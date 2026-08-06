/**
 * Client NVIDIA construit sur le SDK OpenAI.
 *
 * L'API NVIDIA est compatible OpenAI (endpoint `https://integrate.api.nvidia.com/v1`),
 * ce qui permet de réutiliser le package `openai` npm pour :
 *  - appeler le modèle texte Nemotron-3-Super (extraction, scoring),
 *  - appeler le modèle omni Nemotron-3-Nano-Omni (lecture images / PDF rendus).
 *
 * Ces fonctions sont destinées à un usage serveur uniquement (depuis des
 * routes API Next.js). Aucune directive `'use server'` n'est nécessaire
 * puisqu'il s'agit de fonctions de bibliothèque pures.
 */

import OpenAI from 'openai';

import { OMNI_MODEL_ID, SUPER_MODEL_ID } from '@/lib/nvidia/models';

/** URL de base de l'API NVIDIA, compatible OpenAI. */
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/** Instance mise en cache du client OpenAI pointant vers NVIDIA. */
let cachedClient: OpenAI | null = null;

/**
 * Indique si la variable d'environnement `NVIDIA_API_KEY` est définie.
 *
 * Utilisé par les routes API pour décider d'afficher un message d'erreur
 * explicite lorsque le service NVIDIA n'est pas configuré.
 *
 * @returns `true` si la clé API est présente, `false` sinon.
 */
export function isNvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

/**
 * Retourne un client OpenAI configuré pour appeler l'API NVIDIA.
 *
 * Le client est mis en cache pour éviter de recréer une instance à chaque
 * appel. La clé API est lue depuis la variable d'environnement `NVIDIA_API_KEY`.
 *
 * @returns Une instance du SDK OpenAI pointant vers `NVIDIA_BASE_URL`.
 * @throws {Error} Si `NVIDIA_API_KEY` n'est pas définie dans l'environnement.
 */
export function getNvidiaClient(): OpenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "La variable d'environnement NVIDIA_API_KEY n'est pas définie. " +
        "Configurez-la dans .env.local (ou l'environnement de déploiement) " +
        'pour activer les appels aux modèles NVIDIA.'
    );
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: NVIDIA_BASE_URL,
  });

  return cachedClient;
}

/**
 * Paramètres pour `callNvidiaTextModel`.
 */
export interface CallNvidiaTextModelParams {
  /** Prompt système décrivant le rôle et les contraintes du modèle. */
  systemPrompt: string;
  /** Prompt utilisateur contenant la donnée à traiter. */
  userPrompt: string;
  /** Identifiant du modèle NVIDIA à utiliser (défaut : SUPER_MODEL_ID). */
  modelId?: string;
  /** Température (défaut : 0.3). */
  temperature?: number;
  /** Nombre maximum de tokens en sortie (défaut : 4096). */
  maxTokens?: number;
}

/**
 * Appelle le modèle texte NVIDIA (Nemotron-3-Super par défaut) avec un
 * message système et un message utilisateur.
 *
 * @param params - Voir `CallNvidiaTextModelParams`.
 * @returns Le contenu textuel de la réponse du modèle.
 * @throws {Error} Si l'appel échoue ou si la réponse est vide.
 */
export async function callNvidiaTextModel(
  params: CallNvidiaTextModelParams
): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    modelId = SUPER_MODEL_ID,
    temperature = 0.3,
    maxTokens = 4096,
  } = params;

  const client = getNvidiaClient();

  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(
        `La réponse du modèle texte NVIDIA (${modelId}) est vide ou mal formée.`
      );
    }

    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Erreur lors de l'appel au modèle texte NVIDIA (${modelId}) : ${error.message}`
      );
    }
    throw new Error(
      `Erreur inconnue lors de l'appel au modèle texte NVIDIA (${modelId}).`
    );
  }
}

/**
 * Paramètres pour `callNvidiaOmniModel`.
 */
export interface CallNvidiaOmniModelParams {
  /** Prompt système décrivant le rôle et les contraintes du modèle. */
  systemPrompt: string;
  /** Prompt utilisateur texte (optionnel si une image est fournie). */
  textPrompt?: string;
  /** Image encodée en base64 (sans le préfixe `data:...`). */
  imageBase64?: string;
  /** Type MIME de l'image, ex: `image/png`, `image/jpeg` (défaut : `image/png`). */
  imageMimeType?: string;
  /** Identifiant du modèle NVIDIA à utiliser (défaut : OMNI_MODEL_ID). */
  modelId?: string;
  /** Température (défaut : 0.3). */
  temperature?: number;
  /** Nombre maximum de tokens en sortie (défaut : 4096). */
  maxTokens?: number;
}

