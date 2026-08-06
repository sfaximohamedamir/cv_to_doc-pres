/**
 * Route API : statut de configuration.
 *
 * GET /api/status
 *
 * Renvoie l'état de l'agent :
 *   - nvidiaConfigured : true si NVIDIA_API_KEY est définie
 *   - models           : liste des modèles NVIDIA configurés
 *   - database         : true si la base de données répond
 */

import { NextResponse } from 'next/server'
import { isNvidiaConfigured } from '@/lib/nvidia/client'
import { NVIDIA_MODELS } from '@/lib/nvidia/models'
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

  return NextResponse.json({
    nvidiaConfigured: isNvidiaConfigured(),
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
