/**
 * Route API principale : traitement complet d'un CV.
 *
 * POST /api/cv/process
 *
 * Reçoit un fichier (PDF ou image) + un format de sortie (word | powerpoint),
 * puis exécute le pipeline complet :
 *   1. Extraction du contenu du CV (modèle NVIDIA)
 *   2. Conversion au format demandé (Word ou PowerPoint)
 *   3. Scoring du CV (modèle NVIDIA)
 *   4. Sauvegarde en base de données + fichier généré
 *
 * Renvoie un objet `CvProcessingResult` contenant le CV structuré, le score,
 * et l'URL de téléchargement du fichier généré.
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { db } from '@/lib/db'
import { extractCvFromBuffer } from '@/lib/parsers/cv-extractor'
import { isSupportedImage } from '@/lib/parsers/image-parser'
import { scoreCv } from '@/lib/cv/scoring'
import { generateWordCv, getWordFileName } from '@/lib/converters/word-converter'
import {
  generatePowerPointCv,
  getPowerPointFileName,
} from '@/lib/converters/powerpoint-converter'
import {
  fillCustomDocxSkeleton,
  fillCustomPptxSkeleton,
} from '@/lib/converters/custom-skeleton-engine'
import { isNvidiaConfiguredAsync } from '@/lib/nvidia/client'
import type {
  CvProcessingResult,
  OutputFormat,
  ParsedCv,
  CvScore,
} from '@/lib/cv/types'
import type { CvTemplateId } from '@/lib/cv/templates'

/// Taille maximale du fichier téléversé : 10 Mo.
const MAX_FILE_SIZE = 10 * 1024 * 1024

/// Dossier où les fichiers générés sont stockés.
const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

/**
 * Normalise un type MIME déclaré par le client en un type fiable.
 * On se base sur l'extension du fichier en cas de doute.
 */
function resolveMimeType(fileName: string, declaredMime: string): string {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === '.pdf' || declaredMime === 'application/pdf') return 'application/pdf'
  if (ext === '.png' || declaredMime === 'image/png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg' || declaredMime === 'image/jpeg' || declaredMime === 'image/jpg')
    return 'image/jpeg'
  if (ext === '.webp' || declaredMime === 'image/webp') return 'image/webp'
  if (ext === '.gif' || declaredMime === 'image/gif') return 'image/gif'
  return declaredMime
}

/**
 * Valide que le type MIME est supporté par l'agent.
 */
function isAcceptedMime(mime: string): boolean {
  return mime === 'application/pdf' || isSupportedImage(mime)
}

/**
 * S'assure que le dossier de téléchargement existe.
 */
async function ensureDownloadDir(): Promise<void> {
  try {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true })
  } catch {
    // Le dossier existe probablement déjà.
  }
}

/**
 * Écrit le buffer généré sur le disque et renvoie le nom du fichier.
 */
