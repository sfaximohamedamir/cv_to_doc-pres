'use client'

/**
 * Zone de dépôt de fichier (drag & drop + clic).
 * Accepte les PDF et images.
 */

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]

const ACCEPTED_EXT = '.pdf,.png,.jpg,.jpeg,.webp,.gif'

export interface UploadZoneProps {
  file: File | null
  onFileSelected: (file: File | null) => void
  disabled?: boolean
}

export function UploadZone({ file, onFileSelected, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback((f: File): string | null => {
    const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
    const okType = ACCEPTED_TYPES.includes(f.type)
    const okExt = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)
    if (!okType && !okExt) {
      return "Type de fichier non supporté. Formats acceptés : PDF, PNG, JPEG, WebP, GIF."
    }
    if (f.size > 10 * 1024 * 1024) {
      return 'Le fichier dépasse la taille maximale de 10 Mo.'
    }
    return null
  }, [])

  const handleFile = useCallback(
    (f: File | null) => {
      if (!f) return
      const err = validate(f)
      if (err) {
        setError(err)
        onFileSelected(null)
        return
      }
      setError(null)
      onFileSelected(f)
    },
    [onFileSelected, validate]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const f = e.dataTransfer.files?.[0]
      handleFile(f || null)
    },
    [disabled, handleFile]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const isPdf = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf')
  const isImage = file && !isPdf

  if (file) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex items-center gap-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-5 dark:border-emerald-700 dark:bg-emerald-950/20"
      >
        <div
          className={cn(
            'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg',
            isPdf ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
              : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
          )}
        >
          {isPdf ? <FileText className="h-7 w-7" /> : <ImageIcon className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{file.name}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{(file.size / 1024).toFixed(1)} Ko</span>
            <span>•</span>
            <span className="uppercase">{file.type || 'inconnu'}</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-600 dark:text-emerald-400">Prêt à traiter</span>
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onFileSelected(null)
              setError(null)
            }}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Retirer le fichier"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            inputRef.current?.click()
          }
        }}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-all sm:p-10',
          isDragging
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-border bg-muted/30 hover:border-emerald-400 hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <motion.div
          animate={isDragging ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 sm:h-16 sm:w-16"
        >
          <UploadCloud className="h-6 w-6 sm:h-8 sm:w-8" />
        </motion.div>
        <div>
          <p className="font-medium text-foreground">
            {isDragging ? 'Déposez le fichier ici' : 'Glissez-déposez votre CV'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            ou <span className="font-medium text-emerald-600 dark:text-emerald-400">cliquez pour parcourir</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">PDF</span>
          <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">PNG</span>
          <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">JPEG</span>
          <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">WebP</span>
          <span className="text-muted-foreground/70">— max 10 Mo</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          disabled={disabled}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
