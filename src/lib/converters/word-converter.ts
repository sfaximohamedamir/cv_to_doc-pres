/**
 * Convertisseur Word (`.docx`) pour les CV structurés.
 *
 * Ce module transforme un objet {@link ParsedCv} (issu de l'extraction NVIDIA)
 * en un document Word professionnel à l'aide de la bibliothèque `docx` v9.
 *
 * Le document généré suit une mise en page classique de CV :
 * - En-tête (nom, titre, contacts, score optionnel) sur fond légèrement teinté
 * - Profil / résumé
 * - Expérience professionnelle
 * - Formation
 * - Compétences (regroupées par catégorie si disponible)
 * - Langues
 * - Projets
 * - Certifications
 * - Centres d'intérêt
 *
 * La couleur d'accent par défaut est un vert émeraude (`#10b981`) appliqué aux
 * titres de section et à la bordure inférieure de séparation.
 *
 * Les libellés sont en français par défaut, et en anglais si
 * `parsedCv.detectedLanguage` commence par `'en'`.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
  UnderlineType,
  type IBorderOptions,
  type ParagraphChild,
} from 'docx'
import type { ParsedCv, Skill } from '@/lib/cv/types'
import { getTemplate, type CvTemplate, type CvTemplateId } from '@/lib/cv/templates'
import type { ExtractedTemplateStyle } from './template-analyzer'

// =====================================================================
// Constantes de style
// =====================================================================
//
// Les couleurs d'accent et de fond sont mutables (`let`) car elles sont
// redéfinies au début de `generateWordCv` en fonction du template visuel
// demandé. Les couleurs de texte (gris foncé / gris moyen) restent fixes
// car elles ne dépendent pas du template.

/** Couleur d'accent principale (vert émeraude par défaut). */
let ACCENT_COLOR = '10b981'

/** Couleur d'accent secondaire (teal par défaut). */
let SECONDARY_COLOR = '0d9488'

/** Couleur des liens hypertexte (bleu par défaut, mais devient l'accent). */
let LINK_COLOR = '2563eb'

/** Fond léger pour la bande d'en-tête (slate-50 par défaut). */
let HEADER_BG = 'f8fafc'

/** Couleur du texte sur fond d'accent (blanc par défaut). */
let ACCENT_TEXT_COLOR = 'FFFFFF'

/** Indique si les titres de section ont une bordure inférieure. */
let SECTION_HAS_BORDER = true

/** Indique si l'en-tête a un fond coloré (avec la couleur d'accent). */
let COLORED_HEADER = false

/** Couleur de texte principal (gris très foncé). */
const TEXT_COLOR = '111827'

/** Couleur secondaire / métadonnées (gris moyen). */
const MUTED_COLOR = '6b7280'

/** Tailles de police en demi-points (1 pt = 2 unités). */
const SIZE_NAME = 48 // 24 pt — nom complet
const SIZE_TITLE = 28 // 14 pt — titre professionnel
const SIZE_HEADING = 28 // 14 pt — titres de section
const SIZE_BODY = 22 // 11 pt — corps de texte
const SIZE_SMALL = 20 // 10 pt — métadonnées

/** Marge de page en twips (1 pouce = 1440 twips ≈ 2,54 cm). */
const PAGE_MARGIN = 1440

// =====================================================================
// Libellés localisés
// =====================================================================

/** Ensemble de libellés localisés utilisés dans le document. */
interface CvLabels {
  /** Titre de la section profil. */
  profile: string
  /** Titre de la section expérience professionnelle. */
  workExperience: string
  /** Titre de la section formation. */
  education: string
  /** Titre de la section compétences. */
  skills: string
  /** Titre de la section langues. */
  languages: string
  /** Titre de la section projets. */
  projects: string
  /** Titre de la section certifications. */
  certifications: string
  /** Titre de la section centres d'intérêt. */
  interests: string
  /** Préfixe du badge de score. */
  score: string
  /** Libellé par défaut pour regrouper les compétences sans catégorie. */
  otherSkills: string
}