async function saveGeneratedFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  await ensureDownloadDir()
  const filePath = path.join(DOWNLOAD_DIR, fileName)
  await fs.writeFile(filePath, buffer)
  return fileName
}

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // 0. Vérifier que la clé API NVIDIA est configurée (env ou base de données).
  if (!(await isNvidiaConfiguredAsync())) {
    return NextResponse.json(
      {
        error:
          "La clé API NVIDIA n'est pas configurée. Ajoutez-la dans les paramètres de l'application (bouton ⚙️) ou définissez NVIDIA_API_KEY dans .env.local.",
        code: 'NVIDIA_NOT_CONFIGURED',
      },
      { status: 503 }
    )
  }

  // 1. Lire le formulaire multipart.
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide (multipart/form-data attendu).' },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  const outputFormatRaw = formData.get('outputFormat')
  const language = (formData.get('language') as string) || undefined
  const templateId = (formData.get('template') as string) || undefined
  const requestedModel = (formData.get('extractionModel') as string) || (formData.get('model') as string) || undefined
  const customSkeletonFile = formData.get('customSkeleton')
  let customSkeletonBuffer: Buffer | null = null
  if (customSkeletonFile && customSkeletonFile instanceof File && customSkeletonFile.size > 0) {
    const arrayBuf = await customSkeletonFile.arrayBuffer()
    customSkeletonBuffer = Buffer.from(arrayBuf)
  }

  // 2. Valider le fichier.
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Aucun fichier fourni (champ 'file' requis)." },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `Le fichier dépasse la taille maximale autorisée (${MAX_FILE_SIZE / 1024 / 1024} Mo).`,
      },
      { status: 413 }
    )
  }

  // 3. Valider le format de sortie.
  const outputFormat: OutputFormat =
    outputFormatRaw === 'powerpoint' ? 'powerpoint' : 'word'

  // 4. Résoudre et valider le type MIME.
  const mimeType = resolveMimeType(file.name, file.type)
  if (!isAcceptedMime(mimeType)) {
    return NextResponse.json(
      {
        error: `Type de fichier non supporté : ${mimeType}. Formats acceptés : PDF, PNG, JPEG, WebP, GIF.`,
      },
      { status: 415 }
    )
  }

  // 5. Créer l'enregistrement en base (statut pending).
  const record = await db.cvRecord.create({
    data: {
      originalName: file.name,
      sourceType: mimeType,
      outputFormat,
      status: 'extracting',
      fileSize: file.size,
      language: language || null,
    },
  })

  try {
    // 6. Lire le buffer du fichier.
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 7. Étape 1 — Extraction du CV.
    await db.cvRecord.update({
      where: { id: record.id },
      data: { status: 'extracting' },
    })

    const extraction = await extractCvFromBuffer({
      buffer,
      fileName: file.name,
      mimeType,
      language,
      requestedModel,
    })

    const parsedCv: ParsedCv = extraction.parsedCv

    await db.cvRecord.update({
      where: { id: record.id },
      data: {
        extractedText: extraction.rawText,
        structuredData: JSON.stringify(parsedCv),
        extractionModel: extraction.modelUsed,
        language: parsedCv.detectedLanguage || language || null,
        status: 'converting',
      },
    })

    // 8. Étape 2 — Conversion au format demandé.
    let generatedBuffer: Buffer
    let outputFileName: string
    const fullName = parsedCv.personalInfo.fullName || 'candidat'

    if (customSkeletonBuffer) {
      if (outputFormat === 'word') {
        generatedBuffer = await fillCustomDocxSkeleton({
          skeletonBuffer: customSkeletonBuffer,
          parsedCv,
        })
        outputFileName = getWordFileName(fullName)
      } else {
        generatedBuffer = await fillCustomPptxSkeleton({
          skeletonBuffer: customSkeletonBuffer,
          parsedCv,
        })
        outputFileName = getPowerPointFileName(fullName)
      }
    } else {
      if (outputFormat === 'word') {
        generatedBuffer = await generateWordCv({ parsedCv, templateId: templateId as CvTemplateId })
        outputFileName = getWordFileName(fullName)
      } else {
        generatedBuffer = await generatePowerPointCv({ parsedCv, templateId: templateId as CvTemplateId })
        outputFileName = getPowerPointFileName(fullName)
      }
    }

    // Éviter les collisions de noms en préfixant avec l'ID.
    const uniqueName = `${record.id}_${outputFileName}`
    await saveGeneratedFile(generatedBuffer, uniqueName)

    const skipScoringRaw = formData.get('skipScoring')
    const skipScoring = skipScoringRaw === 'true' || skipScoringRaw === '1'

    let score: CvScore | null = null
    let scoringModel: string | null = null

    if (!skipScoring) {
      // 9. Étape 3 — Scoring du CV.
      const scoringResult = await scoreCv({ parsedCv, language })
      score = scoringResult.score
      scoringModel = scoringResult.modelUsed

      await db.cvRecord.update({
        where: { id: record.id },
        data: {
          filePath: uniqueName,
          outputName: outputFileName,
          score: score.overallScore,
          scoreDetails: JSON.stringify(score),
          scoringModel,
          status: 'done',
          durationMs: Date.now() - startTime,
        },
      })
    } else {
      await db.cvRecord.update({
        where: { id: record.id },
        data: {
          filePath: uniqueName,
          outputName: outputFileName,
          status: 'converted',
          durationMs: Date.now() - startTime,
        },
      })
    }

    // 10. Construire la réponse.
    const result: CvProcessingResult = {
      id: record.id,
      status: skipScoring ? 'converted' : 'done',
      parsedCv,
      score: score as any,
      outputFormat,
      downloadUrl: `/api/download?file=${encodeURIComponent(uniqueName)}`,
      outputFileName,
      extractedText: extraction.rawText,
      durationMs: Date.now() - startTime,
      extractionModel: extraction.modelUsed,
      scoringModel: scoringModel || '',
    }

    return NextResponse.json(result)
  } catch (error) {
    // Marquer l'enregistrement comme étant en erreur.
    const errorMessage =
      error instanceof Error ? error.message : 'Erreur inconnue lors du traitement.'

    await db.cvRecord.update({
      where: { id: record.id },
      data: {
        status: 'error',
        errorMessage,
        durationMs: Date.now() - startTime,
      },
    })

    console.error('[/api/cv/process] Erreur :', error)
    return NextResponse.json(
      {
        error: errorMessage,
        id: record.id,
        code: 'PROCESSING_ERROR',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cv/process — renvoie un court résumé d'utilisation.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/cv/process',
    description:
      "Traite un CV (PDF ou image) : extraction, conversion Word/PowerPoint, scoring.",
    acceptedFormats: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    acceptedOutputFormats: ['word', 'powerpoint'],
    maxSize: `${MAX_FILE_SIZE / 1024 / 1024} Mo`,
    fields: {
      file: 'Fichier du CV (requis)',
      outputFormat: "'word' ou 'powerpoint' (défaut : word)",
      language: 'Langue souhaitée, ex: "français" (optionnel)',
      template: "Template visuel : 'modern' | 'classic' | 'creative' | 'minimal' (défaut : modern)",
    },
  })
}
