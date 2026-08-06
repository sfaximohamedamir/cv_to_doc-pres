/**
 * Route API : scoring seul d'un CV structuré.
 *
 * POST /api/nvidia/score
 *
 * Reçoit un objet `ParsedCv` (JSON) et renvoie le score détaillé (CvScore)
 * sans effectuer d'extraction ni de conversion.
 *
 * Corps de la requête :
 *   { "parsedCv": { ... }, "language"?: "français" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { scoreCv } from '@/lib/cv/scoring'
import { isNvidiaConfigured } from '@/lib/nvidia/client'
import type { ParsedCv } from '@/lib/cv/types'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(request: NextRequest) {
  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      { error: "Clé API NVIDIA non configurée (NVIDIA_API_KEY).", code: 'NVIDIA_NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  let body: { parsedCv?: ParsedCv; language?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  if (!body.parsedCv || !body.parsedCv.personalInfo) {
    return NextResponse.json(
      { error: "Champ 'parsedCv' invalide ou incomplet." },
      { status: 400 }
    )
  }

  const startTime = Date.now()
  try {
    const result = await scoreCv({
      parsedCv: body.parsedCv,
      language: body.language,
    })

    return NextResponse.json({
      score: result.score,
      modelUsed: result.modelUsed,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue.'
    console.error('[/api/nvidia/score] Erreur :', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
