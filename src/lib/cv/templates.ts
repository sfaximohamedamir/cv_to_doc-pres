/**
 * Définition des modèles (templates) de CV disponibles.
 *
 * Chaque template définit une palette de couleurs et un style de mise en page
 * qui peuvent être appliqués aux documents Word et PowerPoint générés.
 *
 * Les templates sont des variantes visuelles (couleurs d'accent, styles de
 * titres) — la structure du contenu reste la même, seule l'esthétique change.
 */

/// Identifiant d'un template
export type CvTemplateId = 'modern' | 'classic' | 'creative' | 'minimal'

/// Configuration d'un template
export interface CvTemplate {
  /// Identifiant unique
  id: CvTemplateId
  /// Nom affichable
  name: string
  /// Description courte
  description: string
  /// Couleur d'accent principale (hex sans #)
  accentColor: string
  /// Couleur d'accent secondaire (hex sans #)
  secondaryColor: string
  /// Couleur de fond de l'en-tête (hex sans #)
  headerBg: string
  /// Couleur du texte sur fond d'accent (hex sans #)
  accentTextColor: string
  /// Indique si les titres de section ont une bordure inférieure
  sectionBorder: boolean
  /// Indique si l'en-tête a un fond coloré
  coloredHeader: boolean
  /// Style de puces pour les listes
  bulletStyle: 'dot' | 'dash' | 'arrow' | 'square'
  /// Emoji ou icône représentant le template
  emoji: string
}

/// Registre des templates disponibles
export const CV_TEMPLATES: CvTemplate[] = [
  {
    id: 'modern',
    name: 'Moderne',
    description: 'Design épuré avec accents émeraude, idéal pour les profils tech.',
    accentColor: '10B981',
    secondaryColor: '0D9488',
    headerBg: 'F0FDF4',
    accentTextColor: 'FFFFFF',
    sectionBorder: true,
    coloredHeader: false,
    bulletStyle: 'dot',
    emoji: '🟢',
  },
  {
    id: 'classic',
    name: 'Classique',
    description: 'Style traditionnel avec accents bleu marine, pour les secteurs formels.',
    accentColor: '1E3A5F',
    secondaryColor: '475569',
    headerBg: 'F1F5F9',
    accentTextColor: 'FFFFFF',
    sectionBorder: true,
    coloredHeader: true,
    bulletStyle: 'dash',
    emoji: '🔵',
  },
  {
    id: 'creative',
    name: 'Créatif',
    description: 'Touches orange/violet pour les profils design et marketing.',
    accentColor: 'EA580C',
    secondaryColor: '9333EA',
    headerBg: 'FFF7ED',
    accentTextColor: 'FFFFFF',
    sectionBorder: false,
    coloredHeader: true,
    bulletStyle: 'arrow',
    emoji: '🟠',
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    description: 'Noir et blanc, typographie soignée, pour un rendu épuré.',
    accentColor: '1F2937',
    secondaryColor: '6B7280',
    headerBg: 'FFFFFF',
    accentTextColor: 'FFFFFF',
    sectionBorder: true,
    coloredHeader: false,
    bulletStyle: 'square',
    emoji: '⚫',
  },
]

/// Récupère un template par son ID (défaut : modern)
export function getTemplate(id: CvTemplateId | string | undefined): CvTemplate {
  return CV_TEMPLATES.find((t) => t.id === id) || CV_TEMPLATES[0]
}
