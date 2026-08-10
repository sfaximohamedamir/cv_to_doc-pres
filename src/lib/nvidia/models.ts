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
 */
export const SUPER_MODEL_ID = 'nvidia/nemotron-3-super-120b-a12b';

/**
 * Identifiant du modèle Z.ai GLM 5.2 (très grande fenêtre de contexte).
 */
export const GLM_MODEL_ID = 'z-ai/glm-5.2';

/**
 * Identifiant du modèle Meta Llama 3.3 70B.
 */
export const LLAMA_MODEL_ID = 'meta/llama-3.3-70b-instruct';

/**
 * Identifiant du modèle DeepSeek R1.
 */
export const DEEPSEEK_MODEL_ID = 'deepseek-ai/deepseek-r1';

/**
 * Identifiant complet du modèle omni NVIDIA (Nemotron Nano Omni 30B).
 */
export const OMNI_MODEL_ID = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

/**
 * Liste des modèles texte sélectionnables par l'utilisateur.
 */
export const TEXT_MODELS = [
  {
    id: GLM_MODEL_ID,
    name: 'Z.ai GLM 5.2',
    description: 'Très grande fenêtre de contexte (recommandé pour les longs CV)',
  },
  {
    id: SUPER_MODEL_ID,
    name: 'NVIDIA Nemotron-3 Super 120B',
    description: 'Modèle officiel texte 120B de NVIDIA',
  },
  {
    id: LLAMA_MODEL_ID,
    name: 'Meta Llama 3.3 70B Instruct',
    description: 'Modèle rapide et haute performance de Meta',
  },
  {
    id: DEEPSEEK_MODEL_ID,
    name: 'DeepSeek R1',
    description: 'Modèle de raisonnement avancé',
  },
] as const;

/**
 * Registre des modèles NVIDIA disponibles pour l'agent.
 */
export const NVIDIA_MODELS: Record<string, NvidiaModelConfig> = {
  [GLM_MODEL_ID]: {
    id: GLM_MODEL_ID,
    name: 'Z.ai GLM 5.2',
    type: 'text',
    description: 'Modèle Z.ai GLM 5.2 avec très large fenêtre de contexte.',
    temperature: 0.3,
    maxTokens: 8192,
  },
  [SUPER_MODEL_ID]: {
    id: SUPER_MODEL_ID,
    name: 'Nemotron-3-Super-120B',
    type: 'text',
    description:
      'Modèle de langage texte NVIDIA (120B params, 12B actifs).',
    temperature: 0.3,
    maxTokens: 8192,
  },
  [LLAMA_MODEL_ID]: {
    id: LLAMA_MODEL_ID,
    name: 'Llama 3.3 70B',
    type: 'text',
    description: 'Modèle Meta Llama 3.3 70B.',
    temperature: 0.3,
    maxTokens: 8192,
  },
  [DEEPSEEK_MODEL_ID]: {
    id: DEEPSEEK_MODEL_ID,
    name: 'DeepSeek R1',
    type: 'text',
    description: 'Modèle DeepSeek R1.',
    temperature: 0.3,
    maxTokens: 8192,
  },
  [OMNI_MODEL_ID]: {
    id: OMNI_MODEL_ID,
    name: 'Nemotron-3-Nano-Omni-30B',
    type: 'omni',
    description:
      'Modèle omni/multimodal NVIDIA (30B params, 3B actifs).',
    temperature: 0.3,
    maxTokens: 8192,
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
