'use client'

/**
 * Tableau de bord de statistiques pour l'agent de transformation de CV.
 *
 * Affiché en haut de la page principale (entre le hero et la grille 2 colonnes)
 * lorsqu'au moins un CV a été traité. Si `stats.total === 0`, le composant
 * ne rend rien (retourne `null`).
 *
 * Contenu :
 *  1. En-tête « Statistiques » avec icône + bouton de rafraîchissement
 *  2. Ligne de 4 cartes KPI (Total CVs, Score moyen, Taux de succès, Documents générés)
 *  3. Deux colonnes :
 *      - Gauche : répartition des scores par paliers (barres horizontales animées)
 *      - Droite : activité des 7 derniers jours (barres verticales animées)
 *  4. Répartition des formats source (PDF vs images)
 *
 * Palette : emerald / teal / cyan (cohérente avec le reste de l'app) + orange
 * pour la carte « Documents générés ».
 *
 * Animations : Framer Motion (fade + slide + staggered delays + bar widths/heights).
 */

import { motion } from 'framer-motion'
import {
  FileText,
  TrendingUp,
  CheckCircle2,
  FileOutput,
  RefreshCw,
  Loader2,
  BarChart3,
  CalendarDays,
  BarChart2,
  FileImage,
  FileType2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCvStats, type CvStats } from '@/hooks/use-cv-stats'
import { ScoreEvolutionChart } from '@/components/cv/score-evolution-chart'

/* -------------------------------------------------------------------------- */
/*                              Sous-composants                               */
/* -------------------------------------------------------------------------- */

/**
 * Carte KPI unique avec icône, grand chiffre, libellé et sous-titre.
 * Animation d'entrée en fade + slide vertical, effet hover (scale + ombre).
 */
interface KpiCardProps {
  /** Icône Lucide à afficher dans le badge coloré */
  icon: React.ComponentType<{ className?: string }>
  /** Grand chiffre / valeur principale (déjà formatée) */
  value: string
  /** Libellé court sous la valeur */
  label: string
  /** Sous-titre informatif (ex: « 5 réussis · 2 erreurs ») */
  subtitle: string
  /** Classes Tailwind pour l'accent de couleur (gradient du badge icône) */
  accentClasses: string
  /** Classes Tailwind pour la couleur du chiffre principal */
  valueColorClass: string
  /** Délai d'animation (pour l'effet staggered) */
  delay: number
}

function KpiCard({
  icon: Icon,
  value,
  label,
  subtitle,
  accentClasses,
  valueColorClass,
  delay,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
      whileHover={{ scale: 1.02 }}
      className="h-full"
    >
      <Card className="group h-full overflow-hidden transition-shadow duration-200 hover:shadow-lg hover:shadow-emerald-500/5">
        <CardContent className="flex h-full items-start gap-2.5 p-3 sm:gap-3 sm:p-6">
          {/* Badge icône avec gradient coloré */}
          <div
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm sm:h-11 sm:w-11',
              accentClasses
            )}
          >
            <Icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
          {/* Contenu textuel */}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-xl font-bold leading-none tabular-nums sm:text-2xl',
                valueColorClass
              )}
            >
              {value}
            </p>
            <p className="mt-1 text-xs font-medium text-foreground sm:text-sm">{label}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground sm:text-xs sm:leading-normal">
              {subtitle}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Carte « Répartition des scores » : barres horizontales animées.
 * Chaque palier affiche son libellé à gauche, sa barre colorée au milieu
 * (largeur proportionnelle au count) et le compte à droite.
 */
