'use client'

/**
 * Guide d'onboarding interactif pour les nouveaux utilisateurs.
 *
 * Affiche une boîte de dialogue de bienvenue avec une présentation en
 * 3 étapes du fonctionnement de l'agent. Le guide ne s'affiche qu'une
 * seule fois (état persisté en localStorage).
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  FileSearch,
  FileOutput,
  Gauge,
  X,
  ArrowRight,
  ArrowLeft,
  Rocket,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/// Clé localStorage pour mémoriser si le guide a déjà été vu.
const STORAGE_KEY = 'cv-agent-onboarding-completed'

/// Étapes du guide d'onboarding.
const STEPS = [
  {
    icon: FileSearch,
    title: 'Téléversez votre CV',
    description:
      "Importez un CV au format PDF ou image (PNG, JPEG, WebP). Le modèle NVIDIA Nemotron lit automatiquement le contenu et structure les données (nom, expérience, formation, compétences).",
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    tip: 'Astuce : vous pouvez aussi tester avec un CV d\'exemple sans clé API.',
  },
  {
    icon: FileOutput,
    title: 'Choisissez le format de sortie',
    description:
      "Sélectionnez Word (.docx) pour un document éditable, ou PowerPoint (.pptx) pour une présentation en slides. Le document est généré automatiquement avec une mise en page professionnelle.",
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    tip: 'Astuce : le format Word est idéal pour modifier le CV ensuite.',
  },
  {
    icon: Gauge,
    title: 'Obtenez un score IA',
    description:
      "Le CV est évalué sur 7 critères (clarté, impact, compétences, expérience, formation, présentation, adéquation au marché) avec un score global sur 100, des points forts et des axes d'amélioration personnalisés.",
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    tip: 'Astuce : cliquez sur une catégorie de score pour voir des suggestions détaillées.',
  },
]

export function OnboardingGuide() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  // Vérifier au montage si le guide a déjà été vu.
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        // Petit délai pour laisser la page se charger.
        const timer = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage peut être indisponible (mode privé).
    }
  }, [])

  const handleClose = () => {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      /* ignore */
    }
  }

  const handleSkip = () => {
    handleClose()
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (step > 0) setStep(step - 1)
  }

  const currentStep = STEPS[step]
  const Icon = currentStep.icon
  const isLast = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[480px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Étape {step + 1}/{STEPS.length}
              </Badge>
            </div>
            <button
              onClick={handleSkip}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Passer le guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <DialogTitle className="sr-only">Guide de démarrage</DialogTitle>
          <DialogDescription className="sr-only">
            Guide interactif de présentation de l'agent.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-5 pt-2"
          >
            {/* Icône illustrative */}
            <div className="flex justify-center">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-2xl ${currentStep.bg} ${currentStep.color}`}
              >
                <Icon className="h-10 w-10" />
              </div>
            </div>

            {/* Titre et description */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">
                {currentStep.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {currentStep.description}
              </p>
            </div>

            {/* Astuce */}
            <div className={`rounded-lg border border-border/60 ${currentStep.bg} px-3 py-2`}>
              <p className="text-xs text-foreground/80">
                <span className="font-semibold">💡 {currentStep.tip}</span>
              </p>
            </div>

            {/* Indicateurs de progression */}
            <div className="flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step
                      ? 'w-6 bg-emerald-500'
                      : i < step
                      ? 'w-1.5 bg-emerald-400'
                      : 'w-1.5 bg-muted-foreground/30'
                  }`}
                  aria-label={`Aller à l'étape ${i + 1}`}
                />
              ))}
            </div>

            {/* Boutons de navigation */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={step === 0}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Précédent
              </Button>

              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Passer
              </button>

              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
              >
                {isLast ? (
                  <>
                    <Rocket className="h-4 w-4" />
                    Commencer
                  </>
                ) : (
                  <>
                    Suivant
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
