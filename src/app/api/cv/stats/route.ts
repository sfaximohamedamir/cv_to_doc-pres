/**
 * Route API : statistiques agrégées sur les CV traités.
 *
 * GET /api/cv/stats
 *
 * Renvoie :
 *  - total          : nombre total de CV traités
 *  - done           : nombre de CV traités avec succès
 *  - errors         : nombre de CV en erreur
 *  - averageScore   : score moyen des CV réussis (0-100)
 *  - bestScore      : meilleur score (0-100)
 *  - worstScore     : pire score (0-100)
 *  - wordCount      : nombre de documents Word générés
 *  - pptxCount      : nombre de présentations PowerPoint générées
 *  - pdfCount       : nombre de sources PDF
 *  - imageCount     : nombre de sources image
 *  - averageDuration: durée moyenne de traitement en ms
 *  - scoreDistribution : répartition des scores par paliers
 *  - last7Days      : nombre de CV traités par jour sur 7 jours
 *  - successRate    : taux de succès en %
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const records = await db.cvRecord.findMany({
      select: {
        status: true,
        score: true,
        outputFormat: true,
        sourceType: true,
        durationMs: true,
        createdAt: true,
        originalName: true,
      },
    })

    const total = records.length
    const done = records.filter((r) => r.status === 'done')
    const errors = records.filter((r) => r.status === 'error').length

    const scores = done
      .map((r) => r.score)
      .filter((s): s is number => s !== null)

    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0
    const worstScore = scores.length > 0 ? Math.min(...scores) : 0

    const wordCount = records.filter((r) => r.outputFormat === 'word').length
    const pptxCount = records.filter((r) => r.outputFormat === 'powerpoint').length
    const pdfCount = records.filter((r) => r.sourceType === 'application/pdf').length
    const imageCount = records.filter((r) => r.sourceType !== 'application/pdf').length

    const durations = done
      .map((r) => r.durationMs)
      .filter((d): d is number => d !== null)
    const averageDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0

    // Répartition des scores par paliers
    const scoreDistribution = [
      { range: '0-39', label: 'Insuffisant', count: 0, color: '#dc2626' },
      { range: '40-54', label: 'À améliorer', count: 0, color: '#f97316' },
      { range: '55-69', label: 'Correct', count: 0, color: '#f59e0b' },
      { range: '70-84', label: 'Très bon', count: 0, color: '#10b981' },
      { range: '85-100', label: 'Excellent', count: 0, color: '#16a34a' },
    ]
    for (const s of scores) {
      if (s < 40) scoreDistribution[0].count++
      else if (s < 55) scoreDistribution[1].count++
      else if (s < 70) scoreDistribution[2].count++
      else if (s < 85) scoreDistribution[3].count++
      else scoreDistribution[4].count++
    }

    // Activité des 7 derniers jours
    const last7Days: { date: string; label: string; count: number }[] = []
    const now = new Date()
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const nextD = new Date(d)
      nextD.setDate(nextD.getDate() + 1)
      const count = records.filter((r) => {
        const cd = new Date(r.createdAt)
        return cd >= d && cd < nextD
      }).length
      last7Days.push({
        date: d.toISOString().split('T')[0],
        label: dayNames[d.getDay()],
        count,
      })
    }

    // Évolution des scores dans le temps (série chronologique)
    // On récupère tous les CV réussis avec un score, triés par date croissante.
    const scoreEvolution = done
      .filter((r) => r.score !== null)
      .map((r) => ({
        date: r.createdAt.toISOString(),
        score: r.score as number,
        name: r.originalName,
        format: r.outputFormat,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item, i) => ({
        ...item,
        index: i + 1,
        // Score moyen cumulé à ce point
        cumulativeAvg: Math.round(
          done
            .filter((r) => r.score !== null)
            .map((r) => r.score as number)
            .sort((a, b) => a - b)
            .slice(0, i + 1)
            .reduce((sum, s) => sum + s, 0) / (i + 1)
        ),
      }))

    // Statistiques par format (score moyen par format de sortie)
    const formatStats = ['word', 'powerpoint'].map((fmt) => {
      const formatRecords = done.filter((r) => r.outputFormat === fmt && r.score !== null)
      const formatScores = formatRecords.map((r) => r.score as number)
      return {
        format: fmt,
        count: formatRecords.length,
        averageScore:
          formatScores.length > 0
            ? Math.round(formatScores.reduce((a, b) => a + b, 0) / formatScores.length)
            : 0,
      }
    })

    return NextResponse.json({
      total,
      done: done.length,
      errors,
      averageScore,
      bestScore,
      worstScore,
      wordCount,
      pptxCount,
      pdfCount,
      imageCount,
      averageDuration,
      scoreDistribution,
      last7Days,
      scoreEvolution,
      formatStats,
      successRate: total > 0 ? Math.round((done.length / total) * 100) : 0,
    })
  } catch (error) {
    console.error('[/api/cv/stats] Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors du calcul des statistiques.' },
      { status: 500 }
    )
  }
}
