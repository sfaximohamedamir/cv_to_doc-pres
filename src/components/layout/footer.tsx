'use client'

/**
 * Pied de page de l'application.
 * Affiche les modèles NVIDIA utilisés et un rappel des formats supportés.
 */

import { FileText, Presentation, Image as ImageIcon, FileCheck2 } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Modèles NVIDIA */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Modèles NVIDIA utilisés
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  nemotron-3-super-120b-a12b
                </code>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500" />
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  nemotron-3-nano-omni-30b-a3b-reasoning
                </code>
              </li>
            </ul>
          </div>

          {/* Formats supportés */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Formats supportés
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-red-500" />
                PDF
              </div>
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                PNG / JPEG
              </div>
              <div className="flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                Word (.docx)
              </div>
              <div className="flex items-center gap-1.5">
                <Presentation className="h-3.5 w-3.5 text-orange-500" />
                PowerPoint (.pptx)
              </div>
            </div>
          </div>

          {/* À propos */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              À propos
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Agent IA propulsé par les modèles NVIDIA Nemotron. Transforme
              votre CV en document Word ou PowerPoint professionnel et
              l'évalue avec un score détaillé sur 7 critères.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-border/40 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CV Transformer Agent — Construit avec
            Next.js 16, TypeScript, Tailwind CSS & NVIDIA Nemotron
          </p>
        </div>
      </div>
    </footer>
  )
}
