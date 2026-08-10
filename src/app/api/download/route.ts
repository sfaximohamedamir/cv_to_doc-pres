/**
 * Route API : téléchargement d'un fichier généré.
 *
 * GET /api/download?file=<nom-du-fichier>
 *
 * Sert le fichier Word ou PowerPoint depuis le dossier /download.
 * Le nom de fichier doit correspondre à un fichier réellement généré
 * par le pipeline (préfixé par l'ID du CvRecord).
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'

export const runtime = 'nodejs'

const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

/**
 * Détermine le type MIME et l'extension à partir du nom de fichier.
 */
function getFileInfo(fileName: string): { mime: string; ext: string } {
  const ext = path.extname(fileName).toLowerCase()
  switch (ext) {
    case '.docx':
      return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext }
    case '.pptx':
      return { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext }
    default:
      return { mime: 'application/octet-stream', ext }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const file = searchParams.get('file')

  if (!file) {
    return NextResponse.json({ error: "Paramètre 'file' requis." }, { status: 400 })
  }

  // Sécurité : empêcher la traversée de répertoire.
  const resolved = path.resolve(DOWNLOAD_DIR, file)
  if (!resolved.startsWith(DOWNLOAD_DIR + path.sep) && resolved !== path.join(DOWNLOAD_DIR, path.basename(file))) {
    return NextResponse.json({ error: 'Chemin de fichier invalide.' }, { status: 400 })
  }

  const safeName = path.basename(file)
  const fullPath = path.join(DOWNLOAD_DIR, safeName)

  // Vérifier que le fichier existe.
  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(fullPath)
  } catch {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 })
  }

  if (!stat.isFile()) {
    return NextResponse.json({ error: 'Le chemin ne pointe pas vers un fichier.' }, { status: 400 })
  }

  // Lire et renvoyer le fichier.
  const buffer = await fs.readFile(fullPath)
  const { mime } = getFileInfo(safeName)

  // Le nom de fichier affiché : on retire le préfixe d'ID s'il est présent.
  const displayMatch = safeName.match(/^[^_]+_(.+)$/)
  const displayName = displayMatch ? displayMatch[1] : safeName

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': stat.size.toString(),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(displayName)}"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