/**
 * Appelle le modèle omni/multimodal NVIDIA (Nemotron-3-Nano-Omni par défaut)
 * avec un prompt texte et/ou une image.
 *
 * L'image est transmise au format vision OpenAI, via une `image_url` contenant
 * une data URL : `data:<mime>;base64,<base64>`.
 *
 * Si aucune image n'est fournie, l'appel dégénère en un appel texte classique
 * (utile pour réutiliser le modèle omni sur du texte seul).
 *
 * @param params - Voir `CallNvidiaOmniModelParams`.
 * @returns Le contenu textuel de la réponse du modèle.
 * @throws {Error} Si l'appel échoue ou si la réponse est vide.
 */
export async function callNvidiaOmniModel(
  params: CallNvidiaOmniModelParams
): Promise<string> {
  const {
    systemPrompt,
    textPrompt,
    imageBase64,
    imageMimeType = 'image/png',
    modelId = OMNI_MODEL_ID,
    temperature = 0.3,
    maxTokens = 4096,
  } = params;

  if (!textPrompt && !imageBase64) {
    throw new Error(
      "callNvidiaOmniModel : au moins un des paramètres 'textPrompt' ou " +
        "'imageBase64' doit être fourni."
    );
  }

  const client = getNvidiaClient();

  // Construction du contenu utilisateur au format vision OpenAI.
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  if (textPrompt) {
    userContent.push({ type: 'text', text: textPrompt });
  }

  if (imageBase64) {
    const dataUrl = `data:${imageMimeType};base64,${imageBase64}`;
    userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
  }

  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent as any },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(
        `La réponse du modèle omni NVIDIA (${modelId}) est vide ou mal formée.`
      );
    }

    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Erreur lors de l'appel au modèle omni NVIDIA (${modelId}) : ${error.message}`
      );
    }
    throw new Error(
      `Erreur inconnue lors de l'appel au modèle omni NVIDIA (${modelId}).`
    );
  }
}

/**
 * Extrait de manière robuste un objet JSON depuis la réponse d'un modèle.
 *
 * Gère les cas suivants :
 *  - JSON pur (entouré ou non d'espaces).
 *  - JSON entouré de fences markdown ```json ... ``` ou ``` ... ```.
 *  - JSON précédé ou suivi de texte explicatif.
 *  - Tableau JSON `[...]` en plus des objets `{...}`.
 *
 * @param text - La réponse brute du modèle.
 * @returns L'objet ou tableau JavaScript parsé.
 * @throws {Error} Si aucun JSON valide ne peut être extrait.
 */
export async function extractJsonFromResponse(text: string): Promise<any> {
  if (!text || typeof text !== 'string') {
    throw new Error('extractJsonFromResponse : texte vide ou invalide.');
  }

  const trimmed = text.trim();

  // 1. Cas direct : le texte est déjà du JSON valide.
  try {
    return JSON.parse(trimmed);
  } catch {
    // On continue avec les stratégies de nettoyage.
  }

  // 2. Cas fences markdown ```json ... ``` ou ``` ... ```.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      // On tente un nettoyage plus poussé plus bas.
    }
  }

  // 3. Cas : JSON noyé dans du texte. On cherche le premier { ... } ou [ ... ]
  //    équilibré.
  const jsonCandidate = extractFirstBalancedJson(trimmed);
  if (jsonCandidate) {
    try {
      return JSON.parse(jsonCandidate);
    } catch {
      // On tente en dernier recours de réparer les problèmes courants.
    }
  }

  // 4. Dernier recours : retirer les caractères de contrôle et réessayer.
  const sanitized = trimmed
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/```/g, '')
    .trim();

  const sanitizedCandidate = extractFirstBalancedJson(sanitized);
  if (sanitizedCandidate) {
    try {
      return JSON.parse(sanitizedCandidate);
    } catch (err) {
      throw new Error(
        `extractJsonFromResponse : JSON invalide après nettoyage. ` +
          `Détail : ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error(
    'extractJsonFromResponse : aucun JSON valide trouvé dans la réponse du modèle.'
  );
}

/**
 * Cherche le premier bloc JSON équilibré (objet ou tableau) dans une chaîne.
 *
 * @param text - Le texte à analyser.
 * @returns Le premier bloc JSON équilibré trouvé, ou `null`.
 */
function extractFirstBalancedJson(text: string): string | null {
  const startIdx = text.search(/[[{]/);
  if (startIdx === -1) {
    return null;
  }

  const openChar = text[startIdx];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\') {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }

  return null;
}
