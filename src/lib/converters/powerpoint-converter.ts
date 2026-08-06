/**
 * Convertisseur PowerPoint (`.pptx`) pour les CV structurés.
 *
 * Ce module transforme un objet {@link ParsedCv} (issu de l'extraction NVIDIA)
 * en une présentation PowerPoint professionnelle à l'aide de la bibliothèque
 * `pptxgenjs` v4.
 *
 * La présentation générée suit une mise en page moderne 16:9 (LAYOUT_WIDE,
 * 13,33″ × 7,5″) avec une palette cohérente :
 * - Couleur d'accent : vert émeraude `#10B981`
 * - Texte principal : gris foncé `#1F2937`
 * - Fond clair : `#F9FAFB`
 * - Fond sombre (couverture, clôture) : `#1F2937`
 *
 * Structure des diapositives :
 *  1. Couverture (nom, titre, contacts, score optionnel)
 *  2. Profil / résumé (si `summary` est renseigné) + statistiques clés
 *  3. Expérience professionnelle (1+ diapos, 3 expériences max par diapo)
 *  4. Formation
 *  5. Compétences & Langues (deux colonnes)
 *  6. Projets & Certifications (si au moins une entrée existe)
 *  7. Clôture « Merci » avec rappel des contacts
 *
 * Les libellés sont en français par défaut, et en anglais si
 * `parsedCv.detectedLanguage` commence par `'en'`.
 *
 * @example
 * ```ts
 * const buffer = await generatePowerPointCv({ parsedCv, score: 85 })
 * // → Buffer binaire .pptx prêt à être renvoyé par une route API
 * ```
 */

import pptxgen from 'pptxgenjs'
import type {
  ParsedCv,
  WorkExperience,
  Education,
  Skill,
  Language,
} from '@/lib/cv/types'
import { getTemplate, type CvTemplate, type CvTemplateId } from '@/lib/cv/templates'

// =====================================================================
// Constantes de style
// =====================================================================
//
// Les couleurs d'accent et le fond sombre sont mutables (`let`) car ils
// sont redéfinis au début de `generatePowerPointCv` en fonction du
// template visuel demandé. Les couleurs de texte et de fond clair
// restent fixes car elles ne dépendent pas du template.

/** Couleur d'accent principale (vert émeraude par défaut). */
let ACCENT_COLOR = '10B981'

/** Couleur d'accent secondaire (teal par défaut). */
let SECONDARY_COLOR = '0D9488'

/** Couleur claire d'accent pour fonds légers (vert très clair). */
let ACCENT_LIGHT = 'D1FAE5'

/** Fond sombre (couverture / clôture). */
let DARK_BG = '1F2937'

/** Indique si les titres de section ont une bordure inférieure. */
let SECTION_HAS_BORDER = true

/** Indique si la couverture/clôture ont un fond coloré (couleur d'accent). */
let COLORED_HEADER = false

/** Couleur de texte principal (gris foncé slate). */
const TEXT_COLOR = '1F2937'

/** Couleur secondaire / métadonnées (gris moyen). */
const MUTED_COLOR = '6B7280'

/** Fond clair des diapositives de contenu. */
const LIGHT_BG = 'F9FAFB'

/** Texte blanc (sur fond sombre). */
const WHITE = 'FFFFFF'

/** Blanc atténué (sur fond sombre, pour métadonnées). */
const WHITE_MUTED = 'CBD5E1'

/** Largeur de page en pouces (LAYOUT_WIDE = 13,33″). */
const PAGE_W = 13.33

/** Hauteur de page en pouces (LAYOUT_WIDE = 7,5″). */
const PAGE_H = 7.5

/** Marge latérale standard en pouces. */
const MARGIN_X = 0.6

/** Marge supérieure standard en pouces. */
const MARGIN_Y = 0.5

/** Largeur utile de contenu (page - 2 × marge). */
const CONTENT_W = PAGE_W - MARGIN_X * 2

/** Tailles de police en points. */
const FONT_SIZE_COVER_NAME = 44
const FONT_SIZE_COVER_TITLE = 22
const FONT_SIZE_SECTION_TITLE = 28
const FONT_SIZE_SECTION_SUBTITLE = 13
const FONT_SIZE_JOB_TITLE = 17
const FONT_SIZE_META = 12
const FONT_SIZE_BODY = 13
const FONT_SIZE_SMALL = 11
const FONT_SIZE_STAT = 16
const FONT_SIZE_THANK_YOU = 54
const FONT_SIZE_CONTACT = 12

/** Nombre maximum d'expériences par diapositive. */
const MAX_EXPERIENCES_PER_SLIDE = 3

// =====================================================================
// Libellés localisés
// =====================================================================

/** Ensemble de libellés localisés utilisés dans la présentation. */
interface CvLabels {
  /** Titre de la diapo « Profil ». */
  profile: string
  /** Titre de la section expérience professionnelle. */
  workExperience: string
  /** Titre de la section formation. */
  education: string
  /** Titre de la diapo Compétences & Langues. */
  skillsAndLanguages: string
  /** Titre de la diapo Projets & Certifications. */
  projectsAndCertifications: string
  /** Sous-titre Compétences. */
  skills: string
  /** Sous-titre Langues. */
  languages: string
  /** Sous-titre Projets. */
  projects: string
  /** Sous-titre Certifications. */
  certifications: string
  /** Mot de clôture. */
  thankYou: string
  /** Préfixe du badge de score. */
  score: string
  /** Unité « années d'expérience ». */
  yearsOfExperience: string
  /** Unité « expériences professionnelles » (si dates non exploitables). */
  experiencesCount: string
  /** Unité « compétences ». */
  skillsCount: string
  /** Unité « langues ». */
  languagesCount: string
  /** Libellé par défaut pour les compétences sans catégorie. */
  otherSkills: string
}

