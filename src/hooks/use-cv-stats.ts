'use client'

/**
 * Hook React pour récupérer les statistiques agrégées des CV traités.
 *
 * Récupère les données depuis l'endpoint `GET /api/cv/stats` au montage
 * du composant, et expose une fonction `refresh` pour recharger manuellement
 * (par exemple après un nouveau traitement de CV).
 *
 * @example
 * ```tsx
 * const { stats, loading, error, refresh } = useCvStats()
 * if (loading) return <Spinner />
 * if (error) return <ErrorMessage message={error} />
 * if (!stats || stats.total === 0) return null
 * return <Dashboard stats={stats} onRefresh={refresh} />
 * ```
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * Élément de la répartition des scores par paliers.
 */
export interface ScoreDistributionItem {
  range: string
  label: string
  count: number
  color: string
}

/**
 * Élément de l'activité des 7 derniers jours.
 */
export interface Last7DaysItem {
  date: string
  label: string
  count: number
}

/**
 * Forme exacte des statistiques renvoyées par `/api/cv/stats`.
 */
export interface CvStats {
  /** Nombre total de CV traités (réussis + en erreur) */
  total: number
  /** Nombre de CV traités avec succès */
  done: number
  /** Nombre de CV en erreur */
  errors: number
  /** Score moyen des CV réussis (0-100) */
  averageScore: number
  /** Meilleur score obtenu (0-100) */
  bestScore: number
  /** Pire score obtenu (0-100) */
  worstScore: number
  /** Nombre de documents Word générés */
  wordCount: number
  /** Nombre de présentations PowerPoint générées */
  pptxCount: number
  /** Nombre de sources PDF */
  pdfCount: number
  /** Nombre de sources image */
  imageCount: number
  /** Durée moyenne de traitement en millisecondes */
  averageDuration: number
  /** Répartition des scores par paliers */
  scoreDistribution: ScoreDistributionItem[]
  /** Activité des 7 derniers jours */
  last7Days: Last7DaysItem[]
  /** Taux de succès en pourcentage (0-100) */
  successRate: number
}

/**
 * Valeur de retour du hook `useCvStats`.
 */
export interface UseCvStatsReturn {
  /** Les statistiques ou `null` tant que la première requête n'est pas terminée */
  stats: CvStats | null
  /** `true` pendant le chargement */
  loading: boolean
  /** Message d'erreur ou `null` */
  error: string | null
  /** Recharge les statistiques depuis le serveur */
  refresh: () => Promise<void>
}

/**
 * Hook pour récupérer et rafraîchir les statistiques des CV.
 *
 * Suit le même pattern que `useCvHistory` : état local `stats`/`loading`/`error`,
 * fonction `refresh` mémorisée via `useCallback`, et déclenchement automatique
 * au montage via `useEffect`.
 */
export function useCvStats(): UseCvStatsReturn {
  const [stats, setStats] = useState<CvStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cv/stats')
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = (await res.json()) as CvStats
      setStats(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors du chargement des statistiques.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { stats, loading, error, refresh }
}
