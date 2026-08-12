import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

// S'assurer que le dossier de la base SQLite existe sur le serveur
const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '')
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)
  try {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  } catch {}
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db