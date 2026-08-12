/**
 * Orchestration de l'extraction structurée d'un CV depuis un fichier binaire.
 *
 * Ce module est le point d'entrée principal de la phase d'extraction :
 *  - si le fichier est un PDF avec texte sélectionnable, on extrait le texte
 *    puis on l'envoie au modèle texte NVIDIA (Nemotron-3-Super) ;
 *  - si le fichier est une image (PNG, JPEG, WebP, GIF), on l'envoie
 *    directement au modèle omni NVIDIA (Nemotron-3-Nano-Omni) ;
 *  - si le PDF ne contient pas de texte extractible (PDF scanné), on lève
 *    une erreur explicite invitant l'utilisateur à fournir une image.
 *
 * Le résultat est un `ParsedCv` conforme à l'interface définie dans
 * `@/lib/cv/types`, prêt à être consommé par les convertisseurs Word /
 * PowerPoint et par le moteur de scoring.
 */

import type { ParsedCv } from '@/lib/cv/types';

import {
  callNvidiaOmniModel,
  callNvidiaTextModel,
  extractJsonFromResponse,
  isNvidiaConfiguredAsync,
} from '@/lib/nvidia/client';
import { OMNI_MODEL_ID, SUPER_MODEL_ID } from '@/lib/nvidia/models';
import { buildExtractionPrompt } from '@/lib/nvidia/prompts';
import { resolveNvidiaTextModel } from '@/lib/settings';

import { parsePdf, MIN_SUBSTANTIAL_TEXT_LENGTH } from '@/lib/parsers/pdf-parser';
import {
  bufferToBase64,
  detectImageMimeType,
  isSupportedImage,
  extractEmbeddedImageFromPdf,
  convertScannedPdfToPng,
} from '@/lib/parsers/image-parser';

/**
 * Méthode d'extraction utilisée pour traiter le CV.
 *  - `pdf-text`       : PDF avec texte sélectionnable -> modèle texte.
 *  - `image-omni`     : Image (PNG/JPEG/WebP/GIF) -> modèle omni.
 *  - `pdf-image-omni` : PDF sans texte extractible, traité via rendu image
 *                       (non implémenté ici, réservé pour extension future).
 */
export type ExtractionMethod = 'pdf-text' | 'image-omni' | 'pdf-image-omni';

/**
 * Résultat de l'extraction d'un CV.
 */
export interface ExtractionResult {
  /** CV normalisé, conforme à `ParsedCv`. */
  parsedCv: ParsedCv;
  /** Texte brut ayant servi de source (texte PDF extrait, ou description synthétique pour image). */
  rawText: string;
  /** Méthode d'extraction utilisée. */
  method: ExtractionMethod;
  /** Identifiant du modèle NVIDIA ayant réellement traité la requête. */
  modelUsed: string;
}

/**
 * Paramètres de la fonction `extractCvFromBuffer`.
 */
export interface ExtractCvFromBufferParams {
  /** Buffer binaire du fichier source (PDF ou image). */
  buffer: Buffer;
  /** Nom original du fichier (pour les messages d'erreur). */
  fileName: string;
  /** Type MIME déclaré du fichier (`application/pdf`, `image/png`, ...). */
  mimeType: string;
  /** Langue souhaitée pour les résumés rédigés par le modèle (ex: `français`). */
  language?: string;
  /** Modèle ou mode spécifiquement demandé par l'utilisateur (auto | omni | glm | nemotron). */
  requestedModel?: string;
}

/**
 * Normalise et assainit l'objet retourné par l'IA pour garantir
 * la conformité stricte avec l'interface ParsedCv.
 *
 * Gère automatiquement :
 *  - les objets enveloppes (ex: { "cv": { ... } } ou { "parsedCv": { ... } })
 *  - la conversion des alias de clés (ex: personal_info -> personalInfo, etc.)
 *  - la présence obligatoire des clés principales avec des valeurs par défaut sûres.
 */
