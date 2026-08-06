/**
 * Route API : statut de configuration.
 *
 * GET /api/status
 *
 * Renvoie l'état de l'agent :
 *   - nvidiaConfigured : true si NVIDIA_API_KEY est définie (env ou DB)
 *   - nvidiaKeySource  : "env" | "database" | "none" (source de la clé)
 *   - models           : liste des modèles NVIDIA configurés
 *   - database         : true si la base de données répond
 */

import { NextResponse } from 'next/server'
import { isNvidiaConfiguredAsync } from '@/lib/nvidia/client'
import { NVIDIA_MODELS } from '@/lib/nvidia/models'
import { resolveNvidiaApiKey } from '@/lib/settings'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  let databaseOk = true
  let cvCount = 0
  try {
    cvCount = await db.cvRecord.count()
  } catch {
    databaseOk = false
  }

  // Déterminer la source de la clé API (env, database, ou aucune)
  let nvidiaKeySource: 'env' | 'database' | 'none' = 'none'
  if (process.env.NVIDIA_API_KEY) {
    nvidiaKeySource = 'env'
  } else {
    const dbKey = await resolveNvidiaApiKey()
    if (dbKey) nvidiaKeySource = 'database'
  }

  const nvidiaConfigured = await isNvidiaConfiguredAsync()

  return NextResponse.json({
    nvidiaConfigured,
    nvidiaKeySource,
    models: Object.values(NVIDIA_MODELS).map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      description: m.description,
    })),
    database: databaseOk,
    cvCount,
    timestamp: new Date().toISOString(),
  })
}
