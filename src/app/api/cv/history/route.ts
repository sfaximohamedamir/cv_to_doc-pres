/**
 * Route API : historique des CV traités.
 *
 * GET /api/cv/history
 *   Renvoie la liste des CV traités, du plus récent au plus ancien.
 *   Paramètres de requête optionnels :
 *     - limit  : nombre maximum de résultats (défaut 50, max 200)
 *     - status : filtrer par statut (done, error, ...)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const status = searchParams.get('status') || undefined

  let limit = 50
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 200)
    }
  }

  const records = await db.cvRecord.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      originalName: true,
      sourceType: true,
      outputFormat: true,
      outputName: true,
      status: true,
      score: true,
      language: true,
      extractionModel: true,
      scoringModel: true,
      durationMs: true,
      fileSize: true,
      errorMessage: true,
      filePath: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  // Ne pas renvoyer le filePath brut au client ; on construit une URL de téléchargement.
  const items = records.map((r) => ({
    ...r,
    downloadUrl: r.filePath
      ? `/api/download?file=${encodeURIComponent(r.filePath)}`
      : null,
    filePath: undefined,
  }))

  return NextResponse.json({ items, count: items.length })
}
