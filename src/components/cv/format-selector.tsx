'use client'

/**
 * Sélecteur de format de sortie (Word ou PowerPoint).
 * Affiche deux grandes cartes cliquables.
 */

import { motion } from 'framer-motion'
import { FileText, Presentation } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OutputFormat } from '@/lib/cv/types'

export interface FormatSelectorProps {
  value: OutputFormat
  onChange: (value: OutputFormat) => void
  disabled?: boolean
}

export function FormatSelector({ value, onChange, disabled }: FormatSelectorProps) {
  const options: {
    id: OutputFormat
    label: string
    description: string
    icon: typeof FileText
    color: string
    bg: string
    border: string
  }[] = [
    {
      id: 'word',
      label: 'Word (.docx)',
      description: 'Document texte structuré, idéal pour modifier le CV.',
      icon: FileText,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-500',
    },
    {
      id: 'powerpoint',
      label: 'PowerPoint (.pptx)',
      description: 'Présentation en slides, idéal pour un rendu visuel.',
      icon: Presentation,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
      border: 'border-orange-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = value === opt.id
        const Icon = opt.icon
        return (
          <motion.button
            key={opt.id}
            type="button"
            whileHover={!disabled ? { scale: 1.02 } : undefined}
            whileTap={!disabled ? { scale: 0.98 } : undefined}
            onClick={() => !disabled && onChange(opt.id)}
            disabled={disabled}
            className={cn(
              'relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
              selected
                ? `${opt.border} ${opt.bg}`
                : 'border-border bg-card hover:border-muted-foreground/40',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <div
              className={cn(
                'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg',
                selected ? opt.bg : 'bg-muted',
                opt.color
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{opt.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
            </div>
            {selected && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path
                    d="M2 6L5 9L10 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
