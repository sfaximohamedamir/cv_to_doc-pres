'use client'

/**
 * Comparateur de CV — dialogue de comparaison côte à côte.
 *
 * Permet à l'utilisateur de sélectionner deux CV dans son historique
 * (parmi les CV terminés et scorés) et de les comparer visuellement :
 *
 *  1. Un **graphique radar double** : les deux CV sont superposés sur le même
 *     radar, le CV A en émeraude (#10b981) et le CV B en orange (#f97316),
 *     avec une légende.
 *  2. Un **tableau comparatif** : pour chaque catégorie de score, on affiche
 *     la note du CV A, la note du CV B, et un badge d'écart (+5 en vert si A
 *     est meilleur, -3 en rouge si B est meilleur, « — » si égalité).
 *  3. Deux **cartes résumé** côte à côte : nom complet, score global (gros
 *     chiffre coloré), niveau de séniorité et un badge de verdict
 *     (« Meilleur » / « À améliorer » / « Égalité »).
 *
 * Le composant gère ses propres états de chargement (squelettes) et d'erreur
 * lors de la récupération des détails des deux CV via l'API.
 */

import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTheme } from 'next-themes'
import { GitCompare, AlertCircle, Loader2, Star, Trophy } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { HistoryItem } from '@/hooks/use-cv-history'
import type { CvScore, ParsedCv, ScoreCategory } from '@/lib/cv/types'

/** Couleur d'accent du CV A (émeraude). */
const COLOR_A = '#10b981'
/** Couleur d'accent du CV B (orange). */
const COLOR_B = '#f97316'

/**
 * Réponse renvoyée par la route `/api/cv/history/[id]`.
 * `parsedCv` et `scoreDetails` peuvent être `null` si l'extraction ou le
 * scoring a échoué côté serveur.
 */
interface CvDetailResponse {
  id: string
  originalName: string
  parsedCv: ParsedCv | null
  scoreDetails: CvScore | null
}

/** Props du composant `CvComparator`. */
export interface CvComparatorProps {
  /** État d'ouverture contrôlé du dialogue. */
  open: boolean
  /** Callback appelé quand l'état d'ouverture change. */
  onOpenChange: (open: boolean) => void
  /** Liste des éléments d'historique disponibles (issus de `useCvHistory`). */
  items: HistoryItem[]
}

/**
 * Raccourcit le nom d'une catégorie pour l'affichage sur l'axe du radar.
 *
 * Copie locale du helper `shortenCategoryName` de `score-radar-chart.tsx` —
 * les noms complets (ex: « Clarté et structure ») sont trop longs et se
 * chevauchent sur le radar.
 */
function shortenCategoryName(name: string): string {
  const map: Record<string, string> = {
    'Clarté et structure': 'Clarté',
    'Impact et réalisations': 'Impact',
    'Expérience professionnelle': 'Expérience',
    'Présentation et orthographe': 'Présentation',
    'Adéquation au marché': 'Marché',
    'Compétences': 'Compétences',
    'Formation': 'Formation',
  }

  const exact = map[name]
  if (exact) return exact

  const lower = name.toLowerCase()
  for (const key of Object.keys(map)) {
    if (key.toLowerCase() === lower) return map[key]
  }

  if (name.length <= 12) return name

  const firstWord = name.split(/\s+/)[0]
  return firstWord || name
}

/**
 * Renvoie une couleur Tailwind pour un score donné (utilisé pour le gros
 * chiffre du score global dans les cartes résumé).
 */
function getScoreColorClass(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 70) return 'text-teal-600 dark:text-teal-400'
  if (score >= 55) return 'text-amber-600 dark:text-amber-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * Extrait un nom complet lisible à partir d'un `ParsedCv`.
 * Si le nom est vide, on retombe sur le nom de fichier d'origine.
 */
function getFullName(parsedCv: ParsedCv | null, fallback: string): string {
  const fullName = parsedCv?.personalInfo?.fullName?.trim()
  if (fullName && fullName.length > 0) return fullName
  return fallback
}

/**
 * Comparateur de CV : dialogue avec double radar, tableau et cartes résumé.
 *
 * @param open - État d'ouverture du dialogue.
 * @param onOpenChange - Callback de changement d'état.
 * @param items - Historique des CV traités.
 */
