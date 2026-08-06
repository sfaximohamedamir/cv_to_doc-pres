'use client'

/**
 * Bannière d'avertissement compacte affichée lorsque la clé API NVIDIA
 * n'est pas configurée.
 *
 * Version compacte : une seule ligne repliable. Cliquable pour afficher
 * les détails de configuration (modèle de clé, lien, instructions).
 * Moins intrusive que la version précédente.
 */

import { useState, useEffect } from 'react'
import { AlertTriangle, X, KeyRound, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function NvidiaStatusBanner() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => setConfigured(d.nvidiaConfigured))
      .catch(() => setConfigured(false))
  }, [])

  if (configured !== false || dismissed) return null

  const copyEnv = () => {
    navigator.clipboard.writeText('NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx')
    setCopied(true)
    toast.success('Modèle copié !', {
      description: 'Collez-le dans votre fichier .env.local',
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
      {/* Barre compacte (toujours visible) */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-1.5 text-left text-sm text-amber-900 dark:text-amber-100"
        >
          <span className="font-medium">Clé API NVIDIA requise</span>
          <span className="hidden text-amber-700/80 dark:text-amber-200/80 sm:inline">
            — le scoring IA nécessite une clé
          </span>
          {expanded ? (
            <ChevronUp className="ml-auto h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <ChevronDown className="ml-auto h-3.5 w-3.5 flex-shrink-0" />
          )}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
          onClick={() => setDismissed(true)}
          title="Masquer"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Détails repliables */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-amber-200 dark:border-amber-800"
          >
            <div className="space-y-3 px-3 py-3 text-sm text-amber-900 dark:text-amber-100">
              <p>
                Pour activer le scoring IA, définissez la variable{' '}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/50">
                  NVIDIA_API_KEY
                </code>{' '}
                dans votre fichier{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">
                  .env.local
                </code>
                . Obtenez votre clé sur{' '}
                <a
                  href="https://build.nvidia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  build.nvidia.com
                </a>
                .
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyEnv}
                  className={cn(
                    'border-amber-400 bg-transparent hover:bg-amber-100',
                    'dark:border-amber-700 dark:hover:bg-amber-900/30'
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Copié
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copier le modèle
                    </>
                  )}
                </Button>
                <span className="flex items-center gap-1.5 text-xs">
                  <KeyRound className="h-3.5 w-3.5" />
                  Les CV d&apos;exemple restent utilisables sans clé.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
