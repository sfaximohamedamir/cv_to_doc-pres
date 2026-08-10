'use client'

/**
 * Dialog des paramètres de l'application.
 *
 * Permet à l'utilisateur de :
 *  - Vérifier le statut de la clé API NVIDIA (configurée ou non, source)
 *  - Saisir et enregistrer une nouvelle clé API NVIDIA
 *  - Tester la validité de la clé (appel réel à l'API NVIDIA)
 *  - Supprimer la clé enregistrée (si elle provient de la base de données)
 *
 * Le dialog est accessible via le bouton ⚙️ dans l'en-tête.
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  TestTube,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Copy,
  Cpu,
} from 'lucide-react'
import { TEXT_MODELS } from '@/lib/nvidia/models'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /// Callback appelé après un changement de configuration (pour rafraîchir le statut)
  onConfigChanged?: () => void
}

interface KeyStatus {
  configured: boolean
  source: 'env' | 'database' | 'none'
  canDelete: boolean
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function SettingsDialog({
  open,
  onOpenChange,
  onConfigChanged,
}: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('z-ai/glm-5.2')
  const [status, setStatus] = useState<(KeyStatus & { selectedModel?: string }) | null>(null)

  // Récupérer le statut actuel de la clé à l'ouverture du dialog
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/nvidia-key')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        if (data.selectedModel) {
          setSelectedModel(data.selectedModel)
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchStatus()
      setApiKey('')
      setTestState('idle')
      setTestMessage('')
    }
  }, [open, fetchStatus])

  // Enregistrer la clé API et/ou le modèle
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/nvidia-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          selectedModel,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'enregistrement')
      }

      toast.success('Paramètres enregistrés', {
        description: `Modèle sélectionné : ${selectedModel}`,
      })
      setApiKey('')
      await fetchStatus()
      onConfigChanged?.()
    } catch (err) {
      toast.error('Erreur', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    } finally {
      setSaving(false)
    }
  }, [apiKey, selectedModel, fetchStatus, onConfigChanged])

  // Tester la clé API (celle saisie ou celle configurée)
  const handleTest = useCallback(async () => {
    setTestState('testing')
    setTestMessage('')

    try {
      const body = apiKey.trim()
        ? { apiKey: apiKey.trim() }
        : {}

      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.valid) {
        setTestState('success')
        setTestMessage(data.message)
        toast.success('Clé API valide', {
          description: data.message,
        })
      } else {
        setTestState('error')
        setTestMessage(data.message)
        toast.error('Clé API invalide', {
          description: data.message,
        })
      }
    } catch (err) {
      setTestState('error')
      const msg = err instanceof Error ? err.message : 'Erreur de connexion'
      setTestMessage(msg)
      toast.error('Erreur de test', { description: msg })
    }
  }, [apiKey])

  // Supprimer la clé de la base de données
  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/settings/nvidia-key', {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression')
      }

      toast.success('Clé API supprimée', {
        description: 'L\'agent NVIDIA est maintenant désactivé.',
      })
      await fetchStatus()
      onConfigChanged?.()
    } catch (err) {
      toast.error('Erreur', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    } finally {
      setDeleting(false)
    }
  }, [fetchStatus, onConfigChanged])

  // Copier le lien vers build.nvidia.com
  const copyLink = useCallback(() => {
    navigator.clipboard.writeText('https://build.nvidia.com')
    toast.success('Lien copié', { description: 'https://build.nvidia.com' })
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Paramètres
          </DialogTitle>
          <DialogDescription>
            Configurez la clé API NVIDIA pour activer l'extraction et le scoring IA.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {/* Statut actuel */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Clé API NVIDIA</span>
              </div>
              {status?.configured ? (
                <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Configurée
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Non configurée
                </Badge>
              )}
            </div>
            {status?.configured && (
              <p className="mt-2 text-xs text-muted-foreground">
                Source :{' '}
                <span className="font-medium text-foreground">
                  {status.source === 'env'
                    ? "Variable d'environnement"
                    : status.source === 'database'
                    ? 'Base de données (saisie via l\'interface)'
                    : 'Aucune'}
                </span>
              </p>
            )}
          </div>

          {/* Sélection du Modèle Texte */}
          <div className="space-y-2">
            <Label htmlFor="model-select" className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Modèle d'IA de traitement (Texte & Scoring)
            </Label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-900"
            >
              {TEXT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Sélectionnez <span className="font-semibold text-emerald-600 dark:text-emerald-400">Z.ai GLM 5.2</span> pour bénéficier d'une très grande fenêtre de contexte (évite la saturation de l'API Nemotron).
            </p>
          </div>

          {/* Saisie de la clé */}
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-sm font-medium">
              Saisir votre clé API NVIDIA
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-sm"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Masquer la clé' : 'Afficher la clé'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              La clé est stockée localement dans la base de données de l'application
              et n'est jamais envoyée à un serveur tiers.
            </p>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>

            <Button
              onClick={handleTest}
              disabled={testState === 'testing' || (!apiKey.trim() && !status?.configured)}
              variant="outline"
              className="gap-1.5"
            >
              {testState === 'testing' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Test en cours…
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  Tester
                </>
              )}
            </Button>

            {status?.canDelete && (
              <Button
                onClick={handleDelete}
                disabled={deleting}
                variant="outline"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Supprimer
              </Button>
            )}
          </div>

          {/* Résultat du test */}
          <AnimatePresence>
            {testState !== 'idle' && testState !== 'testing' && testMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-3 text-sm',
                  testState === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
                )}
              >
                {testState === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{testMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Aide : comment obtenir une clé */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold text-foreground">
              📋 Comment obtenir une clé API NVIDIA ?
            </p>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>1. Rendez-vous sur <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-emerald-600 hover:underline dark:text-emerald-400">build.nvidia.com <ExternalLink className="h-3 w-3" /></a></li>
              <li>2. Créez un compte NVIDIA (gratuit) ou connectez-vous</li>
              <li>3. Naviguez vers le modèle Nemotron de votre choix</li>
              <li>4. Cliquez sur "Get API Key" dans le menu de gauche</li>
              <li>5. Copiez la clé (elle commence par <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">nvapi-</code>)</li>
            </ol>
            <button
              onClick={copyLink}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
              Copier le lien
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
