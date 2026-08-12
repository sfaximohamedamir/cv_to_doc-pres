/**
 * Convertisseur Word basé sur template (.docx) avec docxtemplater.
 *
 * Ce module prend un template Word uploadé et y injecte les données structurées
 * du CV en remplaçant les placeholders standard.
 *
 * Placeholders supportés :
 *   - Variables simples : {fullName}, {title}, {email}, {phone}, {location},
 *     {website}, {linkedin}, {github}, {summary}
 *   - Boucles : {#experiences} ... {title} {company} ... {/experiences}
 *              {#education} ... {degree} ... {/education}
 *              {#skills} ... {name} {level} ... {/skills}
 *              {#languages} ... {name} {level} ... {/languages}
 *              {#projects} ... {name} {url} {description} ... {/projects}
 *              {#certifications} ... {name} {issuer} {date} ... {/certifications}
 *              {#interests} {.} ... {/interests}
 *
 * Si un tag n'est pas trouvé dans les données, il est remplacé par une chaîne vide.
 */

import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import type { ParsedCv } from '@/lib/cv/types'

/**
 * Prépare les données du CV au format attendu par docxtemplater.
 */
function buildTemplateData(parsedCv: ParsedCv): Record<string, unknown> {
  const p = parsedCv.personalInfo

  return {
    fullName: p.fullName || '',
    title: p.title || '',
    email: p.email || '',
    phone: p.phone || '',
    location: p.location || '',
    website: p.website || '',
    linkedin: p.linkedin || '',
    github: p.github || '',
    summary: p.summary || '',

    experiences: parsedCv.workExperience.map((exp) => ({
      title: exp.title || '',
      company: exp.company || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      location: exp.location || '',
      description: exp.description || '',
      dateRange: [exp.startDate, exp.endDate].filter(Boolean).join(' – '),
    })),

    education: parsedCv.education.map((edu) => ({
      degree: edu.degree || '',
      institution: edu.institution || '',
      startDate: edu.startDate || '',
      endDate: edu.endDate || '',
      field: edu.field || '',
      description: edu.description || '',
      dateRange: [edu.startDate, edu.endDate].filter(Boolean).join(' – '),
    })),

    skills: parsedCv.skills.map((skill) => ({
      name: skill.name || '',
      level: skill.level || '',
      category: skill.category || '',
    })),

    languages: parsedCv.languages.map((lang) => ({
      name: lang.name || '',
      level: lang.level || '',
    })),

    projects: (parsedCv.projects ?? []).map((proj) => ({
      name: proj.name || '',
      url: proj.url || '',
      description: proj.description || '',
    })),

    certifications: (parsedCv.certifications ?? []).map((cert) => ({
      name: cert.name || '',
      issuer: cert.issuer || '',
      date: cert.date || '',
    })),

    interests: (parsedCv.interests ?? []).map((interest) => ({
      '.': interest,
    })),
  }
}

/**
 * Génère un document Word à partir d'un template et des données structurées du CV.
 *
 * @param params.templateBuffer - Buffer du fichier .docx template.
 * @param params.parsedCv - Données structurées du CV.
 * @returns Buffer du document Word généré.
 */
export async function generateWordFromTemplate(params: {
  templateBuffer: Buffer
  parsedCv: ParsedCv
}): Promise<Buffer> {
  const { templateBuffer, parsedCv } = params

  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })

  const data = buildTemplateData(parsedCv)
  doc.render(data)

  const output = doc.getZip().generate({ type: 'nodebuffer' })
  return output as Buffer
}
