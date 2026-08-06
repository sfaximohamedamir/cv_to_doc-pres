'use client'

/**
 * Affichage du score du CV :
 *  - Score global avec jauge circulaire animée
 *  - Détail par catégorie (barres de progression cliquables et dépliables)
 *  - Points forts / axes d'amélioration
 *  - Recommandation et niveau de séniorité
 *
 * Chaque catégorie est cliquable : au clic, elle se déploie pour révéler
 * une liste de suggestions d'amélioration concrètes et actionnables,
 * spécifiques à la catégorie concernée.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  TrendingUp,
  Lightbulb,
  Target,
  Award,
  ThumbsUp,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CvScore } from '@/lib/cv/types'
import { ScoreRadarChart } from '@/components/cv/score-radar-chart'

export interface ScoreDisplayProps {
  score: CvScore
}

/**
 * Suggestions d'amélioration concrètes et actionnables par catégorie de score.
 *
 * Le mapping couvre les 7 catégories officielles du moteur de scoring.
 * Pour toute catégorie inconnue, on retourne des suggestions génériques.
 *
 * @param categoryName - Le nom de la catégorie (ex: « Clarté et structure »).
 * @param _score - Le score sur 100 (non utilisé actuellement, mais conservé
 *                 pour de futures évolutions — par exemple moduler les
 *                 suggestions selon la gravité du score).
 * @returns Un tableau de 2-3 suggestions en français.
 */
function getCategorySuggestions(categoryName: string, _score: number): string[] {
  const map: Record<string, string[]> = {
    'Clarté et structure': [
      'Utilisez des puces et des sous-titres pour aérer le contenu',
      'Limitez chaque section à 3-5 éléments clés',
      'Ajoutez des mots-clés en gras pour les compétences recherchées',
    ],
    'Impact et réalisations': [
      "Quantifiez vos résultats avec des chiffres (%, €, nombre d'utilisateurs)",
      'Commencez chaque puce par un verbe d\'action (dirigé, optimisé, créé)',
      'Mentionnez l\'impact business de vos réalisations',
    ],
    'Compétences': [
      'Classez vos compétences par catégorie (techniques, langages, outils)',
      'Indiquez un niveau de maîtrise pour chaque compétence',
      'Mettez en avant les compétences mentionnées dans l\'offre visée',
    ],
    'Expérience professionnelle': [
      "Inversez l'ordre chronologique (du plus récent au plus ancien)",
      'Ajoutez le contexte de chaque poste (taille d\'équipe, budget)',
      'Détaillez les technologies utilisées pour chaque mission',
    ],
    'Formation': [
      'Mentionnez les mentions obtenues (Très Bien, Félicitations)',
      'Ajoutez les certifications professionnelles récentes',
      'Incluez les MOOCs pertinents (Coursera, edX)',
    ],
    'Présentation et orthographe': [
      'Faites relire votre CV par une autre personne',
      'Utilisez un correcteur orthographique (Antidote, LanguageTool)',
      'Vérifiez la cohérence des formats de dates et de puces',
    ],
    'Adéquation au marché': [
      "Analysez les offres d'emploi ciblées et intégrez les mots-clés",
      'Adaptez votre CV à chaque candidature',
      'Mettez en avant les compétences les plus demandées dans votre secteur',
    ],
  }

  // Recherche insensible à la casse dans le mapping.
  const lower = categoryName.toLowerCase()
  for (const key of Object.keys(map)) {
    if (key.toLowerCase() === lower) return map[key]
  }

  // Suggestions génériques pour toute catégorie non répertoriée.
  return [
    'Détaillez cette section avec des exemples concrets',
    'Ajoutez des éléments mesurables pour renforcer votre profil',
  ]
}

/**
 * Jauge circulaire SVG animée pour le score global.
 */
