/**
 * Route API : export de l'historique des CV au format CSV.
 *
 * GET /api/cv/csv
 *
 * Renvoie un fichier CSV téléchargeable contenant tous les CV traités
 * avec leurs métadonnées et scores. Utile pour analyse externe dans
 * Excel, Google Sheets, ou tout autre outil de données.
 *
 * Colonnes : Date, Fichier, Type source, Format sortie, Statut, Score,
 *            Langue, Modèle extraction, Modèle scoring, Durée (s), Taille (Ko)
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/// Échappe une valeur pour le format CSV (RFC 4180).
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Si la valeur contient une virgule, un guillemet ou un saut de ligne,
  // on l'entoure de guillemets et on double les guillemets internes.
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  try {
    const records = await db.cvRecord.findMany({
      orderBy: { createdAt: 'desc' },
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
        createdAt: true,
      },
    })

    const headers = [
      'Date',
      'Fichier source',
      'Type source',
      'Format sortie',
      'Nom fichier généré',
      'Statut',
      'Score',
      'Langue',
      'Modèle extraction',
      'Modèle scoring',
      'Durée (s)',
      'Taille (Ko)',
      'Erreur',
    ]

    const rows = records.map((r) => [
      r.createdAt.toISOString(),
      r.originalName,
      r.sourceType,
      r.outputFormat,
      r.outputName || '',
      r.status,
      r.score !== null ? r.score : '',
      r.language || '',
      r.extractionModel || '',
      r.scoringModel || '',
      r.durationMs !== null ? (r.durationMs / 1000).toFixed(2) : '',
      r.fileSize > 0 ? (r.fileSize / 1024).toFixed(1) : '',
      r.errorMessage || '',
    ])

    // BOM UTF-8 pour qu'Excel reconnaisse l'encodage correctement
    const bom = '\uFEFF'
    const csv =
      bom +
      headers.map(escapeCsv).join(',') +
      '\n' +
      rows.map((row) => row.map(escapeCsv).join(',')).join('\n')

    const buffer = Buffer.from(csv, 'utf-8')
    const fileName = `cv-history-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('[/api/cv/csv] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du CSV.' },
      { status: 500 }
    )
  }
}
