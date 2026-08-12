import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

// S'assurer que le dossier de la base SQLite existe sur le serveur
const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '')
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)
  try {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    
    // Si le fichier db n'existe pas encore (ex: dans /tmp/), pousser le schema Prisma
    if (!fs.existsSync(absolutePath)) {
      console.log('[DB] Création et initialisation de la base SQLite...')
      try {
        execSync('npx prisma db push --skip-generate', {
          env: { ...process.env, DATABASE_URL: dbUrl },
          stdio: 'inherit',
        })
      } catch (err) {
        console.error('[DB] Erreur lors de prisma db push:', err)
      }
    }
  } catch (err) {
    console.error('[DB] Erreur préparation dossier DB:', err)
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db