/** Libellés en français. */
const FRENCH_LABELS: CvLabels = {
  profile: 'Profil',
  workExperience: 'Expérience professionnelle',
  education: 'Formation',
  skills: 'Compétences',
  languages: 'Langues',
  projects: 'Projets',
  certifications: 'Certifications',
  interests: "Centres d'intérêt",
  score: 'Score CV',
  otherSkills: 'Autres',
}

/** Libellés en anglais. */
const ENGLISH_LABELS: CvLabels = {
  profile: 'Profile',
  workExperience: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  projects: 'Projects',
  certifications: 'Certifications',
  interests: 'Interests',
  score: 'CV Score',
  otherSkills: 'Other',
}

/**
 * Détermine si le document doit utiliser les libellés anglais.
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
// Helpers de construction
// =====================================================================

/**
 * Construit une bordure inférieure fine (effet « divider ») à partir de la
 * couleur d'accent courante. La bordure est calculée à chaque appel afin de
 * tenir compte du template sélectionné.
 */
function buildSectionBottomBorder(): IBorderOptions {
  return {
    style: BorderStyle.SINGLE,
    color: ACCENT_COLOR,
    size: 8, // 1 pt
    space: 4,
  }
}

/**
 * Construit un titre de section de niveau 2 avec une bordure inférieure
 * verte (effet « divider ») et la couleur d'accent.
 *
 * Si le template désactivé les bordures de section (`SECTION_HAS_BORDER` à
 * `false`), aucune bordure n'est ajoutée.
 *
 * @param text - Libellé du titre.
 * @returns Un paragraphe `Heading 2` stylé.
 */
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    keepNext: true,
    border: SECTION_HAS_BORDER ? { bottom: buildSectionBottomBorder() } : undefined,
    children: [
      new TextRun({
        text,
        bold: true,
        size: SIZE_HEADING,
        color: ACCENT_COLOR,
      }),
    ],
  })
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
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// =====================================================================
// Sections du document
// =====================================================================

/**
 * Construit l'en-tête du CV : nom (grand, sur fond léger), titre
 * professionnel, badge de score optionnel, et ligne de contacts.
 * @param parsedCv - CV structuré.
 * @param score - Score optionnel à afficher en haut du document.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes d'en-tête.
 */
function buildHeader(parsedCv: ParsedCv, score: number | undefined, labels: CvLabels): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const { personalInfo } = parsedCv

  // Selon le template, l'en-tête est soit sur un fond léger (HEADER_BG),
  // soit sur un fond coloré (ACCENT_COLOR) — dans ce dernier cas, le texte
  // doit être clair pour rester lisible.
  const headerBgFill = COLORED_HEADER ? ACCENT_COLOR : HEADER_BG
  const headerTextColor = COLORED_HEADER ? ACCENT_TEXT_COLOR : TEXT_COLOR
  const headerMutedColor = COLORED_HEADER ? ACCENT_TEXT_COLOR : MUTED_COLOR

  // Nom complet — grand titre sur bande légèrement teintée
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 60 },
      shading: { type: ShadingType.CLEAR, fill: headerBgFill, color: 'auto' },
      children: [
        new TextRun({
          text: personalInfo.fullName || 'Curriculum Vitae',
          bold: true,
          size: SIZE_NAME,
          color: headerTextColor,
        }),
      ],
    }),
  )

  // Titre professionnel
  if (personalInfo.title?.trim()) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({
            text: personalInfo.title,
            italics: true,
            size: SIZE_TITLE,
            color: headerMutedColor,
          }),
        ],
      }),
    )
  }

  // Badge de score
  if (typeof score === 'number' && !Number.isNaN(score)) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 80 },
        children: [
          new TextRun({
            text: `${labels.score} : ${Math.round(score)}/100`,
            bold: true,
            size: SIZE_BODY,
            color: ACCENT_COLOR,
          }),
        ],
      }),
    )
  }

  // Ligne de contacts — uniquement les champs présents, séparés par « | »
  const contactParts: string[] = []
  if (personalInfo.email) contactParts.push(personalInfo.email)
  if (personalInfo.phone) contactParts.push(personalInfo.phone)
  if (personalInfo.location) contactParts.push(personalInfo.location)
  if (personalInfo.website) contactParts.push(personalInfo.website)
  if (personalInfo.linkedin) contactParts.push(personalInfo.linkedin)
  if (contactParts.length > 0) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 200 },
        children: [
          new TextRun({
            text: contactParts.join(' | '),
            size: SIZE_SMALL,
            color: headerMutedColor,
          }),
        ],
      }),
    )
  }

  return paragraphs
}