function ScoreGauge({ value }: { value: number }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  // Couleur selon le score
  let color = '#dc2626' // rouge
  let label = 'Insuffisant'
  let emoji = '❌'
  if (value >= 85) {
    color = '#16a34a'
    label = 'Excellent'
    emoji = '🌟'
  } else if (value >= 70) {
    color = '#10b981'
    label = 'Très bon'
    emoji = '✅'
  } else if (value >= 55) {
    color = '#f59e0b'
    label = 'Correct'
    emoji = '⚠️'
  } else if (value >= 40) {
    color = '#f97316'
    label = 'À améliorer'
    emoji = '🔧'
  }

  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg className="h-44 w-44 -rotate-90" viewBox="0 0 160 160">
        {/* Cercle de fond */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-muted/30"
        />
        {/* Cercle de progression */}
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl font-bold"
          style={{ color }}
        >
          {value}
        </motion.span>
        <span className="text-xs text-muted-foreground">/ 100</span>
        <span className="mt-1 text-lg">{emoji}</span>
        <span
          className="text-xs font-semibold"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

/**
 * Props du composant `CategoryBar`.
 */
interface CategoryBarProps {
  /** Nom affiché de la catégorie. */
  name: string
  /** Score sur 100. */
  score: number
  /** Commentaire justifiant le score. */
  comment: string
  /** Délai d'animation (en secondes) pour l'entrée. */
  delay: number
  /** Indique si la catégorie est actuellement déployée. */
  isExpanded: boolean
  /** Fonction appelée au clic pour basculer l'état déployé. */
  onToggle: () => void
}

/**
 * Barre de progression colorée pour une catégorie de score.
 *
 * Cliquer sur l'en-tête de la catégorie déploie/replie un panneau contenant
 * des suggestions d'amélioration spécifiques à la catégorie.
 */
function CategoryBar({
  name,
  score,
  comment,
  delay,
  isExpanded,
  onToggle,
}: CategoryBarProps) {
  let barColor = 'bg-red-500'
  if (score >= 85) barColor = 'bg-emerald-500'
  else if (score >= 70) barColor = 'bg-teal-500'
  else if (score >= 55) barColor = 'bg-amber-500'
  else if (score >= 40) barColor = 'bg-orange-500'

  // Récupère les suggestions spécifiques à cette catégorie.
  const suggestions = getCategorySuggestions(name, score)

  // Identifiant DOM utilisé pour lier aria-controls entre le bouton et
  // le panneau de suggestions (accessibilité).
  const suggestionsId = `suggestions-${name
    .replace(/\s+/g, '-')
    .toLowerCase()}`

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="space-y-1.5"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={suggestionsId}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
          {name}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {score}/100
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
            aria-hidden
          />
        </span>
      </button>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{comment}</p>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="suggestions"
            id={suggestionsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                Suggestions d&apos;amélioration
              </div>
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                        barColor
                      )}
                    />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  // Une seule catégorie déployée à la fois (plus propre visuellement).
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* Score global */}
      <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900">
        <CardHeader className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Évaluation globale du CV
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            <ScoreGauge value={score.overallScore} />
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Niveau estimé
                </p>
                <Badge
                  variant="secondary"
                  className="mt-1 gap-1 bg-foreground/5 text-foreground"
                >
                  <Target className="h-3 w-3" />
                  {score.seniorityLevel}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                {score.recommendation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Détail par catégorie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Détail par catégorie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[45%_1fr]">
            <ScoreRadarChart categories={score.categories} />
            <div className="space-y-5">
              {score.categories.map((cat, i) => (
                <CategoryBar
                  key={cat.name}
                  name={cat.name}
                  score={cat.score}
                  comment={cat.comment}
                  delay={0.3 + i * 0.1}
                  isExpanded={expandedCategory === cat.name}
                  onToggle={() =>
                    setExpandedCategory((prev) =>
                      prev === cat.name ? null : cat.name
                    )
                  }
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Points forts et axes d'amélioration */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
              <ThumbsUp className="h-5 w-5" />
              Points forts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {score.strengths.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                  <span className="text-foreground">{s}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Axes d&apos;amélioration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {score.improvements.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                  <span className="text-foreground">{s}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
