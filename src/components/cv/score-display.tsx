'use client'

/**
 * Affichage du score du CV :
 *  - Score global avec jauge circulaire animée
 *  - Détail par catégorie (barres de progression)
 *  - Points forts / axes d'amélioration
 *  - Recommandation et niveau de séniorité
 */

import { motion } from 'framer-motion'
import {
  TrendingUp,
  Lightbulb,
  Target,
  Award,
  ThumbsUp,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { CvScore } from '@/lib/cv/types'

export interface ScoreDisplayProps {
  score: CvScore
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
 * Barre de progression colorée pour une catégorie de score.
 */
function CategoryBar({
  name,
  score,
  comment,
  delay,
}: {
  name: string
  score: number
  comment: string
  delay: number
}) {
  let barColor = 'bg-red-500'
  if (score >= 85) barColor = 'bg-emerald-500'
  else if (score >= 70) barColor = 'bg-teal-500'
  else if (score >= 55) barColor = 'bg-amber-500'
  else if (score >= 40) barColor = 'bg-orange-500'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{score}/100</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{comment}</p>
    </motion.div>
  )
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
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
        <CardContent className="space-y-5">
          {score.categories.map((cat, i) => (
            <CategoryBar
              key={cat.name}
              name={cat.name}
              score={cat.score}
              comment={cat.comment}
              delay={0.3 + i * 0.1}
            />
          ))}
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
              Axes d'amélioration
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
