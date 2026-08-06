/**
 * Route API : détail d'un CV traité.
 *
 * GET    /api/cv/history/[id]  — récupère le détail complet d'un CV
 * DELETE /api/cv/history/[id]  — supprime un CV (et son fichier généré)
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const record = await db.cvRecord.findUnique({ where: { id } })
  if (!record) {
    return NextResponse.json({ error: 'CV introuvable.' }, { status: 404 })
  }

  // Reconstruire les objets JSON stockés sous forme de texte.
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

  return NextResponse.json({
    id: record.id,
    originalName: record.originalName,
    sourceType: record.sourceType,
    outputFormat: record.outputFormat,
    outputName: record.outputName,
    status: record.status,
    errorMessage: record.errorMessage,
    extractedText: record.extractedText,
    parsedCv,
    score: record.score,
    scoreDetails,
    language: record.language,
    extractionModel: record.extractionModel,
    scoringModel: record.scoringModel,
    durationMs: record.durationMs,
    fileSize: record.fileSize,
    downloadUrl: record.filePath
      ? `/api/download?file=${encodeURIComponent(record.filePath)}`
      : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const record = await db.cvRecord.findUnique({ where: { id } })
  if (!record) {
    return NextResponse.json({ error: 'CV introuvable.' }, { status: 404 })
  }

  // Supprimer le fichier généré du disque s'il existe.
  if (record.filePath) {
    const fullPath = path.join(DOWNLOAD_DIR, record.filePath)
    try {
      await fs.unlink(fullPath)
    } catch {
      // Le fichier est peut-être déjà supprimé.
    }
  }

  await db.cvRecord.delete({ where: { id } })

  return NextResponse.json({ success: true, id })
}
