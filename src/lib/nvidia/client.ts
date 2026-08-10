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
import { resolveNvidiaApiKey, isNvidiaKeyConfigured } from '@/lib/settings';

/** URL de base de l'API NVIDIA, compatible OpenAI. */
export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/** Instance mise en cache du client OpenAI pointant vers NVIDIA. */
let cachedClient: OpenAI | null = null;
/** Clé API utilisée pour créer le client en cache (pour invalider le cache si la clé change). */
let cachedApiKey: string | null = null;

/**
 * Indique si la clé API NVIDIA est configurable via l'environnement.
 *
 * Version synchrone : vérifie uniquement la variable d'environnement.
 * Pour vérifier également la base de données, utiliser `isNvidiaConfiguredAsync()`.
 *
 * @returns `true` si `NVIDIA_API_KEY` est présente dans l'environnement.
 */
export function isNvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

/**
 * Version asynchrone de `isNvidiaConfigured()`.
 *
 * Vérifie à la fois la variable d'environnement ET la base de données
 * (paramètre saisi par l'utilisateur dans l'interface).
 *
 * @returns `true` si la clé API est disponible (env ou DB).
 */
export async function isNvidiaConfiguredAsync(): Promise<boolean> {
  return isNvidiaKeyConfigured();
}

/**
 * Retourne un client OpenAI configuré pour appeler l'API NVIDIA.
 *
 * Version asynchrone : la clé API est résolue depuis l'environnement
 * (priorité 1) ou la base de données (priorité 2, saisie via l'interface).
 *
 * Le client est mis en cache tant que la clé API ne change pas.
 *
 * @returns Une instance du SDK OpenAI pointant vers `NVIDIA_BASE_URL`.
 * @throws {Error} Si aucune clé API n'est configurée.
 */
export async function getNvidiaClient(): Promise<OpenAI> {
  const apiKey = await resolveNvidiaApiKey();

  if (!apiKey) {
    throw new Error(
      "Aucune clé API NVIDIA configurée. " +
        "Ajoutez-la dans les paramètres de l'application (bouton ⚙️ dans l'en-tête) " +
        "ou définissez la variable d'environnement NVIDIA_API_KEY dans .env.local."
    );
  }

  // Réutiliser le client en cache si la clé n'a pas changé.
  if (cachedClient && cachedApiKey === apiKey) {
    return cachedClient;
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: NVIDIA_BASE_URL,
  });
  cachedApiKey = apiKey;

  return cachedClient;
}

/**
 * Invalide le cache du client NVIDIA.
 *
 * À appeler après une modification de la clé API (dans l'interface)
 * pour forcer la recréation du client avec la nouvelle clé.
 */
export function invalidateNvidiaClientCache(): void {
  cachedClient = null;
  cachedApiKey = null;
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

  const client = await getNvidiaClient();

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

  const client = await getNvidiaClient();

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
/**
 * Tente de réparer un flux JSON tronqué (par exemple coupé par le max_tokens).
 */
function tryRepairTruncatedJson(str: string): any {
  let cleaned = str.trim();
  const firstBrace = cleaned.search(/[\{\[]/);
  if (firstBrace === -1) return null;
  cleaned = cleaned.slice(firstBrace);

  try {
    return JSON.parse(cleaned);
  } catch {}

  let stack: string[] = [];
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\') {
      isEscaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        if (stack.length > 0) stack.pop();
      }
    }
  }

  if (inString) {
    cleaned += '"';
  }

  cleaned = cleaned.replace(/,\s*$/, '');

  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === '{') cleaned += '}';
    else if (openChar === '[') cleaned += ']';
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Extrait de manière robuste un objet JSON depuis la réponse d'un modèle.
 *
 * Gère les cas suivants :
 *  - JSON pur (entouré ou non d'espaces).
 *  - JSON entouré de fences markdown ```json ... ``` ou ``` ... ```.
 *  - JSON précédé ou suivi de texte explicatif.
 *  - JSON tronqué par la limite de tokens (réparation automatique).
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
      const repaired = tryRepairTruncatedJson(inner);
      if (repaired) return repaired;
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

  // 4. Réparation automatique d'un JSON tronqué à la fin
  const repaired = tryRepairTruncatedJson(trimmed);
  if (repaired) {
    return repaired;
  }

  // 5. Dernier recours : retirer les caractères de contrôle et réessayer.
  const sanitized = trimmed
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/```/g, '')
    .trim();

  const sanitizedCandidate = extractFirstBalancedJson(sanitized);
  if (sanitizedCandidate) {
    try {
      return JSON.parse(sanitizedCandidate);
    } catch {}
  }

  const sanitizedRepaired = tryRepairTruncatedJson(sanitized);
  if (sanitizedRepaired) {
    return sanitizedRepaired;
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
