'use client'

/**
 * Panneau de résultats : affiche le CV généré, le bouton de téléchargement,
 * les onglets pour naviguer entre le score et l'aperçu du CV.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  FileCheck2,
  Presentation,
  Sparkles,
  BarChart3,
  Eye,
  RotateCcw,
  Timer,
  Cpu,
  CheckCircle2,
  FileJson,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScoreDisplay } from '@/components/cv/score-display'
import { CvPreview } from '@/components/cv/cv-preview'
import type { CvProcessingResult } from '@/lib/cv/types'

export interface ResultPanelProps {
  result: CvProcessingResult
  onReset: () => void
  /// Optionnel : permet de relancer le traitement sur le CV courant.
  onReprocess?: () => void
}

export function ResultPanel({ result, onReset, onReprocess }: ResultPanelProps) {
  const [activeTab, setActiveTab] = useState('score')

  const isWord = result.outputFormat === 'word'
  const isSample = result.extractionModel?.toLowerCase().includes('sample')
  const exportJsonUrl = `/api/cv/export?id=${encodeURIComponent(result.id)}`
  const fileSize = result.parsedCv
    ? JSON.stringify(result.parsedCv).length
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Bandeau de succès */}
      <Card className="overflow-hidden border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-800 dark:from-emerald-950/30 dark:to-teal-950/20">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                CV traité avec succès !
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Document {isWord ? 'Word' : 'PowerPoint'} généré et scoring terminé.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {isSample && (
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-100/70 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  >
                    CV d&apos;exemple
                  </Badge>
                )}
                {result.durationMs && (
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {(result.durationMs / 1000).toFixed(1)} s
                  </span>
                )}
                {result.extractionModel && (
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" />
                    Extraction : {result.extractionModel.split('/').pop()}
                  </span>
                )}
                {result.scoringModel && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Scoring : {result.scoringModel.split('/').pop()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {result.downloadUrl && (
              <Button asChild size="lg" className="gap-2">
                <a href={result.downloadUrl} download={result.outputFileName}>
                  {isWord ? (
                    <FileCheck2 className="h-4 w-4" />
                  ) : (
                    <Presentation className="h-4 w-4" />
                  )}
                  Télécharger {isWord ? 'Word' : 'PowerPoint'}
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="gap-2">
              <a
                href={exportJsonUrl}
                download={`cv-${result.id.slice(0, 8)}.json`}
              >
                <FileJson className="h-4 w-4" />
                Exporter JSON
              </a>
            </Button>
            {onReprocess && (
              <Button
                variant="outline"
                size="lg"
                onClick={onReprocess}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retraiter
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={onReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Nouveau CV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onglets : Score / Aperçu CV */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="score" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Score & Évaluation
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-4 w-4" />
            Aperçu du CV
          </TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="mt-4">
          {result.score && <ScoreDisplay score={result.score} />}
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {result.parsedCv && <CvPreview cv={result.parsedCv} />}
        </TabsContent>
      </Tabs>

      {/* Info footer */}
      {result.extractedText && (
        <Card>
          <CardContent className="p-4">
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                Texte brut extrait ({result.extractedText.length} caractères)
                <Badge variant="secondary" className="ml-auto text-xs">
                  {result.extractedText.length > 1000
                    ? `${Math.round(result.extractedText.length / 1000)}k`
                    : result.extractedText.length}{' '}
                  cars
                </Badge>
              </summary>
              <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                {result.extractedText}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
