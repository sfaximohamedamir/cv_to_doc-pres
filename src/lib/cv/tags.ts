/**
 * Définition des tags de statut de recrutement pour les CV.
 *
 * Les tags permettent à un recruteur de marquer le statut d'un candidat
 * dans son processus de recrutement : à examiner, en entretien, retenu,
 * embauché, ou refusé.
 */

/// Identifiant d'un tag
export type CvTagId = 'none' | 'review' | 'interview' | 'offered' | 'hired' | 'rejected'

/// Configuration d'un tag
export interface CvTag {
  /// Identifiant unique
  id: CvTagId
  /// Nom affichable
  label: string
  /// Description courte
  description: string
  /// Couleur d'accent (classes Tailwind pour badge)
  badgeClass: string
  /// Couleur du point (classes Tailwind)
  dotClass: string
  /// Emoji représentant le tag
  emoji: string
}

/// Registre des tags disponibles
export const CV_TAGS: CvTag[] = [
  {
    id: 'none',
    label: 'Sans tag',
    description: 'Aucun statut défini',
    badgeClass: 'bg-muted text-muted-foreground border-transparent',
    dotClass: 'bg-muted-foreground/40',
    emoji: '⚪',
  },
  {
    id: 'review',
    label: 'À examiner',
    description: 'CV à analyser en priorité',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    dotClass: 'bg-blue-500',
    emoji: '🔵',
  },
  {
    id: 'interview',
    label: 'En entretien',
    description: 'Candidat en processus d\'entretien',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    emoji: '🟡',
  },
  {
    id: 'offered',
    label: 'Offre envoyée',
    description: 'Une offre a été faite au candidat',
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    dotClass: 'bg-purple-500',
    emoji: '🟣',
  },
  {
    id: 'hired',
    label: 'Embauché',
    description: 'Candidat embauché avec succès',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
    emoji: '🟢',
  },
  {
    id: 'rejected',
    label: 'Refusé',
    description: 'Candidature non retenue',
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    dotClass: 'bg-red-500',
    emoji: '🔴',
  },
]

/// Récupère un tag par son ID (défaut : none)
export function getTag(id: CvTagId | string | undefined): CvTag {
  return CV_TAGS.find((t) => t.id === id) || CV_TAGS[0]
}
