/**
 * Route API : calcul du score pour un CV déjà extrait et généré.
 *
 * POST /api/cv/score-record
 *
 * Corps JSON : { "id": "record_id" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scoreCv } from '@/lib/cv/scoring'
import { isNvidiaConfiguredAsync } from '@/lib/nvidia/client'
import type { CvScore, ParsedCv } from '@/lib/cv/types'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(request: NextRequest) {
  if (!(await isNvidiaConfiguredAsync())) {
    return NextResponse.json(
      { error: "Clé API NVIDIA non configurée. Ajoutez-la dans les paramètres de l'application.", code: 'NVIDIA_NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: "Champ 'id' requis." }, { status: 400 })
  }

  const record = await db.cvRecord.findUnique({ where: { id: body.id } })
  if (!record || !record.structuredData) {
    return NextResponse.json({ error: 'Enregistrement CV introuvable.' }, { status: 404 })
  }

  try {
    const parsedCv: ParsedCv = JSON.parse(record.structuredData)
    const scoringResult = await scoreCv({
      parsedCv,
      language: record.language || undefined,
    })
    const score: CvScore = scoringResult.score

    await db.cvRecord.update({
      where: { id: record.id },
      data: {
        score: score.overallScore,
        scoreDetails: JSON.stringify(score),
        scoringModel: scoringResult.modelUsed,
        status: 'done',
      },
    })

    return NextResponse.json({
      success: true,
      score,
      scoringModel: scoringResult.modelUsed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors du scoring.'
    console.error('[/api/cv/score-record] Erreur :', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
