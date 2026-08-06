/**
 * Route API : mise à jour du tag et des notes d'un CV.
 *
 * PATCH /api/cv/tag
 *
 * Corps JSON :
 *   { "id": "<cvId>", "tag"?: "<tagId>", "notes"?: "<texte>" }
 *
 * Met à jour le tag de statut de recrutement et/ou les notes libres
 * associées à un CV. Renvoie l'enregistrement mis à jour.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const VALID_TAGS = ['none', 'review', 'interview', 'offered', 'hired', 'rejected']

export async function PATCH(request: NextRequest) {
  let body: { id?: string; tag?: string; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: "Champ 'id' requis." }, { status: 400 })
  }

  // Construire les données à mettre à jour
  const updateData: { tag?: string; notes?: string | null } = {}
  if (body.tag !== undefined) {
    if (!VALID_TAGS.includes(body.tag)) {
      return NextResponse.json(
        { error: `Tag invalide. Valeurs acceptées : ${VALID_TAGS.join(', ')}` },
        { status: 400 }
      )
    }
    updateData.tag = body.tag
  }
  if (body.notes !== undefined) {
    const trimmed = body.notes.trim()
    updateData.notes = trimmed || null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Aucun champ à mettre à jour (tag ou notes requis)." },
      { status: 400 }
    )
  }

  try {
    const record = await db.cvRecord.update({
      where: { id: body.id },
      data: updateData,
      select: {
        id: true,
        tag: true,
        notes: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      id: record.id,
      tag: record.tag,
      notes: record.notes,
      updatedAt: record.updatedAt,
    })
  } catch (error) {
    console.error('[/api/cv/tag] Erreur :', error)
    return NextResponse.json(
      { error: 'CV introuvable ou erreur de mise à jour.' },
      { status: 404 }
    )
  }
}
