/**
 * Route API : exporte les données structurées d'un CV au format JSON.
 *
 * GET /api/cv/export?id=<cvId>
 *
 * Renvoie le fichier JSON en téléchargement direct (Content-Disposition: attachment).
 * Utile pour récupérer les données structurées d'un CV pour un usage externe
 * (import dans un ATS, analyse, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: "Paramètre 'id' requis." }, { status: 400 })
  }

  const record = await db.cvRecord.findUnique({ where: { id } })
  if (!record) {
    return NextResponse.json({ error: 'CV introuvable.' }, { status: 404 })
  }

  let parsedCv = null
  let scoreDetails = null
  try {
    if (record.structuredData) parsedCv = JSON.parse(record.structuredData)
  } catch {
    /* ignore */
  }
  try {
    if (record.scoreDetails) scoreDetails = JSON.parse(record.scoreDetails)
  } catch {
    /* ignore */
  }

  const exportData = {
    meta: {
      id: record.id,
      originalName: record.originalName,
      sourceType: record.sourceType,
      outputFormat: record.outputFormat,
      language: record.language,
      extractionModel: record.extractionModel,
      scoringModel: record.scoringModel,
      durationMs: record.durationMs,
      processedAt: record.createdAt,
      exportedAt: new Date().toISOString(),
      agentVersion: '1.0.0',
    },
    cv: parsedCv,
    score: record.score,
    scoreDetails,
  }

  const json = JSON.stringify(exportData, null, 2)
  const buffer = Buffer.from(json, 'utf-8')

  const fileName = `cv-export-${record.originalName.replace(/\.[^.]+$/, '')}-${record.id.slice(0, 8)}.json`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
