/**
 * Types TypeScript pour les données de CV.
 *
 * Ce fichier définit la structure normalisée d'un CV telle qu'extraite
 * par les modèles NVIDIA, puis utilisée par les convertisseurs Word/PowerPoint
 * et par le moteur de scoring.
 */

/// Section d'expérience professionnelle
export interface WorkExperience {
  /// Intitulé du poste
  title: string;
  /// Nom de l'entreprise
  company: string;
  /// Date de début (texte libre tel qu'extrait)
  startDate: string;
  /// Date de fin (texte libre, ou "présent")
  endDate: string;
  /// Description des missions et réalisations
  description: string;
  /// Localisation (ville, pays) — optionnel
  location?: string;
}

/// Section de formation
export interface Education {
  /// Diplôme ou certification
  degree: string;
  /// Établissement
  institution: string;
  /// Date de début
  startDate: string;
  /// Date de fin
  endDate: string;
  /// Mention ou spécialisation — optionnel
  field?: string;
  /// Description — optionnel
  description?: string;
}

/// Compétence individuelle
export interface Skill {
  /// Nom de la compétence
  name: string;
  /// Niveau estimé (débutant, intermédiaire, avancé, expert)
  level?: string;
  /// Catégorie (technique, linguistique, logiciel, soft skill, ...)
  category?: string;
}

/// Langue parlée
export interface Language {
  name: string;
  /// Niveau (A1, A2, B1, B2, C1, C2, ou natif, courant, professionnel, ...)
  level?: string;
}

/// Structure complète d'un CV normalisé
export interface ParsedCv {
  /// Informations personnelles
  personalInfo: {
    fullName: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    title?: string;
    summary?: string;
  };
  /// Liste des expériences professionnelles
  workExperience: WorkExperience[];
  /// Liste des formations
  education: Education[];
  /// Liste des compétences
  skills: Skill[];
  /// Liste des langues
  languages: Language[];
  /// Projets éventuels
  projects?: Array<{
    name: string;
    description?: string;
    url?: string;
  }>;
  /// Certifications éventuelles
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
  /// Centres d'intérêt — optionnel
  interests?: string[];
  /// Références — optionnel
  references?: Array<{
    name: string;
    contact?: string;
    relationship?: string;
  }>;
  /// Langue détectée du CV (code ISO 639-1 : fr, en, es, ...)
  detectedLanguage?: string;
}

/// Détail du score par catégorie
export interface ScoreCategory {
  /// Nom de la catégorie (clarté, complétude, expérience, ...)
  name: string;
  /// Note sur 100 pour cette catégorie
  score: number;
  /// Commentaire justificatif
  comment: string;
}

/// Résultat complet du scoring d'un CV
export interface CvScore {
  /// Score global sur 100
  overallScore: number;
  /// Détail par catégorie
  categories: ScoreCategory[];
  /// Points forts du CV
  strengths: string[];
  /// Axes d'amélioration
  improvements: string[];
  /// Recommandation générale
  recommendation: string;
  /// Niveau estimé (débutant, intermédiaire, confirmé, senior)
  seniorityLevel: string;
}

/// Format de sortie demandé par l'utilisateur
export type OutputFormat = 'word' | 'powerpoint';

/// Type de fichier source accepté
export type SourceType = 'pdf' | 'image';

/// Statut du traitement d'un CV
export type ProcessingStatus =
  | 'pending'
  | 'extracting'
  | 'converting'
  | 'scoring'
  | 'done'
  | 'error';

/// Configuration d'un modèle NVIDIA
export interface NvidiaModelConfig {
  /// Identifiant complet du modèle (ex: "nvidia/nemotron-3-super-120b-a12b")
  id: string;
  /// Nom affichable
  name: string;
  /// Type de modèle (text | omni/multimodal)
  type: 'text' | 'omni';
  /// Description courte
  description: string;
  /// Température recommandée
  temperature: number;
  /// Nombre maximum de tokens en sortie
  maxTokens: number;
}

/// Étape de traitement affichée à l'utilisateur
export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

/// Réponse complète du traitement d'un CV
export interface CvProcessingResult {
  id: string;
  status: ProcessingStatus;
  parsedCv?: ParsedCv;
  score?: CvScore;
  outputFormat: OutputFormat;
  downloadUrl?: string;
  outputFileName?: string;
  extractedText?: string;
  durationMs?: number;
  errorMessage?: string;
  extractionModel: string;
  scoringModel: string;
}
