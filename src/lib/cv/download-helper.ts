import path from 'path'
import fs from 'fs'

/**
 * Résout l'URL de téléchargement d'un fichier généré, avec fallback sur le disque
 * si `filePath` n'était pas stocké dans la base de données.
 */
export function getDownloadUrl(record: {
  id: string
  filePath?: string | null
  outputName?: string | null
  outputFormat?: string | null
}): string | null {
  if (record.filePath) {
    return `/api/download?file=${encodeURIComponent(record.filePath)}`
  }

  const downloadDir = path.join(process.cwd(), 'download')

  // 1. Chercher si outputName existe avec le préfixe de l'ID
  if (record.outputName) {
    const candidate = `${record.id}_${record.outputName}`
    if (fs.existsSync(path.join(downloadDir, candidate))) {
      return `/api/download?file=${encodeURIComponent(candidate)}`
    }
  }

  // 2. Chercher dans le dossier download tout fichier qui commence par {id}_
  try {
    if (fs.existsSync(downloadDir)) {
      const files = fs.readdirSync(downloadDir)
      const prefix = `${record.id}_`
      const found = files.find((f) => f.startsWith(prefix))
      if (found) {
        return `/api/download?file=${encodeURIComponent(found)}`
      }
    }
  } catch {
    /* ignore read errors */
  }

  return null
}