/** Libellés en français. */
const FRENCH_LABELS: CvLabels = {
  profile: 'Profil',
  workExperience: 'Expérience professionnelle',
  education: 'Formation',
  skillsAndLanguages: 'Compétences & Langues',
  projectsAndCertifications: 'Projets & Certifications',
  skills: 'Compétences',
  languages: 'Langues',
  projects: 'Projets',
  certifications: 'Certifications',
  thankYou: 'Merci',
  score: 'Score CV',
  yearsOfExperience: "années d'expérience",
  experiencesCount: 'expériences professionnelles',
  skillsCount: 'compétences',
  languagesCount: 'langues',
  otherSkills: 'Autres',
}

/** Libellés en anglais. */
const ENGLISH_LABELS: CvLabels = {
  profile: 'Profile',
  workExperience: 'Work Experience',
  education: 'Education',
  skillsAndLanguages: 'Skills & Languages',
  projectsAndCertifications: 'Projects & Certifications',
  skills: 'Skills',
  languages: 'Languages',
  projects: 'Projects',
  certifications: 'Certifications',
  thankYou: 'Thank you',
  score: 'CV Score',
  yearsOfExperience: 'years of experience',
  experiencesCount: 'professional experiences',
  skillsCount: 'skills',
  languagesCount: 'languages',
  otherSkills: 'Other',
}

/**
 * Détermine si la présentation doit utiliser les libellés anglais.
 * @param parsedCv - CV structuré (utilise `detectedLanguage`).
 * @returns `true` si la langue détectée commence par `'en'`.
 */
function isEnglish(parsedCv: ParsedCv): boolean {
  return (parsedCv.detectedLanguage ?? '').toLowerCase().startsWith('en')
}

/**
 * Retourne le jeu de libellés adapté à la langue détectée.
 * @param parsedCv - CV structuré.
 * @returns Les libellés français ou anglais.
 */
function getLabels(parsedCv: ParsedCv): CvLabels {
  return isEnglish(parsedCv) ? ENGLISH_LABELS : FRENCH_LABELS
}

// =====================================================================
// Helpers de mise en forme
// =====================================================================

/**
 * Découpe un tableau en sous-tableaux de taille fixe.
 * @param arr - Tableau source.
 * @param size - Taille de chaque morceau.
 * @returns Tableau de morceaux.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return arr.length ? [arr] : []
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

/**
 * Tronque une chaîne à une longueur maximale, en ajoutant « … » si nécessaire.
 * @param str - Chaîne source.
 * @param max - Longueur maximale.
 * @returns Chaîne éventuellement tronquée.
 */
function truncate(str: string, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1).trimEnd() + '…' : str
}

/**
 * Formate une plage de dates à partir d'une date de début et de fin.
 * @param start - Date de début (texte libre).
 * @param end - Date de fin (texte libre, ex. « présent »).
 * @returns La chaîne formatée, ex. `2020 – présent`, ou chaîne vide.
 */
function formatDateRange(start?: string, end?: string): string {
  const parts: string[] = []
  if (start && start.trim()) parts.push(start.trim())
  if (end && end.trim()) parts.push(end.trim())
  if (parts.length === 0) return ''
  return parts.join(' – ')
}

/**
 * Découpe un bloc de description en lignes non vides, pour restituer
 * les sauts de ligne éventuels extraits par le modèle.
 * @param description - Texte brut potentiellement multi-lignes.
 * @returns Tableau de lignes nettoyées.
 */
function splitDescriptionLines(description: string | undefined): string[] {
  if (!description) return []
  return description
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•●▪\-*]+/, '').trim())
    .filter((line) => line.length > 0)
}

/**
 * Concatène les éléments de contact non vides avec le séparateur ` | `.
 * @param parsedCv - CV structuré.
 * @returns Ligne de contacts, ex. `jean@mail.com | 06 12 34 56 78 | Paris`.
 */
function buildContactLine(parsedCv: ParsedCv): string {
  const p = parsedCv.personalInfo
  const items: string[] = []
  if (p.email) items.push(p.email)
  if (p.phone) items.push(p.phone)
  if (p.location) items.push(p.location)
  if (p.linkedin) items.push(p.linkedin)
  if (p.website) items.push(p.website)
  if (p.github) items.push(p.github)
  return items.join('  |  ')
}

/**
 * Tente d'estimer le nombre d'années d'expérience à partir des dates
 * extraites des expériences professionnelles.
 *
 * La fonction cherche des années à 4 chiffres (19xx / 20xx) dans les
 * champs `startDate` et `endDate`. Si au moins deux années distinctes
 * sont trouvées, la différence est retournée. Si une expérience se
 * termine par « présent »/« current »/etc., l'année courante est utilisée
 * comme borne supérieure.
 *
 * @param experiences - Liste des expériences professionnelles.
 * @returns Nombre d'années estimé, ou `null` si non exploitable.
 */
