'use client'

/**
 * Sélecteur de CV d'exemple.
 *
 * Permet à l'utilisateur de tester l'application SANS avoir besoin
 * d'une clé API NVIDIA. Trois profils d'exemple sont proposés :
 *  - "Profil confirmé" (full)
 *  - "Profil junior"    (junior)
 *  - "Profil senior"    (senior)
 *
 * Au clic sur une carte, on appelle GET /api/cv/sample?generate=true
 * qui renvoie un objet CvProcessingResult complet (CV structuré +
 * score + URL de téléchargement du document généré).
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Briefcase,
  GraduationCap,
  Award,
  Info,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CvProcessingResult, OutputFormat } from '@/lib/cv/types'

/// Type de profil d'exemple (correspond au paramètre `type` de l'API).
type SampleType = 'full' | 'junior' | 'senior'

interface SampleProfile {
  /// Identifiant transmis à l'API (`type` query param).
  id: SampleType
  /// Nom affiché.
  label: string
  /// Description courte du profil.
  description: string
  /// Icône lucide associée.
  icon: LucideIcon
  /// Plage de score attendue (badge).
  scoreRange: string
}

/// Les trois profils d'exemple proposés à l'utilisateur.
const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: 'full',
    label: 'Profil confirmé',
    description:
      "Candidat avec 5-8 ans d'expérience, parcours solide et compétences variées.",
    icon: Briefcase,
    scoreRange: '75-85',
  },
  {
    id: 'junior',
    label: 'Profil junior',
    description:
      'Jeune diplômé avec des stages et projets personnels, formation récente.',
    icon: GraduationCap,
    scoreRange: '60-72',
  },
  {
    id: 'senior',
    label: 'Profil senior',
    description:
      'Profil expérimenté (10+ ans) avec leadership, impact business mesurable.',
    icon: Award,
    scoreRange: '85-95',
  },
]

export interface SampleSelectorProps {
  /// Callback appelé avec le résultat complet une fois le CV généré.
  onResult: (result: CvProcessingResult) => void
  /// Format de sortie demandé (word ou powerpoint).
  outputFormat: OutputFormat
  /// Template visuel à appliquer (modern, classic, creative, minimal).
  templateId?: string
  /// Désactive le composant (pendant un autre traitement par exemple).
  disabled?: boolean
}

export function SampleSelector({
  onResult,
  outputFormat,
  templateId,
  disabled,
}: SampleSelectorProps) {
  // Profil en cours de génération (null si aucun).
  const [loadingId, setLoadingId] = useState<SampleType | null>(null)
  // Message d'erreur éventuel.
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate(type: SampleType) {
    if (disabled || loadingId) return
    setLoadingId(type)
    setError(null)
    try {
      const url =
        `/api/cv/sample?generate=true` +
        `&format=${encodeURIComponent(outputFormat)}` +
        `&type=${encodeURIComponent(type)}` +
        (templateId ? `&template=${encodeURIComponent(templateId)}` : '')
      const res = await fetch(url, { method: 'GET' })
      let data: any = {}
      const rawText = await res.text()
      if (rawText) {
        try {
          data = JSON.parse(rawText)
        } catch {
          data = { error: rawText }
        }
      }
      if (!res.ok) {
        throw new Error(
          (data && (data.error as string)) || `Erreur ${res.status}`
        )
      }
      onResult(data as CvProcessingResult)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la génération du CV d'exemple."
      )
    } finally {
      setLoadingId(null)
    }
  }

  const isLoading = loadingId !== null
  const isDisabled = Boolean(disabled)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* En-tête */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:border-emerald-900 dark:from-emerald-950/30 dark:to-teal-950/20">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Info className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Pas de clé NVIDIA ? Testez avec un CV d&apos;exemple
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sélectionnez un profil pour générer instantanément un CV complet
            (extraction + scoring + document) sans appeler l&apos;API NVIDIA.
          </p>
        </div>
      </div>

      {/* Cartes des profils d'exemple */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SAMPLE_PROFILES.map((profile) => {
          const Icon = profile.icon
          const isThisLoading = loadingId === profile.id
          return (
            <motion.button
              key={profile.id}
              type="button"
              whileHover={!isDisabled && !isLoading ? { scale: 1.02 } : undefined}
              whileTap={!isDisabled && !isLoading ? { scale: 0.98 } : undefined}
              onClick={() => handleGenerate(profile.id)}
              disabled={isDisabled || isLoading}
              className={cn(
                'group relative flex h-full flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                'border-emerald-200 bg-card hover:border-emerald-500 hover:bg-emerald-50/60',
                'dark:border-emerald-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20',
                (isDisabled || isLoading) && 'cursor-not-allowed opacity-60'
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  {isThisLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                >
                  Score ~ {profile.scoreRange}
                </Badge>
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{profile.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {profile.description}
                </p>
              </div>

              <div className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {isThisLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Génération du CV d&apos;exemple...
                  </>
                ) : (
                  <span className="group-hover:underline underline-offset-2">
                    Générer ce profil →
                  </span>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Message d'erreur */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Indicateur de chargement global */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Génération du CV d&apos;exemple...
        </div>
      )}
    </motion.div>
  )
}
