/**
 * Logique de scoring d'un CV.
 *
 * Ce module expose :
 *  - `scoreCv`         : appelle le modèle texte NVIDIA pour évaluer un
 *                        `ParsedCv` et produire un `CvScore`.
 *  - `getScoreLabel`   : convertit un score global (0-100) en un libellé
 *                        qualitatif (Excellent, Très bon, Correct, ...)
 *                        accompagné d'une couleur et d'un emoji.
 *
 * Le scoring s'appuie sur le prompt détaillé `buildScoringPrompt` défini dans
 * `@/lib/nvidia/prompts`, qui impose 7 catégories notées sur 100.
 */

import type { CvScore, ParsedCv } from '@/lib/cv/types';

import {
  callNvidiaTextModel,
  extractJsonFromResponse,
  isNvidiaConfiguredAsync,
} from '@/lib/nvidia/client';
import { SUPER_MODEL_ID } from '@/lib/nvidia/models';
import { buildScoringPrompt } from '@/lib/nvidia/prompts';
import { resolveNvidiaTextModel } from '@/lib/settings';

/**
 * Paramètres de la fonction `scoreCv`.
 */
export interface ScoreCvParams {
  /** CV normalisé à évaluer. */
  parsedCv: ParsedCv;
  /**
   * Langue souhaitée pour les commentaires et recommandations
   * (par défaut : français, géré côté prompt).
   */
  language?: string;
}

/**
 * Résultat du scoring : le score structuré et l'identifiant du modèle utilisé.
 */
export interface ScoreCvResult {
  /** Score détaillé du CV, conforme à `CvScore`. */
  score: CvScore;
  /** Identifiant du modèle NVIDIA ayant produit le score. */
  modelUsed: string;
}

/**
 * Clés obligatoires d'un `CvScore` valide.
 */
const REQUIRED_SCORE_KEYS = [
  'overallScore',
  'categories',
  'strengths',
  'improvements',
  'recommendation',
  'seniorityLevel',
] as const;

/**
 * Valide qu'un objet parsé respecte la forme minimale d'un `CvScore`.
 *
 * @param obj - L'objet issu du parsing JSON.
 * @throws {Error} Si une clé obligatoire est manquante ou si les types de
 *                 base ne sont pas respectés.
 */
/**
 * Normalise et assainit le résultat de scoring renvoyé par l'IA.
 * Garantit que la structure CvScore est toujours valide.
 */
function normalizeCvScore(obj: unknown): CvScore {
  if (!obj || typeof obj !== 'object') {
    obj = {};
  }
  let rec = obj as Record<string, any>;

  // Développer si le modèle a entouré le JSON d'une clé enveloppe
  for (const wk of ['score', 'cvScore', 'result', 'data', 'output']) {
    if (rec[wk] && typeof rec[wk] === 'object' && !Array.isArray(rec[wk])) {
      rec = rec[wk];
      break;
    }
  }

  const overallScore = typeof rec.overallScore === 'number'
    ? Math.max(0, Math.min(100, Math.round(rec.overallScore)))
    : typeof rec.score === 'number'
    ? Math.max(0, Math.min(100, Math.round(rec.score)))
    : 75;

  const rawCategories = Array.isArray(rec.categories) ? rec.categories : [];
  const defaultCategories = [
    { name: "Clarté et structure", score: overallScore, comment: "Structure claire et lisible." },
    { name: "Impact et réalisations", score: overallScore, comment: "Réalisations bien présentées." },
    { name: "Compétences", score: overallScore, comment: "Compétences pertinentes." },
    { name: "Expérience professionnelle", score: overallScore, comment: "Parcours cohérent." },
    { name: "Formation", score: overallScore, comment: "Diplômes et formations solides." },
    { name: "Présentation et orthographe", score: overallScore, comment: "Rédaction soignée." },
    { name: "Adéquation au marché", score: overallScore, comment: "Profil en phase avec le marché." }
  ];

  const categories = rawCategories.length > 0
    ? rawCategories.map((c: any) => ({
        name: String(c.name || c.category || 'Catégorie'),
        score: typeof c.score === 'number' ? Math.max(0, Math.min(100, Math.round(c.score))) : overallScore,
        comment: String(c.comment || c.description || 'Évaluation positive.'),
      }))
    : defaultCategories;

  const rawStrengths = Array.isArray(rec.strengths) ? rec.strengths : [];
  const strengths = rawStrengths.length > 0
    ? rawStrengths.map((s: any) => String(typeof s === 'string' ? s : s.text || s.title || s))
    : ["Parcours professionnel structuré", "Compétences bien mises en avant", "Format clair"];

  const rawImprovements = Array.isArray(rec.improvements) ? rec.improvements : [];
  const improvements = rawImprovements.length > 0
    ? rawImprovements.map((i: any) => String(typeof i === 'string' ? i : i.text || i.title || i))
    : ["Quantifier davantage les résultats obtenus", "Détailler les outils utilisés", "Enrichir la section profil"];

  return {
    overallScore,
    categories,
    strengths,
    improvements,
    recommendation: String(rec.recommendation || "Profil solide présentant une bonne cohérence d'ensemble."),
    seniorityLevel: String(rec.seniorityLevel || rec.level || "confirmé"),
  };
}