function estimateYearsOfExperience(
  experiences: WorkExperience[],
): number | null {
  const years: number[] = []
  const currentYear = new Date().getFullYear()
  for (const exp of experiences) {
    for (const dateStr of [exp.startDate, exp.endDate]) {
      if (!dateStr) continue
      const matches = dateStr.match(/\b(19|20)\d{2}\b/g)
      if (matches) {
        for (const m of matches) years.push(parseInt(m, 10))
      }
    }
  }
  if (years.length < 2) return null
  const min = Math.min(...years)
  const max = Math.max(...years)
  const hasPresent = experiences.some((e) =>
    /présent|present|current|now|aujourd|hui/i.test(e.endDate ?? ''),
  )
  const effectiveMax = hasPresent ? Math.max(max, currentYear) : max
  const diff = effectiveMax - min
  return diff > 0 ? diff : null
}

/**
 * Regroupe les compétences par catégorie, en plaçant les compétences sans
 * catégorie sous une catégorie « Autres » (traduite).
 * @param skills - Liste des compétences.
 * @param otherLabel - Libellé localisé pour la catégorie « Autres ».
 * @returns Map ordonnée `catégorie → compétences[]`. La catégorie « Autres »
 *          est toujours en dernière position.
 */
function groupSkillsByCategory(
  skills: Skill[],
  otherLabel: string,
): Map<string, Skill[]> {
  const groups = new Map<string, Skill[]>()
  for (const skill of skills) {
    const category = (skill.category ?? '').trim() || otherLabel
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push(skill)
  }
  // Réordonner pour placer « Autres » en dernier.
  if (groups.has(otherLabel)) {
    const other = groups.get(otherLabel)!
    groups.delete(otherLabel)
    groups.set(otherLabel, other)
  }
  return groups
}

// =====================================================================
// Construction des diapositives
// =====================================================================

/**
 * Ajoute une bande de titre de section en haut d'une diapositive de contenu.
 * Inclut un petit rectangle d'accent à gauche, le titre en gras couleur
 * d'accent, et une ligne de séparation en bas de la bande.
 *
 * @param slide - Diapositive cible.
 * @param title - Libellé du titre de section.
 * @param subtitle - Sous-titre optionnel (texte secondaire à droite).
 */
function addSectionTitle(
  slide: pptxgen.Slide,
  title: string,
  subtitle?: string,
): void {
  // Bandeau d'accent vertical à gauche du titre.
  slide.addShape('rect', {
    x: MARGIN_X,
    y: MARGIN_Y + 0.08,
    w: 0.12,
    h: 0.55,
    fill: { color: ACCENT_COLOR },
    line: { type: 'none' },
  })
  // Titre principal.
  slide.addText(title, {
    x: MARGIN_X + 0.25,
    y: MARGIN_Y,
    w: CONTENT_W - 0.25,
    h: 0.7,
    fontSize: FONT_SIZE_SECTION_TITLE,
    bold: true,
    color: TEXT_COLOR,
    fontFace: 'Calibri',
    valign: 'middle',
  })
  // Sous-titre optionnel (aligné à droite).
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN_X + 0.25,
      y: MARGIN_Y,
      w: CONTENT_W - 0.25,
      h: 0.7,
      fontSize: FONT_SIZE_SECTION_SUBTITLE,
      color: MUTED_COLOR,
      italic: true,
      align: 'right',
      valign: 'middle',
    })
  }
  // Ligne de séparation sous le titre (uniquement si le template l'autorise).
  if (SECTION_HAS_BORDER) {
    slide.addShape('line', {
      x: MARGIN_X,
      y: MARGIN_Y + 0.85,
      w: CONTENT_W,
      h: 0,
      line: { color: ACCENT_COLOR, width: 1.5 },
    })
  }
}

/**
 * Crée la diapositive de couverture : fond sombre, nom en grand,
 * titre professionnel, contacts en bas, score en coin si fourni.
 *
 * @param pptx - Instance pptxgenjs.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @param score - Score optionnel sur 100.
 */
function addCoverSlide(
  pptx: pptxgen,
  parsedCv: ParsedCv,
  labels: CvLabels,
  score?: number,
): void {
  const slide = pptx.addSlide()
  // DARK_BG est déjà paramétré en fonction du template (couleur d'accent si
  // l'en-tête est coloré, gris très foncé sinon).
  slide.background = { color: DARK_BG }

  // Bande d'accent en haut.
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: PAGE_W,
    h: 0.18,
    fill: { color: COLORED_HEADER ? WHITE : ACCENT_COLOR },
    line: { type: 'none' },
  })

  // Badge score en haut à droite.
  if (typeof score === 'number' && Number.isFinite(score)) {
    const clamped = Math.max(0, Math.min(100, Math.round(score)))
    // Inversion des couleurs du badge selon le fond pour garantir la lisibilité.
    const badgeText = COLORED_HEADER ? ACCENT_COLOR : DARK_BG
    const badgeFill = COLORED_HEADER ? WHITE : ACCENT_COLOR
    slide.addText(`${labels.score} : ${clamped}/100`, {
      x: PAGE_W - 4.5,
      y: 0.45,
      w: 3.9,
      h: 0.5,
      fontSize: FONT_SIZE_META,
      bold: true,
      color: badgeText,
      align: 'right',
      valign: 'middle',
      fill: { color: badgeFill },
      rectRadius: 0.1,
      shape: 'roundRect',
    })
  }

  const p = parsedCv.personalInfo
  const fullName = (p.fullName ?? '').trim()

  // Nom complet centré.
  slide.addText(fullName || '—', {
    x: 0.5,
    y: 2.3,
    w: PAGE_W - 1,
    h: 1.4,
    fontSize: FONT_SIZE_COVER_NAME,
    bold: true,
    color: WHITE,
    align: 'center',
    valign: 'middle',
    fontFace: 'Calibri',
  })

  // Titre professionnel sous le nom.
  if (p.title) {
    slide.addText(p.title, {
      x: 0.5,
      y: 3.75,
      w: PAGE_W - 1,
      h: 0.7,
      fontSize: FONT_SIZE_COVER_TITLE,
      color: ACCENT_LIGHT,
      italic: true,
      align: 'center',
      valign: 'middle',
      fontFace: 'Calibri',
    })
  }

  // Ligne de contacts en bas.
  const contactLine = buildContactLine(parsedCv)
  if (contactLine) {
    slide.addShape('line', {
      x: PAGE_W / 2 - 3,
      y: 6.0,
      w: 6,
      h: 0,
      line: { color: ACCENT_COLOR, width: 1 },
    })
    slide.addText(contactLine, {
      x: 0.5,
      y: 6.15,
      w: PAGE_W - 1,
      h: 0.6,
      fontSize: FONT_SIZE_CONTACT,
      color: WHITE_MUTED,
      align: 'center',
      valign: 'middle',
      fontFace: 'Calibri',
    })
  }
}

