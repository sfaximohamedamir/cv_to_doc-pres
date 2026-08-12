/**
 * Moteur de remplissage de squelettes personnalisés Word (.docx) et PowerPoint (.pptx).
 *
 * Permet d'intégrer TOUTES les données extraites d'un CV (ParsedCv) directement dans un
 * document squelette fourni par l'utilisateur (trame Word officielle, modèle custom,
 * placeholders {{FULL_NAME}}, {{TITLE}}, {{EXPERIENCE}}, {{COMPETENCES}}, etc. ou
 * balises SDT Content Control Word).
 *
 * Garantit une compatibilité OpenXML 100% sans corruption XML.
 */

import JSZip from 'jszip'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import type { ParsedCv, WorkExperience, Education, Skill } from '@/lib/cv/types'

function escapeXml(unsafe: string): string {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * ---------------------------------------------------------------------------
 * Remplissage sémantique des Content Controls (SDT) Word.
 *
 * Les templates Word officiels utilisent des balises SDT (<w:sdt>) dont les
 * attributs <w:tag>/<w:alias> décrivent le champ (ex. "Diplôme :",
 * "Date d'obtention :", "Intitulé du poste 1 :", "Principales responsabilités
 * pour Poste 1 :"). On remplit ces champs en utilisant le tag plutôt que le
 * texte affiché, ce qui permet :
 *   - de remplir TOUS les champs (dates, descriptions, objectif, compétences…),
 *   - de remplir les blocs répétés séquentiellement (2e poste → 2e expérience),
 *   - de fonctionner même si l'utilisateur a modifié le texte visible.
 * ---------------------------------------------------------------------------
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** Normalise un tag SDT : NBSP → espace, apostrophes, minuscules, ':' final retiré. */
function normalizeSdtKey(raw: string): string {
  return String(raw || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s：:]+$/, '')
    .toLowerCase()
}

/** File FIFO : chaque occurrence du placeholder consomme l'élément suivant de la liste. */
function makeQueue(values: string[]): () => string {
  let i = 0
  const cleaned = (values || []).map((v) => String(v ?? ''))
  return () => (i < cleaned.length ? cleaned[i++] : '')
}

type SdtRule = {
  keys?: string[]
  pattern?: RegExp
  value: (match?: RegExpMatchArray) => string
}

/**
 * Construit la table de correspondance tag SDT → donnée du CV.
 * (Expériences numérotées + infos personnelles ; les champs séquentiels comme
 * "Diplôme" sont gérés directement dans fillSdtContentControls via des files.)
 */
function buildSdtRules(parsedCv: ParsedCv): SdtRule[] {
  const p = parsedCv.personalInfo
  const exps = parsedCv.workExperience || []

  const expAt = (n: number) => exps[Math.max(0, n - 1)] || {}
  const expDates = (e: { startDate?: string; endDate?: string }) =>
    [e.startDate, e.endDate].filter(Boolean).join(' – ')

  return [
    // --- Expériences numérotées (template Word officiel "Poste 1", "Poste 2"…) ---
    { pattern: /^intitulé du poste\s*(\d+)$/, value: (m) => expAt(parseInt(m![1], 10)).title || '' },
    { pattern: /^entreprise pour poste\s*(\d+)$/, value: (m) => expAt(parseInt(m![1], 10)).company || '' },
    { pattern: /^date de début.*date de fin pour poste\s*(\d+)$/, value: (m) => expDates(expAt(parseInt(m![1], 10))) },
    { pattern: /^principales responsabilités pour poste\s*(\d+)$/, value: (m) => expAt(parseInt(m![1], 10)).description || '' },

    // --- Informations personnelles ---
    { keys: ['votre nom', 'ton nom', 'prénom nom', 'nom complet', 'name', 'full name'], value: () => p.fullName || '' },
    { keys: ['adresse postale, code postal, ville', 'adresse postale', 'adresse', 'ville', 'localisation', 'adresse complète'], value: () => p.location || '' },
    { keys: ['téléphone', 'telephone', 'numéro de téléphone', 'tel', 'phone'], value: () => p.phone || '' },
    { keys: ['e-mail', 'email', 'adresse e-mail', 'adresse email', 'mail', 'courriel'], value: () => p.email || '' },
    { keys: ['site web', 'site internet', 'website', 'url du site'], value: () => p.website || '' },
    { keys: ['linkedin', 'profil linkedin'], value: () => p.linkedin || '' },
    { keys: ['github', 'profil github'], value: () => p.github || '' },
    { keys: ['ajouter des objectifs', 'objectifs', 'résumé', 'resume', 'profil professionnel', 'à propos', 'a propos', 'bio', 'summary', 'objectif professionnel'], value: () => p.summary || '' },
  ]
}

/**
 * Remplace le texte d'un SDT par la valeur fournie, en conservant la mise en
 * forme du premier run. Les lignes supplémentaires (retours à la ligne dans la
 * description) sont ajoutées sous forme de runs avec saut de ligne <w:br/>.
 */
function setSdtText(sdt: any, value: string, doc: any): boolean {
  const tNodes: Element[] = []
  const all = sdt.getElementsByTagName('w:t')
  for (let i = 0; i < all.length; i++) tNodes.push(all.item(i) as Element)
  if (tNodes.length === 0) return false

  const lines = String(value ?? '').split(/\r?\n/)
  const firstT = tNodes[0]
  firstT.textContent = lines[0] || ''
  for (let i = 1; i < tNodes.length; i++) tNodes[i].textContent = ''

  if (lines.length > 1) {
    const firstRun = firstT.parentNode as Element | null
    let refNode: Node | null = firstRun
    for (let li = 1; li < lines.length; li++) {
      let newRun: Element
      if (firstRun) {
        newRun = firstRun.cloneNode(true) as Element
        const ts = newRun.getElementsByTagName('w:t')
        if (ts.length > 0) {
          for (let i = 1; i < ts.length; i++) newRun.removeChild(ts.item(i) as Node)
          ;(ts.item(0) as Element).textContent = lines[li]
        }
      } else {
        newRun = doc.createElementNS(W_NS, 'w:r')
        const t = doc.createElementNS(W_NS, 'w:t')
        t.textContent = lines[li]
        newRun.appendChild(t)
      }
      const br = doc.createElementNS(W_NS, 'w:br')
      newRun.insertBefore(br, newRun.firstChild)
      if (refNode && refNode.parentNode) {
        refNode.parentNode.insertBefore(newRun, refNode.nextSibling)
        refNode = newRun
      }
    }
  }
  return true
}

/**
 * Remplit tous les Content Controls (<w:sdt>) d'un document Word à partir des
 * tags sémantiques. Retourne le XML modifié et le nombre de champs remplis.
 */
function fillSdtContentControls(xmlStr: string, parsedCv: ParsedCv): { xml: string; count: number } {
  try {
    const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
    const rules = buildSdtRules(parsedCv)

    const sdts: any[] = []
    const allSdts = doc.getElementsByTagName('w:sdt')
    for (let i = 0; i < allSdts.length; i++) sdts.push(allSdts.item(i))

    // Files séquentielles partagées entre règles (diplôme 1 → edu 1, etc.)
    const eduQueue = makeQueue(parsedCv.education.map((e) => e.degree || ''))
    const eduDateQueue = makeQueue(parsedCv.education.map((e) => e.endDate || e.startDate || ''))
    const eduInstQueue = makeQueue(parsedCv.education.map((e) => e.institution || ''))
    const eduFieldQueue = makeQueue(parsedCv.education.map((e) => e.field || ''))
    const skillNameQueue = makeQueue(parsedCv.skills.map((s) => s.name || ''))
    const skillLevelQueue = makeQueue(parsedCv.skills.map((s) => s.level || ''))

    let filled = 0
    for (const sdt of sdts) {
      const tag = sdt.getElementsByTagName('w:tag').item(0)
      const alias = sdt.getElementsByTagName('w:alias').item(0)
      const raw =
        (tag && tag.getAttribute('w:val')) || (alias && alias.getAttribute('w:val')) || ''
      const key = normalizeSdtKey(raw)
      if (!key) continue

      let value: string | undefined
      switch (key) {
        case 'diplôme':
        case 'diplome':
        case 'degree':
          value = eduQueue()
          break
        case "date d'obtention":
        case 'date de fin':
          value = eduDateQueue()
          break
        case 'établissement':
        case 'etablissement':
        case 'école':
        case 'ecole':
        case 'institution':
        case 'université':
          value = eduInstQueue()
          break
        case 'spécialisation':
        case 'specialisation':
        case 'filière':
          value = eduFieldQueue()
          break
        case 'option':
        case 'cours connexes':
        case 'cours connexe':
          value = ''
          break
        case 'gestion':
        case 'ventes':
        case 'communication':
        case 'leadership':
        case 'compétence':
        case 'competence':
        case 'skill':
        case 'savoir-faire':
          value = skillNameQueue()
          break
        default:
          if (/^compétences en (.+)$/.test(key)) {
            value = skillLevelQueue()
          }
          break
      }

      if (value === undefined) {
        for (const rule of rules) {
          if (rule.pattern) {
            const m = key.match(rule.pattern)
            if (m) {
              value = rule.value(m)
              break
            }
          } else if (rule.keys && rule.keys.includes(key)) {
            value = rule.value()
            break
          }
        }
      }

      if (value === undefined) continue
      setSdtText(sdt, value, doc)
      filled++
    }

    return { xml: new XMLSerializer().serializeToString(doc), count: filled }
  } catch (err) {
    console.warn('fillSdtContentControls warning:', err)
    return { xml: xmlStr, count: 0 }
  }
}

/**
 * Remplace de manière sécurisée du texte dans les nœuds de texte DOM (<w:t>, <a:t>)
 * sans JAMAIS modifier ni altérer la structure des balises XML.
 */
function replaceTextInXmlDom(xmlStr: string, replacements: Record<string, string>): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlStr, 'application/xml')

    // Récupérer toutes les balises de texte Word (<w:t>) et PowerPoint (<a:t>)
    const allElements = doc.getElementsByTagName('*')
    const tNodes: any[] = []

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements.item(i)
      if (el && (el.tagName === 'w:t' || el.tagName === 'a:t' || el.tagName === 't')) {
        tNodes.push(el)
      }
    }

    for (const node of tNodes) {
      let text = node.textContent || ''
      if (!text) continue
      let modified = false

      for (const [target, replacement] of Object.entries(replacements)) {
        if (target && text.includes(target)) {
          text = text.replaceAll(target, replacement || '')
          modified = true
        }
      }

      if (modified) {
        node.textContent = text
      }
    }

    return new XMLSerializer().serializeToString(doc)
  } catch (err) {
    console.warn('replaceTextInXmlDom warning:', err)
    return xmlStr
  }
}

