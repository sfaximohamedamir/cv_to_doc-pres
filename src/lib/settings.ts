/**
 * Gestionnaire de paramètres de l'application.
 *
 * Permet de stocker et récupérer des paramètres (clé-valeur) dans la base
 * de données. Utilisé notamment pour stocker la clé API NVIDIA saisie par
 * l'utilisateur dans l'interface, sans avoir à modifier le fichier .env.
 */

import { db } from '@/lib/db'

/// Clé du paramètre pour la clé API NVIDIA.
export const NVIDIA_API_KEY_SETTING = 'nvidia_api_key'

/**
 * Récupère un paramètre depuis la base de données.
 * @param key - La clé du paramètre.
 * @returns La valeur du paramètre, ou null si non trouvé.
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const setting = await db.setting.findUnique({ where: { key } })
    return setting?.value || null
  } catch (error) {
    console.error(`[getSetting] Erreur pour la clé "${key}" :`, error)
    return null
  }
}

/**
 * Enregistre (ou met à jour) un paramètre dans la base de données.
 * @param key - La clé du paramètre.
 * @param value - La valeur à enregistrer.
 * @param sensitive - Indique si la valeur est sensible (défaut: false).
 */
export async function setSetting(
  key: string,
  value: string,
  sensitive = false
): Promise<void> {
  try {
    await db.setting.upsert({
      where: { key },
      create: { key, value, sensitive },
      update: { value, sensitive },
    })
  } catch (error) {
    console.error(`[setSetting] Erreur pour la clé "${key}" :`, error)
    throw error
  }
}

/**
 * Supprime un paramètre de la base de données.
 * @param key - La clé du paramètre à supprimer.
 */
export async function deleteSetting(key: string): Promise<void> {
  try {
    await db.setting.delete({ where: { key } })
  } catch {
    // Le paramètre n'existe peut-être pas — on ignore l'erreur.
  }
}

/**
 * Récupère la clé API NVIDIA depuis la base de données.
 * @returns La clé API, ou null si non configurée.
 */
export async function getNvidiaApiKey(): Promise<string | null> {
  return getSetting(NVIDIA_API_KEY_SETTING)
}

/**
 * Vérifie si la clé API NVIDIA est configurée (soit en DB, soit en env).
 * @returns true si la clé est disponible.
 */
export async function isNvidiaKeyConfigured(): Promise<boolean> {
  // Priorité 1 : variable d'environnement
  if (process.env.NVIDIA_API_KEY) return true
  // Priorité 2 : base de données
  const dbKey = await getNvidiaApiKey()
  return Boolean(dbKey)
}

/**
 * Récupère la clé API NVIDIA (env OU base de données).
 * L'env a la priorité pour compatibilité avec les déploiements existants.
 * @returns La clé API, ou null si non configurée.
 */
export async function resolveNvidiaApiKey(): Promise<string | null> {
  // Priorité 1 : variable d'environnement
  if (process.env.NVIDIA_API_KEY) return process.env.NVIDIA_API_KEY
  // Priorité 2 : base de données
  return getNvidiaApiKey()
}