/**
 * Crée la diapositive « Profil » avec le résumé et des statistiques clés.
 * Ne fait rien si aucun résumé n'est disponible.
 *
 * @param pptx - Instance pptxgenjs.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 */
function addProfileSlide(
  pptx: pptxgen,
  parsedCv: ParsedCv,
  labels: CvLabels,
): void {
  const summary = (parsedCv.personalInfo.summary ?? '').trim()
  if (!summary) return

  const slide = pptx.addSlide()
  slide.background = { color: LIGHT_BG }

  addSectionTitle(slide, labels.profile)

  // Bloc de texte du résumé.
  slide.addText(summary, {
    x: MARGIN_X,
    y: MARGIN_Y + 1.1,
    w: CONTENT_W,
    h: 3.3,
    fontSize: FONT_SIZE_BODY,
    color: TEXT_COLOR,
    align: 'left',
    valign: 'top',
    fontFace: 'Calibri',
    lineSpacingMultiple: 1.25,
  })

  // Statistiques clés en bas de la diapo.
  addStatsBar(slide, parsedCv, labels, MARGIN_Y + 4.7)
}

/**
 * Ajoute une barre de statistiques clés (années d'expérience, compétences,
 * langues) sur une diapositive. Les statistiques vides sont omises.
 *
 * @param slide - Diapositive cible.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @param y - Position verticale de la barre.
 */
function addStatsBar(
  slide: pptxgen.Slide,
  parsedCv: ParsedCv,
  labels: CvLabels,
  y: number,
): void {
  const stats: Array<{ value: string; label: string }> = []

  const years = estimateYearsOfExperience(parsedCv.workExperience)
  if (years !== null && years > 0) {
    stats.push({ value: String(years), label: labels.yearsOfExperience })
  } else if (parsedCv.workExperience.length > 0) {
    stats.push({
      value: String(parsedCv.workExperience.length),
      label: labels.experiencesCount,
    })
  }
  if (parsedCv.skills.length > 0) {
    stats.push({
      value: String(parsedCv.skills.length),
      label: labels.skillsCount,
    })
  }
  if (parsedCv.languages.length > 0) {
    stats.push({
      value: String(parsedCv.languages.length),
      label: labels.languagesCount,
    })
  }

  if (stats.length === 0) return

  const slotW = CONTENT_W / stats.length
  stats.forEach((stat, i) => {
    const x = MARGIN_X + i * slotW
    // Encadré léger.
    slide.addShape('roundRect', {
      x: x + 0.15,
      y,
      w: slotW - 0.3,
      h: 1.4,
      fill: { color: WHITE },
      line: { color: ACCENT_COLOR, width: 1 },
      rectRadius: 0.08,
    })
    // Valeur (chiffre) en grand, couleur d'accent.
    slide.addText(stat.value, {
      x: x + 0.15,
      y: y + 0.15,
      w: slotW - 0.3,
      h: 0.7,
      fontSize: FONT_SIZE_STAT + 14,
      bold: true,
      color: ACCENT_COLOR,
      align: 'center',
      valign: 'middle',
      fontFace: 'Calibri',
    })
    // Libellé sous la valeur.
    slide.addText(stat.label, {
      x: x + 0.15,
      y: y + 0.85,
      w: slotW - 0.3,
      h: 0.45,
      fontSize: FONT_SIZE_SMALL,
      color: MUTED_COLOR,
      align: 'center',
      valign: 'middle',
      fontFace: 'Calibri',
    })
  })
}

/**
 * Construit le tableau de runs de texte décrivant une expérience
 * professionnelle (titre, méta, lignes de description), pour ajout via
 * `slide.addText(runs, options)`.
 *
 * @param exp - Expérience professionnelle.
 * @returns Tableau d'objets `TextProps` pour pptxgenjs.
 */
