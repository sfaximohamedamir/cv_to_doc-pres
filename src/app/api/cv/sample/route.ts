/**
 * Route API : génère un CV d'exemple (sample) pour tester l'interface
 * SANS avoir besoin de la clé API NVIDIA.
 *
 * GET /api/cv/sample
 *   ?type=full|junior|senior   (défaut : full)
 *
 * Renvoie un objet ParsedCv réaliste qui peut être affiché dans l'interface
 * via le panneau de résultats (mode "démo").
 *
 * POST /api/cv/sample?format=word|powerpoint
 *   Génère également le document Word/PowerPoint correspondant au CV d'exemple
 *   et renvoie l'URL de téléchargement.
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { db } from '@/lib/db'
import { generateWordCv, getWordFileName } from '@/lib/converters/word-converter'
import {
  generatePowerPointCv,
  getPowerPointFileName,
} from '@/lib/converters/powerpoint-converter'
import { scoreCv } from '@/lib/cv/scoring'
import { isNvidiaConfigured } from '@/lib/nvidia/client'
import type { ParsedCv, CvScore, OutputFormat, CvProcessingResult } from '@/lib/cv/types'
import type { CvTemplateId } from '@/lib/cv/templates'
import { SAMPLE_CVS } from '@/lib/cv/samples'

export const runtime = 'nodejs'
export const maxDuration = 120

const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

async function ensureDownloadDir() {
  try {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true })
  } catch {
    /* exists */
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = (searchParams.get('type') || 'full') as keyof typeof SAMPLE_CVS
  const generateDoc = searchParams.get('generate') === 'true'
  const format = (searchParams.get('format') || 'word') as OutputFormat
  const templateId = (searchParams.get('template') as string) || undefined

  const sample = SAMPLE_CVS[type] || SAMPLE_CVS.full

  // Si on demande juste le CV structuré (sans génération de document)
  if (!generateDoc) {
    return NextResponse.json({
      parsedCv: sample,
      type,
      availableTypes: Object.keys(SAMPLE_CVS),
    })
  }

  // Génération du document demandé
  const startTime = Date.now()
  try {
    await ensureDownloadDir()

    let generatedBuffer: Buffer
    let outputFileName: string
    const fullName = sample.personalInfo.fullName || 'Candidat Exemple'

    if (format === 'powerpoint') {
      generatedBuffer = await generatePowerPointCv({ parsedCv: sample, templateId: templateId as CvTemplateId })
      outputFileName = getPowerPointFileName(fullName)
    } else {
      generatedBuffer = await generateWordCv({ parsedCv: sample, templateId: templateId as CvTemplateId })
      outputFileName = getWordFileName(fullName)
    }

    // Sauvegarder en base
    const record = await db.cvRecord.create({
      data: {
        originalName: `sample-${type}.cv`,
        sourceType: 'sample',
        outputFormat: format,
        outputName: outputFileName,
        status: 'done',
        structuredData: JSON.stringify(sample),
        language: sample.detectedLanguage || 'fr',
        extractionModel: 'sample (no AI)',
        scoringModel: isNvidiaConfigured() ? 'pending' : 'sample (no AI)',
        fileSize: 0,
        filePath: '',
        durationMs: 0,
      },
    })

    const uniqueName = `${record.id}_${outputFileName}`
    await fs.writeFile(path.join(DOWNLOAD_DIR, uniqueName), generatedBuffer)

    await db.cvRecord.update({
      where: { id: record.id },
      data: { filePath: uniqueName, durationMs: Date.now() - startTime },
    })

    // Scoring : si NVIDIA est configuré, on calcule un vrai score ; sinon un score de démo
    let score: CvScore
    let scoringModel: string
    if (isNvidiaConfigured()) {
      try {
        const result = await scoreCv({ parsedCv: sample, language: 'français' })
        score = result.score
        scoringModel = result.modelUsed
      } catch {
        score = SAMPLE_SCORES[type] || SAMPLE_SCORES.full
        scoringModel = 'sample (fallback)'
      }
    } else {
      score = SAMPLE_SCORES[type] || SAMPLE_SCORES.full
      scoringModel = 'sample (no AI)'
    }

    await db.cvRecord.update({
      where: { id: record.id },
      data: {
        score: score.overallScore,
        scoreDetails: JSON.stringify(score),
        scoringModel,
        durationMs: Date.now() - startTime,
      },
    })

    const result: CvProcessingResult = {
      id: record.id,
      status: 'done',
      parsedCv: sample,
      score,
      outputFormat: format,
      downloadUrl: `/api/download?file=${encodeURIComponent(uniqueName)}`,
      outputFileName,
      extractedText: `[CV d'exemple — ${type}]`,
      durationMs: Date.now() - startTime,
      extractionModel: 'sample (no AI)',
      scoringModel,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[/api/cv/sample] Erreur :', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue.' },
      { status: 500 }
    )
  }
}

