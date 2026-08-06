'use client'

/**
 * Bannière d'avertissement affichée lorsque la clé API NVIDIA n'est pas configurée.
 * Fournit les instructions pour la configurer.
 */

import { useState, useEffect } from 'react'
import { AlertTriangle, X, KeyRound, Copy, Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function NvidiaStatusBanner() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(false)
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
    <Alert className="relative border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="flex items-center gap-2">
        Configuration requise — Clé API NVIDIA manquante
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-7 w-7"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">
          Pour utiliser l'agent, vous devez définir la variable d'environnement{' '}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/50">
            NVIDIA_API_KEY
          </code>{' '}
          avec votre clé personnelle (obtenue sur{' '}
          <a
            href="https://build.nvidia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            build.nvidia.com
          </a>
          ).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyEnv}
            className="border-amber-400 bg-transparent hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30"
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
            Ajoutez cette ligne dans le fichier{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900/50">
              .env.local
            </code>
          </span>
        </div>
      </AlertDescription>
    </Alert>
  )
}
