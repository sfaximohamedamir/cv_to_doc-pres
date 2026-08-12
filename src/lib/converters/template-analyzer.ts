/**
 * Analyseur de templates Office (Word .docx et PowerPoint .pptx).
 *
 * Ce module extrait la palette de couleurs, les polices et les styles de base
 * d'un template uploadé pour les appliquer au document généré.
 */

import PizZip from 'pizzip'
import { DOMParser } from '@xmldom/xmldom'

/// Styles extraits d'un template
export interface ExtractedTemplateStyle {
  /// Couleur d'accent principale (hex sans #)
  accentColor?: string
  /// Couleur secondaire (hex sans #)
  secondaryColor?: string
  /// Couleur de fond d'en-tête (hex sans #)
  headerBg?: string
  /// Couleur du texte sur fond d'accent (hex sans #)
  accentTextColor?: string
  /// Police principale
  fontFamily?: string
  /// Police de titre
  headingFont?: string
  /// Indique si le template est valide et exploitable
  valid: boolean
  /// Message d'erreur si le template n'est pas valide
  error?: string
}

/**
 * Convertit une couleur OpenXML (hex avec # ou valeur thème) en hex sans #.
 * Pour les couleurs de thème, on fait un mapping simplifié vers des valeurs par défaut.
 */
function normalizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined
  // Si c'est déjà un hex, nettoyer
  const clean = color.trim().replace('#', '').toUpperCase()
  if (/^[0-9A-F]{6}$/i.test(clean)) return clean
  // Mapping des couleurs de thème OpenXML vers des valeurs par défaut
  const themeMap: Record<string, string> = {
    accent1: '4472C4',
    accent2: 'ED7D31',
    accent3: 'A5A5A5',
    accent4: 'FFC000',
    accent5: '5B9BD5',
    accent6: '70AD47',
    dk1: '000000',
    lt1: 'FFFFFF',
    dk2: '44546A',
    lt2: 'E7E6E6',
    hlink: '0563C1',
    folHlink: '954F72',
  }
  return themeMap[clean.toLowerCase()] || undefined
}

/**
 * Extrait la palette de couleurs d'un thème OpenXML.
 * Le XML de thème contient des éléments `<a:clrScheme>` avec des couleurs
 * `<a:srgbClr val="..."/>` ou `<a:sysClr val="..." lastClr="..."/>`.
 */
function extractThemeColors(themeXml: string): {
  accent1?: string
  accent2?: string
  dk1?: string
  lt1?: string
  dk2?: string
  lt2?: string
} {
  const colors: Record<string, string> = {}
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(themeXml, 'application/xml')
    const scheme = doc.getElementsByTagName('a:clrScheme')[0]
    if (!scheme) return colors

    const children = scheme.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as unknown as Element
      if (child.nodeType !== 1) continue
      const tagName = child.tagName
      const name = tagName.replace(/^a:/, '')

      // Chercher srgbClr
      const srgb = child.getElementsByTagName('a:srgbClr')[0]
      if (srgb) {
        const val = srgb.getAttribute('val')
        if (val) colors[name] = val
        continue
      }

      // Chercher sysClr avec lastClr
      const sys = child.getElementsByTagName('a:sysClr')[0]
      if (sys) {
        const val = sys.getAttribute('lastClr')
        if (val) colors[name] = val
      }
    }
  } catch {
    /* ignore parsing errors */
  }
  return colors
}

/**
 * Analyse un template Word (.docx) ou PowerPoint (.pptx) et extrait
 * les informations de style pertinentes.
 */
export function analyzeTemplate(buffer: Buffer, ext: 'docx' | 'pptx'): ExtractedTemplateStyle {
  try {
    const zip = new PizZip(buffer)
    const themePath = ext === 'docx' ? 'word/theme/theme1.xml' : 'ppt/theme/theme1.xml'
    const themeFile = zip.file(themePath)

    if (!themeFile) {
      return { valid: true } // Pas de thème, on génère normalement
    }

    const themeXml = themeFile.asText()
    const colors = extractThemeColors(themeXml)

    // Construire le style extrait
    const style: ExtractedTemplateStyle = { valid: true }

    if (colors.accent1) {
      style.accentColor = normalizeColor(colors.accent1)
    }
    if (colors.accent2) {
      style.secondaryColor = normalizeColor(colors.accent2)
    }
    if (colors.dk2) {
      style.headerBg = normalizeColor(colors.lt2) || normalizeColor(colors.lt1) || 'F8FAFC'
    }
    if (colors.lt1) {
      style.accentTextColor = normalizeColor(colors.lt1) || 'FFFFFF'
    }

    return style
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Erreur lors de l\'analyse du template',
    }
  }
}
