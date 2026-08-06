'use client'

/**
 * Aperçu du CV structuré extrait par le modèle NVIDIA.
 * Affiche toutes les sections du CV de manière élégante.
 */

import { motion } from 'framer-motion'
import {
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Languages as LanguagesIcon,
  FolderGit2,
  Award,
  Heart,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Github,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ParsedCv } from '@/lib/cv/types'

export interface CvPreviewProps {
  cv: ParsedCv
}

function ContactItem({ icon: Icon, value }: { icon: typeof Mail; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" />
      {value}
    </span>
  )
}

function SectionCard({
  icon: Icon,
  title,
  children,
  delay = 0,
  color = 'text-emerald-600 dark:text-emerald-400',
}: {
  icon: typeof User
  title: string
  children: React.ReactNode
  delay?: number
  color?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Icon className={`h-4 w-4 ${color}`} />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  )
}

export function CvPreview({ cv }: CvPreviewProps) {
  const p = cv.personalInfo

  return (
    <div className="space-y-4">
      {/* En-tête : informations personnelles */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 dark:from-emerald-950/30 dark:to-teal-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white shadow-lg">
                {p.fullName?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-foreground">
                  {p.fullName || 'Nom inconnu'}
                </h3>
                {p.title && (
                  <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {p.title}
                  </p>
                )}
                {p.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p.summary}
                  </p>
                )}
              </div>
            </div>
            {/* Coordonnées */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {p.email && <ContactItem icon={Mail} value={p.email} />}
              {p.phone && <ContactItem icon={Phone} value={p.phone} />}
              {p.location && <ContactItem icon={MapPin} value={p.location} />}
              {p.website && <ContactItem icon={Globe} value={p.website} />}
              {p.linkedin && <ContactItem icon={Linkedin} value={p.linkedin} />}
              {p.github && <ContactItem icon={Github} value={p.github} />}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Expérience professionnelle */}
      {cv.workExperience.length > 0 && (
        <SectionCard icon={Briefcase} title="Expérience professionnelle" delay={0.1}>
          <div className="space-y-4">
            {cv.workExperience.map((exp, i) => (
              <div key={i} className="relative pl-4">
                {/* Puce de timeline */}
                <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                {i < cv.workExperience.length - 1 && (
                  <div className="absolute left-[3px] top-4 h-[calc(100%-8px)] w-0.5 bg-border" />
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {exp.title}
                    {exp.company && (
                      <span className="font-normal text-muted-foreground">
                        {' — '}
                        {exp.company}
                      </span>
                    )}
                  </p>
                  {(exp.startDate || exp.endDate) && (
                    <span className="text-xs text-muted-foreground">
                      {[exp.startDate, exp.endDate].filter(Boolean).join(' — ')}
                      {exp.location && ` · ${exp.location}`}
                    </span>
                  )}
                </div>
                {exp.description && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Formation */}
      {cv.education.length > 0 && (
        <SectionCard
          icon={GraduationCap}
          title="Formation"
          delay={0.15}
          color="text-blue-600 dark:text-blue-400"
        >
          <div className="space-y-3">
            {cv.education.map((edu, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {edu.degree}
                    {edu.institution && (
                      <span className="font-normal text-muted-foreground">
                        {' — '}
                        {edu.institution}
                      </span>
                    )}
                  </p>
                  {(edu.startDate || edu.endDate) && (
                    <span className="text-xs text-muted-foreground">
                      {[edu.startDate, edu.endDate].filter(Boolean).join(' — ')}
                    </span>
                  )}
                </div>
                {edu.field && (
                  <p className="text-sm text-muted-foreground">{edu.field}</p>
                )}
                {edu.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{edu.description}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Compétences */}
      {cv.skills.length > 0 && (
        <SectionCard
          icon={Wrench}
          title="Compétences"
          delay={0.2}
          color="text-purple-600 dark:text-purple-400"
        >
          <div className="flex flex-wrap gap-2">
            {cv.skills.map((s, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="gap-1 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
              >
                {s.name}
                {s.level && (
                  <span className="text-[10px] opacity-70">· {s.level}</span>
                )}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Langues */}
      {cv.languages.length > 0 && (
        <SectionCard
          icon={LanguagesIcon}
          title="Langues"
          delay={0.25}
          color="text-cyan-600 dark:text-cyan-400"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cv.languages.map((l, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">{l.name}</span>
                {l.level && (
                  <span className="text-xs text-muted-foreground">{l.level}</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Projets */}
      {cv.projects && cv.projects.length > 0 && (
        <SectionCard
          icon={FolderGit2}
          title="Projets"
          delay={0.3}
          color="text-orange-600 dark:text-orange-400"
        >
          <div className="space-y-2">
            {cv.projects.map((proj, i) => (
              <div key={i}>
                <div className="flex items-baseline gap-2">
                  <p className="font-medium text-foreground">{proj.name}</p>
                  {proj.url && (
                    <a
                      href={proj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {proj.url}
                    </a>
                  )}
                </div>
                {proj.description && (
                  <p className="text-sm text-muted-foreground">{proj.description}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Certifications */}
      {cv.certifications && cv.certifications.length > 0 && (
        <SectionCard
          icon={Award}
          title="Certifications"
          delay={0.35}
          color="text-amber-600 dark:text-amber-400"
        >
          <ul className="space-y-1.5">
            {cv.certifications.map((cert, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <Award className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                <span className="font-medium text-foreground">{cert.name}</span>
                {cert.issuer && (
                  <span className="text-muted-foreground">— {cert.issuer}</span>
                )}
                {cert.date && (
                  <span className="text-xs text-muted-foreground">({cert.date})</span>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Centres d'intérêt */}
      {cv.interests && cv.interests.length > 0 && (
        <SectionCard
          icon={Heart}
          title="Centres d'intérêt"
          delay={0.4}
          color="text-pink-600 dark:text-pink-400"
        >
          <div className="flex flex-wrap gap-2">
            {cv.interests.map((interest, i) => (
              <Badge
                key={i}
                variant="outline"
                className="border-pink-300 text-pink-700 dark:border-pink-800 dark:text-pink-400"
              >
                {interest}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
