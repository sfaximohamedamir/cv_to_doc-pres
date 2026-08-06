'use client'

/**
 * Liste de l'historique des CV traités.
 * Permet de recharger un résultat précédent ou de supprimer une entrée.
 * Inclut recherche textuelle, filtres par format/score et tri.
 */

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History,
  FileText,
  Image as ImageIcon,
  Presentation,
  Trash2,
  Download,
  Clock,
  Star,
  Loader2,
  RefreshCw,
  FileWarning,
  Search,
  Filter,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { HistoryItem } from '@/hooks/use-cv-history'
import { getTag, CV_TAGS, type CvTagId } from '@/lib/cv/tags'

export interface HistoryListProps {
  items: HistoryItem[]
  loading: boolean
  onSelect: (id: string) => void
  onRefresh: () => void
  onRemove: (id: string) => void
  selectedId?: string | null
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffD < 7) return `il y a ${diffD} j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 70) return 'text-teal-600 dark:text-teal-400'
  if (score >= 55) return 'text-amber-600 dark:text-amber-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

type FormatFilter = 'all' | 'word' | 'powerpoint'
type ScoreFilter = 'all' | 'excellent' | 'verygood' | 'correct' | 'poor'
type TagFilter = 'all' | 'none' | 'review' | 'interview' | 'offered' | 'hired' | 'rejected'
type SortBy = 'recent' | 'oldest' | 'best' | 'worst'

export function HistoryList({
  items,
  loading,
  onSelect,
  onRefresh,
  onRemove,
  selectedId,
}: HistoryListProps) {
  // États des filtres et de la recherche
  const [searchQuery, setSearchQuery] = useState('')
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all')
  const [tagFilter, setTagFilter] = useState<TagFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('recent')

  // Calcul mémoïsé de la liste filtrée et triée
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    // 1. Filtrage par recherche textuelle (sur originalName)
    let result = items
    if (query) {
      result = result.filter((item) =>
        item.originalName.toLowerCase().includes(query)
      )
    }

    // 2. Filtrage par format de sortie
    if (formatFilter !== 'all') {
      result = result.filter((item) => item.outputFormat === formatFilter)
    }

    // 3. Filtrage par score
    if (scoreFilter !== 'all') {
      result = result.filter((item) => {
        if (item.score === null) return false
        switch (scoreFilter) {
          case 'excellent':
            return item.score >= 85
          case 'verygood':
            return item.score >= 70 && item.score < 85
          case 'correct':
            return item.score >= 55 && item.score < 70
          case 'poor':
            return item.score < 55
          default:
            return true
        }
      })
    }

    // 3.5. Filtrage par tag
    if (tagFilter !== 'all') {
      result = result.filter((item) => (item.tag || 'none') === tagFilter)
    }

    // 4. Tri
    const sorted = [...result]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        case 'best': {
          const sa = a.score ?? -1
          const sb = b.score ?? -1
          return sb - sa
        }
        case 'worst': {
          const sa = a.score ?? Number.MAX_SAFE_INTEGER
          const sb = b.score ?? Number.MAX_SAFE_INTEGER
          return sa - sb
        }
        default:
          return 0
      }
    })

    return sorted
  }, [items, searchQuery, formatFilter, scoreFilter, tagFilter, sortBy])

  // Indique si au moins un filtre est actif
  const filtersActive =
    searchQuery.trim() !== '' ||
    formatFilter !== 'all' ||
    scoreFilter !== 'all' ||
    tagFilter !== 'all' ||
    sortBy !== 'recent'

  const resetFilters = () => {
    setSearchQuery('')
    setFormatFilter('all')
    setScoreFilter('all')
    setTagFilter('all')
    setSortBy('recent')
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Historique
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {items.length}
            </Badge>
          )}
          {filtersActive &&
            filteredItems.length < items.length && (
              <Badge
                variant="outline"
                className="ml-1 gap-1 text-xs font-normal text-muted-foreground"
              >
                {filteredItems.length}/{items.length}
              </Badge>
            )}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRefresh}
          disabled={loading}
          title="Rafraîchir"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </CardHeader>

      {/* Barre de filtres et de recherche — visible uniquement si des items existent */}
      {items.length > 0 && (
        <div className="space-y-2 border-b p-3">
          {/* Champ de recherche textuelle */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="h-8 pl-8 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                title="Effacer la recherche"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Ligne de filtres : format, score, tri */}
          <div className="flex flex-wrap gap-2">
            <Select
              value={formatFilter}
              onValueChange={(v) => setFormatFilter(v as FormatFilter)}
            >
              <SelectTrigger size="sm" className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="word">Word</SelectItem>
                <SelectItem value="powerpoint">PowerPoint</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={scoreFilter}
              onValueChange={(v) => setScoreFilter(v as ScoreFilter)}
            >
              <SelectTrigger size="sm" className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous scores</SelectItem>
                <SelectItem value="excellent">Excellent (85+)</SelectItem>
                <SelectItem value="verygood">Très bon (70+)</SelectItem>
                <SelectItem value="correct">Correct (55+)</SelectItem>
                <SelectItem value="poor">À améliorer (&lt;55)</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={tagFilter}
              onValueChange={(v) => setTagFilter(v as TagFilter)}
            >
              <SelectTrigger size="sm" className="h-8 flex-1 text-xs">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les tags</SelectItem>
                {CV_TAGS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.emoji} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <SelectTrigger size="sm" className="h-8 flex-1 text-xs">
                <Filter className="h-3 w-3 text-muted-foreground" />
                <SelectValue placeholder="Tri" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récents</SelectItem>
                <SelectItem value="oldest">Plus anciens</SelectItem>
                <SelectItem value="best">Meilleur score</SelectItem>
                <SelectItem value="worst">Pire score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <CardContent className="flex-1 p-0">
        {items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
            <History className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Aucun CV traité pour l'instant.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Vos traitements apparaîtront ici.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          // État vide : items présents mais aucun ne correspond aux filtres
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
            <Filter className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Aucun CV ne correspond à vos critères.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={resetFilters}
            >
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-280px)] min-h-[300px] px-3">
            <div className="space-y-2 pb-3">
              <AnimatePresence initial={false}>
                {filteredItems.map((item) => {
                  const isPdf = item.sourceType === 'application/pdf'
                  const isError = item.status === 'error'
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className={cn(
                        'group relative cursor-pointer rounded-lg border p-3 transition-all',
                        selectedId === item.id
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                          : 'border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/50'
                      )}
                      onClick={() => onSelect(item.id)}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
                            isError
                              ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                              : isPdf
                              ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                              : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                          )}
                        >
                          {isError ? (
                            <FileWarning className="h-4 w-4" />
                          ) : isPdf ? (
                            <FileText className="h-4 w-4" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.originalName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {formatRelativeDate(item.createdAt)}
                            </span>
                            {item.outputFormat === 'powerpoint' ? (
                              <span className="flex items-center gap-0.5">
                                <Presentation className="h-3 w-3" />
                                PPTX
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5">
                                <FileText className="h-3 w-3" />
                                DOCX
                              </span>
                            )}
                            {item.durationMs && (
                              <span>{(item.durationMs / 1000).toFixed(1)}s</span>
                            )}
                          </div>
                          {isError ? (
                            <p className="mt-1 truncate text-xs text-destructive">
                              {item.errorMessage || 'Erreur de traitement'}
                            </p>
                          ) : item.score !== null ? (
                            <p
                              className={cn(
                                'mt-1 flex items-center gap-1 text-xs font-semibold',
                                getScoreColor(item.score)
                              )}
                            >
                              <Star className="h-3 w-3 fill-current" />
                              {item.score}/100
                              {item.tag && item.tag !== 'none' && (
                                <span className="ml-1 inline-flex items-center gap-0.5">
                                  <span className={cn('h-1.5 w-1.5 rounded-full', getTag(item.tag as CvTagId).dotClass)} />
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    {getTag(item.tag as CvTagId).label}
                                  </span>
                                </span>
                              )}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-1">
                          {item.downloadUrl && (
                            <a
                              href={item.downloadUrl}
                              onClick={(e) => e.stopPropagation()}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Télécharger"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemove(item.id)
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
