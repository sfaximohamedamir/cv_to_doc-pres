'use client'

/**
 * Heatmap d'activité : 7 jours (lignes) x 24 heures (colonnes).
 *
 * Chaque cellule est colorée selon le nombre de CV traités ce jour-là
 * à cette heure. Permet d'identifier les pics d'activité.
 *
 * Inspiré des heatmaps de contribution GitHub, avec la palette emerald.
 */

import { motion } from 'framer-motion'
import { CalendarClock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ActivityHeatmapItem } from '@/hooks/use-cv-stats'
import { cn } from '@/lib/utils'

export interface ActivityHeatmapProps {
  data: ActivityHeatmapItem[]
  delay?: number
}

/// Calcule l'intensité de couleur (0-4) pour une valeur donnée.
function getIntensity(value: number, max: number): number {
  if (value === 0 || max === 0) return 0
  const ratio = value / max
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

/// Classes Tailwind pour chaque niveau d'intensité (bien visibles et colorées).
const INTENSITY_CLASSES = [
  'bg-emerald-500/10 dark:bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/10',
  'bg-emerald-200 dark:bg-emerald-900/60 hover:bg-emerald-300',
  'bg-emerald-400 dark:bg-emerald-700/80 hover:bg-emerald-500',
  'bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-600',
  'bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700',
]

export function ActivityHeatmap({ data, delay = 0 }: ActivityHeatmapProps) {
  // Trouver la valeur maximale pour l'échelle de couleur.
  const max = Math.max(1, ...data.flatMap((d) => d.hours))
  const totalActivity = data.reduce((sum, d) => sum + d.hours.reduce((a, b) => a + b, 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Heatmap d&apos;activité
            {totalActivity > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({totalActivity} traitement{totalActivity > 1 ? 's' : ''} cette semaine)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalActivity === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucune activité cette semaine.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Traitez des CV pour voir vos pics d&apos;activité ici.
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-x-auto pb-1">
              <div className="min-w-[480px]">
                {/* Labels des heures (alignés parfaitement sur les 24 colonnes) */}
                <div className="mb-1 flex gap-1 pl-10">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div
                      key={h}
                      className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
                    >
                      {h % 3 === 0 ? `${h}h` : ''}
                    </div>
                  ))}
                </div>

                {/* Grille de la heatmap */}
                <div className="space-y-1">
                  {data.map((day, dayIdx) => (
                    <div key={dayIdx} className="flex items-center gap-1">
                      {/* Label du jour */}
                      <div className="w-9 flex-shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                        {day.day}
                      </div>
                      {/* Cellules des 24 heures */}
                      <div className="flex flex-1 gap-1">
                        {day.hours.map((count, hourIdx) => {
                          const intensity = getIntensity(count, max)
                          return (
                            <motion.div
                              key={hourIdx}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                duration: 0.2,
                                delay: delay + 0.05 + dayIdx * 0.01 + hourIdx * 0.003,
                              }}
                              className={cn(
                                'h-4 flex-1 min-w-0 rounded-sm transition-all hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1 hover:ring-offset-background',
                                INTENSITY_CLASSES[intensity]
                              )}
                              title={`${day.day} ${hourIdx}h00 : ${count} CV traité${count > 1 ? 's' : ''}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Légende */}
                <div className="mt-3 flex items-center justify-end gap-2 pr-1">
                  <span className="text-[10px] text-muted-foreground">Moins</span>
                  <div className="flex gap-1">
                    {INTENSITY_CLASSES.map((cls, i) => (
                      <div
                        key={i}
                        className={cn('h-3.5 w-3.5 rounded-sm', cls)}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Plus</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
