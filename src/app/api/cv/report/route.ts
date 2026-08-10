/**
 * Route API : génère un rapport d'audit de CV au format HTML imprimable.
 *
 * GET /api/cv/report?id=<cvId>
 *
 * Renvoie une page HTML autonome (avec styles inline) prête à être imprimée
 * en PDF via Ctrl+P (ou Cmd+P sur macOS). Le rapport contient :
 *  - En-tête avec le nom du candidat et la date
 *  - Score global + niveau de séniorité
 *  - Graphique radar (rendu en SVG inline)
 *  - Détail par catégorie avec barres de progression
 *  - Points forts et axes d'amélioration
 *  - Recommandation générale
 *  - Aperçu structuré du CV (expérience, formation, compétences)
 *
 * Cette approche légère (HTML + print CSS) évite d'installer une dépendance
 * lourde comme Puppeteer ou jsPDF, tout en offrant un rendu professionnel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ParsedCv, CvScore } from '@/lib/cv/types'
import { getScoreLabel } from '@/lib/cv/scoring'

export const runtime = 'nodejs'

/// Fonction d'échappement HTML pour éviter les injections.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/// Raccourcit le nom d'une catégorie pour l'affichage du radar.
function shortenCategoryName(name: string): string {
  const map: Record<string, string> = {
    'Clarté et structure': 'Clarté',
    'Impact et réalisations': 'Impact',
    'Expérience professionnelle': 'Expérience',
    'Présentation et orthographe': 'Présentation',
    'Adéquation au marché': 'Marché',
  }
  return map[name] || name
}

/// Génère les points du polygone radar en SVG.
function generateRadarPoints(
  categories: Array<{ score: number }>,
  centerX: number,
  centerY: number,
  radius: number
): string {
  const n = categories.length
  return categories
    .map((cat, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const r = (cat.score / 100) * radius
      const x = centerX + r * Math.cos(angle)
      const y = centerY + r * Math.sin(angle)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/// Génère le HTML complet du rapport.
function buildReportHtml(params: {
  cv: ParsedCv
  score: CvScore
  recordId: string
  originalName: string
  processedAt: string
  durationMs: number | null
  extractionModel: string | null
  scoringModel: string | null
}): string {
  const { cv, score, recordId, originalName, processedAt, durationMs, extractionModel, scoringModel } = params
  const fullName = cv.personalInfo.fullName || 'Candidat'
  const label = getScoreLabel(score.overallScore)
  const dateStr = new Date(processedAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Configuration du radar
  const radarSize = 280
  const radarCenter = radarSize / 2
  const radarRadius = 100
  const radarPoints = generateRadarPoints(
    score.categories,
    radarCenter,
    radarCenter,
    radarRadius
  )

  // Points de la grille (polygones réguliers à 25%, 50%, 75%, 100%)
  const gridLevels = [25, 50, 75, 100]
  const gridPolygons = gridLevels
    .map((level) => {
      const pts = score.categories
        .map((_, i) => {
          const angle = (Math.PI * 2 * i) / score.categories.length - Math.PI / 2
          const r = (level / 100) * radarRadius
          const x = radarCenter + r * Math.cos(angle)
          const y = radarCenter + r * Math.sin(angle)
          return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
      return `<polygon points="${pts}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`
    })
    .join('')

  // Lignes radiales
  const radialLines = score.categories
    .map((_, i) => {
      const angle = (Math.PI * 2 * i) / score.categories.length - Math.PI / 2
      const x = radarCenter + radarRadius * Math.cos(angle)
      const y = radarCenter + radarRadius * Math.sin(angle)
      return `<line x1="${radarCenter}" y1="${radarCenter}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>`
    })
    .join('')

  // Labels des axes
  const axisLabels = score.categories
    .map((cat, i) => {
      const angle = (Math.PI * 2 * i) / score.categories.length - Math.PI / 2
      const labelR = radarRadius + 18
      const x = radarCenter + labelR * Math.cos(angle)
      const y = radarCenter + labelR * Math.sin(angle)
      const shortName = shortenCategoryName(cat.name)
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="500" fill="#374151">${escapeHtml(shortName)}</text>`
    })
    .join('')

  // Barres de catégories
  const categoryBars = score.categories
    .map((cat) => {
      const barColor =
        cat.score >= 85 ? '#16a34a' : cat.score >= 70 ? '#10b981' : cat.score >= 55 ? '#f59e0b' : cat.score >= 40 ? '#f97316' : '#dc2626'
      return `
        <div class="cat-item">
          <div class="cat-header">
            <span class="cat-name">${escapeHtml(cat.name)}</span>
            <span class="cat-score">${cat.score}/100</span>
          </div>
          <div class="cat-bar-bg">
            <div class="cat-bar-fill" style="width: ${cat.score}%; background: ${barColor};"></div>
          </div>
          <p class="cat-comment">${escapeHtml(cat.comment)}</p>
        </div>
      `
    })
    .join('')

  // Points forts
  const strengthsList = score.strengths
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('')

  // Axes d'amélioration
  const improvementsList = score.improvements
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('')

  // Expériences
  const experienceList = (cv.workExperience || [])
    .map(
      (exp) => `
      <div class="exp-item">
        <div class="exp-header">
          <strong>${escapeHtml(exp.title)}</strong>
          ${exp.company ? `<span class="exp-company">${escapeHtml(exp.company)}</span>` : ''}
          <span class="exp-dates">${escapeHtml([exp.startDate, exp.endDate].filter(Boolean).join(' — '))}</span>
        </div>
        ${exp.description ? `<p class="exp-desc">${escapeHtml(exp.description)}</p>` : ''}
      </div>
    `
    )
    .join('')

  // Formation
  const educationList = (cv.education || [])
    .map(
      (edu) => `
      <div class="edu-item">
        <strong>${escapeHtml(edu.degree)}</strong>
        ${edu.institution ? `<span class="edu-inst"> — ${escapeHtml(edu.institution)}</span>` : ''}
        <span class="edu-dates">${escapeHtml([edu.startDate, edu.endDate].filter(Boolean).join(' — '))}</span>
      </div>
    `
    )
    .join('')

  // Compétences
  const skillsList = (cv.skills || [])
    .map((s) => `<span class="skill-badge">${escapeHtml(s.name)}${s.level ? ` <em>· ${escapeHtml(s.level)}</em>` : ''}</span>`)
    .join('')

  // Langues
  const languagesList = (cv.languages || [])
    .map((l) => `<span class="lang-badge">${escapeHtml(l.name)}${l.level ? ` <em>· ${escapeHtml(l.level)}</em>` : ''}</span>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport d'audit CV — ${escapeHtml(fullName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      background: #f3f4f6;
      line-height: 1.6;
      padding: 24px;
    }
    .report {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981, #0d9488);
      color: white;
      padding: 32px;
    }
    .header h1 { font-size: 24px; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.9; }
    .header .meta { font-size: 12px; opacity: 0.8; margin-top: 12px; }
    .section { padding: 24px 32px; border-bottom: 1px solid #e5e7eb; }
    .section:last-child { border-bottom: none; }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #10b981;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: #10b981;
      border-radius: 2px;
    }
    .score-section { display: flex; gap: 32px; align-items: center; flex-wrap: wrap; }
    .score-global { text-align: center; flex-shrink: 0; }
    .score-number {
      font-size: 56px;
      font-weight: 800;
      color: ${label.color};
      line-height: 1;
    }
    .score-label { font-size: 14px; font-weight: 600; color: ${label.color}; margin-top: 4px; }
    .score-max { font-size: 12px; color: #6b7280; }
    .score-info { flex: 1; min-width: 200px; }
    .score-info .level-badge {
      display: inline-block;
      background: #f3f4f6;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .score-info .recommendation { font-size: 13px; color: #374151; }
    .radar-container { display: flex; justify-content: center; margin: 16px 0; }
    .cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 640px) { .cat-grid { grid-template-columns: 1fr; } }
    .cat-item { }
    .cat-header { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
    .cat-name { font-weight: 600; color: #1f2937; }
    .cat-score { font-weight: 700; color: #1f2937; }
    .cat-bar-bg { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
    .cat-bar-fill { height: 100%; border-radius: 3px; }
    .cat-comment { font-size: 11px; color: #6b7280; margin-top: 4px; line-height: 1.4; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } }
    .col-card { background: #f9fafb; border-radius: 8px; padding: 16px; }
    .col-card h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    .col-card.strengths h3 { color: #059669; }
    .col-card.improvements h3 { color: #d97706; }
    .col-card ul { list-style: none; padding: 0; }
    .col-card li { font-size: 12px; color: #374151; padding: 3px 0 3px 16px; position: relative; }
    .col-card.strengths li::before { content: '✓'; position: absolute; left: 0; color: #10b981; font-weight: bold; }
    .col-card.improvements li::before { content: '→'; position: absolute; left: 0; color: #f59e0b; font-weight: bold; }
    .exp-item, .edu-item { margin-bottom: 12px; font-size: 12px; }
    .exp-header { display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }
    .exp-company { color: #6b7280; }
    .exp-dates { margin-left: auto; color: #6b7280; font-size: 11px; }
    .exp-desc { color: #4b5563; margin-top: 2px; white-space: pre-line; }
    .edu-item { padding: 4px 0; }
    .edu-inst { color: #6b7280; }
    .edu-dates { color: #6b7280; font-size: 11px; margin-left: 8px; }
    .skill-badge, .lang-badge {
      display: inline-block;
      background: #ecfdf5;
      color: #065f46;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      margin: 2px;
    }
    .lang-badge { background: #ecfeff; color: #155e75; }
    .skill-badge em, .lang-badge em { font-style: normal; opacity: 0.7; }
    .footer {
      padding: 16px 32px;
      background: #f9fafb;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
    }
    .no-print { margin-bottom: 16px; text-align: center; }
    .no-print button {
      background: #10b981;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(16,185,129,0.3);
    }
    .no-print button:hover { background: #059669; }
    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none; }
      .report { box-shadow: none; max-width: none; border-radius: 0; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">📄 Imprimer / Enregistrer en PDF</button>
  </div>
  <div class="report">
    <div class="header">
      <h1>Rapport d'audit CV</h1>
      <div class="subtitle">${escapeHtml(fullName)}${cv.personalInfo.title ? ' — ' + escapeHtml(cv.personalInfo.title) : ''}</div>
      <div class="meta">
        Généré le ${dateStr} · CV Transformer Agent (NVIDIA Nemotron)<br>
        Fichier source : ${escapeHtml(originalName)}
        ${durationMs ? ` · Durée du traitement : ${(durationMs / 1000).toFixed(1)}s` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Score global</div>
      <div class="score-section">
        <div class="score-global">
          <div class="score-number">${score.overallScore}</div>
          <div class="score-label">${label.label} ${label.emoji}</div>
          <div class="score-max">/ 100</div>
        </div>
        <div class="score-info">
          <div class="level-badge">Niveau : ${escapeHtml(score.seniorityLevel)}</div>
          <p class="recommendation">${escapeHtml(score.recommendation)}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Analyse par catégorie</div>
      <div class="radar-container">
        <svg width="${radarSize}" height="${radarSize}" viewBox="0 0 ${radarSize} ${radarSize}">
          ${gridPolygons}
          ${radialLines}
          <polygon points="${radarPoints}" fill="rgba(16,185,129,0.25)" stroke="#059669" stroke-width="2"/>
          ${axisLabels}
        </svg>
      </div>
      <div class="cat-grid">
        ${categoryBars}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Recommandations</div>
      <div class="two-col">
        <div class="col-card strengths">
          <h3>✓ Points forts</h3>
          <ul>${strengthsList}</ul>
        </div>
        <div class="col-card improvements">
          <h3>→ Axes d'amélioration</h3>
          <ul>${improvementsList}</ul>
        </div>
      </div>
    </div>

    ${cv.workExperience && cv.workExperience.length > 0 ? `
    <div class="section">
      <div class="section-title">Expérience professionnelle</div>
      ${experienceList}
    </div>` : ''}

    ${cv.education && cv.education.length > 0 ? `
    <div class="section">
      <div class="section-title">Formation</div>
      ${educationList}
    </div>` : ''}

    ${cv.skills && cv.skills.length > 0 ? `
    <div class="section">
      <div class="section-title">Compétences</div>
      <div>${skillsList}</div>
    </div>` : ''}

    ${cv.languages && cv.languages.length > 0 ? `
    <div class="section">
      <div class="section-title">Langues</div>
      <div>${languagesList}</div>
    </div>` : ''}

    <div class="footer">
      Rapport généré par CV Transformer Agent — Propulsé par NVIDIA Nemotron · ID : ${escapeHtml(recordId)}
    </div>
  </div>
</body>
</html>`
}

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

  let parsedCv: ParsedCv | null = null
  let score: CvScore | null = null
  try {
    if (record.structuredData) parsedCv = JSON.parse(record.structuredData)
  } catch {
    /* ignore */
  }
  try {
    if (record.scoreDetails) score = JSON.parse(record.scoreDetails)
  } catch {
    /* ignore */
  }

  if (!parsedCv || !score) {
    return NextResponse.json(
      { error: "Données insuffisantes pour générer le rapport (CV ou score manquant)." },
      { status: 422 }
    )
  }

  const html = buildReportHtml({
    cv: parsedCv,
    score,
    recordId: record.id,
    originalName: record.originalName,
    processedAt: record.createdAt.toISOString(),
    durationMs: record.durationMs,
    extractionModel: record.extractionModel,
    scoringModel: record.scoringModel,
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  })
}