/**
 * Construit la section « Profil » si un résumé est disponible.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildProfileSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  const summary = parsedCv.personalInfo.summary?.trim()
  if (!summary) return []
  return [
    sectionHeading(labels.profile),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({
          text: summary,
          size: SIZE_BODY,
          color: TEXT_COLOR,
        }),
      ],
    }),
  ]
}

/**
 * Construit la section « Expérience professionnelle ».
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildWorkExperienceSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  if (!parsedCv.workExperience.length) return []
  const result: Paragraph[] = [sectionHeading(labels.workExperience)]

  for (const exp of parsedCv.workExperience) {
    // Ligne 1 — intitulé du poste + entreprise
    const titleRuns: ParagraphChild[] = []
    if (exp.title?.trim()) {
      titleRuns.push(new TextRun({ text: exp.title, bold: true, size: SIZE_BODY, color: TEXT_COLOR }))
    }
    if (exp.company?.trim()) {
      titleRuns.push(new TextRun({ text: ' — ', size: SIZE_BODY, color: MUTED_COLOR }))
      titleRuns.push(new TextRun({ text: exp.company, bold: true, size: SIZE_BODY, color: TEXT_COLOR }))
    }
    if (titleRuns.length > 0) {
      result.push(
        new Paragraph({
          spacing: { before: 120, after: 0 },
          keepNext: true,
          children: titleRuns,
        }),
      )
    }

    // Ligne 2 — dates et localisation (italique, muted)
    const dateRange = formatDateRange(exp.startDate, exp.endDate)
    const metaParts: string[] = []
    if (dateRange) metaParts.push(dateRange)
    if (exp.location?.trim()) metaParts.push(exp.location.trim())
    if (metaParts.length > 0) {
      result.push(
        new Paragraph({
          spacing: { before: 0, after: 40 },
          keepNext: true,
          children: [
            new TextRun({
              text: metaParts.join(' • '),
              italics: true,
              size: SIZE_SMALL,
              color: MUTED_COLOR,
            }),
          ],
        }),
      )
    }

    // Description — un paragraphe par ligne extraite
    for (const line of splitDescriptionLines(exp.description)) {
      result.push(
        new Paragraph({
          spacing: { before: 0, after: 60 },
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: line, size: SIZE_BODY, color: TEXT_COLOR }),
          ],
        }),
      )
    }
  }

  return result
}

/**
 * Construit la section « Formation ».
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildEducationSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  if (!parsedCv.education.length) return []
  const result: Paragraph[] = [sectionHeading(labels.education)]

  for (const edu of parsedCv.education) {
    // Ligne 1 — diplôme (gras) + établissement
    const titleRuns: ParagraphChild[] = []
    if (edu.degree?.trim()) {
      titleRuns.push(new TextRun({ text: edu.degree, bold: true, size: SIZE_BODY, color: TEXT_COLOR }))
    }
    if (edu.institution?.trim()) {
      titleRuns.push(new TextRun({ text: ' — ', size: SIZE_BODY, color: MUTED_COLOR }))
      titleRuns.push(new TextRun({ text: edu.institution, size: SIZE_BODY, color: TEXT_COLOR }))
    }
    if (titleRuns.length > 0) {
      result.push(
        new Paragraph({
          spacing: { before: 120, after: 0 },
          keepNext: true,
          children: titleRuns,
        }),
      )
    }

    // Ligne 2 — dates et spécialité
    const dateRange = formatDateRange(edu.startDate, edu.endDate)
    const metaParts: string[] = []
    if (dateRange) metaParts.push(dateRange)
    if (edu.field?.trim()) metaParts.push(edu.field.trim())
    if (metaParts.length > 0) {
      result.push(
        new Paragraph({
          spacing: { before: 0, after: 40 },
          keepNext: true,
          children: [
            new TextRun({
              text: metaParts.join(' • '),
              italics: true,
              size: SIZE_SMALL,
              color: MUTED_COLOR,
            }),
          ],
        }),
      )
    }

    // Description optionnelle
    for (const line of splitDescriptionLines(edu.description)) {
      result.push(
        new Paragraph({
          spacing: { before: 0, after: 60 },
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: line, size: SIZE_BODY, color: TEXT_COLOR }),
          ],
        }),
      )
    }
  }

  return result
}

/**
 * Construit la section « Compétences ».
 *
 * Si les compétences possèdent une catégorie, elles sont regroupées et
 * présentées sous forme de blocs « Catégorie : skill1 • skill2 (niveau) ».
 * Sinon, une liste simple sur une ligne est générée.
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildSkillsSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  if (!parsedCv.skills.length) return []
  const result: Paragraph[] = [sectionHeading(labels.skills)]

  // Regroupement par catégorie (les compétences sans catégorie vont dans « Autres »)
  const byCategory = new Map<string, Skill[]>()
  for (const skill of parsedCv.skills) {
    const category = skill.category?.trim() || labels.otherSkills
    const arr = byCategory.get(category) ?? []
    arr.push(skill)
    byCategory.set(category, arr)
  }

  /**
   * Construit les runs pour une liste de compétences données :
   * `name (level) • name (level) • ...`
   */
  const buildSkillRuns = (skills: Skill[]): ParagraphChild[] => {
    const runs: ParagraphChild[] = []
    skills.forEach((skill, index) => {
      if (index > 0) {
        runs.push(new TextRun({ text: ' • ', size: SIZE_BODY, color: MUTED_COLOR }))
      }
      runs.push(new TextRun({ text: skill.name, size: SIZE_BODY, color: TEXT_COLOR }))
      if (skill.level?.trim()) {
        runs.push(
          new TextRun({
            text: ` (${skill.level.trim()})`,
            size: SIZE_SMALL,
            color: MUTED_COLOR,
            italics: true,
          }),
        )
      }
    })
    return runs
  }

  // Cas 1 — une seule catégorie « Autres » : on affiche une liste simple
  const onlyFallback =
    byCategory.size === 1 && byCategory.has(labels.otherSkills)

  if (onlyFallback) {
    const skills = byCategory.get(labels.otherSkills) ?? []
    result.push(
      new Paragraph({
        spacing: { before: 0, after: 120 },
        children: buildSkillRuns(skills),
      }),
    )
    return result
  }

  // Cas 2 — plusieurs catégories : un paragraphe par catégorie
  // On affiche d'abord les catégories nommées, puis « Autres » en dernier
  const sortedCategories = Array.from(byCategory.keys()).sort((a, b) => {
    if (a === labels.otherSkills) return 1
    if (b === labels.otherSkills) return -1
    return a.localeCompare(b)
  })

  for (const category of sortedCategories) {
    const skills = byCategory.get(category) ?? []
    const runs: ParagraphChild[] = [
      new TextRun({
        text: `${category} : `,
        bold: true,
        size: SIZE_BODY,
        color: TEXT_COLOR,
      }),
      ...buildSkillRuns(skills),
    ]
    result.push(
      new Paragraph({
        spacing: { before: 40, after: 80 },
        children: runs,
      }),
    )
  }

  return result
}

