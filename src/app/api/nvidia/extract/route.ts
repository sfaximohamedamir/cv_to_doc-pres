/**
 * Route API : extraction seule d'un CV.
 *
 * POST /api/nvidia/extract
 *
 * Utile pour tester l'étape d'extraction indépendamment du pipeline complet.
 * Reçoit un fichier (PDF ou image) et renvoie le CV structuré (ParsedCv)
 * sans générer de document ni calculer le score.
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { extractCvFromBuffer } from '@/lib/parsers/cv-extractor'
import { isSupportedImage } from '@/lib/parsers/image-parser'
import { isNvidiaConfigured } from '@/lib/nvidia/client'

export const runtime = 'nodejs'
export const maxDuration = 90

const MAX_FILE_SIZE = 10 * 1024 * 1024

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

export async function POST(request: NextRequest) {
  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      { error: "Clé API NVIDIA non configurée (NVIDIA_API_KEY).", code: 'NVIDIA_NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const language = (formData.get('language') as string) || undefined

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Fichier 'file' requis." }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo).' }, { status: 413 })
  }

  const mimeType = resolveMimeType(file.name, file.type)
  if (mimeType !== 'application/pdf' && !isSupportedImage(mimeType)) {
    return NextResponse.json(
      { error: `Type non supporté : ${mimeType}` },
      { status: 415 }
    )
  }

  const startTime = Date.now()
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const extraction = await extractCvFromBuffer({
      buffer,
      fileName: file.name,
      mimeType,
      language,
    })

    return NextResponse.json({
      parsedCv: extraction.parsedCv,
      method: extraction.method,
      modelUsed: extraction.modelUsed,
      rawTextLength: extraction.rawText.length,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue.'
    console.error('[/api/nvidia/extract] Erreur :', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