export function CvComparator({ open, onOpenChange, items }: CvComparatorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // CV sélectionnés (IDs).
  const [idA, setIdA] = useState<string>('')
  const [idB, setIdB] = useState<string>('')

  // Détails chargés pour les deux CV.
  const [detailA, setDetailA] = useState<CvDetailResponse | null>(null)
  const [detailB, setDetailB] = useState<CvDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtrer uniquement les CV terminés et scorés.
  const scoredItems = useMemo(
    () => items.filter((it) => it.status === 'done' && it.score !== null),
    [items]
  )

  // Récupérer les détails des deux CV (appelé depuis les handlers de
  // sélection — pas depuis un effet, pour respecter la règle
  // `react-hooks/set-state-in-effect`).
  const fetchBoth = useCallback(async (aId: string, bId: string) => {
    setLoading(true)
    setError(null)
    setDetailA(null)
    setDetailB(null)
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/cv/history/${aId}`).then((r) => {
          if (!r.ok) throw new Error(`CV A — erreur ${r.status}`)
          return r.json() as Promise<CvDetailResponse>
        }),
        fetch(`/api/cv/history/${bId}`).then((r) => {
          if (!r.ok) throw new Error(`CV B — erreur ${r.status}`)
          return r.json() as Promise<CvDetailResponse>
        }),
      ])
      if (!a.scoreDetails || !b.scoreDetails) {
        throw new Error(
          'Les détails de score sont indisponibles pour l\'un des CV.'
        )
      }
      setDetailA(a)
      setDetailB(b)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors du chargement des CV.'
      )
      setDetailA(null)
      setDetailB(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Handler de sélection du CV A : met à jour l'ID et, si B est déjà
  // choisi, lance la récupération des détails pour les deux CV.
  const handleSetIdA = useCallback(
    (nextId: string) => {
      setIdA(nextId)
      if (nextId && idB && nextId !== idB) {
        void fetchBoth(nextId, idB)
      } else {
        setDetailA(null)
        setDetailB(null)
      }
    },
    [idB, fetchBoth]
  )

  // Handler de sélection du CV B : symétrique de `handleSetIdA`.
  const handleSetIdB = useCallback(
    (nextId: string) => {
      setIdB(nextId)
      if (nextId && idA && nextId !== idA) {
        void fetchBoth(idA, nextId)
      } else {
        setDetailA(null)
        setDetailB(null)
      }
    },
    [idA, fetchBoth]
  )

  // Handler d'ouverture/fermeture : réinitialise les sélections et les
  // détails quand le dialogue se ferme.
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setIdA('')
        setIdB('')
        setDetailA(null)
        setDetailB(null)
        setError(null)
        setLoading(false)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  // Données formatées pour le radar double.
  const radarData = useMemo(() => {
    const scoreA = detailA?.scoreDetails
    const scoreB = detailB?.scoreDetails
    if (!scoreA || !scoreB) return null

    // On prend les catégories du CV A comme référence (les deux CV partagent
    // la même grille de 7 catégories).
    const categories: ScoreCategory[] = scoreA.categories ?? []
    return categories.map((cat, i) => ({
      category: shortenCategoryName(cat.name),
      cvA: cat.score,
      cvB: scoreB.categories[i]?.score ?? 0,
      fullMark: 100,
    }))
  }, [detailA, detailB])

  // Données formatées pour le tableau comparatif.
  const tableRows = useMemo(() => {
    const scoreA = detailA?.scoreDetails
    const scoreB = detailB?.scoreDetails
    if (!scoreA || !scoreB) return null

    const categories: ScoreCategory[] = scoreA.categories ?? []
    return categories.map((cat, i) => {
      const a = cat.score
      const b = scoreB.categories[i]?.score ?? 0
      const diff = a - b
      return {
        name: cat.name,
        a,
        b,
        diff,
      }
    })
  }, [detailA, detailB])

  // Verdict global : « Meilleur » / « À améliorer » / « Égalité ».
  const verdictA = useMemo(() => {
    const sA = detailA?.scoreDetails?.overallScore
    const sB = detailB?.scoreDetails?.overallScore
    if (sA === undefined || sB === undefined) return null
    if (sA > sB) return 'better' as const
    if (sA < sB) return 'worse' as const
    return 'equal' as const
  }, [detailA, detailB])

  // Couleurs du radar selon le thème.
  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const tickColor = isDark ? '#9ca3af' : '#374151'
  const strokeA = isDark ? '#34d399' : '#059669'
  const strokeB = isDark ? '#fb923c' : '#ea580c'

  // Tous les items sont éligibles au select A. Pour le select B, on retire
  // l'item sélectionné en A (mais on garde quand même tous les items pour
  // ne pas brusquer l'utilisateur — la garde est appliquée via useEffect).
  const itemsForA = scoredItems
  const itemsForB = scoredItems

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Comparer deux CV
          </DialogTitle>
          <DialogDescription>
            Sélectionnez deux CV terminés pour comparer leurs scores catégorie
            par catégorie.
          </DialogDescription>
        </DialogHeader>

        {/* Sélecteurs de CV */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="cv-comparator-a"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLOR_A }}
              />
              CV A
            </label>
            <Select value={idA} onValueChange={handleSetIdA}>
              <SelectTrigger id="cv-comparator-a" className="w-full">
                <SelectValue placeholder="Choisir un CV…" />
              </SelectTrigger>
              <SelectContent>
                {itemsForA.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aucun CV éligible.
                  </div>
                ) : (
                  itemsForA.map((it) => (
                    <SelectItem
                      key={it.id}
                      value={it.id}
                      disabled={it.id === idB}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate">{it.originalName}</span>
                        <Badge
                          variant="outline"
                          className="ml-1 text-[10px] font-normal"
                        >
                          {it.score}/100
                        </Badge>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cv-comparator-b"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLOR_B }}
              />
              CV B
            </label>
            <Select value={idB} onValueChange={handleSetIdB}>
              <SelectTrigger id="cv-comparator-b" className="w-full">
                <SelectValue placeholder="Choisir un CV…" />
              </SelectTrigger>
              <SelectContent>
                {itemsForB.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aucun CV éligible.
                  </div>
                ) : (
                  itemsForB.map((it) => (
                    <SelectItem
                      key={it.id}
                      value={it.id}
                      disabled={it.id === idA}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate">{it.originalName}</span>
                        <Badge
                          variant="outline"
                          className="ml-1 text-[10px] font-normal"
                        >
                          {it.score}/100
                        </Badge>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* États : pas de sélection / chargement / erreur / contenu */}
        {!idA || !idB ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <GitCompare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Sélectionnez deux CV pour lancer la comparaison.
            </p>
            {scoredItems.length < 2 && (
              <p className="text-xs text-muted-foreground/70">
                Il faut au moins deux CV scorés dans l'historique.
              </p>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {/* Squelette du radar */}
            <Skeleton className="h-[300px] w-full rounded-xl" />
            {/* Squelette des cartes */}
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
            {/* Squelette du tableau */}
            <Skeleton className="h-48 rounded-xl" />
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Chargement des détails…
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              Impossible de charger la comparaison
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : (
          radarData &&
          tableRows &&
          detailA?.scoreDetails &&
          detailB?.scoreDetails && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-5"
            >
              {/* Radar double */}
              <div className="rounded-xl border bg-card p-3">
                <div className="w-full" style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={radarData}
                      cx="50%"
                      cy="50%"
                      outerRadius="68%"
                      margin={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    >
                      <defs>
                        <linearGradient
                          id="radarGradientCompareA"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={COLOR_A}
                            stopOpacity={isDark ? 0.55 : 0.45}
                          />
                          <stop
                            offset="100%"
                            stopColor={COLOR_A}
                            stopOpacity={isDark ? 0.25 : 0.15}
                          />
                        </linearGradient>
                        <linearGradient
                          id="radarGradientCompareB"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={COLOR_B}
                            stopOpacity={isDark ? 0.55 : 0.45}
                          />
                          <stop
                            offset="100%"
                            stopColor={COLOR_B}
                            stopOpacity={isDark ? 0.25 : 0.15}
                          />
                        </linearGradient>
                      </defs>
                      <PolarGrid stroke={gridColor} strokeWidth={1} />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{
                          fill: tickColor,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name="CV A"
                        dataKey="cvA"
                        stroke={strokeA}
                        strokeWidth={2}
                        fill="url(#radarGradientCompareA)"
                        fillOpacity={1}
                        isAnimationActive
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                      <Radar
                        name="CV B"
                        dataKey="cvB"
                        stroke={strokeB}
                        strokeWidth={2}
                        fill="url(#radarGradientCompareB)"
                        fillOpacity={1}
                        isAnimationActive
                        animationDuration={700}
                        animationEasing="ease-out"
                        animationBegin={150}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        iconType="circle"
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Plus la zone est large, meilleur est le score
                </p>
              </div>

              {/* Cartes résumé */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SummaryCard
                  label="CV A"
                  accentColor={COLOR_A}
                  fullName={getFullName(
                    detailA.parsedCv,
                    detailA.originalName
                  )}
                  overallScore={detailA.scoreDetails.overallScore}
                  seniorityLevel={detailA.scoreDetails.seniorityLevel}
                  verdict={verdictA}
                />
                <SummaryCard
                  label="CV B"
                  accentColor={COLOR_B}
                  fullName={getFullName(
                    detailB.parsedCv,
                    detailB.originalName
                  )}
                  overallScore={detailB.scoreDetails.overallScore}
                  seniorityLevel={detailB.scoreDetails.seniorityLevel}
                  verdict={
                    verdictA === 'better'
                      ? 'worse'
                      : verdictA === 'worse'
                      ? 'better'
                      : 'equal'
                  }
                />
              </div>

              {/* Tableau comparatif */}
              <div className="rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Catégorie</TableHead>
                      <TableHead className="text-center">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: COLOR_A }}
                          />
                          CV A
                        </span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: COLOR_B }}
                          />
                          CV B
                        </span>
                      </TableHead>
                      <TableHead className="text-center">Écart</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row, i) => {
                      const diff = row.diff
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                'font-semibold',
                                getScoreColorClass(row.a)
                              )}
                            >
                              {row.a}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                'font-semibold',
                                getScoreColorClass(row.b)
                              )}
                            >
                              {row.b}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {diff === 0 ? (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground"
                              >
                                —
                              </Badge>
                            ) : diff > 0 ? (
                              <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                                +{diff}
                              </Badge>
                            ) : (
                              <Badge className="border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                                {diff}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Ligne de synthèse des scores globaux */}
              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Score global — CV A :{' '}
                <span className="font-semibold text-foreground">
                  {detailA.scoreDetails.overallScore}
                </span>{' '}
                · CV B :{' '}
                <span className="font-semibold text-foreground">
                  {detailB.scoreDetails.overallScore}
                </span>
              </div>
            </motion.div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Carte résumé d'un CV (CV A ou CV B) utilisée dans le comparateur.
 */
interface SummaryCardProps {
  /** Libellé « CV A » ou « CV B ». */
  label: string
  /** Couleur d'accent (.hex) — émeraude ou orange. */
  accentColor: string
  /** Nom complet du titulaire du CV. */
  fullName: string
  /** Score global sur 100. */
  overallScore: number
  /** Niveau de séniorité estimé. */
  seniorityLevel: string
  /** Verdict comparatif. */
  verdict: 'better' | 'worse' | 'equal' | null
}

/**
 * Carte résumé affichant le nom, le score global, le niveau de séniorité et
 * un badge de verdict pour un CV comparé.
 */
function SummaryCard({
  label,
  accentColor,
  fullName,
  overallScore,
  seniorityLevel,
  verdict,
}: SummaryCardProps) {
  const verdictBadge =
    verdict === 'better' ? (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
        <Trophy className="h-3 w-3" />
        Meilleur
      </Badge>
    ) : verdict === 'worse' ? (
      <Badge className="border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
        À améliorer
      </Badge>
    ) : verdict === 'equal' ? (
      <Badge variant="secondary">Égalité</Badge>
    ) : null

  return (
    <Card className="overflow-hidden">
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: accentColor }}
          >
            {label}
          </span>
          {verdictBadge}
        </div>
        <p className="truncate text-sm font-semibold text-foreground" title={fullName}>
          {fullName}
        </p>
        <div className="flex items-end gap-2">
          <span
            className={cn(
              'text-4xl font-bold leading-none',
              getScoreColorClass(overallScore)
            )}
          >
            {overallScore}
          </span>
          <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Séniorité :{' '}
          <span className="font-medium text-foreground">{seniorityLevel}</span>
        </p>
      </CardContent>
    </Card>
  )
}

export default CvComparator