function normalizeParsedCv(obj: unknown): ParsedCv {
  if (!obj || typeof obj !== 'object') {
    obj = {};
  }

  let rec = obj as Record<string, any>;

  // 1. Développer si le modèle a entouré le JSON d'une clé enveloppe
  const wrapperKeys = ['cv', 'data', 'parsedCv', 'parsed_cv', 'result', 'resume', 'output'];
  for (const wk of wrapperKeys) {
    if (rec[wk] && typeof rec[wk] === 'object' && !Array.isArray(rec[wk])) {
      rec = rec[wk];
      break;
    }
  }

  // 2. Normaliser personalInfo
  const rawPersonalInfo =
    rec.personalInfo ||
    rec.personal_info ||
    rec.personal ||
    rec.profil ||
    rec.profile ||
    {};

  const fullName =
    rawPersonalInfo.fullName ||
    rawPersonalInfo.full_name ||
    rawPersonalInfo.name ||
    rawPersonalInfo.nom ||
    rec.fullName ||
    rec.full_name ||
    rec.nom ||
    '';

  const personalInfo = {
    fullName: String(fullName) || '',
    email: rawPersonalInfo.email ? String(rawPersonalInfo.email) : undefined,
    phone: rawPersonalInfo.phone ? String(rawPersonalInfo.phone) : undefined,
    location: rawPersonalInfo.location || rawPersonalInfo.address ? String(rawPersonalInfo.location || rawPersonalInfo.address) : undefined,
    website: rawPersonalInfo.website || rawPersonalInfo.url ? String(rawPersonalInfo.website || rawPersonalInfo.url) : undefined,
    linkedin: rawPersonalInfo.linkedin ? String(rawPersonalInfo.linkedin) : undefined,
    github: rawPersonalInfo.github ? String(rawPersonalInfo.github) : undefined,
    title: rawPersonalInfo.title || rawPersonalInfo.poste ? String(rawPersonalInfo.title || rawPersonalInfo.poste) : undefined,
    summary: rawPersonalInfo.summary || rawPersonalInfo.bio || rawPersonalInfo.description ? String(rawPersonalInfo.summary || rawPersonalInfo.bio || rawPersonalInfo.description) : undefined,
  };

  // 3. Normaliser workExperience
  const rawExp =
    rec.workExperience ||
    rec.work_experience ||
    rec.experiences ||
    rec.experience ||
    rec.parcours ||
    [];
  const workExperience = Array.isArray(rawExp)
    ? rawExp.map((item: any) => ({
        title: String(item.title || item.poste || item.jobTitle || ''),
        company: String(item.company || item.entreprise || item.employer || ''),
        startDate: String(item.startDate || item.start_date || item.debut || item.from || ''),
        endDate: String(item.endDate || item.end_date || item.fin || item.to || 'présent'),
        description: String(item.description || item.missions || item.details || ''),
        location: item.location || item.lieu ? String(item.location || item.lieu) : undefined,
      }))
    : [];

  // 4. Normaliser education
  const rawEdu =
    rec.education ||
    rec.formations ||
    rec.formation ||
    rec.studies ||
    rec.academic ||
    [];
  const education = Array.isArray(rawEdu)
    ? rawEdu.map((item: any) => ({
        degree: String(item.degree || item.diploma || item.diplome || item.title || ''),
        institution: String(item.institution || item.school || item.ecole || item.university || ''),
        startDate: String(item.startDate || item.start_date || item.debut || item.from || ''),
        endDate: String(item.endDate || item.end_date || item.fin || item.to || ''),
        field: item.field || item.domain || item.specialite ? String(item.field || item.domain || item.specialite) : undefined,
        description: item.description ? String(item.description) : undefined,
      }))
    : [];

  // 5. Normaliser skills
  const rawSkills =
    rec.skills ||
    rec.competences ||
    rec.competence ||
    rec.skillList ||
    [];
  const skills = Array.isArray(rawSkills)
    ? rawSkills.map((item: any) => {
        if (typeof item === 'string') {
          return { name: item };
        }
        return {
          name: String(item.name || item.skill || item.label || ''),
          level: item.level || item.niveau ? String(item.level || item.niveau) : undefined,
          category: item.category || item.categorie ? String(item.category || item.categorie) : undefined,
        };
      })
    : [];

  // 6. Normaliser languages
  const rawLang =
    rec.languages ||
    rec.langues ||
    rec.langue ||
    [];
  const languages = Array.isArray(rawLang)
    ? rawLang.map((item: any) => {
        if (typeof item === 'string') {
          return { name: item };
        }
        return {
          name: String(item.name || item.langue || item.language || ''),
          level: item.level || item.niveau ? String(item.level || item.niveau) : undefined,
        };
      })
    : [];

  // 7. Normaliser optionnels
  const rawProjects = rec.projects || rec.projets || [];
  const projects = Array.isArray(rawProjects)
    ? rawProjects.map((item: any) => ({
        name: String(item.name || item.nom || ''),
        description: item.description ? String(item.description) : undefined,
        url: item.url ? String(item.url) : undefined,
      }))
    : undefined;

  const rawCerts = rec.certifications || rec.certifs || [];
  const certifications = Array.isArray(rawCerts)
    ? rawCerts.map((item: any) => ({
        name: String(item.name || item.title || ''),
        issuer: item.issuer || item.organism ? String(item.issuer || item.organism) : undefined,
        date: item.date ? String(item.date) : undefined,
      }))
    : undefined;

  const rawInterests = rec.interests || rec.centres_d_interet || rec.loisirs || [];
  const interests = Array.isArray(rawInterests)
    ? rawInterests.map((item: any) => String(typeof item === 'string' ? item : item.name || item.label))
    : undefined;

  return {
    personalInfo,
    workExperience,
    education,
    skills,
    languages,
    projects: projects && projects.length > 0 ? projects : undefined,
    certifications: certifications && certifications.length > 0 ? certifications : undefined,
    interests: interests && interests.length > 0 ? interests : undefined,
    detectedLanguage: rec.detectedLanguage || rec.language || 'fr',
  };
}