/**
 * Construit la section « Langues ».
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildLanguagesSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  if (!parsedCv.languages.length) return []
  const result: Paragraph[] = [sectionHeading(labels.languages)]

  const runs: ParagraphChild[] = []
  parsedCv.languages.forEach((lang, index) => {
    if (index > 0) {
      runs.push(new TextRun({ text: ' • ', size: SIZE_BODY, color: MUTED_COLOR }))
    }
    runs.push(new TextRun({ text: lang.name, bold: true, size: SIZE_BODY, color: TEXT_COLOR }))
    if (lang.level?.trim()) {
      runs.push(
        new TextRun({
          text: ` — ${lang.level.trim()}`,
          size: SIZE_BODY,
          color: MUTED_COLOR,
          italics: true,
        }),
      )
    }
  })
  result.push(
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: runs,
    }),
  )

  return result
}

/**
 * Construit la section « Projets ».
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildProjectsSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  if (!parsedCv.projects?.length) return []
  const result: Paragraph[] = [sectionHeading(labels.projects)]

  for (const project of parsedCv.projects) {
    const titleRuns: ParagraphChild[] = [
      new TextRun({ text: project.name, bold: true, size: SIZE_BODY, color: TEXT_COLOR }),
    ]
    if (project.url?.trim()) {
      titleRuns.push(new TextRun({ text: ' — ', size: SIZE_BODY, color: MUTED_COLOR }))
      titleRuns.push(
        new ExternalHyperlink({
          link: project.url,
          children: [
            new TextRun({
              text: project.url,
              size: SIZE_SMALL,
              color: LINK_COLOR,
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
        }),
      )
    }
    result.push(
      new Paragraph({
        spacing: { before: 120, after: 0 },
        keepNext: true,
        children: titleRuns,
      }),
    )

    for (const line of splitDescriptionLines(project.description)) {
      result.push(
        new Paragraph({
          spacing: { before: 0, after: 60 },
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: line, size: SIZE_BODY, color: TEXT_COLOR }),
          ],
        }),
      )
    }
  }

  return result
}

/**
 * Construit la section « Certifications ».
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildCertificationsSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  if (!parsedCv.certifications?.length) return []
  const result: Paragraph[] = [sectionHeading(labels.certifications)]

  for (const cert of parsedCv.certifications) {
    const runs: ParagraphChild[] = [
      new TextRun({ text: cert.name, bold: true, size: SIZE_BODY, color: TEXT_COLOR }),
    ]
    const metaParts: string[] = []
    if (cert.issuer?.trim()) metaParts.push(cert.issuer.trim())
    if (cert.date?.trim()) metaParts.push(cert.date.trim())
    if (metaParts.length > 0) {
      runs.push(
        new TextRun({
          text: ` — ${metaParts.join(', ')}`,
          size: SIZE_BODY,
          color: MUTED_COLOR,
        }),
      )
    }
    result.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: runs,
      }),
    )
  }

  return result
}

/**
 * Construit la section « Centres d'intérêt ».
 * @param parsedCv - CV structuré.
 * @param labels - Libellés localisés.
 * @returns Les paragraphes de la section, ou un tableau vide.
 */
