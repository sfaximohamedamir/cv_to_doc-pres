'use client'

/**
 * Hook React pour gérer le pipeline complet de traitement d'un CV.
 *
 * Fournit :
 *  - l'état courant (étapes, résultat, erreur)
 *  - une fonction `processCv` qui envoie le fichier à /api/cv/process
 *  - une fonction `reset` pour revenir à l'état initial
 */

import { useState, useCallback } from 'react'
import type {
  CvProcessingResult,
  OutputFormat,
  ProcessingStep,
} from '@/lib/cv/types'

/// Étapes du pipeline affichées à l'utilisateur.
const DEFAULT_STEPS: ProcessingStep[] = [
  { id: 'upload', label: 'Téléversement du fichier', status: 'pending' },
  { id: 'extract', label: "Extraction du contenu (NVIDIA Nemotron)", status: 'pending' },
  { id: 'convert', label: 'Génération du document', status: 'pending' },
  { id: 'score', label: 'Scoring du CV (NVIDIA Nemotron)', status: 'pending' },
]

export interface UseCvProcessingReturn {
  /// Indique si un traitement est en cours
  isProcessing: boolean
  /// Étapes actuelles avec leur statut
  steps: ProcessingStep[]
  /// Résultat du traitement (null tant que non terminé)
  result: CvProcessingResult | null
  /// Message d'erreur éventuel
  error: string | null
  /// Lance le traitement d'un fichier
  processCv: (params: {
    file: File
    outputFormat: OutputFormat
    language?: string
    template?: string
  }) => Promise<void>
  /// Réinitialise l'état
  reset: () => void
}

export function useCvProcessing(): UseCvProcessingReturn {
  const [isProcessing, setIsProcessing] = useState(false)
  const [steps, setSteps] = useState<ProcessingStep[]>(DEFAULT_STEPS)
  const [result, setResult] = useState<CvProcessingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateStep = useCallback(
    (id: string, status: ProcessingStep['status'], detail?: string) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status, detail } : s))
      )
    },
    []
  )

  const reset = useCallback(() => {
    setIsProcessing(false)
    setSteps(DEFAULT_STEPS)
    setResult(null)
    setError(null)
  }, [])

  const processCv = useCallback(
    async ({
      file,
      outputFormat,
      language,
      template,
    }: {
      file: File
      outputFormat: OutputFormat
      language?: string
      template?: string
    }) => {
      setIsProcessing(true)
      setError(null)
      setResult(null)
      setSteps(DEFAULT_STEPS)

      // Étape 1 : téléversement
      updateStep('upload', 'running')

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('outputFormat', outputFormat)
        if (language) formData.append('language', language)
        if (template) formData.append('template', template)

        updateStep('upload', 'done')
        updateStep('extract', 'running')

        // Le serveur fait tout le pipeline d'un coup ; on simule la
        // progression des étapes côté client avec des délais progressifs
        // pour donner un retour visuel pendant l'attente.
        const progressTimers: ReturnType<typeof setTimeout>[] = []

        // Après 2,5 s, si l'extraction n'est pas finie, on passe à "conversion"
        progressTimers.push(
          setTimeout(() => {
            setSteps((prev) =>
              prev.map((s) =>
                s.id === 'extract' && s.status === 'running'
                  ? { ...s, status: 'done' }
                  : s
              )
            )
            setSteps((prev) =>
              prev.map((s) =>
                s.id === 'convert' && s.status === 'pending'
                  ? { ...s, status: 'running' }
                  : s
              )
            )
          }, 2500)
        )

        // Après 6 s, on passe au scoring
        progressTimers.push(
          setTimeout(() => {
            setSteps((prev) =>
              prev.map((s) =>
                s.id === 'convert' && s.status === 'running'
                  ? { ...s, status: 'done' }
                  : s
              )
            )
            setSteps((prev) =>
              prev.map((s) =>
                s.id === 'score' && s.status === 'pending'
                  ? { ...s, status: 'running' }
                  : s
              )
            )
          }, 6000)
        )

        const response = await fetch('/api/cv/process', {
          method: 'POST',
          body: formData,
        })

        // Nettoyer les minuteurs
        progressTimers.forEach((t) => clearTimeout(t))

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `Erreur ${response.status}`)
        }

        // Tout est terminé côté serveur : marquer toutes les étapes comme done.
        setSteps((prev) =>
          prev.map((s) => ({ ...s, status: 'done' as const }))
        )

        setResult(data as CvProcessingResult)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue.'
        setError(message)
        // Marquer l'étape en cours comme erreur.
        setSteps((prev) =>
          prev.map((s) =>
            s.status === 'running'
              ? { ...s, status: 'error' as const, detail: message }
              : s
          )
        )
      } finally {
        setIsProcessing(false)
      }
    },
    [updateStep]
  )

  return { isProcessing, steps, result, error, processCv, reset }
}
