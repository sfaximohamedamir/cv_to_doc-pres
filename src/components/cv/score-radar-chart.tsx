'use client'

/**
 * Graphique radar (spider chart) des scores par catégorie du CV.
 *
 * Visualise simultanément les 7 catégories de score sous forme de polygone,
 * afin de permettre d'identifier en un coup d'œil les forces et les faiblesses
 * du CV analysé.
 *
 * Un bouton « PNG » permet d'exporter le graphique au format PNG :
 * le SVG est sérialisé puis dessiné sur un canvas avec un fond adapté au
 * thème (clair/sombre), puis téléchargé en tant qu'image.
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
import { useRef } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

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
 * Graphique radar des scores par catégorie, avec export PNG.
 *
 * @param categories - Les catégories de score à afficher.
 */
export function ScoreRadarChart({ categories }: ScoreRadarChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)

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

  /**
   * Exporte le graphique radar actuel au format PNG.
   *
   * Étapes :
   *  1. Récupère le SVG rendu par recharts dans le conteneur référencé.
   *  2. Clone le SVG et lui attribue des dimensions explicites (le SVG
   *     recharts utilise souvent width/height en pourcentage, non reconnus
   *     par l'élément <img> chargé depuis un blob).
   *  3. Sérialise le SVG en garantissant la présence de l'attribut `xmlns`
   *     (sinon l'Image refuse de charger le blob SVG).
   *  4. Dessine le SVG sur un canvas 2x (retina) avec un fond adapté au thème.
   *  5. Convertit le canvas en blob PNG et déclenche le téléchargement.
   *  6. Affiche un toast de confirmation (ou d'erreur) via sonner.
   */
  const handleDownloadPng = () => {
    const svg = containerRef.current?.querySelector('svg')
    if (!svg) {
      toast.error("Échec de l'export", {
        description: "Aucun graphique à exporter n'a été trouvé.",
      })
      return
    }

    // Clone pour ne pas muter le SVG rendu par recharts.
    const svgClone = svg.cloneNode(true) as SVGSVGElement
    const svgSize = svg.getBoundingClientRect()
    const width = Math.max(1, svgSize.width)
    const height = Math.max(1, svgSize.height)
    svgClone.setAttribute('width', String(width))
    svgClone.setAttribute('height', String(height))

    // Sérialisation et ajout de l'attribut xmlns si absent.
    const svgData = new XMLSerializer().serializeToString(svgClone)
    const svgWithNs = svgData.includes('xmlns')
      ? svgData
      : svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')

    // Préparation du canvas 2x pour la netteté sur écrans retina.
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast.error("Échec de l'export", {
        description: "Le contexte canvas 2D n'est pas disponible.",
      })
      return
    }
    canvas.width = width * 2
    canvas.height = height * 2

    // Fond adapté au thème pour la lisibilité du PNG exporté.
    ctx.fillStyle = isDark ? '#1f2937' : '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Chargement du SVG dans une Image puis dessin sur le canvas.
    const blob = new Blob([svgWithNs], {
      type: 'image/svg+xml;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          toast.error("Échec de l'export", {
            description: "La conversion en PNG a échoué.",
          })
          return
        }
        const pngUrl = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = 'radar-scores.png'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(pngUrl)
        toast.success('Graphique téléchargé', {
          description: 'Le radar a été exporté en PNG',
        })
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error("Échec de l'export", {
        description: "Le SVG n'a pas pu être chargé en image.",
      })
    }
    img.src = url
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
      className="relative flex flex-col items-center"
    >
      {/* Bouton d'export PNG, positionné en haut à droite du graphique */}
      <div className="absolute right-0 top-0 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPng}
          aria-label="Télécharger le graphique en PNG"
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          PNG
        </Button>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 300 }}>
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
