/**
 * Route API : recherche full-text dans l'historique des CV.
 *
 * GET /api/cv/search?q=<query>&limit=<n>
 *
 * Cherche dans :
 *  - le nom du fichier original
 *  - le texte extrait (extractedText)
 *  - les données structurées (structuredData : nom, email, entreprise, compétences)
 *
 * Renvoie une liste d'items correspondants, avec un extrait du texte correspondant
 * (snippet) pour mettre en évidence la correspondance.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDownloadUrl } from '@/lib/cv/download-helper'

export const runtime = 'nodejs'

/// Extrait un snippet autour de la première correspondance trouvée.
function extractSnippet(text: string, query: string, contextLength = 60): string {
  if (!text) return ''
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)
  if (idx === -1) return text.slice(0, 120) + (text.length > 120 ? '…' : '')
  const start = Math.max(0, idx - contextLength)
  const end = Math.min(text.length, idx + query.length + contextLength)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

/// Cherche une requête dans les données structurées JSON (nom, email, entreprises, compétences).
function searchInStructuredData(structuredData: string | null, query: string): boolean {
  if (!structuredData) return false
  try {
    const data = JSON.parse(structuredData)
    const lowerQuery = query.toLowerCase()

    // Nom complet
    if (data.personalInfo?.fullName?.toLowerCase().includes(lowerQuery)) return true
    // Email
    if (data.personalInfo?.email?.toLowerCase().includes(lowerQuery)) return true
    // Titre
    if (data.personalInfo?.title?.toLowerCase().includes(lowerQuery)) return true
    // Entreprises
    if (data.workExperience?.some((exp: { company?: string; title?: string }) =>
      exp.company?.toLowerCase().includes(lowerQuery) ||
      exp.title?.toLowerCase().includes(lowerQuery)
    )) return true
    // Compétences
    if (data.skills?.some((skill: { name?: string }) =>
      skill.name?.toLowerCase().includes(lowerQuery)
    )) return true
    // Établissements
    if (data.education?.some((edu: { institution?: string; degree?: string }) =>
      edu.institution?.toLowerCase().includes(lowerQuery) ||
      edu.degree?.toLowerCase().includes(lowerQuery)
    )) return true
    // Langues
    if (data.languages?.some((lang: { name?: string }) =>
      lang.name?.toLowerCase().includes(lowerQuery)
    )) return true
    return false
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') || '').trim()
  const limitParam = searchParams.get('limit')
  let limit = 20
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!Number.isNaN(parsed) && parsed > 0) limit = Math.min(parsed, 100)
  }

  if (!query || query.length < 2) {
    return NextResponse.json({
      items: [],
      count: 0,
      query,
      message: 'La recherche nécessite au moins 2 caractères.',
    })
  }

  try {
    // Récupérer tous les CV (la recherche se fait en mémoire car SQLite ne supporte
    // pas facilement le full-text search sur du JSON).
    const records = await db.cvRecord.findMany({
      where: { status: 'done' },
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
        extractedText: true,
        structuredData: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Limite pour éviter de tout scanner
    })

    const lowerQuery = query.toLowerCase()
    const results = records
      .filter((r) => {
        // Cherche dans le nom du fichier
        if (r.originalName.toLowerCase().includes(lowerQuery)) return true
        // Cherche dans le texte extrait
        if (r.extractedText && r.extractedText.toLowerCase().includes(lowerQuery)) return true
        // Cherche dans les données structurées
        if (searchInStructuredData(r.structuredData, query)) return true
        return false
      })
      .slice(0, limit)
      .map((r) => {
        // Construire le snippet à partir du texte extrait ou des données structurées
        let snippet = ''
        let matchedField = ''
        if (r.extractedText && r.extractedText.toLowerCase().includes(lowerQuery)) {
          snippet = extractSnippet(r.extractedText, query)
          matchedField = 'Texte extrait'
        } else if (searchInStructuredData(r.structuredData, query)) {
          // Extraire un champ pertinent
          try {
            const data = JSON.parse(r.structuredData || '{}')
            if (data.personalInfo?.fullName?.toLowerCase().includes(lowerQuery)) {
              snippet = `Nom : ${data.personalInfo.fullName}`
              matchedField = 'Nom du candidat'
            } else if (data.personalInfo?.email?.toLowerCase().includes(lowerQuery)) {
              snippet = `Email : ${data.personalInfo.email}`
              matchedField = 'Email'
            } else {
              const skills = data.skills?.filter((s: { name?: string }) =>
                s.name?.toLowerCase().includes(lowerQuery)
              )
              if (skills?.length > 0) {
                snippet = `Compétence : ${skills.map((s: { name?: string }) => s.name).join(', ')}`
                matchedField = 'Compétence'
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (!snippet && r.originalName.toLowerCase().includes(lowerQuery)) {
          snippet = `Fichier : ${r.originalName}`
          matchedField = 'Nom de fichier'
        }

        return {
          id: r.id,
          originalName: r.originalName,
          sourceType: r.sourceType,
          outputFormat: r.outputFormat,
          outputName: r.outputName,
          status: r.status,
          score: r.score,
          language: r.language,
          extractionModel: r.extractionModel,
          scoringModel: r.scoringModel,
          durationMs: r.durationMs,
          fileSize: r.fileSize,
          errorMessage: r.errorMessage,
          filePath: undefined,
          downloadUrl: getDownloadUrl(r),
          createdAt: r.createdAt,
          snippet,
          matchedField,
        }
      })

    return NextResponse.json({
      items: results,
      count: results.length,
      query,
    })
  } catch (error) {
    console.error('[/api/cv/search] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recherche.' },
      { status: 500 }
    )
  }
}