function buildExperienceRuns(exp: WorkExperience): pptxgen.TextProps[] {
  const runs: pptxgen.TextProps[] = []

  // Ligne 1 : intitulé du poste (gras, couleur accent).
  const title = (exp.title ?? '').trim()
  if (title) {
    runs.push({
      text: title,
      options: {
        bold: true,
        color: ACCENT_COLOR,
        fontSize: FONT_SIZE_JOB_TITLE,
        breakLine: true,
        fontFace: 'Calibri',
      },
    })
  }

  // Ligne 2 : entreprise — dates — localisation (italique muted).
  const metaParts: string[] = []
  const company = (exp.company ?? '').trim()
  if (company) metaParts.push(company)
  const dateRange = formatDateRange(exp.startDate, exp.endDate)
  if (dateRange) metaParts.push(dateRange)
  if (exp.location && exp.location.trim()) metaParts.push(exp.location.trim())
  if (metaParts.length > 0) {
    runs.push({
      text: metaParts.join('  —  '),
      options: {
        italic: true,
        color: MUTED_COLOR,
        fontSize: FONT_SIZE_META,
        breakLine: true,
        fontFace: 'Calibri',
      },
    })
  }

  // Lignes de description (puces).
  const lines = splitDescriptionLines(exp.description)
  for (const line of lines) {
    runs.push({
      text: line,
      options: {
        bullet: { characterCode: '2022' },
        color: TEXT_COLOR,
        fontSize: FONT_SIZE_BODY - 1,
        breakLine: true,
        fontFace: 'Calibri',
        paraSpaceAfter: 2,
      },
    })
  }

  return runs
}

/**
 * Ajoute une diapositive d'expériences professionnelles contenant jusqu'à
 * `MAX_EXPERIENCES_PER_SLIDE` expériences.
 *
 * @param pptx - Instance pptxgenjs.
 * @param experiences - Lot d'expériences à afficher.
 * @param labels - Libellés localisés.
 * @param slideIndex - Indice du lot (1 pour la première diapo).
 * @param totalSlides - Nombre total de diapos d'expérience (pour sous-titre).
 */
function addExperienceSlide(
  pptx: pptxgen,
  experiences: WorkExperience[],
  labels: CvLabels,
  slideIndex: number,
  totalSlides: number,
): void {
  const slide = pptx.addSlide()
  slide.background = { color: LIGHT_BG }

  const subtitle =
    totalSlides > 1 ? `${slideIndex} / ${totalSlides}` : undefined
  addSectionTitle(slide, labels.workExperience, subtitle)

  // Hauteur utile sous le titre.
  const topY = MARGIN_Y + 1.15
  const usableH = PAGE_H - topY - MARGIN_Y
  const slotH = usableH / MAX_EXPERIENCES_PER_SLIDE

  experiences.forEach((exp, i) => {
    const y = topY + i * slotH
    const runs = buildExperienceRuns(exp)
    if (runs.length === 0) return
    slide.addText(runs, {
      x: MARGIN_X,
      y,
      w: CONTENT_W,
      h: slotH - 0.15,
      valign: 'top',
      fontFace: 'Calibri',
      margin: 0,
    })
  })
}

/**
 * Crée la diapositive « Formation ».
 * Ne fait rien si la liste est vide.
 *
 * @param pptx - Instance pptxgenjs.
 * @param education - Liste des formations.
 * @param labels - Libellés localisés.
 */
function addEducationSlide(
  pptx: pptxgen,
  education: Education[],
  labels: CvLabels,
): void {
  if (education.length === 0) return

  const slide = pptx.addSlide()
  slide.background = { color: LIGHT_BG }
  addSectionTitle(slide, labels.education)

  const topY = MARGIN_Y + 1.2
  const usableH = PAGE_H - topY - MARGIN_Y
  const slotH = Math.min(usableH / Math.max(education.length, 1), 1.6)

  education.forEach((edu, i) => {
    const y = topY + i * slotH
    const runs: pptxgen.TextProps[] = []

    const degree = (edu.degree ?? '').trim()
    if (degree) {
      runs.push({
        text: degree,
        options: {
          bold: true,
          color: ACCENT_COLOR,
          fontSize: FONT_SIZE_JOB_TITLE,
          breakLine: true,
          fontFace: 'Calibri',
        },
      })
    }

    const metaParts: string[] = []
    const institution = (edu.institution ?? '').trim()
    if (institution) metaParts.push(institution)
    const dateRange = formatDateRange(edu.startDate, edu.endDate)
    if (dateRange) metaParts.push(dateRange)
    if (metaParts.length > 0) {
      runs.push({
        text: metaParts.join('  —  '),
        options: {
          italic: true,
          color: MUTED_COLOR,
          fontSize: FONT_SIZE_META,
          breakLine: true,
          fontFace: 'Calibri',
        },
      })
    }

    if (edu.field && edu.field.trim()) {
      runs.push({
        text: edu.field.trim(),
        options: {
          color: TEXT_COLOR,
          fontSize: FONT_SIZE_BODY - 1,
          breakLine: true,
          fontFace: 'Calibri',
        },
      })
    }

    if (edu.description && edu.description.trim()) {
      runs.push({
        text: truncate(edu.description.trim(), 240),
        options: {
          color: MUTED_COLOR,
          fontSize: FONT_SIZE_SMALL,
          italic: true,
          breakLine: true,
          fontFace: 'Calibri',
        },
      })
    }

    if (runs.length === 0) return
    slide.addText(runs, {
      x: MARGIN_X,
      y,
      w: CONTENT_W,
      h: slotH - 0.1,
      valign: 'top',
      fontFace: 'Calibri',
      margin: 0,
    })
  })
}

