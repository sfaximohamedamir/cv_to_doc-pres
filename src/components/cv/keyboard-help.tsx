'use client'

/**
 * Dialog d'aide des raccourcis clavier.
 * Affiche la liste des raccourcis disponibles avec leurs combinaisons de touches.
 */

import { motion } from 'framer-motion'
import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { KEYBOARD_SHORTCUTS } from '@/hooks/use-keyboard-shortcuts'

export interface KeyboardHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardHelp({ open, onOpenChange }: KeyboardHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Raccourcis clavier
          </DialogTitle>
          <DialogDescription>
            Utilisez ces raccourcis pour naviguer plus rapidement dans l'application.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{shortcut.icon}</span>
                <span className="text-sm text-foreground">{shortcut.description}</span>
              </div>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j} className="flex items-center gap-1">
                    {j > 0 && <span className="text-xs text-muted-foreground">+</span>}
                    <kbd className="min-w-[28px] rounded-md border border-border bg-muted px-2 py-1 text-center font-mono text-xs font-semibold text-foreground shadow-sm">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          💡 Astuce : les raccourcis <kbd className="rounded border border-border bg-background px-1 font-mono">Ctrl</kbd>+
          fonctionnent aussi avec <kbd className="rounded border border-border bg-background px-1 font-mono">Cmd</kbd>
          sur macOS.
        </div>
      </DialogContent>
    </Dialog>
  )
}