/**
 * Enrichit le ParsedCv de manière 100% dynamique à partir du texte brut extrait,
 * SANS AUCUNE VALEUR EN DUR, pour s'adapter à n'importe quel candidat.
 */
function enrichParsedCvFromRawText(parsed: ParsedCv, rawText: string): ParsedCv {
  if (!rawText || rawText.length < 20) return parsed;

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Extraction dynamique du nom si manquant ou générique
  if (!parsed.personalInfo.fullName || parsed.personalInfo.fullName.trim() === '') {
    const firstLine = lines.find(
      (l) =>
        l.length < 60 &&
        !l.includes('@') &&
        !l.includes('http') &&
        !l.toLowerCase().includes('curriculum') &&
        !l.toLowerCase().includes('page')
    );
    if (firstLine) {
      parsed.personalInfo.fullName = firstLine;
    }
  }

  // 2. Extraction dynamique Email & Téléphone & LinkedIn
  if (!parsed.personalInfo.email) {
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) parsed.personalInfo.email = emailMatch[0];
  }
  if (!parsed.personalInfo.phone) {
    const phoneMatch = rawText.match(/(?:\+?\d{1,3}[ -]?)?\(?\d{2,4}\)?[ -]?\d{2,4}[ -]?\d{2,4}/);
    if (phoneMatch) parsed.personalInfo.phone = phoneMatch[0];
  }
  if (!parsed.personalInfo.linkedin) {
    const linkedinMatch = rawText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    if (linkedinMatch) parsed.personalInfo.linkedin = linkedinMatch[0];
  }

  // 3. Extraction dynamique des compétences si absentes de l'extrait IA
  if (parsed.skills.length === 0) {
    const commonSkills = [
      'Python', 'Java', 'C++', 'C#', 'C', 'SQL', 'JavaScript', 'TypeScript', 'PHP', 'HTML', 'CSS',
      'Power BI', 'Tableau', 'SSIS', 'SSRS', 'SSMS', 'Talend', 'Qlik', 'ETL', 'Data Analysis',
      'PyTorch', 'TensorFlow', 'scikit-learn', 'Hugging Face', 'spaCy', 'LangChain', 'RAG',
      'FastAPI', 'Django', 'Node.js', 'React', 'Angular', 'Vue', 'Docker', 'Git', 'Linux', 'Windows'
    ];
    const foundSkills = commonSkills.filter((s) =>
      new RegExp(`\\b${s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(rawText)
    );
    if (foundSkills.length > 0) {
      parsed.skills = foundSkills.map((name) => ({ name, category: 'technique' }));
    }
  }

  // 4. Nettoyage dynamique du résumé
  if (parsed.personalInfo.summary) {
    parsed.personalInfo.summary = parsed.personalInfo.summary
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\|[\{\ï\#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return parsed;
}

/**
 * Extrait un CV structuré (`ParsedCv`) depuis un buffer binaire.
 *
 * Flux décisionnel :
 *  1. **PDF** : on tente `parsePdf`. Si le texte extrait est suffisamment
 *     long (> 200 caractères), on l'envoie au modèle texte. Si le texte est
 *     vide, on lève une erreur claire invitant à fournir une image. Si le
 *     texte est court mais non vide, on l'envoie quand même au modèle texte
 *     (au cas où le CV soit très succinct).
 *  2. **Image** : on détecte/confirme le type MIME, on encode en base64, et
 *     on appelle le modèle omni multimodal.
 *
 * @param params - Voir `ExtractCvFromBufferParams`.
 * @returns Un `ExtractionResult` contenant le CV, le texte brut, la méthode
 *          et le modèle utilisés.
 * @throws {Error} Si NVIDIA n'est pas configuré, si le fichier n'est pas
 *                 supporté, ou si le modèle ne retourne pas un JSON valide.
 */
export async function extractCvFromBuffer(
  params: ExtractCvFromBufferParams
): Promise<ExtractionResult> {
  const { buffer, fileName, mimeType, language, requestedModel } = params;

  // 0. Vérification préalable : la clé API NVIDIA doit être configurée.
  if (!(await isNvidiaConfiguredAsync())) {
    throw new Error(
      "Aucune clé API NVIDIA configurée. " +
        "Ajoutez-la dans les paramètres de l'application (bouton ⚙️) " +
        "ou définissez la variable d'environnement NVIDIA_API_KEY."
    );
  }

  // Construction des prompts (système + utilisateur) — communs aux deux méthodes.
  const { system, user } = buildExtractionPrompt(language);

  const forceOmni = requestedModel === 'omni';
  const forceGlm = requestedModel === 'glm';
  const forceNemotron = requestedModel === 'nemotron';

  // 1. Cas PDF.
  if (mimeType === 'application/pdf') {
    let pdfText = '';
    try {
      const pdfResult = await parsePdf(buffer);
      pdfText = pdfResult.text ?? '';
    } catch {
      /* ignore */
    }

    const hasSubstantialText = pdfText.trim().length >= MIN_SUBSTANTIAL_TEXT_LENGTH || pdfText.trim().length > 20;

    // A. Si le PDF contient du texte sélectionnable et que Vision Omni n'est pas explicitement forcé
    if (hasSubstantialText && !forceOmni) {
      const method: ExtractionMethod = 'pdf-text';
      const fullUserPrompt = `${user}\n\n----- DÉBUT DU TEXTE EXTRAIT DU PDF -----\n${pdfText}\n----- FIN DU TEXTE EXTRAIT DU PDF -----`;

      let selectedModel = await resolveNvidiaTextModel();
      if (forceGlm) selectedModel = 'z-ai/glm-5.2';
      if (forceNemotron) selectedModel = SUPER_MODEL_ID;

      let response: string;
      try {
        response = await callNvidiaTextModel({
          systemPrompt: system,
          userPrompt: fullUserPrompt,
          modelId: selectedModel,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Échec de l'analyse du PDF « ${fileName} » par le modèle texte (${selectedModel}) : ${message}`
        );
      }

      const rawJson = await extractJsonFromResponse(response);
      const parsed = enrichParsedCvFromRawText(normalizeParsedCv(rawJson), pdfText);

      return {
        parsedCv: parsed,
        rawText: pdfText,
        method,
        modelUsed: selectedModel,
      };
    }

    // B. Si Vision Omni est demandé ou si le PDF n'a pas de texte : tenter l'extraction de l'image de la page
    const extractedImage = await convertScannedPdfToPng(buffer);

    if (extractedImage) {
      const method: ExtractionMethod = 'image-omni';
      const imageBase64 = bufferToBase64(extractedImage.buffer);
      const imageMimeType = extractedImage.mime;

      let response: string;
      try {
        response = await callNvidiaOmniModel({
          systemPrompt: system,
          textPrompt: user,
          imageBase64,
          imageMimeType,
          modelId: OMNI_MODEL_ID,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Échec du modèle visuel NVIDIA Omni (${OMNI_MODEL_ID}) : ${message}. ` +
          `Veuillez choisir un autre modèle d'analyse IA dans le menu déroulant (ex: Z.ai GLM 5.2 ou NVIDIA Nemotron 3 Super).`
        );
      }

      const rawJson = await extractJsonFromResponse(response);
      const rawTextFallback = `[PDF scanné — image ${imageMimeType} traitée par vision omni (${OMNI_MODEL_ID})]`;
      const parsed = enrichParsedCvFromRawText(normalizeParsedCv(rawJson), rawTextFallback);

      return {
        parsedCv: parsed,
        rawText: rawTextFallback,
        method,
        modelUsed: OMNI_MODEL_ID,
      };
    }

    // C. Si aucune image n'a été extraite mais que pdfText contient du texte
    if (pdfText && pdfText.trim().length > 0) {
      let selectedModel = forceGlm ? 'z-ai/glm-5.2' : (await resolveNvidiaTextModel());
      const fullUserPrompt = `${user}\n\n----- DÉBUT DU TEXTE EXTRAIT DU PDF -----\n${pdfText}\n----- FIN DU TEXTE EXTRAIT DU PDF -----`;

      const response = await callNvidiaTextModel({
        systemPrompt: system,
        userPrompt: fullUserPrompt,
        modelId: selectedModel,
      });

      const rawJson = await extractJsonFromResponse(response);
      const parsed = enrichParsedCvFromRawText(normalizeParsedCv(rawJson), pdfText);

      return {
        parsedCv: parsed,
        rawText: pdfText,
        method: 'pdf-text',
        modelUsed: selectedModel,
      };
    }

    throw new Error(
      `Impossible d'analyser le PDF « ${fileName} » : aucun texte sélectionnable et aucune image scannée n'ont pu être extraits.`
    );
  }

  // 2. Cas image.
  // On tente d'abord de détecter le vrai type MIME via le magic number, car
  // le `mimeType` declared par le client peut être erroné ou générique
  // (ex: `application/octet-stream`).
  const detectedMime = detectImageMimeType(buffer);
  const effectiveMime = detectedMime ?? mimeType;

  if (!isSupportedImage(effectiveMime)) {
    throw new Error(
      `Type de fichier non supporté pour l'extraction : "${mimeType}"` +
        (detectedMime ? ` (type détecté : "${detectedMime}")` : '') +
        '. Formats acceptés : PDF, PNG, JPEG, WebP, GIF.'
    );
  }

  // Le modèle omni attend un type MIME canonical ; on normalise `image/jpg`
  // en `image/jpeg` pour éviter tout rejet côté API.
  const normalizedMime =
    effectiveMime === 'image/jpg' ? 'image/jpeg' : effectiveMime;

  const imageBase64 = bufferToBase64(buffer);

  const method: ExtractionMethod = 'image-omni';

  let response: string;
  try {
    response = await callNvidiaOmniModel({
      systemPrompt: system,
      textPrompt: user,
      imageBase64,
      imageMimeType: normalizedMime,
      modelId: OMNI_MODEL_ID,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Échec de l'appel au modèle omni NVIDIA pour l'extraction de l'image « ${fileName} » : ${message}`
    );
  }

  const rawJson = await extractJsonFromResponse(response);
  const rawText = `[Image fournie — ${fileName} — type ${normalizedMime}, ${buffer.length} octets]`;
  const parsed = enrichParsedCvFromRawText(normalizeParsedCv(rawJson), rawText);

  return {
    parsedCv: parsed,
    rawText,
    method,
    modelUsed: OMNI_MODEL_ID,
  };
}