function buildFormattedExperienceXml(experiences: WorkExperience[]): string {
  if (!experiences || experiences.length === 0) return ''
  return experiences
    .map((exp) => {
      const title = escapeXml(exp.title || 'Poste')
      const company = escapeXml(exp.company || '')
      const dates = escapeXml(
        [exp.startDate, exp.endDate].filter(Boolean).join(' – ')
      )
      const location = escapeXml(exp.location || '')
      const headerText = `${title}${company ? ` — ${company}` : ''}${dates ? ` | ${dates}` : ''}${location ? ` (${location})` : ''}`

      const descLines = (exp.description || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const descXml = descLines
        .map(
          (line) =>
            `<w:p><w:pPr><w:contextualSpacing/><w:spaceAfter w:val="60"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="333333"/></w:rPr><w:t xml:space="preserve">• ${escapeXml(line)}</w:t></w:r></w:p>`
        )
        .join('')

      return `
        <w:p><w:pPr><w:spaceBefore w:val="140"/><w:spaceAfter w:val="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="111827"/></w:rPr><w:t>${headerText}</w:t></w:r></w:p>
        ${descXml}
      `
    })
    .join('')
}

function buildFormattedEducationXml(educations: Education[]): string {
  if (!educations || educations.length === 0) return ''
  return educations
    .map((edu) => {
      const degree = escapeXml(edu.degree || 'Diplôme')
      const school = escapeXml(edu.institution || '')
      const dates = escapeXml(
        [edu.startDate, edu.endDate].filter(Boolean).join(' – ')
      )
      const field = escapeXml(edu.field || '')
      const headerText = `${degree}${school ? ` — ${school}` : ''}${dates ? ` | ${dates}` : ''}`

      const descLines = (edu.description || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const descXml = descLines
        .map(
          (line) =>
            `<w:p><w:pPr><w:spaceAfter w:val="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="555555"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
        )
        .join('')

      return `
        <w:p><w:pPr><w:spaceBefore w:val="120"/><w:spaceAfter w:val="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="111827"/></w:rPr><w:t>${headerText}</w:t></w:r></w:p>
        ${field ? `<w:p><w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="666666"/></w:rPr><w:t>Spécialisation : ${field}</w:t></w:r></w:p>` : ''}
        ${descXml}
      `
    })
    .join('')
}

function buildFormattedSkillsXml(parsedCv: ParsedCv): string {
  if (!parsedCv.skills || parsedCv.skills.length === 0) return ''

  const byCategory = new Map<string, Skill[]>()
  for (const s of parsedCv.skills) {
    const cat = s.category?.trim() || 'Compétences principales'
    const arr = byCategory.get(cat) || []
    arr.push(s)
    byCategory.set(cat, arr)
  }

  return Array.from(byCategory.entries())
    .map(([cat, list]) => {
      const skillsText = list.map((s) => s.name + (s.level ? ` (${s.level})` : '')).join(' • ')
      return `<w:p><w:pPr><w:spaceBefore w:val="60"/><w:spaceAfter w:val="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="111827"/></w:rPr><w:t>${escapeXml(cat)} : </w:t></w:r><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="333333"/></w:rPr><w:t>${escapeXml(skillsText)}</w:t></w:r></w:p>`
    })
    .join('')
}

function buildFormattedLanguagesXml(parsedCv: ParsedCv): string {
  if (!parsedCv.languages || parsedCv.languages.length === 0) return ''
  return parsedCv.languages
    .map((lang) => {
      const name = escapeXml(lang.name)
      const level = lang.level ? escapeXml(lang.level) : ''
      return `<w:p><w:pPr><w:spaceAfter w:val="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="111827"/></w:rPr><w:t>${name}${level ? ` — ${level}` : ''}</w:t></w:r></w:p>`
    })
    .join('')
}

function buildFormattedProjectsXml(parsedCv: ParsedCv): string {
  if (!parsedCv.projects || parsedCv.projects.length === 0) return ''
  return parsedCv.projects
    .map((proj) => {
      const name = escapeXml(proj.name || 'Projet')
      const url = proj.url ? escapeXml(proj.url) : ''
      const desc = proj.description ? escapeXml(proj.description) : ''
      return `
        <w:p><w:pPr><w:spaceBefore w:val="120"/><w:spaceAfter w:val="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="111827"/></w:rPr><w:t>${name}${url ? ` — ${url}` : ''}</w:t></w:r></w:p>
        ${desc ? `<w:p><w:pPr><w:spaceAfter w:val="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="555555"/></w:rPr><w:t>${desc}</w:t></w:r></w:p>` : ''}
      `
    })
    .join('')
}

function buildFormattedCertificationsXml(parsedCv: ParsedCv): string {
  if (!parsedCv.certifications || parsedCv.certifications.length === 0) return ''
  return parsedCv.certifications
    .map((cert) => {
      const name = escapeXml(cert.name || 'Certification')
      const issuer = cert.issuer ? escapeXml(cert.issuer) : ''
      const date = cert.date ? escapeXml(cert.date) : ''
      const meta = [issuer, date].filter(Boolean).join(', ')
      return `<w:p><w:pPr><w:spaceBefore w:val="60"/><w:spaceAfter w:val="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="111827"/></w:rPr><w:t>${name}${meta ? ` — ${meta}` : ''}</w:t></w:r></w:p>`
    })
    .join('')
}

function buildFormattedInterestsXml(parsedCv: ParsedCv): string {
  if (!parsedCv.interests || parsedCv.interests.length === 0) return ''
  const cleaned = parsedCv.interests.map((i) => i.trim()).filter((i) => i.length > 0)
  if (cleaned.length === 0) return ''
  return `<w:p><w:pPr><w:spaceBefore w:val="60"/><w:spaceAfter w:val="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="111827"/></w:rPr><w:t>Centres d'intérêt : </w:t></w:r><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="333333"/></w:rPr><w:t>${escapeXml(cleaned.join(', '))}</w:t></w:r></w:p>`
}

function buildFormattedReferencesXml(parsedCv: ParsedCv): string {
  if (!parsedCv.references || parsedCv.references.length === 0) return ''
  return parsedCv.references
    .map((ref) => {
      const name = escapeXml(ref.name || 'Référent')
      const contact = ref.contact ? escapeXml(ref.contact) : ''
      const rel = ref.relationship ? escapeXml(ref.relationship) : ''
      const meta = [contact, rel].filter(Boolean).join(', ')
      return `<w:p><w:pPr><w:spaceAfter w:val="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="111827"/></w:rPr><w:t>${name}${meta ? ` — ${meta}` : ''}</w:t></w:r></w:p>`
    })
    .join('')
}

function formatXmlParagraphs(text: string): string {
  if (!text || !text.trim()) return ''
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<w:p><w:r><w:rPr><w:sz w:val="22"/><w:color w:val="333333"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join('')
}

/**
 * Construit un objet de données ultra-complet pour docxtemplater
 */
function buildDocData(parsedCv: ParsedCv, score?: number): Record<string, unknown> {
  const p = parsedCv.personalInfo
  const fullName = p.fullName || ''
  const title = p.title || ''
  const summary = p.summary || ''
  const email = p.email || ''
  const phone = p.phone || ''
  const location = p.location || ''
  const website = p.website || ''
  const linkedin = p.linkedin || ''
  const github = p.github || ''
  const scoreStr = typeof score === 'number' ? `${Math.round(score)}/100` : ''

  const expTextPlain = parsedCv.workExperience
    .map(
      (e) =>
        `${e.title || ''}${e.company ? ` — ${e.company}` : ''}${e.startDate || e.endDate ? ` (${e.startDate || ''} - ${e.endDate || ''})` : ''}${e.location ? ` | ${e.location}` : ''}\n${(e.description || '').split('\n').map((l) => (l.trim() ? `• ${l.trim()}` : '')).filter(Boolean).join('\n')}`
    )
    .join('\n\n')

  const eduTextPlain = parsedCv.education
    .map(
      (ed) =>
        `${ed.degree || ''}${ed.institution ? ` — ${ed.institution}` : ''}${ed.startDate || ed.endDate ? ` (${ed.startDate || ''} - ${ed.endDate || ''})` : ''}${ed.field ? ` [${ed.field}]` : ''}${ed.description ? `\n${ed.description}` : ''}`
    )
    .join('\n\n')

  const skillsTextPlain = parsedCv.skills
    .map((s) => `${s.name}${s.level ? ` (${s.level})` : ''}`)
    .join(' • ')

  const languagesTextPlain = parsedCv.languages
    .map((l) => `${l.name}${l.level ? ` (${l.level})` : ''}`)
    .join(' • ')

  const projectsTextPlain = (parsedCv.projects || [])
    .map(
      (proj) =>
        `${proj.name || ''}${proj.url ? ` (${proj.url})` : ''}${proj.description ? `: ${proj.description}` : ''}`
    )
    .join('\n')

  const certsTextPlain = (parsedCv.certifications || [])
    .map(
      (cert) =>
        `${cert.name || ''}${cert.issuer ? ` — ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}`
    )
    .join('\n')

  const interestsTextPlain = (parsedCv.interests || []).join(', ')

  const referencesTextPlain = (parsedCv.references || [])
    .map(
      (ref) =>
        `${ref.name || ''}${ref.contact ? ` (${ref.contact})` : ''}${ref.relationship ? ` - ${ref.relationship}` : ''}`
    )
    .join('\n')

  const experiencesArray = parsedCv.workExperience.map((exp) => ({
    title: exp.title || '',
    company: exp.company || '',
    startDate: exp.startDate || '',
    endDate: exp.endDate || '',
    location: exp.location || '',
    description: exp.description || '',
    dateRange: [exp.startDate, exp.endDate].filter(Boolean).join(' – '),
  }))

  const educationArray = parsedCv.education.map((edu) => ({
    degree: edu.degree || '',
    institution: edu.institution || '',
    startDate: edu.startDate || '',
    endDate: edu.endDate || '',
    field: edu.field || '',
    description: edu.description || '',
    dateRange: [edu.startDate, edu.endDate].filter(Boolean).join(' – '),
  }))

  const skillsArray = parsedCv.skills.map((skill) => ({
    name: skill.name || '',
    level: skill.level || '',
    category: skill.category || '',
  }))

  const languagesArray = parsedCv.languages.map((lang) => ({
    name: lang.name || '',
    level: lang.level || '',
  }))

  return {
    fullName, FULL_NAME: fullName, NOM: fullName, Nom: fullName, FIRST_NAME: fullName.split(' ')[0] || '', LAST_NAME: fullName.split(' ').slice(1).join(' ') || '',
    title, TITLE: title, TITRE: title, Titre: title, POSTE: title,
    summary, SUMMARY: summary, PROFIL: summary, Profil: summary, RESUME: summary, BIO: summary,
    email, EMAIL: email, MAIL: email,
    phone, PHONE: phone, TELEPHONE: phone, TEL: phone,
    location, LOCATION: location, ADRESSE: location, VILLE: location,
    website, WEBSITE: website, SITE_WEB: website, URL: website,
    linkedin, LINKEDIN: linkedin, github, GITHUB: github,
    score: scoreStr, SCORE: scoreStr, SCORE_CV: scoreStr,

    WORK_EXPERIENCE: expTextPlain, EXPERIENCE: expTextPlain, EXPERIENCES: expTextPlain, workExperience: expTextPlain,
    EDUCATION: eduTextPlain, FORMATION: eduTextPlain, FORMATIONS: eduTextPlain,
    SKILLS: skillsTextPlain, COMPETENCES: skillsTextPlain, COMPETENCE: skillsTextPlain,
    LANGUAGES: languagesTextPlain, LANGUES: languagesTextPlain,
    PROJECTS: projectsTextPlain, PROJETS: projectsTextPlain, projects: projectsTextPlain,
    CERTIFICATIONS: certsTextPlain, CERTIFS: certsTextPlain, certifications: certsTextPlain,
    INTERESTS: interestsTextPlain, CENTRES_INTERET: interestsTextPlain, interests: interestsTextPlain,
    REFERENCES: referencesTextPlain, references: referencesTextPlain,

    experiences: experiencesArray, EXPERIENCES_LIST: experiencesArray,
    education: educationArray, FORMATIONS_LIST: educationArray,
    skills: skillsArray, COMPETENCES_LIST: skillsArray,
    languages: languagesArray, LANGUES_LIST: languagesArray,
  }
}

/**
 * Exécute docxtemplater de manière sécurisée avec un jeu de délimiteurs.
 */
function safeDocxtemplaterRender(
  buffer: Buffer,
  data: Record<string, unknown>,
  startDelim: string,
  endDelim: string
): Buffer {
  try {
    const zip = new PizZip(buffer)
    const doc = new Docxtemplater(zip, {
      delimiters: { start: startDelim, end: endDelim },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    })
    doc.render(data)
    return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer
  } catch (err) {
    console.warn(`docxtemplater (${startDelim}...${endDelim}) execution note:`, err)
    return buffer
  }
}

/**
 * Map de secours pour les templates sans Content Controls : remplace les
 * textes d'exemple visibles (par ex. "Votre nom", "Intitulé du poste").
 */
function buildDirectTextMap(parsedCv: ParsedCv): Record<string, string> {
  const p = parsedCv.personalInfo
  const fullName = p.fullName || ''
  const title = p.title || ''
  const email = p.email || ''
  const phone = p.phone || ''
  const location = p.location || ''
  const website = p.website || ''
  const linkedin = p.linkedin || ''

  return {
    'Votre nom': fullName,
    'Ton nom': fullName,
    'Prénom Nom': fullName,
    'Adresse, Code postal, Ville': location,
    'Adresse': location,
    'Téléphone': phone,
    'E-mail': email,
    'Email': email,
    'LinkedIn': linkedin,
    'Site web': website,
    'Intitulé du poste': parsedCv.workExperience[0]?.title || title,
    'Société': parsedCv.workExperience[0]?.company || '',
    'Diplôme': parsedCv.education[0]?.degree || '',
    'Établissement': parsedCv.education[0]?.institution || '',
  }
}

/**
 * Remplit un squelette Word (.docx) personnalisé avec les données du CV.
 */
export async function fillCustomDocxSkeleton(params: {
  skeletonBuffer: Buffer
  parsedCv: ParsedCv
  score?: number
}): Promise<Buffer> {
  const { skeletonBuffer, parsedCv, score } = params

  try {
    let currentBuffer = skeletonBuffer
    const docData = buildDocData(parsedCv, score)

    // Convertir en string pour vérifier les délimiteurs présents
    const rawContentStr = currentBuffer.toString('utf-8')

    // 1. Remplissage par docxtemplater (balises {{...}})
    if (rawContentStr.includes('{{')) {
      currentBuffer = safeDocxtemplaterRender(currentBuffer, docData, '{{', '}}')
    }

    // 2. Remplissage par docxtemplater (balises {...})
    if (rawContentStr.includes('{') && !rawContentStr.includes('{{')) {
      currentBuffer = safeDocxtemplaterRender(currentBuffer, docData, '{', '}')
    }

    // 3. Remplissage sémantique des Content Controls SDT (tags Word officiels)
    const zip = await JSZip.loadAsync(currentBuffer)
    const docXmlFile = zip.file('word/document.xml')

    if (docXmlFile) {
      let xml = await docXmlFile.async('text')

      const sdtResult = fillSdtContentControls(xml, parsedCv)

      // 4. Fallback texte direct si le template ne contient aucun SDT rempli
      if (sdtResult.count === 0) {
        xml = replaceTextInXmlDom(xml, buildDirectTextMap(parsedCv))
      } else {
        xml = sdtResult.xml
      }

      // 5. Si le template ne contenait aucun placeholder ni texte direct, on injecte avant <w:sectPr>
      const p = parsedCv.personalInfo
      const fullName = p.fullName || ''
      const title = p.title || ''
      const email = p.email || ''
      const phone = p.phone || ''
      const location = p.location || ''
      const hasKnownPlaceholders =
        xml.includes(fullName) ||
        xml.includes(email) ||
        xml.includes(title) ||
        xml.includes(parsedCv.workExperience[0]?.title || '______')

      if (!hasKnownPlaceholders) {
        const expFormattedXml = buildFormattedExperienceXml(parsedCv.workExperience)
        const eduFormattedXml = buildFormattedEducationXml(parsedCv.education)
        const skillsFormattedXml = buildFormattedSkillsXml(parsedCv)
        const languagesFormattedXml = buildFormattedLanguagesXml(parsedCv)
        const projectsFormattedXml = buildFormattedProjectsXml(parsedCv)
        const certificationsFormattedXml = buildFormattedCertificationsXml(parsedCv)
        const interestsFormattedXml = buildFormattedInterestsXml(parsedCv)
        const referencesFormattedXml = buildFormattedReferencesXml(parsedCv)

        const injected = `
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="10B981"/></w:rPr><w:t>${escapeXml(fullName)}</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:i/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r></w:p>
          <w:p><w:r><w:t>${escapeXml(email)} | ${escapeXml(phone)} | ${escapeXml(location)}</w:t></w:r></w:p>
          ${formatXmlParagraphs(p.summary || '')}
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="10B981"/></w:rPr><w:t>Expérience professionnelle</w:t></w:r></w:p>
          ${expFormattedXml}
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="10B981"/></w:rPr><w:t>Formation</w:t></w:r></w:p>
          ${eduFormattedXml}
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="10B981"/></w:rPr><w:t>Compétences</w:t></w:r></w:p>
          ${skillsFormattedXml}
          ${languagesFormattedXml ? `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="10B981"/></w:rPr><w:t>Langues</w:t></w:r></w:p>${languagesFormattedXml}` : ''}
          ${projectsFormattedXml ? `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="10B981"/></w:rPr><w:t>Projets</w:t></w:r></w:p>${projectsFormattedXml}` : ''}
          ${certificationsFormattedXml ? `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="10B981"/></w:rPr><w:t>Certifications</w:t></w:r></w:p>${certificationsFormattedXml}` : ''}
          ${interestsFormattedXml || ''}
          ${referencesFormattedXml || ''}
        `

        // Toujours insérer AVANT <w:sectPr> pour respecter strictement le schéma OpenXML
        const sectPrPos = xml.lastIndexOf('<w:sectPr')
        if (sectPrPos !== -1) {
          xml = xml.slice(0, sectPrPos) + injected + xml.slice(sectPrPos)
        } else {
          const bodyClosePos = xml.lastIndexOf('</w:body>')
          if (bodyClosePos !== -1) {
            xml = xml.slice(0, bodyClosePos) + injected + xml.slice(bodyClosePos)
          }
        }
      }

      zip.file('word/document.xml', xml)
      return await zip.generateAsync({ type: 'nodebuffer' })
    }

    return currentBuffer
  } catch (err) {
    console.error('fillCustomDocxSkeleton error :', err)
    return params.skeletonBuffer
  }
}

/**
 * ---------------------------------------------------------------------------
 * Remplissage sémantique des diapositives PowerPoint.
 *
 * Les templates de CV PowerPoint utilisent des zones de texte d'exemple
 * ("Gurpeet Bawa", "gurpeet@example.com", "20XX – 20XX", "WORD", "ÉDITEUR"...).
 * Ce moteur reconnaît :
 *   - le nom : zone de texte de type "title" (ph type="title"),
 *   - les coordonnées : regex email / URL / téléphone,
 *   - les champs par section ("Coordonnées", "Formation", "Compétences",
 *     "Langues", "Expérience", "Capacités et années"...), remplis
 *     séquentiellement dans l'ordre des formes.
 * ---------------------------------------------------------------------------
 */

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'

/** Sections reconnues dans une diapositive de CV (FR/EN). */
const PPTX_SECTIONS: { name: string; keys: string[] }[] = [
  { name: 'formation', keys: ['formation', 'formations', 'éducation', 'education', 'diplômes', 'diplomes', 'études', 'etudes', 'académique', 'academique'] },
  { name: 'competences', keys: ['compétences', 'competences', 'compétences clés', 'competences cles', 'skills', 'key skills', 'aptitudes'] },
  { name: 'langues', keys: ['langues', 'languages'] },
  { name: 'experience', keys: ['expérience', 'experience', 'expérience professionnelle', 'experience professionnelle', 'parcours professionnel', 'work experience', 'carrière', 'carriere', 'emplois'] },
  { name: 'capacites', keys: ['capacités et années', 'capacites et annees', 'capacités', 'capacites', 'skills and years', 'compétences et niveaux', 'competences et niveaux'] },
  { name: 'projets', keys: ['projets', 'projects', 'réalisations', 'realisations'] },
  { name: 'certifications', keys: ['certifications', 'certificats', 'certificates'] },
  { name: 'objectif', keys: ['objectif', 'résumé', 'resume', 'profil', 'profile', 'à propos', 'a propos', 'summary', 'bio'] },
  { name: 'interets', keys: ['centres d’intérêt', "centres d'interet", 'centres d intérêt', 'intérêts', 'interets', 'interests', 'hobbies', 'loisirs'] },
  { name: 'references', keys: ['références', 'references'] },
  { name: 'coordonnees', keys: ['coordonnées', 'coordonnees', 'contact', 'informations personnelles'] },
]

function detectPptxSection(text: string): string | null {
  const t = normalizeSdtKey(text)
  if (!t) return null
  for (const sec of PPTX_SECTIONS) {
    if (sec.keys.includes(t)) return sec.name
  }
  return null
}

const RE_EMAIL = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/
const RE_URL = /^(https?:\/\/|www\.)[\w.-]+\.[a-z]{2,}/i
const RE_BARE_URL = /^[\w-]+(\.[a-z]{2,})+\/?$/i
const RE_PHONE = /^[0-9+().\s/-]{6,}$/
const RE_FAKE_DATE = /(20XX|20\d\d|(?:\d{1,2}\/\d{1,2}\/)?20\d\d)/

/** Remplace le texte d'une forme PowerPoint en conservant la présentation du 1er run. */
function setShapeText(shape: any, value: string, doc: any): boolean {
  const txBody = shape.getElementsByTagName('p:txBody').item(0) as any
  if (!txBody) return false
  const allParas = txBody.getElementsByTagName('a:p')
  const firstPara = allParas.item(0) as any
  if (!firstPara) return false

  const lines = String(value ?? '').split(/\r?\n/)
  let templateRun: any = null
  const runs = firstPara.getElementsByTagName('a:r')
  if (runs.length > 0) templateRun = runs.item(0)

  const clearPara = (p: any) => {
    const pPr = p.getElementsByTagName('a:pPr').item(0)
    const toRemove: any[] = []
    for (let i = 0; i < p.childNodes.length; i++) {
      const c = p.childNodes.item(i)
      if (c !== pPr) toRemove.push(c)
    }
    for (const c of toRemove) p.removeChild(c)
  }

  const makeRun = (text: string): any => {
    const r: any = templateRun
      ? templateRun.cloneNode(true)
      : doc.createElementNS(A_NS, 'a:r')
    const rPr = r.getElementsByTagName('a:rPr').item(0)
    const toRemove: any[] = []
    for (let i = 0; i < r.childNodes.length; i++) {
      const c = r.childNodes.item(i)
      if (c !== rPr) toRemove.push(c)
    }
    for (const c of toRemove) r.removeChild(c)
    const t = doc.createElementNS(A_NS, 'a:t')
    t.setAttribute('xml:space', 'preserve')
    t.textContent = text
    r.appendChild(t)
    return r
  }

  clearPara(firstPara)
  firstPara.appendChild(makeRun(lines[0] || ''))

  const created: any[] = [firstPara]
  let ref = firstPara
  for (let li = 1; li < lines.length; li++) {
    const np = firstPara.cloneNode(true)
    clearPara(np)
    np.appendChild(makeRun(lines[li]))
    txBody.insertBefore(np, ref.nextSibling)
    ref = np
    created.push(np)
  }

  const remaining: any[] = []
  const allParas2 = txBody.getElementsByTagName('a:p')
  for (let i = 0; i < allParas2.length; i++) remaining.push(allParas2.item(i))
  for (const p of remaining) {
    if (!created.includes(p)) txBody.removeChild(p)
  }
  return true
}

/** Concatène le texte de toutes les balises <a:t> d'une forme. */
function shapeText(shape: any): string {
  let text = ''
  const ts = shape.getElementsByTagName('a:t')
  for (let i = 0; i < ts.length; i++) text += ts.item(i).textContent || ''
  return text
}

/**
 * Remplit une diapositive PowerPoint avec les données du CV.
 * Retourne le XML modifié et le nombre de champs remplis.
 */
function fillPptxSlide(xmlStr: string, parsedCv: ParsedCv): { xml: string; count: number } {
  try {
    const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
    const all = doc.getElementsByTagName('*')
    const shapes: any[] = []
    for (let i = 0; i < all.length; i++) {
      const el = all.item(i)
      if (el && el.tagName === 'p:sp') shapes.push(el)
    }

    const p = parsedCv.personalInfo
    const fullName = p.fullName || ''
    const title = p.title || ''
    const email = p.email || ''
    const phone = p.phone || ''
    const location = p.location || ''
    const website = p.website || ''
    const linkedin = p.linkedin || ''
    const summary = p.summary || ''

    let filled = 0
    const set = (shape: any, value: string): void => {
      if (setShapeText(shape, value, doc)) filled++
    }

    // --- 1. Nom : zone de texte "title" ---
    for (const shape of shapes) {
      const ph = shape.getElementsByTagName('p:ph').item(0) as any
      const type = ph ? ph.getAttribute('type') : ''
      if (type === 'title') {
        set(shape, fullName)
        break
      }
    }

    // --- 2. Coordonnées par regex (dans n'importe quelle forme) ---
    for (const shape of shapes) {
      const t = shapeText(shape).trim()
      if (!t) continue
      if (RE_EMAIL.test(t)) {
        set(shape, email)
        continue
      }
      if (RE_URL.test(t) || RE_BARE_URL.test(t)) {
        set(shape, website || linkedin || '')
        continue
      }
      if (RE_PHONE.test(t) && (t.match(/\d/g) || []).length >= 6) {
        set(shape, phone)
        continue
      }
    }

    // --- Queues de données ---
    const eduDegrees = parsedCv.education.map((e) => e.degree || '')
    const eduInstitutions = parsedCv.education.map((e) => e.institution || '')
    const eduDateRanges = parsedCv.education.map((e) =>
      [e.startDate, e.endDate].filter(Boolean).join(' – ')
    )
    const skillNames = parsedCv.skills.map((s) => s.name || '')
    const skillLevels = parsedCv.skills.map((s) => s.level || '')
    const langNames = parsedCv.languages.map((l) => l.name || '')
    const expTitles = parsedCv.workExperience.map((e) => e.title || '')
    const expCompanies = parsedCv.workExperience.map((e) => e.company || '')
    const expDates = parsedCv.workExperience.map((e) =>
      [e.startDate, e.endDate].filter(Boolean).join(' – ')
    )
    const expDescs = parsedCv.workExperience.map((e) => e.description || '')
    const projects = (parsedCv.projects || []).map((pr) =>
      [pr.name, pr.url, pr.description].filter(Boolean).join(' — ')
    )

    let eduIdx = 0
    let skillIdx = 0
    let langIdx = 0
    let expBlock = 0 // 0=title, 1=company, 2=dates, 3=description (par expérience)
    let expIdx = 0
    let projectIdx = 0

    const nextEduDegree = () => eduIdx < eduDegrees.length ? eduDegrees[eduIdx] : ''
    const nextExp = () => expIdx < parsedCv.workExperience.length ? parsedCv.workExperience[expIdx] : null

    // --- 3. Remplissage par sections ---
    let section: string | null = null
    for (const shape of shapes) {
      const t = shapeText(shape).trim()
      if (!t) continue

      const sec = detectPptxSection(t)
      if (sec) {
        section = sec
        continue
      }

      switch (section) {
        case 'formation': {
          if (RE_FAKE_DATE.test(t)) {
            // Ligne "diplôme + dates" (le template affiche une fausse année 20XX)
            const d = nextEduDegree()
            const dr = eduDateRanges[eduIdx] || ''
            if (d) {
              set(shape, dr ? d + '\n' + dr : d)
              eduIdx++
            } else {
              set(shape, '')
            }
          } else {
            // Ligne école / institution
            if (eduIdx < eduInstitutions.length) {
              set(shape, eduInstitutions[eduIdx])
            } else {
              set(shape, '')
            }
          }
          break
        }
        case 'competences': {
          if (skillIdx < skillNames.length) {
            const lvl = skillLevels[skillIdx] || ''
            set(shape, lvl ? skillNames[skillIdx] + ' (' + lvl + ')' : skillNames[skillIdx])
            skillIdx++
          } else {
            set(shape, '')
          }
          break
        }
        case 'langues': {
          if (langIdx < langNames.length) {
            const lvl = parsedCv.languages[langIdx]?.level || ''
            set(shape, lvl ? langNames[langIdx] + ' (' + lvl + ')' : langNames[langIdx])
            langIdx++
          } else {
            set(shape, '')
          }
          break
        }
        case 'experience': {
          const exp = nextExp()
          let value = ''
          if (exp) {
            if (expBlock === 0) value = exp.title || ''
            else if (expBlock === 1) value = exp.company || ''
            else if (expBlock === 2) value = [exp.startDate, exp.endDate].filter(Boolean).join(' – ')
            else value = exp.description || ''
          }
          set(shape, value)
          expBlock++
          if (expBlock >= 4) {
            expBlock = 0
            expIdx++
          }
          break
        }
        case 'capacites': {
          const parts = parsedCv.skills.map((s) => {
            const lvl = s.level ? ' | ' + s.level : ''
            return (s.name || '') + lvl
          })
          if (parts.length > 0) {
            set(shape, parts.join('\n'))
          }
          break
        }
        case 'projets': {
          if (projectIdx < projects.length) {
            set(shape, projects[projectIdx] || '')
            projectIdx++
          } else {
            set(shape, '')
          }
          break
        }
        case 'objectif': {
          set(shape, summary)
          section = null // une seule zone d'objectif
          break
        }
        case 'coordonnees':
        case 'references':
        case 'interets':
        case 'certifications':
        default:
          break
      }
    }

    return { xml: new XMLSerializer().serializeToString(doc), count: filled }
  } catch (err) {
    console.warn('fillPptxSlide warning:', err)
    return { xml: xmlStr, count: 0 }
  }
}

/**
 * Remplit un squelette PowerPoint (.pptx) personnalisé avec les données d'un CV.
 */
export async function fillCustomPptxSkeleton(params: {
  skeletonBuffer: Buffer
  parsedCv: ParsedCv
  score?: number
}): Promise<Buffer> {
  const { skeletonBuffer, parsedCv, score } = params

  try {
    let currentBuffer = skeletonBuffer
    const docData = buildDocData(parsedCv, score)

    const rawContentStr = currentBuffer.toString('utf-8')

    if (rawContentStr.includes('{{')) {
      currentBuffer = safeDocxtemplaterRender(currentBuffer, docData, '{{', '}}')
    } else if (rawContentStr.includes('{')) {
      currentBuffer = safeDocxtemplaterRender(currentBuffer, docData, '{', '}')
    }

    const zip = await JSZip.loadAsync(currentBuffer)
    const slideFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith('ppt/slides/slide') && f.endsWith('.xml')
    )

    const p = parsedCv.personalInfo
    const directTextMap: Record<string, string> = {
      'Votre nom': p.fullName || '',
      'Ton nom': p.fullName || '',
      'Prénom Nom': p.fullName || '',
      'Téléphone': p.phone || '',
      'E-mail': p.email || '',
      'Email': p.email || '',
    }

    let totalFilled = 0
    for (const slidePath of slideFiles) {
      const xml = await zip.file(slidePath)!.async('text')

      // Remplissage sémantique (sections + regex) sur la 1ère diapo de contenu
      const result = fillPptxSlide(xml, parsedCv)

      if (result.count > 0) {
        zip.file(slidePath, result.xml)
        totalFilled += result.count
      } else {
        // Fallback : remplacement de texte direct (templates avec textes FR simples)
        zip.file(slidePath, replaceTextInXmlDom(xml, directTextMap))
      }
    }

    return await zip.generateAsync({ type: 'nodebuffer' })
  } catch (err) {
    console.error('fillCustomPptxSkeleton error :', err)
    return skeletonBuffer
  }
}