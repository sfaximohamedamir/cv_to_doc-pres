import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

// S'assurer que le dossier /db existe sur le serveur (ex: Render)
try {
  fs.mkdirSync(path.join(process.cwd(), 'db'), { recursive: true })
} catch {}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db