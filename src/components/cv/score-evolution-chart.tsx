'use client'

/**
 * Graphique d'évolution des scores dans le temps.
 *
 * Affiche une courbe linéaire (line chart) montrant comment évoluent les
 * scores des CV traités au fur et à mesure des transformations. Deux séries
 * sont tracées :
 *
 *  1. **Score** — le score individuel de chaque CV (ligne pleine emerald).
 *  2. **Moyenne cumulée** — la moyenne des scores jusqu'à ce point
 *     (ligne pointillée teal).
 *
 * L'axe X correspond à l'index chronologique (CV #1, #2, …) et l'axe Y au
 * score (0-100). Un tooltip personnalisé affiche le nom du CV, la date
 * formatée en DD/MM/YYYY, le score et la moyenne cumulée.
 *
 * Si moins de 2 points sont disponibles, un message d'état vide s'affiche
 * (le graphique nécessite au minimum 2 CV pour être lisible).
 *
 * Utilise `recharts` (LineChart) et Framer Motion pour l'animation d'entrée.
 * La palette est emerald / teal, cohérente avec le reste de l'interface.
 * Les couleurs de grille et de texte s'adaptent au thème clair/sombre via
 * `useTheme` (même approche que `score-radar-chart.tsx`).
 */

import { motion } from 'framer-motion'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from 'next-themes'
import { TrendingUp } from 'lucide-react'

/**
 * Forme d'un point de données (identique à `ScoreEvolutionItem` du hook).
 */
export interface ScoreEvolutionPoint {
  /** Date ISO du traitement */
  date: string
  /** Score obtenu (0-100) */
  score: number
  /** Nom du fichier source d'origine */
  name: string
  /** Format de sortie : `'word'` ou `'powerpoint'` */
  format: string
  /** Index chronologique (1-based) */
  index: number
  /** Moyenne cumulée des scores jusqu'à ce point (0-100) */
  cumulativeAvg: number
}

/**
 * Props du composant `ScoreEvolutionChart`.
 */
export interface ScoreEvolutionChartProps {
  /** Série chronologique des scores (un point par CV réussi scoré). */
  data: ScoreEvolutionPoint[]
}

/**
 * Formate une date ISO en chaîne DD/MM/YYYY (format français).
 *
 * @param iso - Date au format ISO (ex: `2024-12-31T10:30:00.000Z`).
 * @returns La date formatée, par exemple `31/12/2024`.
 */
function formatFrDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Traduit le code format en libellé français lisible.
 */
function formatLabel(format: string): string {
  if (format === 'word') return 'Word'
  if (format === 'powerpoint') return 'PowerPoint'
  return format
}

/**
 * Props du tooltip personnalisé recharts.
 */
interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: ScoreEvolutionPoint
  }>
}

/**
 * Tooltip personnalisé affichant le nom du CV, la date, le score et la
 * moyenne cumulée. Le payload de recharts contient une entrée par série
 * (Score et Moyenne cumulée) ; on lit directement le `payload` (l'élément
 * complet) commun aux deux séries pour récupérer les métadonnées.
 */
function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  if (!point) return null

  return (
    <div className="rounded-lg border border-emerald-200/60 bg-background/95 px-3 py-2 shadow-md backdrop-blur-sm dark:border-emerald-900/50">
      <p className="max-w-[220px] truncate text-xs font-semibold text-foreground">
        {point.name}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        CV #{point.index} · {formatLabel(point.format)} ·{' '}
        {formatFrDate(point.date)}
      </p>
      <div className="mt-1.5 space-y-0.5 text-[11px]">
        <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#10b981' }}
          />
          Score : <span className="font-semibold tabular-nums">{point.score}</span>
        </p>
        <p className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#0d9488' }}
          />
          Moyenne cumulée :{' '}
          <span className="font-semibold tabular-nums">{point.cumulativeAvg}</span>
        </p>
      </div>
    </div>
  )
}

/**
 * Graphique d'évolution des scores dans le temps.
 *
 * @param data - La série chronologique des scores à afficher.
 */
export function ScoreEvolutionChart({ data }: ScoreEvolutionChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Couleurs adaptées au thème (les classes Tailwind ne s'appliquent pas
  // correctement aux attributs SVG stroke/fill de recharts).
  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const tickColor = isDark ? '#9ca3af' : '#374151'
  const axisStroke = isDark ? '#4b5563' : '#d1d5db'

  // État vide : moins de 2 points → on ne peut pas tracer une évolution.
  if (!data || data.length < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex h-[280px] flex-col items-center justify-center gap-2 text-center"
      >
        <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Pas encore assez de données pour afficher l&apos;évolution (minimum 2 CV).
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridColor}
            strokeOpacity={isDark ? 0.6 : 0.7}
            vertical={false}
          />
          <XAxis
            dataKey="index"
            stroke={axisStroke}
            tick={{ fill: tickColor, fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: axisStroke }}
            label={{
              value: '#',
              position: 'insideBottomRight',
              offset: -4,
              fill: tickColor,
              fontSize: 11,
              fontWeight: 500,
            }}
            allowDecimals={false}
          />
          <YAxis
            domain={[0, 100]}
            stroke={axisStroke}
            tick={{ fill: tickColor, fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: axisStroke }}
            label={{
              value: 'Score',
              angle: -90,
              position: 'insideLeft',
              offset: 16,
              fill: tickColor,
              fontSize: 11,
              fontWeight: 500,
            }}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: isDark ? '#4b5563' : '#d1d5db',
              strokeWidth: 1,
              strokeDasharray: '3 3',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="cumulativeAvg"
            name="Moyenne cumulée"
            stroke="#0d9488"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: '#0d9488', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#0d9488', stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

export default ScoreEvolutionChart
