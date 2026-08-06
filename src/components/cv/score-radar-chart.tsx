'use client'

/**
 * Graphique radar (spider chart) des scores par catégorie du CV.
 *
 * Visualise simultanément les 7 catégories de score sous forme de polygone,
 * afin de permettre d'identifier en un coup d'œil les forces et les faiblesses
 * du CV analysé.
 *
 * Utilise `recharts` (RadarChart) et Framer Motion pour l'animation d'entrée.
 * La palette est emerald / teal, cohérente avec le reste de l'interface.
 */

import { motion } from 'framer-motion'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { useTheme } from 'next-themes'
import type { ScoreCategory } from '@/lib/cv/types'

/**
 * Props du composant `ScoreRadarChart`.
 */
export interface ScoreRadarChartProps {
  /** Liste des catégories de score (généralement 7). */
  categories: Array<{ name: string; score: number; comment: string }>
}

/**
 * Raccourcit le nom d'une catégorie pour l'affichage sur l'axe du radar.
 *
 * Les noms complets (ex: « Clarté et structure ») sont souvent trop longs et
 * se chevauchent sur le graphique radar. On utilise donc une version courte.
 *
 * Si la catégorie n'est pas dans le mapping connu, on retourne le premier mot
 * significatif ou le nom tel quel s'il est déjà court.
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

  // Recherche exacte (insensible à la casse) dans le mapping.
  const exact = map[name]
  if (exact) return exact

  // Recherche insensible à la casse.
  const lower = name.toLowerCase()
  for (const key of Object.keys(map)) {
    if (key.toLowerCase() === lower) return map[key]
  }

  // Fallback : si le nom est court (≤ 12 caractères), on le garde tel quel.
  if (name.length <= 12) return name

  // Sinon, on garde le premier mot.
  const firstWord = name.split(/\s+/)[0]
  return firstWord || name
}

/**
 * Graphique radar des scores par catégorie.
 *
 * @param categories - Les catégories de score à afficher.
 */
export function ScoreRadarChart({ categories }: ScoreRadarChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Couleurs adaptées au thème (les classes Tailwind ne s'appliquent pas
  // correctement aux attributs SVG stroke/fill de recharts).
  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const tickColor = isDark ? '#9ca3af' : '#374151'
  const radarStroke = isDark ? '#34d399' : '#059669'
  const radarFillStart = isDark ? '#10b981' : '#10b981'
  const radarFillEnd = isDark ? '#10b981' : '#10b981'

  // Transformation des catégories vers le format attendu par recharts.
  const data = categories.map((cat) => ({
    category: shortenCategoryName(cat.name),
    score: cat.score,
    fullMark: 100,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
      className="flex flex-col items-center"
    >
      <div className="w-full" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={data}
            cx="50%"
            cy="50%"
            outerRadius="72%"
            margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
          >
            <defs>
              <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={radarFillStart} stopOpacity={isDark ? 0.55 : 0.45} />
                <stop offset="100%" stopColor={radarFillEnd} stopOpacity={isDark ? 0.25 : 0.15} />
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
              name="Score"
              dataKey="score"
              stroke={radarStroke}
              strokeWidth={2}
              fill="url(#radarGradient)"
              fillOpacity={1}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Plus la zone est large, meilleur est le score
      </p>
    </motion.div>
  )
}

export default ScoreRadarChart
