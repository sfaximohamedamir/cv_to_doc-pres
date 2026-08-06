'use client'

/**
 * Fournisseur de thème (clair / sombre / système) basé sur next-themes.
 * Permet à l'utilisateur de basculer entre les modes via le bouton dans le header.
 */

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
