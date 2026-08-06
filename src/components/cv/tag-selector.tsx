'use client'

/**
 * Sélecteur de tag de recrutement pour un CV.
 *
 * Affiche un dropdown compact permettant de marquer un CV avec un statut
 * de recrutement (à examiner, en entretien, retenu, embauché, refusé).
 * Met à jour le tag via l'API PATCH /api/cv/tag.
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CV_TAGS, getTag, type CvTagId } from '@/lib/cv/tags'
import { cn } from '@/lib/utils'

export interface TagSelectorProps {
  /// ID du CV à taguer
  cvId: string
  /// Tag actuel
  tag: string
  /// Callback appelé après la mise à jour réussie
  onTagChanged?: (newTag: string) => void
  /// Taille du sélecteur
  size?: 'sm' | 'default'
  /// Désactive le sélecteur
  disabled?: boolean
}

export function TagSelector({
  cvId,
  tag,
  onTagChanged,
  size = 'sm',
  disabled,
}: TagSelectorProps) {
  const [loading, setLoading] = useState(false)
  const currentTag = getTag(tag as CvTagId)

  const handleTagChange = useCallback(
    async (newTag: string) => {
      if (newTag === tag || loading) return
      setLoading(true)
      try {
        const res = await fetch('/api/cv/tag', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cvId, tag: newTag }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `Erreur ${res.status}`)
        }
        onTagChanged?.(newTag)
        const tagInfo = getTag(newTag as CvTagId)
        toast.success('Tag mis à jour', {
          description: `${tagInfo.emoji} ${tagInfo.label}`,
        })
      } catch (err) {
        toast.error('Erreur lors de la mise à jour du tag', {
          description: err instanceof Error ? err.message : 'Erreur inconnue',
        })
      } finally {
        setLoading(false)
      }
    },
    [cvId, tag, loading, onTagChanged]
  )

  return (
    <Select
      value={tag}
      onValueChange={handleTagChange}
      disabled={disabled || loading}
    >
      <SelectTrigger
        className={cn(
          'h-7 w-auto gap-1 border-0 px-2 text-xs font-medium shadow-none hover:bg-muted/60',
          currentTag.badgeClass,
          size === 'sm' && 'h-7 text-xs'
        )}
      >
        <span className="flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', currentTag.dotClass)} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {CV_TAGS.map((t) => (
          <SelectItem key={t.id} value={t.id} className="gap-2">
            <span className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', t.dotClass)} />
              <span className="font-medium">{t.emoji} {t.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
