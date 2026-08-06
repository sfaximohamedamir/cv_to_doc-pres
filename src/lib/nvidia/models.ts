/**
 * Configuration des modèles NVIDIA utilisés par l'agent de transformation de CV.
 *
 * Deux modèles sont mobilisés :
 *  - `nvidia/nemotron-3-super-120b-a12b` : modèle texte (LLM) utilisé pour
 *    structurer le texte du CV en JSON et pour le scoring.
 *  - `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` : modèle omni multimodal
 *    utilisé pour lire visuellement les images (JPG/PNG) et les PDF rendus
 *    sous forme d'images.
 *
 * L'API NVIDIA est compatible OpenAI (endpoint `https://integrate.api.nvidia.com/v1`),
 * ce qui permet de réutiliser le SDK `openai` npm pour les appels.
 */

import type { NvidiaModelConfig } from '@/lib/cv/types';

/**
 * Identifiant complet du modèle texte NVIDIA (Nemotron Super 120B).
 * Utilisé pour l'extraction structurée (texte -> JSON) et le scoring.
 */
export const SUPER_MODEL_ID = 'nvidia/nemotron-3-super-120b-a12b';

/**
 * Identifiant complet du modèle omni NVIDIA (Nemotron Nano Omni 30B).
 * Utilisé pour la lecture visuelle des images et PDF.
 */
export const OMNI_MODEL_ID = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

/**
 * Registre des modèles NVIDIA disponibles pour l'agent.
 *
 * La clé est l'identifiant complet du modèle. Chaque entrée décrit
 * le type de modèle, sa température recommandée et son nombre maximum
 * de tokens en sortie.
 */
export const NVIDIA_MODELS: Record<string, NvidiaModelConfig> = {
  [SUPER_MODEL_ID]: {
    id: SUPER_MODEL_ID,
    name: 'Nemotron-3-Super-120B',
    type: 'text',
    description:
      'Modèle de langage texte NVIDIA (120B params, 12B actifs). ' +
      "Utilisé pour structurer le texte d'un CV en JSON normalisé et pour le scoring.",
    temperature: 0.3,
    maxTokens: 4096,
  },
  [OMNI_MODEL_ID]: {
    id: OMNI_MODEL_ID,
    name: 'Nemotron-3-Nano-Omni-30B',
    type: 'omni',
    description:
      'Modèle omni/multimodal NVIDIA (30B params, 3B actifs). ' +
      "Utilisé pour lire visuellement les images (JPG/PNG) et les PDF rendus en image.",
    temperature: 0.3,
    maxTokens: 4096,
  },
};

/**
 * Récupère la configuration d'un modèle à partir de son identifiant.
 *
 * @param modelId - Identifiant complet du modèle NVIDIA.
 * @returns La configuration du modèle, ou `undefined` si inconnu.
 */
export function getModelConfig(modelId: string): NvidiaModelConfig | undefined {
  return NVIDIA_MODELS[modelId];
}
