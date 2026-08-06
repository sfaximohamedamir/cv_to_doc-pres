'use client'

/**
 * Sélecteur de modèle (template) de CV.
 *
 * Affiche 4 templates visuels (Moderne, Classique, Créatif, Minimaliste)
 * sous forme de cartes cliquables avec un aperçu de la palette de couleurs.
 */

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CV_TEMPLATES, type CvTemplateId } from '@/lib/cv/templates'

export interface TemplateSelectorProps {
  value: CvTemplateId
  onChange: (value: CvTemplateId) => void
  disabled?: boolean
}

export function TemplateSelector({
  value,
  onChange,
  disabled,
}: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CV_TEMPLATES.map((template, i) => {
        const selected = value === template.id
        return (
          <motion.button
            key={template.id}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={!disabled ? { scale: 1.02 } : undefined}
            whileTap={!disabled ? { scale: 0.98 } : undefined}
            onClick={() => !disabled && onChange(template.id)}
            disabled={disabled}
            className={cn(
              'relative flex flex-col gap-2 rounded-lg border-2 p-2.5 text-left transition-all',
              selected
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-border bg-card hover:border-muted-foreground/40',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            {/* Aperçu de la palette */}
            <div className="flex gap-1">
              <div
                className="h-6 flex-1 rounded"
                style={{ backgroundColor: `#${template.accentColor}` }}
              />
              <div
                className="h-6 w-6 rounded"
                style={{ backgroundColor: `#${template.secondaryColor}` }}
              />
            </div>

            {/* Nom + emoji */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-foreground">
                {template.name}
              </span>
              <span className="text-xs">{template.emoji}</span>
            </div>

            {/* Description courte */}
            <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
              {template.description}
            </p>

            {/* Indicateur de sélection */}
            {selected && (
              <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <Check className="h-3 w-3" />
              </div>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
