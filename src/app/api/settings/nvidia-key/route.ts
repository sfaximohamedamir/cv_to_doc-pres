/**
 * Route API : gestion de la clé API NVIDIA.
 *
 * GET    /api/settings/nvidia-key  — vérifie si la clé est configurée (renvoie le statut, jamais la clé)
 * PUT    /api/settings/nvidia-key  — enregistre une nouvelle clé API
 * DELETE /api/settings/nvidia-key  — supprime la clé de la base de données
 *
 * La clé est stockée dans la table Setting avec la clé "nvidia_api_key".
 * Elle n'est JAMAIS renvoyée au client (seul le statut configuré/non configuré l'est).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getNvidiaApiKey,
  setSetting,
  deleteSetting,
  NVIDIA_API_KEY_SETTING,
  resolveNvidiaTextModel,
  setNvidiaTextModel,
} from '@/lib/settings'
import { invalidateNvidiaClientCache } from '@/lib/nvidia/client'

export const runtime = 'nodejs'

/**
 * GET — vérifie si la clé API NVIDIA est configurée et renvoie le modèle sélectionné.
 */
export async function GET() {
  const envKey = process.env.NVIDIA_API_KEY
  const dbKey = await getNvidiaApiKey()
  const selectedModel = await resolveNvidiaTextModel()

  let source: 'env' | 'database' | 'none' = 'none'
  if (envKey) {
    source = 'env'
  } else if (dbKey) {
    source = 'database'
  }

  return NextResponse.json({
    configured: Boolean(envKey || dbKey),
    source,
    canDelete: !envKey && Boolean(dbKey),
    selectedModel,
  })
}

/**
 * PUT — enregistre la clé API NVIDIA et/ou le modèle sélectionné.
 */
export async function PUT(request: NextRequest) {
  let body: { apiKey?: string; selectedModel?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const apiKey = body.apiKey?.trim()
  const selectedModel = body.selectedModel?.trim()

  if (selectedModel) {
    await setNvidiaTextModel(selectedModel)
  }

  if (apiKey) {
    if (!apiKey.startsWith('nvapi-')) {
      return NextResponse.json(
        {
          error:
            "La clé API NVIDIA doit commencer par 'nvapi-'. Vérifiez le format de votre clé.",
        },
        { status: 400 }
      )
    }

    if (apiKey.length < 20) {
      return NextResponse.json(
        { error: 'La clé API semble trop courte. Vérifiez que vous avez copié la clé complète.' },
        { status: 400 }
      )
    }

    await setSetting(NVIDIA_API_KEY_SETTING, apiKey, true)
    invalidateNvidiaClientCache()
  }

  return NextResponse.json({
    success: true,
    message: 'Paramètres enregistrés avec succès.',
    configured: true,
    selectedModel: await resolveNvidiaTextModel(),
  })
}

/**
 * DELETE — supprime la clé API NVIDIA de la base de données.
 * Ne supprime pas la clé si elle provient de l'environnement.
 */
export async function DELETE() {
  // Si la clé vient de l'env, on ne peut pas la supprimer
  if (process.env.NVIDIA_API_KEY) {
    return NextResponse.json(
      {
        error:
          'La clé API est définie via la variable d\'environnement NVIDIA_API_KEY. Elle ne peut pas être supprimée depuis l\'interface.',
      },
      { status: 403 }
    )
  }

  try {
    await deleteSetting(NVIDIA_API_KEY_SETTING)
    invalidateNvidiaClientCache()

    return NextResponse.json({
      success: true,
      message: 'Clé API NVIDIA supprimée.',
      configured: false,
      source: 'none',
    })
  } catch (error) {
    console.error('[/api/settings/nvidia-key] DELETE Erreur :', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la clé.' },
      { status: 500 }
    )
  }
}
