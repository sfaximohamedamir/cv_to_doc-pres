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

import { parsePdf, MIN_SUBSTANTIAL_TEXT_LENGTH } from '@/lib/parsers/pdf-parser';
import {
  bufferToBase64,
  detectImageMimeType,
  isSupportedImage,
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
}

/**
 * Valide qu'un objet parsé est bien conforme à la forme minimale d'un
 * `ParsedCv`.
 *
 * On ne fait pas une validation stricte du schéma complet (le prompt est
 * chargé de garantir la conformité), mais on vérifie la présence des clés
 * obligatoires pour éviter les erreurs en aval.
 *
 * @param obj - L'objet issu du parsing JSON.
 * @throws {Error} Si une clé obligatoire est manquante.
 */
function validateParsedCvShape(obj: unknown): asserts obj is ParsedCv {
  if (!obj || typeof obj !== 'object') {
    throw new Error(
      "Le modèle NVIDIA n'a pas retourné un objet JSON exploitable pour le CV."
    );
  }

  const candidate = obj as Record<string, unknown>;

  const requiredKeys = [
    'personalInfo',
    'workExperience',
    'education',
    'skills',
    'languages',
  ] as const;

  for (const key of requiredKeys) {
    if (!(key in candidate)) {
      throw new Error(
        `Le CV extrait est invalide : la clé obligatoire "${key}" est manquante.`
      );
    }
  }

  if (
    !candidate.personalInfo ||
    typeof candidate.personalInfo !== 'object' ||
    !('fullName' in (candidate.personalInfo as Record<string, unknown>))
  ) {
    throw new Error(
      "Le CV extrait est invalide : personalInfo.fullName est manquant."
    );
  }

  if (!Array.isArray(candidate.workExperience)) {
    throw new Error('Le CV extrait est invalide : workExperience doit être un tableau.');
  }
  if (!Array.isArray(candidate.education)) {
    throw new Error('Le CV extrait est invalide : education doit être un tableau.');
  }
  if (!Array.isArray(candidate.skills)) {
    throw new Error('Le CV extrait est invalide : skills doit être un tableau.');
  }
  if (!Array.isArray(candidate.languages)) {
    throw new Error('Le CV extrait est invalide : languages doit être un tableau.');
  }
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
  const { buffer, fileName, mimeType, language } = params;

  // 0. Vérification préalable : la clé API NVIDIA doit être configurée.
  if (!(await isNvidiaConfiguredAsync())) {
    throw new Error(
      "Aucune clé API NVIDIA configurée. " +
        "Ajoutez-la dans les paramètres de l'application (bouton ⚙️) " +
        "ou définissez la variable d'environnement NVIDIA_API_KEY."
    );
  }

  // Construction des prompts (système + utilisateur) — communs aux deux
  // méthodes d'extraction.
  const { system, user } = buildExtractionPrompt(language);

  // 1. Cas PDF.
  if (mimeType === 'application/pdf') {
    let pdfText = '';
    try {
      const pdfResult = await parsePdf(buffer);
      pdfText = pdfResult.text ?? '';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Échec de l'extraction texte du PDF « ${fileName} » : ${message}`
      );
    }

    // PDF sans aucun texte extractible : probablement un PDF scanné.
    if (pdfText.trim().length === 0) {
      throw new Error(
        'Le PDF semble être scanné (pas de texte extractible). ' +
          "Veuillez fournir une image du CV ou un PDF avec texte sélectionnable."
      );
    }

    // Si le texte est court mais non vide, on l'envoie quand même au modèle
    // texte : le CV peut être volontairement succinct, ou le PDF partiellement
    // scanné mais avec un peu de texte récupérable.
    const method: ExtractionMethod = 'pdf-text';

    const fullUserPrompt = `${user}\n\n----- DÉBUT DU TEXTE EXTRAIT DU PDF -----\n${pdfText}\n----- FIN DU TEXTE EXTRAIT DU PDF -----`;

    let response: string;
    try {
      response = await callNvidiaTextModel({
        systemPrompt: system,
        userPrompt: fullUserPrompt,
        modelId: SUPER_MODEL_ID,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Échec de l'appel au modèle texte NVIDIA pour l'extraction du PDF « ${fileName} » : ${message}`
      );
    }

    const parsed = await extractJsonFromResponse(response);
    validateParsedCvShape(parsed);

    return {
      parsedCv: parsed,
      rawText: pdfText,
      method,
      modelUsed: SUPER_MODEL_ID,
    };
  }

  // 2. Cas image.
  // On tente d'abord de détecter le vrai type MIME via le magic number, car
  // le `mimeType` déclaré par le client peut être erroné ou générique
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

  const parsed = await extractJsonFromResponse(response);
  validateParsedCvShape(parsed);

  // Pour une image, on n'a pas de texte source à proprement parler ; on
  // construit une description synthétique utile pour l'affichage et le
  // débogage.
  const rawText = `[Image fournie — ${fileName} — type ${normalizedMime}, ${buffer.length} octets]`;

  return {
    parsedCv: parsed,
    rawText,
    method,
    modelUsed: OMNI_MODEL_ID,
  };
}
