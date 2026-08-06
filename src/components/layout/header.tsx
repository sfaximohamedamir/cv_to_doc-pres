'use client'

/**
 * En-tête de l'application.
 * Affiche le logo, le titre et un badge indiquant l'état de configuration NVIDIA.
 * Inclut le bouton Paramètres (⚙️) pour configurer la clé API NVIDIA.
 */

import { useEffect, useState } from 'react'
import { FileText, Cpu, CheckCircle2, AlertCircle, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { SettingsDialog } from '@/components/cv/settings-dialog'

interface StatusInfo {
  nvidiaConfigured: boolean
  nvidiaKeySource: 'env' | 'database' | 'none'
  database: boolean
  cvCount: number
}

export function Header() {
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/status')
      if (res.ok) {
        const data = await res.json()
        setStatus({
          nvidiaConfigured: data.nvidiaConfigured,
          nvidiaKeySource: data.nvidiaKeySource || 'none',
          database: data.database,
          cvCount: data.cvCount,
        })
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-tight text-foreground sm:text-lg">
                CV Transformer Agent
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                PDF / Image → Word / PowerPoint + Scoring IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status && (
              <>
                {/* Badge NVIDIA — cliquable si non configuré */}
                <button
                  onClick={() => !status.nvidiaConfigured && setSettingsOpen(true)}
                  disabled={status.nvidiaConfigured}
                  className={
                    status.nvidiaConfigured
                      ? 'cursor-default'
                      : 'cursor-pointer hover:opacity-80'
                  }
                  title={
                    status.nvidiaConfigured
                      ? `NVIDIA connecté (${status.nvidiaKeySource === 'env' ? 'env' : 'base de données'})`
                      : 'Cliquer pour configurer la clé API NVIDIA'
                  }
                >
                  <Badge
                    variant={status.nvidiaConfigured ? 'default' : 'destructive'}
                    className="hidden gap-1 sm:flex"
                  >
                    {status.nvidiaConfigured ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        NVIDIA connecté
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        Configurer NVIDIA
                      </>
                    )}
                  </Badge>
                </button>
                <Badge variant="secondary" className="hidden gap-1 md:flex">
                  <Cpu className="h-3 w-3" />
                  {status.cvCount} CV traités
                </Badge>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchStatus}
              disabled={loading}
              title="Rafraîchir le statut"
              className="h-9 w-9"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {/* Bouton Paramètres */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="Paramètres"
              className="h-9 w-9"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Dialog des paramètres */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onConfigChanged={fetchStatus}
      />
    </>
  )
}
