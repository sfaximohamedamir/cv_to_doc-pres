'use client'

/**
 * Page principale de l'agent de transformation de CV.
 *
 * Architecture :
 *  - Header (sticky) avec toggle de thème
 *  - Bannière de configuration NVIDIA
 *  - Section hero (présentation + pipeline)
 *  - Tableau de bord de statistiques (si des CV ont été traités)
 *  - Zone principale en 2 colonnes :
 *      * Colonne gauche : upload, sample selector, format, bouton, étapes, résultats
 *      * Colonne droite : historique
 *  - Footer (sticky en bas)
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Wand2,
  ArrowRight,
  Zap,
  FileSearch,
  FileOutput,
  Gauge,
  Languages,
  Lightbulb,
  Search,
  Download,
  Palette,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { NvidiaStatusBanner } from '@/components/cv/nvidia-status-banner'
import { UploadZone } from '@/components/cv/upload-zone'
import { FormatSelector } from '@/components/cv/format-selector'
import { ProcessingSteps } from '@/components/cv/processing-steps'
import { ResultPanel } from '@/components/cv/result-panel'
import { HistoryList } from '@/components/cv/history-list'
import { CompareButton } from '@/components/cv/compare-button'
import { OnboardingGuide } from '@/components/cv/onboarding-guide'
import { FullTextSearch } from '@/components/cv/full-text-search'
import { TemplateSelector } from '@/components/cv/template-selector'
import type { CvTemplateId } from '@/lib/cv/templates'
import { toast } from 'sonner'
import { StatsDashboard } from '@/components/cv/stats-dashboard'
import { SampleSelector } from '@/components/cv/sample-selector'
import { KeyboardHelp } from '@/components/cv/keyboard-help'
import { useCvProcessing } from '@/hooks/use-cv-processing'
import { useCvHistory } from '@/hooks/use-cv-history'
import { useCvStats } from '@/hooks/use-cv-stats'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useTheme } from 'next-themes'
import type { OutputFormat, CvProcessingResult } from '@/lib/cv/types'

const LANGUAGES = [
  { value: 'français', label: 'Français' },
  { value: 'english', label: 'Anglais' },
  { value: 'español', label: 'Espagnol' },
  { value: 'auto', label: 'Détection automatique' },
]

const PIPELINE_FEATURES = [
  {
    icon: FileSearch,
    title: '1. Extraction IA',
    description:
      "Le modèle Nemotron lit votre PDF ou image et structure les données du CV (nom, expérience, formation, compétences...).",
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    icon: FileOutput,
    title: '2. Génération',
    description:
      "Un document Word ou PowerPoint professionnel est généré automatiquement à partir des données structurées.",
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
  },
  {
    icon: Gauge,
    title: '3. Scoring',
    description:
      "Le CV est évalué sur 7 critères (clarté, impact, compétences...) avec un score global sur 100 et des recommandations.",
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
  },
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('word')
  const [language, setLanguage] = useState<string>('français')
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [viewedHistory, setViewedHistory] = useState<CvProcessingResult | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showSamples, setShowSamples] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)
  const [template, setTemplate] = useState<CvTemplateId>('modern')

  const { isProcessing, steps, result, error, processCv, reset } =
    useCvProcessing()
  const { items, loading: historyLoading, refresh, remove } = useCvHistory()
  const { refresh: refreshStats } = useCvStats()
  const { theme, setTheme } = useTheme()

  // Raccourcis clavier globaux
  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    onHelp: () => setKeyboardHelpOpen(true),
  })

  // Toast : succès du traitement (quand result passe à 'done')
  useEffect(() => {
    if (result && result.status === 'done') {
      const scoreText = result.score ? ` — Score : ${result.score.overallScore}/100` : ''
      toast.success('CV traité avec succès !', {
        description: `Document ${result.outputFormat === 'word' ? 'Word' : 'PowerPoint'} généré${scoreText}`,
      })
    }
  }, [result])

  // Toast : erreur de traitement
  useEffect(() => {
    if (error) {
      toast.error('Erreur lors du traitement', {
        description: error,
      })
    }
  }, [error])

  const handleProcess = useCallback(async () => {
    if (!file) return
    const lang = language === 'auto' ? undefined : language
    toast.info('Traitement en cours…', {
      description: `Analyse de "${file.name}" avec NVIDIA Nemotron`,
    })
    await processCv({ file, outputFormat, language: lang, template })
    // Rafraîchir l'historique et les stats après le traitement
    refresh()
    refreshStats()
  }, [file, outputFormat, language, processCv, refresh, refreshStats, toast, template])

  const handleReset = useCallback(() => {
    reset()
    setFile(null)
    setViewedHistory(null)
    setSelectedHistoryId(null)
  }, [reset])

  const handleSampleResult = useCallback(
    (sampleResult: CvProcessingResult) => {
      reset()
      setViewedHistory(sampleResult)
      setSelectedHistoryId(null)
      // Rafraîchir l'historique et les stats
      refresh()
      refreshStats()
      const scoreText = sampleResult.score ? ` — Score : ${sampleResult.score.overallScore}/100` : ''
      toast.success('CV d\'exemple généré !', {
        description: `Document ${sampleResult.outputFormat === 'word' ? 'Word' : 'PowerPoint'} créé${scoreText}`,
      })
    },
    [reset, refresh, refreshStats]
  )

  const handleReprocess = useCallback(() => {
    // Retraiter : revenir à l'écran de configuration en gardant le format
    reset()
    setViewedHistory(null)
    setSelectedHistoryId(null)
    toast.info('Prêt pour un nouveau traitement', {
      description: 'Téléversez un nouveau CV ou choisissez un exemple',
    })
    // Faire défiler vers le haut
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [reset])

  const handleSelectHistory = useCallback(async (id: string) => {
    setSelectedHistoryId(id)
    setLoadingHistory(true)
    setViewedHistory(null)
    try {
      const res = await fetch(`/api/cv/history/${id}`)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      setViewedHistory({
        id: data.id,
        status: data.status,
        parsedCv: data.parsedCv,
        score: data.scoreDetails,
        outputFormat: data.outputFormat,
        downloadUrl: data.downloadUrl || undefined,
        outputFileName: data.outputName || undefined,
        extractedText: data.extractedText || undefined,
        durationMs: data.durationMs || undefined,
        extractionModel: data.extractionModel || '',
        scoringModel: data.scoringModel || '',
        tag: data.tag || 'none',
        notes: data.notes || null,
      })
    } catch {
      setViewedHistory(null)
      toast.error('Impossible de charger ce CV', {
        description: 'Le CV sélectionné n\'a pas pu être récupéré.',
      })
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  const handleRemove = useCallback(
    async (id: string) => {
      const promise = fetch(`/api/cv/history/${id}`, { method: 'DELETE' }).then(async (res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
      })
      toast.promise(promise, {
        loading: 'Suppression en cours…',
        success: 'CV supprimé de l\'historique',
        error: 'Erreur lors de la suppression',
      })
      try {
        await promise
        await remove(id)
        refreshStats()
        if (selectedHistoryId === id) {
          setSelectedHistoryId(null)
          setViewedHistory(null)
        }
      } catch {
        /* le toast gère l'erreur */
      }
    },
    [remove, refreshStats, selectedHistoryId]
  )

  // Le résultat affiché : soit le traitement courant, soit un élément d'historique consulté
  const displayedResult = result || viewedHistory
  const showResult = displayedResult && displayedResult.status === 'done'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OnboardingGuide />
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Bannière NVIDIA */}
        <div className="mb-6">
          <NvidiaStatusBanner />
        </div>

        {/* Section Hero — visible seulement avant tout résultat */}
        {!showResult && !isProcessing && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-cyan-950/20 sm:p-8">
              <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
              <div className="relative">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm dark:bg-white/10 dark:text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Propulsé par NVIDIA Nemotron
                </div>
                <h2 className="max-w-2xl text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                  Transformez votre CV en document Word ou PowerPoint et obtenez
                  un score IA
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Téléversez un CV en PDF ou image. L'agent l'extrait,
                  le restructure, génère un document propre et l'évalue sur
                  7 critères.
                </p>

                {/* Pipeline features */}
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {PIPELINE_FEATURES.map((f, i) => {
                    const Icon = f.icon
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        className="rounded-xl border border-border bg-card/80 p-3 backdrop-blur"
                      >
                        <div
                          className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${f.bg} ${f.color}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {f.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {f.description}
                        </p>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Tableau de bord de statistiques */}
        {!showResult && !isProcessing && <StatsDashboard />}

        {/* Contenu principal : 2 colonnes */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Colonne gauche : interaction + résultats */}
          <div className="space-y-6">
            {/* Carte de configuration (upload + format + bouton) */}
            {!showResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wand2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Configuration du traitement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      1. Sélectionnez votre CV
                    </Label>
                    <UploadZone
                      file={file}
                      onFileSelected={setFile}
                      disabled={isProcessing}
                    />
                  </div>

                  {/* Format de sortie */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      2. Choisissez le format de sortie
                    </Label>
                    <FormatSelector
                      value={outputFormat}
                      onChange={setOutputFormat}
                      disabled={isProcessing}
                    />
                  </div>

                  {/* Template visuel */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Palette className="h-3.5 w-3.5" />
                      3. Modèle visuel
                    </Label>
                    <TemplateSelector
                      value={template}
                      onChange={setTemplate}
                      disabled={isProcessing}
                    />
                  </div>

                  {/* Langue */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Languages className="h-3.5 w-3.5" />
                      4. Langue du CV (optionnel)
                    </Label>
                    <Select
                      value={language}
                      onValueChange={setLanguage}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="w-full sm:w-[260px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bouton de traitement */}
                  <Button
                    onClick={handleProcess}
                    disabled={!file || isProcessing}
                    size="lg"
                    className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                  >
                    {isProcessing ? (
                      <>
                        <Zap className="h-4 w-4 animate-pulse" />
                        Traitement en cours…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Transformer et scorer mon CV
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {/* Lien pour tester avec un CV d'exemple */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowSamples((s) => !s)}
                        className="flex items-center gap-1.5 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Lightbulb className="h-3.5 w-3.5" />
                        {showSamples ? 'Masquer' : "Pas de CV sous la main ? Testez avec un exemple"}
                      </button>
                    </div>
                  </div>

                  {/* Sample selector (conditionnel) */}
                  <AnimatePresence>
                    {showSamples && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <SampleSelector
                          onResult={handleSampleResult}
                          outputFormat={outputFormat}
                          templateId={template}
                          disabled={isProcessing}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            )}

            {/* Étapes de traitement */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        Progression du traitement
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ProcessingSteps steps={steps} />
                      {error && (
                        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          {error}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Erreur */}
            {error && !isProcessing && !showResult && (
              <Card className="border-destructive/40">
                <CardContent className="p-4 text-sm text-destructive">
                  {error}
                </CardContent>
              </Card>
            )}

            {/* Résultat */}
            {showResult && displayedResult && (
              <ResultPanel
                result={displayedResult}
                onReset={handleReset}
                onReprocess={handleReprocess}
                onTagChanged={() => {
                  refresh()
                  refreshStats()
                }}
              />
            )}

            {/* Chargement d'un élément d'historique */}
            {loadingHistory && !showResult && (
              <Card>
                <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Chargement du CV sélectionné…
                </CardContent>
              </Card>
            )}
          </div>

          {/* Colonne droite : historique */}
          <div className="space-y-3 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                disabled={items.length === 0}
                className="gap-1.5"
                title="Rechercher (Ctrl+K)"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rechercher</span>
                <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline">
                  ⌘K
                </kbd>
              </Button>
              <div className="flex gap-2">
                {items.length > 0 && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a href="/api/cv/csv" download>
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">CSV</span>
                    </a>
                  </Button>
                )}
                <CompareButton items={items} />
              </div>
            </div>
            <HistoryList
              items={items}
              loading={historyLoading}
              onSelect={handleSelectHistory}
              onRefresh={refresh}
              onRemove={handleRemove}
              selectedId={selectedHistoryId}
            />
            <FullTextSearch
              open={searchOpen}
              onOpenChange={setSearchOpen}
              onSelectResult={handleSelectHistory}
            />
          </div>
        </div>
      </main>

      <Footer />
      <KeyboardHelp open={keyboardHelpOpen} onOpenChange={setKeyboardHelpOpen} />
    </div>
  )
}
