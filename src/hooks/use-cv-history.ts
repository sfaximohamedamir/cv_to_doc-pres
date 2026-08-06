'use client'

/**
 * Hook React pour récupérer l'historique des CV traités.
 */

import { useState, useEffect, useCallback } from 'react'

export interface HistoryItem {
  id: string
  originalName: string
  sourceType: string
  outputFormat: string
  outputName: string | null
  status: string
  score: number | null
  language: string | null
  extractionModel: string | null
  scoringModel: string | null
  durationMs: number | null
  fileSize: number
  errorMessage: string | null
  downloadUrl: string | null
  createdAt: string
}

export interface UseCvHistoryReturn {
  items: HistoryItem[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useCvHistory(): UseCvHistoryReturn {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cv/history?limit=50')
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/cv/history/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression.')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { items, loading, error, refresh, remove }
}