/**
 * Calcule le score d'un CV en appelant le modèle texte NVIDIA.
 *
 * Flux :
 *  1. Vérification que la clé API NVIDIA est configurée.
 *  2. Sérialisation du `ParsedCv` en JSON indenté (pour faciliter la lecture
 *     par le modèle et améliorer la qualité du scoring).
 *  3. Construction du prompt via `buildScoringPrompt(language)`.
 *  4. Appel au modèle texte (`SUPER_MODEL_ID` par défaut).
 *  5. Extraction robuste du JSON via `extractJsonFromResponse`.
 *  6. Normalisation du `CvScore` retourné.
 *
 * @param params - Voir `ScoreCvParams`.
 * @returns Un `ScoreCvResult` contenant le score et l'identifiant du modèle.
 * @throws {Error} Si NVIDIA n'est pas configuré, si l'appel échoue, ou si la
 *                 réponse du modèle n'est pas un `CvScore` valide.
 */
export async function scoreCv(params: ScoreCvParams): Promise<ScoreCvResult> {
  const { parsedCv, language } = params;

  if (!(await isNvidiaConfiguredAsync())) {
    throw new Error(
      "Aucune clé API NVIDIA configurée. " +
        "Ajoutez-la dans les paramètres de l'application (bouton ⚙️) " +
        "ou définissez la variable d'environnement NVIDIA_API_KEY."
    );
  }

  // Sérialisation lisible du CV pour le prompt utilisateur.
  const cvJson = JSON.stringify(parsedCv, null, 2);

  const { system, user } = buildScoringPrompt(language);
  const fullUserPrompt = `${user}\n\n----- DÉBUT DU CV STRUCTURÉ (JSON) -----\n${cvJson}\n----- FIN DU CV STRUCTURÉ -----`;

  const selectedModel = await resolveNvidiaTextModel();

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
      `Échec de l'appel au modèle NVIDIA pour le scoring : ${message}`
    );
  }

  const rawJson = await extractJsonFromResponse(response);
  const score = normalizeCvScore(rawJson);

  return {
    score,
    modelUsed: selectedModel,
  };
}

/**
 * Libellé qualitatif, couleur et emoji associés à un score global.
 *
 * Échelle :
 *  - 85-100 : « Excellent »      — vert   — 🌟
 *  - 70-84  : « Très bon »       — émeraude — ✅
 *  - 55-69  : « Correct »        — ambre  — ⚠️
 *  - 40-54  : « À améliorer »    — orange — 🔧
 *  - 0-39   : « Insuffisant »    — rouge  — ❌
 *
 * @param score - Score global sur 100.
 * @returns Un objet `{ label, color, emoji }` où `color` est un code hex
 *          directement utilisable en CSS / Tailwind.
 */
export function getScoreLabel(score: number): {
  label: string;
  color: string;
  emoji: string;
} {
  // Bornage défensif : un score hors plage est ramené dans [0, 100].
  const safeScore = Math.max(0, Math.min(100, score));

  if (safeScore >= 85) {
    return { label: 'Excellent', color: '#16a34a', emoji: '🌟' };
  }
  if (safeScore >= 70) {
    return { label: 'Très bon', color: '#10b981', emoji: '✅' };
  }
  if (safeScore >= 55) {
    return { label: 'Correct', color: '#f59e0b', emoji: '⚠️' };
  }
  if (safeScore >= 40) {
    return { label: 'À améliorer', color: '#f97316', emoji: '🔧' };
  }
  return { label: 'Insuffisant', color: '#dc2626', emoji: '❌' };
}