/// Scores de démonstration (utilisés quand NVIDIA n'est pas configuré)
const SAMPLE_SCORES: Record<string, CvScore> = {
  full: {
    overallScore: 82,
    categories: [
      { name: 'Clarté et structure', score: 85, comment: 'Structure claire et bien organisée avec des sections bien délimitées.' },
      { name: 'Impact et réalisations', score: 78, comment: 'Bonnes réalisations chiffrées, mais pourraient être plus détaillées.' },
      { name: 'Compétences', score: 88, comment: 'Excellent éventail de compétences techniques et linguistiques.' },
      { name: 'Expérience professionnelle', score: 80, comment: 'Parcours solide avec une progression visible.' },
      { name: 'Formation', score: 85, comment: 'Formation pertinente et bien alignée avec le poste visé.' },
      { name: 'Présentation et orthographe', score: 84, comment: 'Présentation soignée, orthographe correcte.' },
      { name: 'Adéquation au marché', score: 76, comment: 'Profil recherché mais quelques compétences clés manquantes.' },
    ],
    strengths: [
      'Compétences techniques variées et modernes',
      'Expérience internationale significative',
      'Formation académique solide',
      'Multilingue (français, anglais, espagnol)',
    ],
    improvements: [
      'Ajouter plus de métriques quantifiées dans les expériences',
      'Mettre en avant des projets open source',
      'Préciser les certifications récentes',
    ],
    recommendation:
      'CV solide et professionnel. Quelques ajustements sur la quantification des résultats permettraient de viser des postes senior.',
    seniorityLevel: 'Confirmé (5-8 ans)',
  },
  junior: {
    overallScore: 68,
    categories: [
      { name: 'Clarté et structure', score: 72, comment: 'Structure correcte mais quelques sections pourraient être mieux organisées.' },
      { name: 'Impact et réalisations', score: 55, comment: 'Manque de réalisations chiffrées.' },
      { name: 'Compétences', score: 75, comment: 'Bonnes compétences de base pour un profil junior.' },
      { name: 'Expérience professionnelle', score: 60, comment: 'Expérience limitée mais stages pertinents.' },
      { name: 'Formation', score: 85, comment: 'Excellente formation académique.' },
      { name: 'Présentation et orthographe', score: 70, comment: 'Présentation correcte.' },
      { name: 'Adéquation au marché', score: 65, comment: 'Profil correct pour un premier emploi.' },
    ],
    strengths: [
      'Formation académique récente et pertinente',
      'Stages en entreprise',
      'Projets personnels montrant la motivation',
    ],
    improvements: [
      'Quantifier les réalisations des stages',
      'Ajouter un projet open source',
      'Détailler les compétences techniques avec des niveaux',
      'Mettre en avant les soft skills',
    ],
    recommendation:
      'CV prometteur pour un profil junior. Focus sur la quantification des expériences et la mise en valeur des projets personnels.',
    seniorityLevel: 'Junior (0-3 ans)',
  },
  senior: {
    overallScore: 91,
    categories: [
      { name: 'Clarté et structure', score: 95, comment: 'Structure impeccable, lecture fluide.' },
      { name: 'Impact et réalisations', score: 92, comment: 'Excellentes réalisations chiffrées avec impact business.' },
      { name: 'Compétences', score: 93, comment: 'Compétences techniques de haut niveau et leadership.' },
      { name: 'Expérience professionnelle', score: 95, comment: 'Parcours exceptionnel avec progression claire vers des rôles de direction.' },
      { name: 'Formation', score: 85, comment: 'Formation solide complétée par des certifications.' },
      { name: 'Présentation et orthographe', score: 90, comment: 'Présentation soignée et professionnelle.' },
      { name: 'Adéquation au marché', score: 88, comment: 'Profil très recherché sur le marché actuel.' },
    ],
    strengths: [
      'Parcours de leadership démontré',
      'Impact business mesurable et chiffré',
      'Expertise technique pointue',
      'Mentorat et gestion d\'équipes',
      'Vision stratégique',
    ],
    improvements: [
      'Pourrait mentionner des publications ou conférences',
      'Ajouter des recommandations de pairs',
    ],
    recommendation:
      'CV d\'exception pour un profil senior. Prêt pour des postes de direction technique ou de C-level.',
    seniorityLevel: 'Senior (10+ ans)',
  },
}
