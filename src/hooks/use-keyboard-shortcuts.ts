'use client'

/**
 * Hook pour gérer les raccourcis clavier globaux de l'application.
 *
 * Raccourcis supportés :
 *  - Ctrl+K / Cmd+K : ouvrir la recherche full-text
 *  - Ctrl+B / Cmd+B : basculer le thème (clair/sombre)
 *  - Ctrl+, / Cmd+, : ouvrir le comparateur de CV
 *  - Escape         : fermer les dialogs (géré nativement par Radix)
 *  - ?              : afficher l'aide des raccourcis
 *
 * Usage :
 *   useKeyboardShortcuts({
 *     onSearch: () => setSearchOpen(true),
 *     onToggleTheme: () => toggleTheme(),
 *     onCompare: () => setCompareOpen(true),
 *   })
 */

import { useEffect, useCallback } from 'react'

export interface KeyboardShortcutHandlers {
  /// Ctrl+K — ouvrir la recherche
  onSearch?: () => void
  /// Ctrl+B — basculer le thème
  onToggleTheme?: () => void
  /// Ctrl+, — ouvrir le comparateur
  onCompare?: () => void
  /// ? — afficher l'aide
  onHelp?: () => void
}

/// Vérifie si l'élément actif est un champ de saisie.
function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || el.isContentEditable
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  // Mémoriser les handlers pour éviter de recréer l'effet à chaque rendu.
  const stableHandlers = useCallback(() => handlers, [handlers])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      const h = stableHandlers()

      // Ctrl+K / Cmd+K — recherche
      if (cmd && e.key === 'k') {
        e.preventDefault()
        h.onSearch?.()
        return
      }

      // Ctrl+B / Cmd+B — thème (seulement si pas dans un input)
      if (cmd && e.key === 'b') {
        e.preventDefault()
        h.onToggleTheme?.()
        return
      }

      // Ctrl+, / Cmd+, — comparateur
      if (cmd && e.key === ',') {
        e.preventDefault()
        h.onCompare?.()
        return
      }

      // ? — aide (seulement si pas dans un input et pas de modificateur)
      if (e.key === '?' && !isInputFocused() && !cmd && !e.altKey) {
        e.preventDefault()
        h.onHelp?.()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stableHandlers])
}

/// Liste des raccourcis pour l'affichage dans l'aide.
export const KEYBOARD_SHORTCUTS = [
  { keys: ['Ctrl', 'K'], description: 'Ouvrir la recherche full-text', icon: '🔍' },
  { keys: ['Ctrl', 'B'], description: 'Basculer le thème (clair/sombre)', icon: '🌓' },
  { keys: ['Ctrl', ','], description: 'Ouvrir le comparateur de CV', icon: '⚖️' },
  { keys: ['?'], description: 'Afficher cette aide', icon: '❓' },
  { keys: ['Esc'], description: 'Fermer les fenêtres modales', icon: '✕' },
] as const