/**
 * Construit la liste de runs pour la colonne « Compétences » regroupées
 * par catégorie.
 *
 * @param skills - Liste des compétences.
 * @param labels - Libellés localisés.
 * @returns Tableau de runs pour pptxgenjs.
 */
function buildSkillsRuns(
  skills: Skill[],
  labels: CvLabels,
): pptxgen.TextProps[] {
  const runs: pptxgen.TextProps[] = []
  const groups = groupSkillsByCategory(skills, labels.otherSkills)

  for (const [category, items] of groups) {
    runs.push({
      text: category,
      options: {
        bold: true,
        color: ACCENT_COLOR,
        fontSize: FONT_SIZE_BODY,
        breakLine: true,
        fontFace: 'Calibri',
        paraSpaceBefore: 4,
      },
    })
    const parts = items.map((s) => {
      const name = (s.name ?? '').trim()
      const level = (s.level ?? '').trim()
      if (!name) return ''
      return level ? `${name} (${level})` : name
    })
    runs.push({
      text: parts.filter(Boolean).join('  •  '),
      options: {
        color: TEXT_COLOR,
        fontSize: FONT_SIZE_SMALL,
        breakLine: true,
        fontFace: 'Calibri',
        paraSpaceAfter: 6,
      },
    })
  }
  return runs
}

/**
 * Construit la liste de runs pour la colonne « Langues ».
 *
 * @param languages - Liste des langues.
 * @returns Tableau de runs pour pptxgenjs.
 */
function buildLanguagesRuns(languages: Language[]): pptxgen.TextProps[] {
  const runs: pptxgen.TextProps[] = []
  for (const lang of languages) {
    const name = (lang.name ?? '').trim()
    if (!name) continue
    const level = (lang.level ?? '').trim()
    runs.push({
      text: name,
      options: {
        bold: true,
        color: TEXT_COLOR,
        fontSize: FONT_SIZE_BODY,
        breakLine: !level,
        fontFace: 'Calibri',
      },
    })
    if (level) {
      runs.push({
        text: ` — ${level}`,
        options: {
          italic: true,
          color: MUTED_COLOR,
          fontSize: FONT_SIZE_BODY - 1,
          breakLine: true,
          fontFace: 'Calibri',
        },
      })
    }
  }
  return runs
}

/**
 * Crée la diapositive « Compétences & Langues » avec deux colonnes.
 * Ne fait rien si ni compétences ni langues ne sont présentes.
 *
 * @param pptx - Instance pptxgenjs.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 */
function addSkillsAndLanguagesSlide(
  pptx: pptxgen,
  parsedCv: ParsedCv,
  labels: CvLabels,
): void {
  const hasSkills = parsedCv.skills.length > 0
  const hasLanguages = parsedCv.languages.length > 0
  if (!hasSkills && !hasLanguages) return

  const slide = pptx.addSlide()
  slide.background = { color: LIGHT_BG }
  addSectionTitle(slide, labels.skillsAndLanguages)

  const topY = MARGIN_Y + 1.2
  const colH = PAGE_H - topY - MARGIN_Y
  const colW = (CONTENT_W - 0.5) / 2
  const leftX = MARGIN_X
  const rightX = MARGIN_X + colW + 0.5

  // Colonne gauche : Compétences.
  if (hasSkills) {
    slide.addText(labels.skills, {
      x: leftX,
      y: topY,
      w: colW,
      h: 0.4,
      fontSize: FONT_SIZE_BODY + 1,
      bold: true,
      color: TEXT_COLOR,
      fontFace: 'Calibri',
    })
    slide.addText(buildSkillsRuns(parsedCv.skills, labels), {
      x: leftX,
      y: topY + 0.5,
      w: colW,
      h: colH - 0.5,
      valign: 'top',
      fontFace: 'Calibri',
      margin: 0,
    })
  }

  // Colonne droite : Langues.
  if (hasLanguages) {
    slide.addText(labels.languages, {
      x: rightX,
      y: topY,
      w: colW,
      h: 0.4,
      fontSize: FONT_SIZE_BODY + 1,
      bold: true,
      color: TEXT_COLOR,
      fontFace: 'Calibri',
    })
    slide.addText(buildLanguagesRuns(parsedCv.languages), {
      x: rightX,
      y: topY + 0.5,
      w: colW,
      h: colH - 0.5,
      valign: 'top',
      fontFace: 'Calibri',
      margin: 0,
    })
  }
}

/**
 * Crée la diapositive « Projets & Certifications » avec deux colonnes.
 * Ne fait rien si ni projets ni certifications ne sont présents.
 *
 * @param pptx - Instance pptxgenjs.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 */
