'use client'

/**
 * Recherche full-text dans l'historique des CV.
 *
 * Ouvre un dialog avec un champ de recherche qui interroge l'API
 * /api/cv/search?q=... pour chercher dans le contenu extrait des CV
 * (nom du candidat, email, entreprises, compétences, texte du PDF/image).
 *
 * Affiche les résultats avec un snippet mettant en évidence la correspondance.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  FileText,
  Image as ImageIcon,
  Download,
  X,
  CornerDownLeft,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface SearchResultItem {
  id: string
  originalName: string
  sourceType: string
  outputFormat: string
  outputName: string | null
  status: string
  score: number | null
  language: string | null
  downloadUrl: string | null
  createdAt: string
  snippet: string
  matchedField: string
}

export interface FullTextSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectResult: (id: string) => void
}

/// Débounced search hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function FullTextSearch({
  open,
  onOpenChange,
  onSelectResult,
}: FullTextSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 350)

  // Réinitialiser l'état quand le dialog se ferme (via le handler, pas dans l'effet)
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setQuery('')
        setResults([])
        setHasSearched(false)
        setLoading(false)
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  // Effectuer la recherche quand la requête change (debounced)
  useEffect(() => {
    if (!open || debouncedQuery.trim().length < 2) {
      return
    }

    let cancelled = false
    // Utiliser queueMicrotask pour éviter le setState synchrone dans l'effet
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      fetch(
        `/api/cv/search?q=${encodeURIComponent(debouncedQuery)}&limit=20`
      )
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          setResults(data.items || [])
          setHasSearched(true)
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setHasSearched(true)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, open])

  // Focus sur l'input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSelect = useCallback(
    (id: string) => {
      onSelectResult(id)
      handleOpenChange(false)
    },
    [onSelectResult, handleOpenChange]
  )

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= 70) return 'text-teal-600 dark:text-teal-400'
    if (score >= 55) return 'text-amber-600 dark:text-amber-400'
    return 'text-orange-600 dark:text-orange-400'
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="sr-only">
          <DialogTitle>Recherche full-text</DialogTitle>
          <DialogDescription>
            Rechercher dans le contenu de tous les CV traités.
          </DialogDescription>
        </DialogHeader>

        {/* Barre de recherche */}
        <div className="flex items-center gap-2 border-b p-4">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, email, entreprise, compétence…"
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Info bar */}
        {query.trim().length > 0 && query.trim().length < 2 && (
          <div className="px-4 py-2 text-xs text-muted-foreground">
            Saisissez au moins 2 caractères pour lancer la recherche.
          </div>
        )}
        {hasSearched && !loading && query.trim().length >= 2 && (
          <div className="px-4 py-2 text-xs text-muted-foreground">
            {results.length > 0
              ? `${results.length} résultat${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''} pour « ${query} »`
              : `Aucun résultat pour « ${query} »`}
          </div>
        )}

        {/* Résultats */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-2">
            {results.length === 0 && hasSearched && !loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Aucun CV trouvé</p>
                <p className="text-xs text-muted-foreground/70">
                  Essayez avec d'autres mots-clés (nom, compétence, entreprise…)
                </p>
              </div>
            )}

            {results.length === 0 && !hasSearched && !loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Recherche full-text
                </p>
                <p className="text-xs text-muted-foreground/70 max-w-xs">
                  Cherchez dans le contenu de tous vos CV : nom du candidat,
                  email, entreprises, compétences, formations…
                </p>
              </div>
            )}

            <AnimatePresence>
              {results.map((item, i) => {
                const isPdf = item.sourceType === 'application/pdf'
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleSelect(item.id)}
                    className="group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
                        isPdf
                          ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                      )}
                    >
                      {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.originalName}
                        </p>
                        {item.score !== null && (
                          <span className={cn('flex-shrink-0 text-xs font-bold', getScoreColor(item.score))}>
                            {item.score}/100
                          </span>
                        )}
                      </div>
                      {item.snippet && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.snippet}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.matchedField && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {item.matchedField}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground/70">
                          {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                    <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