function ScoreDistributionCard({
  distribution,
  delay,
}: {
  distribution: CvStats['scoreDistribution']
  delay: number
}) {
  // Calcul du max pour proportionner les largeurs de barres
  const maxCount = Math.max(1, ...distribution.map((d) => d.count))
  const totalScores = distribution.reduce((acc, d) => acc + d.count, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Répartition des scores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalScores === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucun CV réussi pour l&apos;instant.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Les paliers de scores apparaîtront ici.
              </p>
            </div>
          ) : (
            distribution.map((d, i) => (
              <div key={d.range} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {d.label}{' '}
                    <span className="text-muted-foreground">({d.range})</span>
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {d.count}
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(d.count / maxCount) * 100}%`,
                    }}
                    transition={{
                      duration: 0.7,
                      ease: 'easeOut',
                      delay: delay + 0.15 + i * 0.08,
                    }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Carte « Activité (7 derniers jours) » : barres verticales animées
 * avec gradient emerald. Affiche un état vide si tous les comptes sont à 0.
 */
function Activity7DaysCard({
  last7Days,
  delay,
}: {
  last7Days: CvStats['last7Days']
  delay: number
}) {
  const maxCount = Math.max(0, ...last7Days.map((d) => d.count))
  const totalCount = last7Days.reduce((acc, d) => acc + d.count, 0)
  const chartHeight = 120 // px

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Activité (7 derniers jours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalCount === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucune activité cette semaine.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Traitez un CV pour voir l&apos;activité.
              </p>
            </div>
          ) : (
            <div
              className="flex items-end justify-between gap-2"
              style={{ height: chartHeight }}
            >
              {last7Days.map((d, i) => {
                // Hauteur proportionnelle au max, minimum 4px si count > 0
                const ratio = maxCount > 0 ? d.count / maxCount : 0
                const barHeight =
                  d.count > 0 ? Math.max(4, ratio * chartHeight) : 4
                const isToday = i === last7Days.length - 1
                return (
                  <div
                    key={d.date}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <div className="flex w-full flex-1 items-end justify-center">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: barHeight }}
                        transition={{
                          duration: 0.6,
                          ease: 'easeOut',
                          delay: delay + 0.15 + i * 0.07,
                        }}
                        className={cn(
                          'w-full max-w-[28px] rounded-t-md bg-gradient-to-t shadow-sm',
                          isToday
                            ? 'from-teal-500 to-emerald-400'
                            : 'from-emerald-600 to-teal-500'
                        )}
                        title={`${d.label} : ${d.count} CV`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {d.label}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold tabular-nums',
                        d.count > 0
                          ? 'text-foreground'
                          : 'text-muted-foreground/50'
                      )}
                    >
                      {d.count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Carte « Sources » : répartition PDF vs images avec badges et pourcentages.
 * Affiché sous les deux colonnes de graphiques.
 */
function SourceFormatCard({
  pdfCount,
  imageCount,
  delay,
}: {
  pdfCount: number
  imageCount: number
  delay: number
}) {
  const total = pdfCount + imageCount
  const pdfPct = total > 0 ? Math.round((pdfCount / total) * 100) : 0
  const imagePct = total > 0 ? 100 - pdfPct : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            Sources des CV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Ligne PDF */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <FileType2 className="h-4 w-4 text-red-500" />
                PDF
              </span>
              <span className="text-muted-foreground">
                {pdfCount} · {pdfPct}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pdfPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: delay + 0.15 }}
                className="h-full rounded-full bg-red-500"
              />
            </div>
          </div>
          {/* Ligne Images */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <FileImage className="h-4 w-4 text-teal-500" />
                Images
              </span>
              <span className="text-muted-foreground">
                {imageCount} · {imagePct}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${imagePct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: delay + 0.2 }}
                className="h-full rounded-full bg-teal-500"
              />
            </div>
          </div>
          {/* Résumé en badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge
              variant="secondary"
              className="gap-1 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
            >
              <FileType2 className="h-3 w-3" />
              {pdfCount} PDF
            </Badge>
            <Badge
              variant="secondary"
              className="gap-1 bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400"
            >
              <FileImage className="h-3 w-3" />
              {imageCount} images
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*                         Composant principal exporté                        */
/* -------------------------------------------------------------------------- */

/**
 * Tableau de bord de statistiques.
 *
 * Récupère les statistiques via le hook `useCvStats` et les affiche sous
 * forme de tableau de bord animé. Ne rend rien tant que `stats` est `null`
 * ou que `stats.total === 0`.
 */
export function StatsDashboard() {
  const { stats, loading, error, refresh } = useCvStats()

  // Tant qu'on n'a pas de données ET qu'on charge, on ne rend rien
  // (le dashboard est optionnel et ne doit pas bloquer l'UI).
  if (!stats) {
    return null
  }

  // Pas de CV traité → on n'affiche pas le tableau de bord
  if (stats.total === 0) {
    return null
  }

  // Configuration des 4 cartes KPI
  const kpiCards = [
    {
      icon: FileText,
      value: String(stats.total),
      label: 'CV traités',
      subtitle: `${stats.done} réussis · ${stats.errors} erreurs`,
      accentClasses: 'from-emerald-500 to-emerald-600',
      valueColorClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: TrendingUp,
      value: `${stats.averageScore}`,
      label: 'Score moyen / 100',
      subtitle: `Meilleur: ${stats.bestScore} · Pire: ${stats.worstScore}`,
      accentClasses: 'from-teal-500 to-teal-600',
      valueColorClass: 'text-teal-600 dark:text-teal-400',
    },
    {
      icon: CheckCircle2,
      value: `${stats.successRate}%`,
      label: 'Taux de succès',
      subtitle: `Durée moy: ${(stats.averageDuration / 1000).toFixed(1)}s`,
      accentClasses: 'from-cyan-500 to-cyan-600',
      valueColorClass: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      icon: FileOutput,
      value: String(stats.wordCount + stats.pptxCount),
      label: 'Documents générés',
      subtitle: `${stats.wordCount} Word · ${stats.pptxCount} PowerPoint`,
      accentClasses: 'from-orange-500 to-orange-600',
      valueColorClass: 'text-orange-600 dark:text-orange-400',
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mb-8"
      aria-label="Statistiques"
    >
      <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/40">
        {/* En-tête avec titre + bouton refresh */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-gradient-to-r from-emerald-50/50 to-teal-50/50 pb-4 dark:from-emerald-950/20 dark:to-teal-950/10">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Statistiques
            <Badge
              variant="secondary"
              className="ml-1 gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            >
              {stats.total} CV
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="gap-1.5 text-muted-foreground"
            title="Rafraîchir les statistiques"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Rafraîchir</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Bandeau d'erreur (non bloquant) */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Section 1 : cartes KPI (4 sur desktop, 2 sur mobile) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {kpiCards.map((card, i) => (
              <KpiCard
                key={card.label}
                icon={card.icon}
                value={card.value}
                label={card.label}
                subtitle={card.subtitle}
                accentClasses={card.accentClasses}
                valueColorClass={card.valueColorClass}
                delay={0.05 + i * 0.08}
              />
            ))}
          </div>

          {/* Section 1.5 : évolution des scores dans le temps (pleine largeur) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.35 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Évolution des scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreEvolutionChart data={stats.scoreEvolution} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Section 2 : deux colonnes (distribution + activité) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ScoreDistributionCard
              distribution={stats.scoreDistribution}
              delay={0.4}
            />
            <Activity7DaysCard last7Days={stats.last7Days} delay={0.45} />
          </div>

          {/* Section 3 : répartition des formats source */}
          <SourceFormatCard
            pdfCount={stats.pdfCount}
            imageCount={stats.imageCount}
            delay={0.5}
          />
        </CardContent>
      </Card>
    </motion.section>
  )
}

export default StatsDashboard