function addProjectsAndCertificationsSlide(
  pptx: pptxgen,
  parsedCv: ParsedCv,
  labels: CvLabels,
): void {
  const projects = parsedCv.projects ?? []
  const certifications = parsedCv.certifications ?? []
  if (projects.length === 0 && certifications.length === 0) return

  const slide = pptx.addSlide()
  slide.background = { color: LIGHT_BG }
  addSectionTitle(slide, labels.projectsAndCertifications)

  const topY = MARGIN_Y + 1.2
  const colH = PAGE_H - topY - MARGIN_Y
  const colW = (CONTENT_W - 0.5) / 2
  const leftX = MARGIN_X
  const rightX = MARGIN_X + colW + 0.5

  // Colonne gauche : Projets.
  if (projects.length > 0) {
    slide.addText(labels.projects, {
      x: leftX,
      y: topY,
      w: colW,
      h: 0.4,
      fontSize: FONT_SIZE_BODY + 1,
      bold: true,
      color: TEXT_COLOR,
      fontFace: 'Calibri',
    })

    const runs: pptxgen.TextProps[] = []
    projects.forEach((project, i) => {
      const name = (project.name ?? '').trim()
      if (name) {
        runs.push({
          text: name,
          options: {
            bold: true,
            color: ACCENT_COLOR,
            fontSize: FONT_SIZE_BODY,
            breakLine: true,
            fontFace: 'Calibri',
            paraSpaceBefore: i === 0 ? 0 : 6,
          },
        })
      }
      if (project.url && project.url.trim()) {
        runs.push({
          text: project.url.trim(),
          options: {
            color: MUTED_COLOR,
            italic: true,
            fontSize: FONT_SIZE_SMALL,
            breakLine: true,
            fontFace: 'Calibri',
            hyperlink: { url: project.url.trim() },
          },
        })
      }
      if (project.description && project.description.trim()) {
        runs.push({
          text: truncate(project.description.trim(), 220),
          options: {
            color: TEXT_COLOR,
            fontSize: FONT_SIZE_SMALL,
            breakLine: true,
            fontFace: 'Calibri',
            paraSpaceAfter: 4,
          },
        })
      }
    })

    slide.addText(runs, {
      x: leftX,
      y: topY + 0.5,
      w: colW,
      h: colH - 0.5,
      valign: 'top',
      fontFace: 'Calibri',
      margin: 0,
    })
  }

  // Colonne droite : Certifications.
  if (certifications.length > 0) {
    slide.addText(labels.certifications, {
      x: rightX,
      y: topY,
      w: colW,
      h: 0.4,
      fontSize: FONT_SIZE_BODY + 1,
      bold: true,
      color: TEXT_COLOR,
      fontFace: 'Calibri',
    })

    const runs: pptxgen.TextProps[] = []
    certifications.forEach((cert, i) => {
      const name = (cert.name ?? '').trim()
      if (name) {
        runs.push({
          text: name,
          options: {
            bold: true,
            color: ACCENT_COLOR,
            fontSize: FONT_SIZE_BODY,
            breakLine: true,
            fontFace: 'Calibri',
            paraSpaceBefore: i === 0 ? 0 : 6,
          },
        })
      }
      const metaParts: string[] = []
      if (cert.issuer && cert.issuer.trim()) metaParts.push(cert.issuer.trim())
      if (cert.date && cert.date.trim()) metaParts.push(cert.date.trim())
      if (metaParts.length > 0) {
        runs.push({
          text: metaParts.join('  —  '),
          options: {
            color: MUTED_COLOR,
            italic: true,
            fontSize: FONT_SIZE_SMALL,
            breakLine: true,
            fontFace: 'Calibri',
            paraSpaceAfter: 4,
          },
        })
      }
    })

    slide.addText(runs, {
      x: rightX,
      y: topY + 0.5,
      w: colW,
      h: colH - 0.5,
      valign: 'top',
      fontFace: 'Calibri',
      margin: 0,
    })
  }
}

/**
 * Crée la diapositive de clôture « Merci » avec rappel des contacts.
 *
 * @param pptx - Instance pptxgenjs.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 */
function addThankYouSlide(
  pptx: pptxgen,
  parsedCv: ParsedCv,
  labels: CvLabels,
): void {
  const slide = pptx.addSlide()
  // DARK_BG est déjà paramétré en fonction du template (couleur d'accent si
  // l'en-tête est coloré, gris très foncé sinon).
  slide.background = { color: DARK_BG }

  // Bande d'accent en bas.
  slide.addShape('rect', {
    x: 0,
    y: PAGE_H - 0.18,
    w: PAGE_W,
    h: 0.18,
    fill: { color: COLORED_HEADER ? WHITE : ACCENT_COLOR },
    line: { type: 'none' },
  })

  // « Merci » centré.
  slide.addText(labels.thankYou, {
    x: 0.5,
    y: 2.2,
    w: PAGE_W - 1,
    h: 1.6,
    fontSize: FONT_SIZE_THANK_YOU,
    bold: true,
    color: WHITE,
    align: 'center',
    valign: 'middle',
    fontFace: 'Calibri',
  })

  // Nom du candidat sous « Merci ».
  const fullName = (parsedCv.personalInfo.fullName ?? '').trim()
  if (fullName) {
    slide.addText(fullName, {
      x: 0.5,
      y: 3.85,
      w: PAGE_W - 1,
      h: 0.6,
      fontSize: FONT_SIZE_COVER_TITLE,
      color: ACCENT_LIGHT,
      italic: true,
      align: 'center',
      valign: 'middle',
      fontFace: 'Calibri',
    })
  }

  // Ligne de contacts en bas.
  const contactLine = buildContactLine(parsedCv)
  if (contactLine) {
    slide.addShape('line', {
      x: PAGE_W / 2 - 3,
      y: 5.6,
      w: 6,
      h: 0,
      line: { color: ACCENT_COLOR, width: 1 },
    })
    slide.addText(contactLine, {
      x: 0.5,
      y: 5.75,
      w: PAGE_W - 1,
      h: 0.6,
      fontSize: FONT_SIZE_CONTACT,
      color: WHITE_MUTED,
      align: 'center',
      valign: 'middle',
      fontFace: 'Calibri',
    })
  }
}

