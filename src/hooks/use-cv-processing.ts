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
  /// Indique si l'application attend la décision de l'utilisateur pour le scoring
  awaitingScoringConfirmation: boolean
  /// Résultat intermédiaire après la génération du fichier (avant scoring)
  partialResult: CvProcessingResult | null
  /// Lance le traitement d'un fichier (génère le document et fait une pause)
  processCv: (params: {
    file: File
    outputFormat: OutputFormat
    language?: string
    template?: string
    extractionModel?: string
    customSkeleton?: File
  }) => Promise<void>
  /// Lance l'étape de scoring après confirmation de l'utilisateur
  confirmScoring: () => Promise<void>
  /// Saute le scoring et finalise avec uniquement le fichier généré
  skipScoring: () => void
  /// Réinitialise l'état
  reset: () => void
}

export function useCvProcessing(): UseCvProcessingReturn {
  const [isProcessing, setIsProcessing] = useState(false)
  const [steps, setSteps] = useState<ProcessingStep[]>(DEFAULT_STEPS)
  const [result, setResult] = useState<CvProcessingResult | null>(null)
  const [partialResult, setPartialResult] = useState<CvProcessingResult | null>(null)
  const [awaitingScoringConfirmation, setAwaitingScoringConfirmation] = useState(false)
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
    setPartialResult(null)
    setAwaitingScoringConfirmation(false)
    setError(null)
  }, [])

  const processCv = useCallback(
    async ({
      file,
      outputFormat,
      language,
      template,
      extractionModel,
      customSkeleton,
    }: {
      file: File
      outputFormat: OutputFormat
      language?: string
      template?: string
      extractionModel?: string
      customSkeleton?: File
    }) => {
      setIsProcessing(true)
      setError(null)
      setResult(null)
      setPartialResult(null)
      setAwaitingScoringConfirmation(false)
      setSteps(DEFAULT_STEPS)

      // Étape 1 : téléversement
      updateStep('upload', 'running')

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('outputFormat', outputFormat)
        formData.append('skipScoring', 'true')
        if (language) formData.append('language', language)
        if (template) formData.append('template', template)
        if (extractionModel) formData.append('extractionModel', extractionModel)
        if (customSkeleton) formData.append('customSkeleton', customSkeleton)

        updateStep('upload', 'done')
        updateStep('extract', 'running')

        const progressTimers: ReturnType<typeof setTimeout>[] = []

        // Après 2 s, passer visuellement à la conversion
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
          }, 2000)
        )

        const response = await fetch('/api/cv/process', {
          method: 'POST',
          body: formData,
        })

        progressTimers.forEach((t) => clearTimeout(t))

        let data: any = {}
        const rawText = await response.text()
        if (rawText) {
          try {
            data = JSON.parse(rawText)
          } catch {
            data = { error: rawText }
          }
        }

        if (!response.ok) {
          throw new Error(data.error || `Erreur serveur ${response.status}`)
        }

        // Marquer les 3 premières étapes comme 'done'
        setSteps((prev) =>
          prev.map((s) =>
            s.id === 'score' ? { ...s, status: 'pending' as const } : { ...s, status: 'done' as const }
          )
        )

        const res = data as CvProcessingResult
        setPartialResult(res)
        setResult(res)
        setAwaitingScoringConfirmation(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue.'
        setError(message)
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

  const confirmScoring = useCallback(async () => {
    if (!partialResult?.id) return
    setIsProcessing(true)
    setAwaitingScoringConfirmation(false)
    updateStep('score', 'running')

    try {
      const res = await fetch('/api/cv/score-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: partialResult.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors du scoring')

      updateStep('score', 'done')
      const updatedResult: CvProcessingResult = {
        ...partialResult,
        status: 'done',
        score: data.score,
        scoringModel: data.scoringModel,
      }
      setResult(updatedResult)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de scoring.'
      setError(message)
      updateStep('score', 'error', message)
    } finally {
      setIsProcessing(false)
    }
  }, [partialResult, updateStep])

  const skipScoring = useCallback(() => {
    setAwaitingScoringConfirmation(false)
    setIsProcessing(false)
    setSteps((prev) =>
      prev.map((s) => (s.id === 'score' ? { ...s, status: 'done' as const, detail: 'Ignoré à la demande' } : s))
    )
  }, [])

  return {
    isProcessing,
    steps,
    result,
    error,
    awaitingScoringConfirmation,
    partialResult,
    processCv,
    confirmScoring,
    skipScoring,
    reset,
  }
}