function buildInterestsSection(parsedCv: ParsedCv, labels: CvLabels): Paragraph[] {
  const cleaned = (parsedCv.interests ?? [])
    .map((interest) => interest.trim())
    .filter((interest) => interest.length > 0)
  if (cleaned.length === 0) return []
  return [
    sectionHeading(labels.interests),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: cleaned.join(', '),
          size: SIZE_BODY,
          color: TEXT_COLOR,
        }),
      ],
    }),
  ]
}

// =====================================================================
// API publique
// =====================================================================

/**
 * Génère un document Word professionnel à partir d'un CV structuré.
 *
 * Le document produit inclut l'en-tête (nom, titre, contacts), un badge
 * de score optionnel, le profil, les expériences, la formation, les
 * compétences, les langues, les projets, les certifications et les
 * centres d'intérêt — chaque section n'étant générée que si elle contient
 * au moins une entrée.
 *
 * @param params.parsedCv - CV structuré à convertir.
 * @param params.score - Score optionnel (sur 100) affiché en haut du document.
 * @param params.templateId - Identifiant du template visuel à appliquer (défaut : `modern`).
 * @returns Un `Buffer` Node.js contenant le fichier `.docx` binaire.
 */
export async function generateWordCv(params: {
  parsedCv: ParsedCv
  score?: number
  templateId?: CvTemplateId
  templateStyle?: ExtractedTemplateStyle
}): Promise<Buffer> {
  const { parsedCv, score } = params

  // Résolution du template visuel et application des couleurs/style.
  // Les variables `let` au niveau du module sont mises à jour ici afin que
  // toutes les fonctions `build*` utilisent les bonnes valeurs.
  const template: CvTemplate = getTemplate(params.templateId)
  const tStyle = params.templateStyle
  if (tStyle && tStyle.valid) {
    ACCENT_COLOR = (tStyle.accentColor || template.accentColor).toLowerCase()
    SECONDARY_COLOR = (tStyle.secondaryColor || template.secondaryColor).toLowerCase()
    HEADER_BG = (tStyle.headerBg || template.headerBg).toLowerCase()
    LINK_COLOR = (tStyle.accentColor || template.accentColor).toLowerCase()
    ACCENT_TEXT_COLOR = (tStyle.accentTextColor || template.accentTextColor).toUpperCase()
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  } else {
    ACCENT_COLOR = template.accentColor.toLowerCase()
    SECONDARY_COLOR = template.secondaryColor.toLowerCase()
    HEADER_BG = template.headerBg.toLowerCase()
    LINK_COLOR = template.accentColor.toLowerCase()
    ACCENT_TEXT_COLOR = template.accentTextColor.toUpperCase()
    SECTION_HAS_BORDER = template.sectionBorder
    COLORED_HEADER = template.coloredHeader
  }

  const labels = getLabels(parsedCv)

  const children: Paragraph[] = [
    ...buildHeader(parsedCv, score, labels),
    ...buildProfileSection(parsedCv, labels),
    ...buildWorkExperienceSection(parsedCv, labels),
    ...buildEducationSection(parsedCv, labels),
    ...buildSkillsSection(parsedCv, labels),
    ...buildLanguagesSection(parsedCv, labels),
    ...buildProjectsSection(parsedCv, labels),
    ...buildCertificationsSection(parsedCv, labels),
    ...buildInterestsSection(parsedCv, labels),
  ]

  const fullName = parsedCv.personalInfo.fullName || 'Candidat'

  const doc = new Document({
    creator: 'Agent de transformation de CV',
    title: `CV — ${fullName}`,
    description: parsedCv.personalInfo.summary || `CV de ${fullName}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: PAGE_MARGIN,
              right: PAGE_MARGIN,
              bottom: PAGE_MARGIN,
              left: PAGE_MARGIN,
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBuffer(doc)
}

/**
 * Génère le nom de fichier suggéré pour le document Word.
 *
 * Le nom est normalisé : suppression des accents, des caractères non
 * alphanumériques, et lower-casing. Le résultat est préfixé par `CV_`
 * et porte l'extension `.docx`.
 *
 * @example
 * getWordFileName('Jean Dupont') // → 'CV_jean_dupont.docx'
 * getWordFileName('Marie-Josée O\'Neil') // → 'CV_marie_josee_o_neil.docx'
 * @param fullName - Nom complet du candidat.
 * @returns Un nom de fichier sûr pour le téléchargement.
 */
export function getWordFileName(fullName: string): string {
  const sanitized = (fullName || 'CV')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // suppression des diacritiques
    .replace(/[^a-zA-Z0-9]+/g, '_') // caractères non alphanumériques → _
    .replace(/^_+|_+$/g, '') // trimming des _
    .toLowerCase()
  return `CV_${sanitized || 'candidat'}.docx`
}