// =====================================================================
// API publique
// =====================================================================

/**
 * Génère une présentation PowerPoint professionnelle à partir d'un CV
 * structuré.
 *
 * Le fichier généré suit une mise en page 16:9 moderne. Les diapositives
 * vides (sections sans données) sont automatiquement omises.
 *
 * @param params - Paramètres de génération.
 * @param params.parsedCv - CV structuré issu de l'extraction NVIDIA.
 * @param params.score - Score optionnel sur 100 (affiché sur la couverture).
 * @param params.templateId - Identifiant du template visuel à appliquer (défaut : `modern`).
 * @returns Un `Buffer` Node.js contenant le fichier `.pptx` binaire.
 *
 * @throws {Error} Si la génération échoue ou si le type de sortie renvoyé
 *                 par `pptxgenjs` est inattendu.
 */
export async function generatePowerPointCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
}): Promise<Buffer> {
  const { parsedCv, score } = params

  // Résolution du template visuel et application des couleurs/style.
  // Les variables `let` au niveau du module sont mises à jour ici afin que
  // toutes les fonctions `add*` utilisent les bonnes valeurs. Les couleurs
  // du template sont en majuscules pour correspondre au format attendu par
  // `pptxgenjs`.
  const template: CvTemplate = getTemplate(params.templateId)
  ACCENT_COLOR = template.accentColor.toUpperCase()
  SECONDARY_COLOR = template.secondaryColor.toUpperCase()
  ACCENT_LIGHT = template.accentColor.toUpperCase()
  // Si le template active l'en-tête coloré, les diapositives de couverture
  // et de clôture prennent la couleur d'accent comme fond (au lieu du gris
  // très foncé par défaut) ; DARK_BG est utilisé directement par les slides.
  DARK_BG = template.coloredHeader ? template.accentColor.toUpperCase() : '1F2937'
  SECTION_HAS_BORDER = template.sectionBorder
  COLORED_HEADER = template.coloredHeader

  const pptx = new pptxgen()
  // Layout 16:9 large (13,33″ × 7,5″) — équivalent PowerPoint standard.
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Agent de transformation de CV'
  pptx.company = 'CV Transformer'
  pptx.subject = 'CV généré automatiquement'
  const fullName = (parsedCv.personalInfo.fullName ?? '').trim()
  pptx.title = fullName ? `CV — ${fullName}` : 'CV'

  const labels = getLabels(parsedCv)

  // Diapo 1 — Couverture.
  addCoverSlide(pptx, parsedCv, labels, score)

  // Diapo 2 — Profil (si résumé présent).
  addProfileSlide(pptx, parsedCv, labels)

  // Diapos 3+ — Expérience professionnelle (1+ diapos, 3 max par diapo).
  if (parsedCv.workExperience.length > 0) {
    const chunks = chunk(parsedCv.workExperience, MAX_EXPERIENCES_PER_SLIDE)
    chunks.forEach((expChunk, i) => {
      addExperienceSlide(pptx, expChunk, labels, i + 1, chunks.length)
    })
  }

  // Diapo — Formation.
  addEducationSlide(pptx, parsedCv.education, labels)

  // Diapo — Compétences & Langues.
  addSkillsAndLanguagesSlide(pptx, parsedCv, labels)

  // Diapo — Projets & Certifications.
  addProjectsAndCertificationsSlide(pptx, parsedCv, labels)

  // Diapo finale — Merci.
  addThankYouSlide(pptx, parsedCv, labels)

  // Génération du buffer binaire.
  // En Node, `pptxgenjs` retourne un `Buffer` pour `nodebuffer`, mais le
  // type déclaré est une union plus large — on normalise donc défensivement.
  const result = await pptx.write({ outputType: 'nodebuffer' })

  if (typeof result === 'string') {
    throw new Error(
      "Type de sortie inattendu pour la présentation PowerPoint : string au lieu d'un buffer.",
    )
  }
  if (Buffer.isBuffer(result)) {
    return result
  }
  if (result instanceof Uint8Array) {
    return Buffer.from(result)
  }
  if (result instanceof ArrayBuffer) {
    return Buffer.from(result)
  }
  // Cas restant (Blob) — non géré côté serveur Node.
  throw new Error(
    "Type de sortie inattendu pour la présentation PowerPoint (Blob non supporté).",
  )
}

/**
 * Génère le nom de fichier suggéré pour la présentation PowerPoint.
 *
 * Le nom est normalisé : minuscules, diacritiques supprimés, caractères non
 * alphanumériques remplacés par `_`, préfixe `CV_`, extension `.pptx`.
 *
 * @param fullName - Nom complet du candidat.
 * @returns Nom de fichier sécurisé, ex. `CV_jean_dupont.pptx`.
 *
 * @example
 * ```ts
 * getPowerPointFileName('Jean Dupont')      // → 'CV_jean_dupont.pptx'
 * getPowerPointFileName("Marie-Josée O'Neil") // → 'CV_marie_josee_o_neil.pptx'
 * getPowerPointFileName('')                   // → 'CV_candidat.pptx'
 * ```
 */
export function getPowerPointFileName(fullName: string): string {
  const normalized = (fullName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // suppression des diacritiques
    .replace(/[^a-zA-Z0-9]+/g, '_') // tout caractère non alphanumérique → _
    .replace(/^_+|_+$/g, '') // trimming des underscores
    .toLowerCase()
  const base = normalized || 'candidat'
  return `CV_${base}.pptx`
}
