'use client'

/**
 * Bouton d'ouverture du comparateur de CV.
 *
 * Petit bouton secondaire affichant l'icône `GitCompare` et le libellé
 * « Comparer ». Au clic, il ouvre le dialogue de comparaison (`CvComparator`).
 *
 * Le bouton est automatiquement désactivé s'il y a moins de 2 CV scorés dans
 * l'historique (le comparateur a besoin de deux CV pour fonctionner).
 */

import { useMemo, useState } from 'react'
import { GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CvComparator } from '@/components/cv/cv-comparator'
import type { HistoryItem } from '@/hooks/use-cv-history'

/** Props du composant `CompareButton`. */
export interface CompareButtonProps {
  /** Liste des éléments d'historique disponibles. */
  items: HistoryItem[]
  /** Désactive explicitement le bouton (en plus de la règle des 2 CV). */
  disabled?: boolean
  /** Variante visuelle du bouton (par défaut « outline »). */
  variant?: 'outline' | 'secondary' | 'ghost'
  /** Taille du bouton. */
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Bouton d'ouverture du comparateur de CV.
 *
 * @param items - Historique des CV traités.
 * @param disabled - Désactive le bouton manuellement.
 * @param variant - Variante visuelle (outline par défaut).
 * @param size - Taille du bouton.
 */
export function CompareButton({
  items,
  disabled = false,
  variant = 'outline',
  size = 'default',
}: CompareButtonProps) {
  const [open, setOpen] = useState(false)

  // Compter le nombre de CV éligibles (terminés + scorés).
  const eligibleCount = useMemo(
    () => items.filter((it) => it.status === 'done' && it.score !== null).length,
    [items]
  )

  // Le bouton est désactivé s'il y a moins de 2 CV scorés ou si la prop
  // `disabled` est passée explicitement.
  const isDisabled = disabled || eligibleCount < 2

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        disabled={isDisabled}
        title={
          eligibleCount < 2
            ? 'Il faut au moins 2 CV scorés pour comparer'
            : 'Comparer deux CV'
        }
        className="gap-2"
      >
        <GitCompare className="h-4 w-4" />
        Comparer
      </Button>

      <CvComparator open={open} onOpenChange={setOpen} items={items} />
    </>
  )
}

export default CompareButton
