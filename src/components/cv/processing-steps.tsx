'use client'

/**
 * Affichage animé des étapes de traitement du pipeline.
 */

import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react'
import type { ProcessingStep } from '@/lib/cv/types'
import { cn } from '@/lib/utils'

export interface ProcessingStepsProps {
  steps: ProcessingStep[]
}

const STEP_ICONS: Record<string, string> = {
  upload: '01',
  extract: '02',
  convert: '03',
  score: '04',
}

export function ProcessingSteps({ steps }: ProcessingStepsProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <div key={step.id} className="relative flex gap-3 pb-4">
            {/* Ligne de connexion */}
            {!isLast && (
              <div className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-0.5 bg-border" />
            )}

            {/* Icône d'étape */}
            <div className="relative z-10 flex-shrink-0">
              {step.status === 'pending' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-background">
                  <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {step.status === 'running' && (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                </motion.div>
              )}
              {step.status === 'done' && (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </motion.div>
              )}
              {step.status === 'error' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
                  <XCircle className="h-4 w-4" />
                </div>
              )}
            </div>

            {/* Contenu de l'étape */}
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Étape {STEP_ICONS[step.id] || ''}
                </span>
                {step.status === 'running' && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    En cours…
                  </span>
                )}
              </div>
              <p
                className={cn(
                  'mt-0.5 text-sm font-medium',
                  step.status === 'pending' && 'text-muted-foreground',
                  step.status === 'running' && 'text-foreground',
                  step.status === 'done' && 'text-foreground',
                  step.status === 'error' && 'text-destructive'
                )}
              >
                {step.label}
              </p>
              {step.detail && (
                <p className="mt-0.5 text-xs text-destructive">{step.detail}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
