# 📘 HOWTO — Guide détaillé des routes API

> Ce document explique **comment les routes API de l'agent de transformation de CV ont été construites**,
> et **comment les utiliser étape par étape, détail par détail**. Il s'adresse à la fois aux développeurs
> qui souhaitent comprendre l'implémentation et à ceux qui veulent appeler les endpoints depuis un frontend
> ou un script externe.

---

## 📑 Sommaire

1. [Introduction](#1-introduction)
2. [Architecture des routes API](#2-architecture-des-routes-api)
3. [Pourquoi des routes API (et non des Server Actions) ?](#3-pourquoi-des-routes-api-et-non-des-server-actions-)
4. [Détail de chaque route API](#4-détail-de-chaque-route-api)
   - [4.1. POST /api/cv/process](#41-post-apicvprocess)
   - [4.2. GET /api/cv/history](#42-get-apicvhistory)
   - [4.3. GET /api/cv/history/[id]](#43-get-apicvhistoryid)
   - [4.4. DELETE /api/cv/history/[id]](#44-delete-apicvhistoryid)
   - [4.5. POST /api/nvidia/extract](#45-post-apinvidiaextract)
   - [4.6. POST /api/nvidia/score](#46-post-apinvidiascore)
   - [4.7. GET /api/download](#47-get-apidownload)
   - [4.8. GET /api/status](#48-get-apistatus)
5. [Comment l'extraction fonctionne](#5-comment-lextraction-fonctionne)
6. [Comment le scoring fonctionne](#6-comment-le-scoring-fonctionne)
7. [Comment les convertisseurs fonctionnent](#7-comment-les-convertisseurs-fonctionnent)
8. [Comment ajouter une nouvelle route API](#8-comment-ajouter-une-nouvelle-route-api)
9. [Comment appeler les APIs depuis le frontend](#9-comment-appeler-les-apis-depuis-le-frontend)
10. [Sécurité](#10-sécurité)
11. [Tests des APIs](#11-tests-des-apis)

---

## 1. Introduction

Ce guide documente l'ensemble des **8 routes API** exposées par l'agent de transformation de CV. Pour chacune, vous trouverez :

- la méthode HTTP et le chemin,
- les paramètres d'entrée (query, body, FormData),
- des exemples de requête (`curl` et `fetch` JavaScript),
- des exemples de réponse JSON réalistes,
- les codes d'erreur possibles,
- une explication détaillée du code (logique ligne par ligne).

Toutes les routes sont implémentées avec le **App Router de Next.js 16** (fichiers `route.ts`)
et utilisent les utilitaires `NextRequest` / `NextResponse` du module `next/server`.

---

## 2. Architecture des routes API

Toutes les routes API vivent sous le dossier `src/app/api/`. Voici la liste complète :

| Méthode | Route | Description | Fichier |
|---------|-------|-------------|---------|
| `POST` | `/api/cv/process` | Pipeline complet : extraction → conversion → scoring | `src/app/api/cv/process/route.ts` |
| `GET` | `/api/cv/process` | Résumé d'utilisation de la route (aide) | `src/app/api/cv/process/route.ts` |
| `GET` | `/api/cv/history` | Liste paginée de l'historique des CV traités | `src/app/api/cv/history/route.ts` |
| `GET` | `/api/cv/history/[id]` | Détail complet d'un CV traité | `src/app/api/cv/history/[id]/route.ts` |
| `DELETE` | `/api/cv/history/[id]` | Supprime un CV (BDD + fichier généré) | `src/app/api/cv/history/[id]/route.ts` |
| `POST` | `/api/nvidia/extract` | Extraction seule d'un CV (sans conversion ni scoring) | `src/app/api/nvidia/extract/route.ts` |
| `POST` | `/api/nvidia/score` | Scoring seul d'un `ParsedCv` fourni en JSON | `src/app/api/nvidia/score/route.ts` |
| `GET` | `/api/download` | Téléchargement d'un fichier généré (Word ou PowerPoint) | `src/app/api/download/route.ts` |
| `GET` | `/api/status` | État du service (NVIDIA, BDD, modèles) | `src/app/api/status/route.ts` |

> ℹ️ Toutes les routes sont exécutées dans le runtime Node.js (`export const runtime = 'nodejs'`),
> car elles utilisent des bibliothèques natives (Prisma, pdf-parse, Buffer, fs) non compatibles
> avec le runtime Edge.

---

## 3. Pourquoi des routes API (et non des Server Actions) ?

Next.js 16 propose deux paradigmes pour exécuter du code serveur depuis le frontend :

| Critère | Routes API (`route.ts`) | Server Actions (`'use server'`) |
|---|---|---|
| **Contrat** | HTTP REST classique (GET, POST, DELETE…) | Appels de fonction RPC transparents |
| **Compatible fetch / curl** | ✅ Oui, sans configuration | ❌ Non (requiert le protocole RSC interne) |
| **Upload de fichiers** | ✅ Natif via `FormData` | ⚠️ Possible mais moins idiomatique |
| **Streaming de réponse** | ✅ `Response` standard | ⚠️ Limité |
| **Tests en dehors du navigateur** | ✅ curl, Postman, httpie | ❌ Non |
| **Réutilisation par un client externe** | ✅ Oui (mobile, CLI, autre backend) | ❌ Non |
| **Cache et CDN** | ✅ Headers HTTP standards | ⚠️ Différent |

### Décision retenue

L'agent de transformation de CV utilise **uniquement des routes API** pour les raisons suivantes :

1. **Interopérabilité** — les endpoints peuvent être appelés par n'importe quel client HTTP (curl, scripts Python, application mobile, autre backend).
2. **Tests** — on peut tester chaque route indépendamment avec curl ou un client REST, sans avoir à monter une page React.
3. **Upload de fichiers natif** — `request.formData()` fonctionne parfaitement pour recevoir un CV (PDF ou image) en multipart.
4. **Sémantique REST** — `GET /api/cv/history` pour lister, `DELETE /api/cv/history/[id]` pour supprimer, `GET /api/download` pour récupérer un fichier : c'est lisible et prévisible.
5. **Téléchargement binaire** — `GET /api/download` renvoie directement un flux binaire avec le bon `Content-Type`, ce qui est trivial en route API mais plus délicat en Server Action.

> 💡 **Pourquoi pas un mix ?** On aurait pu utiliser des Server Actions pour certains appels (par exemple « rafraîchir l'historique »), mais l'uniformité facilite la maintenance et la documentation.

---

## 4. Détail de chaque route API

### 4.1. POST /api/cv/process

**Fichier** : `src/app/api/cv/process/route.ts`

C'est la **route principale** de l'agent. Elle exécute le pipeline complet : extraction → conversion → scoring, puis sauvegarde le tout en base et sur le disque.

#### Endpoint

```
POST /api/cv/process
Content-Type: multipart/form-data
```

#### Paramètres d'entrée (FormData)

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `file` | `File` (binaire) | ✅ Oui | Le fichier du CV. Formats acceptés : `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `image/gif`. Taille max : 10 Mo. |
| `outputFormat` | `string` | ❌ Non | `'word'` ou `'powerpoint'`. Défaut : `'word'`. |
| `language` | `string` | ❌ Non | Langue souhaitée pour les résumés et commentaires (ex: `français`, `anglais`). |

#### Exemple de requête

**Avec curl :**

```bash
curl -X POST http://localhost:3000/api/cv/process \
  -F "file=@./mon-cv.pdf" \
  -F "outputFormat=word" \
  -F "language=français"
```

**Avec JavaScript (`fetch`) :**

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('outputFormat', 'powerpoint');
formData.append('language', 'français');

const response = await fetch('/api/cv/process', {
  method: 'POST',
  body: formData,
});

if (!response.ok) {
  const error = await response.json();
  console.error('Erreur :', error.error);
  return;
}

const result = await response.json();
console.log('Score global :', result.score.overallScore);
console.log('Téléchargement :', result.downloadUrl);
```

#### Exemple de réponse JSON (200 OK)

```json
{
  "id": "clxxxxxx1234567890abcdef",
  "status": "done",
  "parsedCv": {
    "personalInfo": {
      "fullName": "Jean Dupont",
      "email": "jean.dupont@example.com",
      "phone": "+33 6 12 34 56 78",
      "location": "Paris, France",
      "linkedin": "https://linkedin.com/in/jeandupont",
      "title": "Développeur Full-Stack Senior",
      "summary": "Développeur full-stack avec 10 ans d'expérience..."
    },
    "workExperience": [
      {
        "title": "Lead Developer",
        "company": "TechCorp",
        "startDate": "Janvier 2021",
        "endDate": "présent",
        "description": "Pilotage d'une équipe de 5 développeurs...",
        "location": "Paris"
      }
    ],
    "education": [
      {
        "degree": "Master Informatique",
        "institution": "Université Paris-Saclay",
        "startDate": "2012",
        "endDate": "2014",
        "field": "Génie logiciel"
      }
    ],
    "skills": [
      { "name": "TypeScript", "level": "expert", "category": "technique" },
      { "name": "React", "level": "avancé", "category": "technique" }
    ],
    "languages": [
      { "name": "Français", "level": "natif" },
      { "name": "Anglais", "level": "C1" }
    ],
    "projects": [
      { "name": "Plateforme SaaS interne", "url": "https://github.com/jeandupont/saas" }
    ],
    "certifications": [
      { "name": "AWS Solutions Architect", "issuer": "Amazon", "date": "2022" }
    ],
    "detectedLanguage": "fr"
  },
  "score": {
    "overallScore": 87,
    "categories": [
      { "name": "Clarté et structure", "score": 90, "comment": "CV bien organisé..." },
      { "name": "Impact et réalisations", "score": 82, "comment": "..." },
      { "name": "Compétences", "score": 88, "comment": "..." },
      { "name": "Expérience professionnelle", "score": 85, "comment": "..." },
      { "name": "Formation", "score": 80, "comment": "..." },
      { "name": "Présentation et orthographe", "score": 92, "comment": "..." },
      { "name": "Adéquation au marché", "score": 90, "comment": "..." }
    ],
    "strengths": [
      "10 ans d'expérience en développement full-stack",
      "Progression de carrière claire",
      "Compétences techniques diversifiées et actuelles"
    ],
    "improvements": [
      "Quantifier davantage les réalisations avec des chiffres",
      "Ajouter un lien GitHub si disponible"
    ],
    "recommendation": "Excellent CV pour un poste de lead developer senior...",
    "seniorityLevel": "senior"
  },
  "outputFormat": "word",
  "downloadUrl": "/api/download?file=clxxxxxx1234567890abcdef_CV_jean_dupont.docx",
  "outputFileName": "CV_jean_dupont.docx",
  "extractedText": "Jean Dupont\nDéveloppeur Full-Stack Senior\n...",
  "durationMs": 18342,
  "extractionModel": "nvidia/nemotron-3-super-120b-a12b",
  "scoringModel": "nvidia/nemotron-3-super-120b-a12b"
}
```

#### Codes d'erreur possibles

| HTTP | Code interne | Cause |
|---|---|---|
| `400` | — | Corps de requête invalide, fichier manquant, ou `outputFormat` invalide |
| `413` | — | Fichier > 10 Mo |
| `415` | — | Type MIME non supporté |
| `503` | `NVIDIA_NOT_CONFIGURED` | Variable `NVIDIA_API_KEY` absente |
| `500` | `PROCESSING_ERROR` | Erreur pendant l'extraction, la conversion ou le scoring (message détaillé dans `error`) |

#### Explication détaillée du code

Le handler `POST` de `src/app/api/cv/process/route.ts` procède ainsi :

1. **Vérification de la clé API NVIDIA** (`isNvidiaConfigured()`) → renvoie 503 si absente.
2. **Lecture du corps `multipart/form-data`** via `request.formData()`. Si échec → 400.
3. **Extraction des champs** `file`, `outputFormat`, `language`.
4. **Validation du fichier** : présence et taille ≤ `MAX_FILE_SIZE` (10 Mo). Sinon → 400 ou 413.
5. **Résolution du `outputFormat`** : si `'powerpoint'`, on prend PowerPoint ; sinon, défaut `'word'`.
6. **Résolution du type MIME** via `resolveMimeType(fileName, file.type)` qui se base sur l'extension et le MIME déclaré. Validation via `isAcceptedMime`. Si non supporté → 415.
7. **Création du `CvRecord` en base** avec `status: 'extracting'` (le statut évoluera à chaque étape).
8. **Lecture du buffer** (`file.arrayBuffer()` puis `Buffer.from(...)`).
9. **Étape 1 — Extraction** : appel à `extractCvFromBuffer({ buffer, fileName, mimeType, language })`. Mise à jour du `CvRecord` avec `extractedText`, `structuredData`, `extractionModel`, `language`, `status: 'converting'`.
10. **Étape 2 — Conversion** : selon `outputFormat`, on appelle `generateWordCv({ parsedCv })` ou `generatePowerPointCv({ parsedCv })`. Le nom de fichier est calculé via `getWordFileName(fullName)` ou `getPowerPointFileName(fullName)`, puis préfixé par l'ID du `CvRecord` pour éviter les collisions. Écriture dans le dossier `/download`. Mise à jour : `outputName`, `filePath`, `status: 'scoring'`.
11. **Étape 3 — Scoring** : appel à `scoreCv({ parsedCv, language })`. Mise à jour : `score`, `scoreDetails`, `scoringModel`, `status: 'done'`, `durationMs`.
12. **Construction de la réponse** : un objet `CvProcessingResult` contenant `id`, `status`, `parsedCv`, `score`, `outputFormat`, `downloadUrl`, `outputFileName`, `extractedText`, `durationMs`, `extractionModel`, `scoringModel`.
13. **Gestion des erreurs** : si une étape échoue, le `CvRecord` est marqué `status: 'error'` avec `errorMessage`, et la route renvoie 500 avec le détail.

Le handler `GET` (méthode secondaire) renvoie simplement un résumé d'utilisation de la route (formats acceptés, taille max, champs attendus).

> ⚙️ La route déclare `export const runtime = 'nodejs'` (nécessaire pour Prisma, Buffer, fs) et `export const maxDuration = 120` (autorise jusqu'à 120 secondes de traitement, utile sur Vercel).

---

### 4.2. GET /api/cv/history

**Fichier** : `src/app/api/cv/history/route.ts`

Renvoie la liste des CV traités, du plus récent au plus ancien. Utile pour alimenter le panneau d'historique de l'interface.

#### Endpoint

```
GET /api/cv/history?limit=<int>&status=<string>
```

#### Paramètres d'entrée (query string)

| Paramètre | Type | Obligatoire | Défaut | Description |
|---|---|---|---|---|
| `limit` | `integer` | ❌ Non | `50` | Nombre maximum de résultats (plafonné à 200) |
| `status` | `string` | ❌ Non | — | Filtre par statut : `pending`, `extracting`, `converting`, `scoring`, `done`, `error` |

#### Exemple de requête

**Avec curl :**

```bash
# Tous les CV traités avec succès, 20 résultats max
curl "http://localhost:3000/api/cv/history?limit=20&status=done"
```

**Avec JavaScript :**

```typescript
const response = await fetch('/api/cv/history?limit=20&status=done');
const data = await response.json();
console.log(`${data.count} CV traités avec succès`);
data.items.forEach((item) => {
  console.log(`- ${item.originalName} → score ${item.score}`);
});
```

#### Exemple de réponse JSON (200 OK)

```json
{
  "items": [
    {
      "id": "clxxxxxx1234567890abcdef",
      "originalName": "cv_dupont.pdf",
      "sourceType": "application/pdf",
      "outputFormat": "word",
      "outputName": "CV_jean_dupont.docx",
      "status": "done",
      "score": 87,
      "language": "fr",
      "extractionModel": "nvidia/nemotron-3-super-120b-a12b",
      "scoringModel": "nvidia/nemotron-3-super-120b-a12b",
      "durationMs": 18342,
      "fileSize": 245678,
      "errorMessage": null,
      "downloadUrl": "/api/download?file=clxxxxxx1234567890abcdef_CV_jean_dupont.docx",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:18.000Z"
    }
  ],
  "count": 1
}
```

#### Codes d'erreur possibles

| HTTP | Cause |
|---|---|
| `500` | Erreur de base de données (rare) |

#### Explication détaillée du code

1. **Lecture des paramètres de requête** via `new URL(request.url).searchParams`.
2. **Parsing de `limit`** : on tente `parseInt(limitParam, 10)`. Si valide et positif, on le plafonne à 200. Sinon, défaut 50.
3. **Lecture de `status`** : si présent, on l'utilise comme filtre Prisma (`where: { status }`).
4. **Requête Prisma `findMany`** avec :
   - `orderBy: { createdAt: 'desc' }` (du plus récent au plus ancien),
   - `take: limit`,
   - `select: { ... }` — on sélectionne explicitement les champs (on n'envoie pas `structuredData`, `extractedText`, `scoreDetails` qui sont volumineux).
5. **Construction de la réponse** : pour chaque enregistrement, on remplace `filePath` par une `downloadUrl` construite (on ne暴露 jamais le chemin brut au client).
6. Renvoie `{ items, count }`.

> ℹ️ Le champ `filePath` est explicitement mis à `undefined` dans la réponse (sécurité : on ne souhaite pas exposer le système de fichiers interne).

---

### 4.3. GET /api/cv/history/[id]

**Fichier** : `src/app/api/cv/history/[id]/route.ts`

Récupère le **détail complet** d'un CV traité, y compris le `parsedCv` et le `scoreDetails` complets (désérialisés depuis leur forme JSON stockée en base).

#### Endpoint

```
GET /api/cv/history/<id>
```

#### Paramètres d'entrée (chemin)

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | `string` (CUID) | ✅ Oui | Identifiant du `CvRecord` |

#### Exemple de requête

**Avec curl :**

```bash
curl http://localhost:3000/api/cv/history/clxxxxxx1234567890abcdef
```

**Avec JavaScript :**

```typescript
const response = await fetch(`/api/cv/history/${id}`);
if (response.status === 404) {
  console.log('CV introuvable');
  return;
}
const detail = await response.json();
console.log('CV structuré :', detail.parsedCv);
console.log('Score :', detail.scoreDetails);
```

#### Exemple de réponse JSON (200 OK)

```json
{
  "id": "clxxxxxx1234567890abcdef",
  "originalName": "cv_dupont.pdf",
  "sourceType": "application/pdf",
  "outputFormat": "word",
  "outputName": "CV_jean_dupont.docx",
  "status": "done",
  "errorMessage": null,
  "extractedText": "Jean Dupont\nDéveloppeur Full-Stack Senior\n...",
  "parsedCv": {
    "personalInfo": { "fullName": "Jean Dupont", "email": "jean.dupont@example.com", "..." : "..." },
    "workExperience": [ "..." ],
    "education": [ "..." ],
    "skills": [ "..." ],
    "languages": [ "..." ],
    "detectedLanguage": "fr"
  },
  "score": 87,
  "scoreDetails": {
    "overallScore": 87,
    "categories": [ "..." ],
    "strengths": [ "..." ],
    "improvements": [ "..." ],
    "recommendation": "...",
    "seniorityLevel": "senior"
  },
  "language": "fr",
  "extractionModel": "nvidia/nemotron-3-super-120b-a12b",
  "scoringModel": "nvidia/nemotron-3-super-120b-a12b",
  "durationMs": 18342,
  "fileSize": 245678,
  "downloadUrl": "/api/download?file=clxxxxxx1234567890abcdef_CV_jean_dupont.docx",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:18.000Z"
}
```

#### Codes d'erreur possibles

| HTTP | Cause |
|---|---|
| `404` | Aucun `CvRecord` trouvé avec cet `id` |
| `500` | Erreur de base de données |

#### Explication détaillée du code

1. **Récupération de l'`id`** depuis les paramètres dynamiques Next.js : `const { id } = await params` (note : dans Next.js 16 App Router, `params` est une `Promise`).
2. **Requête Prisma `findUnique({ where: { id } })`**.
3. Si aucun enregistrement → 404.
4. **Désérialisation** des champs JSON stockés en texte :
   - `record.structuredData` → `parsedCv` (avec `try/catch` silent en cas de JSON corrompu),
   - `record.scoreDetails` → `scoreDetails` (idem).
5. **Construction de la réponse** : on renvoie tous les champs utiles, y compris `parsedCv` et `scoreDetails` complets. On construit la `downloadUrl` à partir de `filePath` (si présent).
6. Renvoie l'objet JSON complet.

---

### 4.4. DELETE /api/cv/history/[id]

**Fichier** : `src/app/api/cv/history/[id]/route.ts`

Supprime un `CvRecord` **et** son fichier généré sur le disque.

#### Endpoint

```
DELETE /api/cv/history/<id>
```

#### Paramètres d'entrée (chemin)

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | `string` (CUID) | ✅ Oui | Identifiant du `CvRecord` à supprimer |

#### Exemple de requête

**Avec curl :**

```bash
curl -X DELETE http://localhost:3000/api/cv/history/clxxxxxx1234567890abcdef
```

**Avec JavaScript :**

```typescript
const response = await fetch(`/api/cv/history/${id}`, { method: 'DELETE' });
const data = await response.json();
if (data.success) {
  console.log('CV supprimé avec succès');
}
```

#### Exemple de réponse JSON (200 OK)

```json
{
  "success": true,
  "id": "clxxxxxx1234567890abcdef"
}
```

#### Codes d'erreur possibles

| HTTP | Cause |
|---|---|
| `404` | Aucun `CvRecord` trouvé avec cet `id` |
| `500` | Erreur de base de données |

#### Explication détaillée du code

1. **Récupération de l'`id`** (comme pour le GET).
2. **Recherche du `CvRecord`**. Si introuvable → 404.
3. **Suppression du fichier généré** si `record.filePath` est présent :
   - Calcul du chemin complet : `path.join(DOWNLOAD_DIR, record.filePath)`.
   - Appel `fs.unlink(fullPath)` dans un `try/catch` (le fichier peut déjà avoir été supprimé manuellement, on ignore l'erreur).
4. **Suppression de l'enregistrement en base** via `db.cvRecord.delete({ where: { id } })`.
5. Renvoie `{ success: true, id }`.

> 💡 Cette route est **idempotente** côté fichier : si le fichier physique n'existe plus, la suppression de l'enregistrement se fait quand même.

---

### 4.5. POST /api/nvidia/extract

**Fichier** : `src/app/api/nvidia/extract/route.ts`

Route utilitaire qui exécute **uniquement l'étape d'extraction** (sans conversion ni scoring). Utile pour tester l'extraction indépendamment, ou pour récupérer un `ParsedCv` à scorer ailleurs.

#### Endpoint

```
POST /api/nvidia/extract
Content-Type: multipart/form-data
```

#### Paramètres d'entrée (FormData)

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `file` | `File` (binaire) | ✅ Oui | Le fichier du CV (PDF ou image). Taille max : 10 Mo. |
| `language` | `string` | ❌ Non | Langue souhaitée pour les résumés rédigés |

#### Exemple de requête

**Avec curl :**

```bash
curl -X POST http://localhost:3000/api/nvidia/extract \
  -F "file=@./cv.png" \
  -F "language=français"
```

**Avec JavaScript :**

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('language', 'français');

const response = await fetch('/api/nvidia/extract', {
  method: 'POST',
  body: formData,
});
const data = await response.json();
console.log('CV extrait :', data.parsedCv);
console.log('Méthode utilisée :', data.method);
console.log('Modèle :', data.modelUsed);
```

#### Exemple de réponse JSON (200 OK)

```json
{
  "parsedCv": {
    "personalInfo": {
      "fullName": "Marie Martin",
      "email": "marie.martin@example.com",
      "phone": "+33 6 98 76 54 32",
      "title": "Chef de produit"
    },
    "workExperience": [ "..." ],
    "education": [ "..." ],
    "skills": [ "..." ],
    "languages": [ "..." ],
    "detectedLanguage": "fr"
  },
  "method": "image-omni",
  "modelUsed": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "rawTextLength": 64,
  "durationMs": 8421
}
```

#### Codes d'erreur possibles

| HTTP | Cause |
|---|---|
| `400` | Fichier `file` manquant |
| `413` | Fichier > 10 Mo |
| `415` | Type MIME non supporté |
| `503` | `NVIDIA_API_KEY` non configurée (`code: NVIDIA_NOT_CONFIGURED`) |
| `500` | Erreur pendant l'extraction (PDF scanné, modèle injoignable, JSON invalide…) |

#### Explication détaillée du code

1. **Vérification** `isNvidiaConfigured()` → 503 si non configurée.
2. **Lecture du `FormData`** via `request.formData()`.
3. **Extraction des champs** `file` et `language`.
4. **Validation du fichier** : présent et ≤ 10 Mo.
5. **Résolution et validation du type MIME** via `resolveMimeType` + `isSupportedImage` (ou `application/pdf`).
6. **Mesure du temps** (`startTime = Date.now()`).
7. **Conversion en `Buffer`** (`file.arrayBuffer()` → `Buffer.from(...)`).
8. **Appel à `extractCvFromBuffer`** (cf. section 5 pour le détail).
9. **Réponse** : on renvoie `parsedCv`, `method`, `modelUsed`, `rawTextLength`, `durationMs`.
10. **Gestion d'erreur** : catch global → 500 avec message détaillé.

> ⚙️ `maxDuration = 90` secondes autorisé pour cette route (le modèle omni peut prendre un peu de temps sur une image complexe).

---

### 4.6. POST /api/nvidia/score

**Fichier** : `src/app/api/nvidia/score/route.ts`

Route utilitaire qui exécute **uniquement l'étape de scoring** sur un `ParsedCv` déjà extrait et fourni en JSON.

#### Endpoint

```
POST /api/nvidia/score
Content-Type: application/json
```

#### Paramètres d'entrée (body JSON)

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `parsedCv` | `ParsedCv` (objet) | ✅ Oui | Le CV structuré, doit contenir au minimum `personalInfo` |
| `language` | `string` | ❌ Non | Langue souhaitée pour les commentaires |

#### Exemple de requête

**Avec curl :**

```bash
curl -X POST http://localhost:3000/api/nvidia/score \
  -H "Content-Type: application/json" \
  -d '{
    "language": "français",
    "parsedCv": {
      "personalInfo": { "fullName": "Jean Dupont", "title": "Développeur" },
      "workExperience": [ { "title": "Dev", "company": "X", "startDate": "2020", "endDate": "présent", "description": "..." } ],
      "education": [],
      "skills": [ { "name": "TypeScript" } ],
      "languages": [ { "name": "Français", "level": "natif" } ]
    }
  }'
```

**Avec JavaScript :**

```typescript
const response = await fetch('/api/nvidia/score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    parsedCv: parsedCvObject,
    language: 'français',
  }),
});
const data = await response.json();
console.log('Score global :', data.score.overallScore);
console.log('Catégories :', data.score.categories);
```

#### Exemple de réponse JSON (200 OK)

```json
{
  "score": {
    "overallScore": 72,
    "categories": [
      { "name": "Clarté et structure", "score": 80, "comment": "CV lisible et bien découpé." },
      { "name": "Impact et réalisations", "score": 60, "comment": "Manque de chiffres et de résultats quantifiés." },
      { "name": "Compétences", "score": 75, "comment": "Bonnes compétences techniques." },
      { "name": "Expérience professionnelle", "score": 70, "comment": "Expérience correcte mais courte." },
      { "name": "Formation", "score": 65, "comment": "Formation non renseignée." },
      { "name": "Présentation et orthographe", "score": 85, "comment": "Aucune faute détectée." },
      { "name": "Adéquation au marché", "score": 70, "comment": "Profil recherché sur le marché actuel." }
    ],
    "strengths": [ "Compétences techniques pertinentes", "CV lisible" ],
    "improvements": [ "Quantifier les réalisations", "Ajouter la section formation" ],
    "recommendation": "Bon CV avec des bases solides, quelques améliorations à apporter.",
    "seniorityLevel": "confirmé"
  },
  "modelUsed": "nvidia/nemotron-3-super-120b-a12b",
  "durationMs": 6234
}
```

#### Codes d'erreur possibles

| HTTP | Cause |
|---|---|
| `400` | Corps JSON invalide, ou `parsedCv` manquant/incomplet |
| `503` | `NVIDIA_API_KEY` non configurée |
| `500` | Erreur pendant le scoring (modèle injoignable, JSON invalide…) |

#### Explication détaillée du code

1. **Vérification** `isNvidiaConfigured()` → 503 si non configurée.
2. **Parsing du corps JSON** via `request.json()`. Si échec → 400.
3. **Validation** : `body.parsedCv` doit être présent et contenir au moins `personalInfo`. Sinon → 400.
4. **Appel à `scoreCv({ parsedCv, language })`** (cf. section 6 pour le détail).
5. **Réponse** : `{ score, modelUsed, durationMs }`.
6. **Gestion d'erreur** : catch global → 500 avec message détaillé.

> ⚙️ `maxDuration = 90` secondes. Le scoring prend généralement 3 à 10 secondes.

---

### 4.7. GET /api/download

**Fichier** : `src/app/api/download/route.ts`

Sert un fichier généré (Word ou PowerPoint) depuis le dossier `/download`. Protège contre la traversée de répertoire (path traversal).

#### Endpoint

```
GET /api/download?file=<filename>
```

#### Paramètres d'entrée (query string)

| Paramètre | Type | Obligatoire | Description |
|---|---|---|---|
| `file` | `string` | ✅ Oui | Nom du fichier dans le dossier `/download` (généralement préfixé par l'ID du `CvRecord`) |

#### Exemple de requête

**Avec curl :**

```bash
# Télécharge le fichier en local
curl -OJ "http://localhost:3000/api/download?file=clxxxxxx1234567890abcdef_CV_jean_dupont.docx"
```

**Avec JavaScript (téléchargement côté navigateur) :**

```typescript
const downloadUrl = '/api/download?file=clxxxxxx1234567890abcdef_CV_jean_dupont.docx';
const a = document.createElement('a');
a.href = downloadUrl;
a.download = 'CV_jean_dupont.docx';  // nom proposé au navigateur
document.body.appendChild(a);
a.click();
a.remove();
```

#### Exemple de réponse

**200 OK** — corps binaire (le fichier lui-même) avec les en-têtes :

```text
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Length: 48230
Content-Disposition: attachment; filename="CV_jean_dupont.docx"
Cache-Control: private, no-cache
```

Le nom affiché (`Content-Disposition`) est **nettoyé du préfixe d'ID** : si le fichier sur disque s'appelle `clxxxxxx1234567890abcdef_CV_jean_dupont.docx`, le navigateur proposera `CV_jean_dupont.docx`.

#### Codes d'erreur possibles

| HTTP | Cause |
|---|---|
| `400` | Paramètre `file` manquant, ou chemin invalide (tentative de traversée) |
| `404` | Fichier introuvable sur le disque |
| `500` | Erreur de lecture |

#### Explication détaillée du code

1. **Lecture du paramètre `file`** depuis `searchParams`. Si absent → 400.
2. **Sécurité — protection contre la traversée de répertoire** :
   - Calcul de `resolved = path.resolve(DOWNLOAD_DIR, file)`.
   - Vérification que `resolved` commence bien par `DOWNLOAD_DIR + path.sep` (ou est exactement le basename). Sinon → 400.
3. **Calcul du nom sécurisé** : `path.basename(file)` — on ne garde que le nom, en ignorant tout préfixe de dossier.
4. **Vérification de l'existence** via `fs.stat(fullPath)`. Si introuvable → 404. Si ce n'est pas un fichier → 400.
5. **Lecture du fichier** : `fs.readFile(fullPath)`.
6. **Détermination du `Content-Type`** :
   - `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - `.pptx` → `application/vnd.openxmlformats-officedocument.presentationml.presentation`
   - autre → `application/octet-stream`
7. **Nettoyage du nom d'affichage** : on retire le préfixe d'ID via regex `/^[^_]+_(.+)$/`.
8. **Construction de la réponse** avec les headers `Content-Type`, `Content-Length`, `Content-Disposition: attachment; filename="..."`, `Cache-Control: private, no-cache`.

---

### 4.8. GET /api/status

**Fichier** : `src/app/api/status/route.ts`

Renvoie l'état de santé du service : configuration NVIDIA, modèles disponibles, état de la base de données, nombre de CV traités. À utiliser pour les health checks et le débogage.

#### Endpoint

```
GET /api/status
```

#### Paramètres d'entrée

Aucun.

#### Exemple de requête

**Avec curl :**

```bash
curl http://localhost:3000/api/status | jq
```

**Avec JavaScript :**

```typescript
const response = await fetch('/api/status');
const status = await response.json();
if (!status.nvidiaConfigured) {
  console.error('⚠️ NVIDIA non configuré');
}
if (!status.database) {
  console.error('⚠️ Base de données inaccessible');
}
console.log(`${status.cvCount} CV traités au total`);
```

#### Exemple de réponse JSON (200 OK)

```json
{
  "nvidiaConfigured": true,
  "models": [
    {
      "id": "nvidia/nemotron-3-super-120b-a12b",
      "name": "Nemotron-3-Super-120B",
      "type": "text",
      "description": "Modèle de langage texte NVIDIA (120B params, 12B actifs). Utilisé pour structurer le texte d'un CV en JSON normalisé et pour le scoring."
    },
    {
      "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      "name": "Nemotron-3-Nano-Omni-30B",
      "type": "omni",
      "description": "Modèle omni/multimodal NVIDIA (30B params, 3B actifs). Utilisé pour lire visuellement les images (JPG/PNG) et les PDF rendus en image."
    }
  ],
  "database": true,
  "cvCount": 12,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### Codes d'erreur possibles

| HTTP | Cause |
|---|---|
| (jamais d'erreur HTTP) | Cette route renvoie toujours 200, même si NVIDIA ou la BDD est KO (les champs booléens l'indiquent) |

#### Explication détaillée du code

1. **Test de la base de données** : appel `db.cvRecord.count()` dans un `try/catch`. Si ça échoue, `databaseOk = false`. Sinon, `cvCount` contient le nombre total de CV traités.
2. **Lecture de la configuration NVIDIA** via `isNvidiaConfigured()` (vérifie la présence de `process.env.NVIDIA_API_KEY`).
3. **Liste des modèles** depuis le registre `NVIDIA_MODELS` (exporté par `src/lib/nvidia/models.ts`).
4. **Horodatage** ISO 8601.
5. Renvoie le tout en JSON avec un statut 200 (jamais d'erreur HTTP, pour faciliter les health checks).

---

## 5. Comment l'extraction fonctionne

L'extraction est orchestrée par la fonction `extractCvFromBuffer` dans `src/lib/parsers/cv-extractor.ts`. C'est elle qui est appelée par `POST /api/cv/process` et `POST /api/nvidia/extract`.

### Schéma de décision

```text
extractCvFromBuffer({ buffer, fileName, mimeType, language })
                       │
                       ▼
        ┌────────────────────────────────┐
        │  isNvidiaConfigured() ?        │
        │  Si non → throw Error          │
        └────────────────┬───────────────┘
                         │
                         ▼
                buildExtractionPrompt(language)
                → { system, user }
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
   mimeType === 'application/pdf'   mimeType = image/*
              │                     │
              ▼                     ▼
        parsePdf(buffer)        detectImageMimeType(buffer)
        (pdf-parse v2)          → effectiveMime
              │                     │
              ▼                     ▼
        text vide ?             isSupportedImage ?
        → throw « PDF scanné »  → sinon throw « non supporté »
              │                     │
              ▼                     ▼
        callNvidiaTextModel(    normalize image/jpg → image/jpeg
          SUPER_MODEL_ID,       bufferToBase64(buffer)
          system, user + text   callNvidiaOmniModel(
        )                         OMNI_MODEL_ID,
              │                     system,
              ▼                     user,
        extractJsonFromResponse   imageBase64,
        validateParsedCvShape     imageMimeType
        )                       )
              │                     │
              └──────────┬──────────┘
                         ▼
                  ExtractionResult {
                    parsedCv,
                    rawText,
                    method: 'pdf-text' | 'image-omni',
                    modelUsed
                  }
```

### Détail des étapes

1. **Vérification préalable** — `isNvidiaConfigured()` : on lit `process.env.NVIDIA_API_KEY`. Si absente, on lève une erreur explicite.
2. **Construction des prompts** — `buildExtractionPrompt(language)` (cf. `src/lib/nvidia/prompts.ts`) renvoie deux chaînes : un prompt système (rôle du modèle, règles strictes, schéma JSON attendu) et un prompt utilisateur (instructions + emplacement pour le contenu).
3. **Cas PDF** (`mimeType === 'application/pdf'`) :
   - `parsePdf(buffer)` (cf. `src/lib/parsers/pdf-parser.ts`) utilise la bibliothèque `pdf-parse` v2. On vérifie d'abord le magic number `%PDF-`, on instancie `new PDFParse({ data: buffer })`, on appelle `getText()` pour récupérer tout le texte concaténé, puis `getInfo()` en best-effort pour les métadonnées. Le parser est détruit dans un `finally`.
   - Si le texte est **vide**, on lève une erreur claire : « Le PDF semble être scanné ».
   - On envoie le texte au modèle **Super** (`callNvidiaTextModel`) avec un prompt construit en concaténant `user` + le texte PDF délimité par des marqueurs `----- DÉBUT/FIN DU TEXTE EXTRAIT DU PDF -----`.
   - La réponse est passée à `extractJsonFromResponse` qui gère les cas JSON pur, fences markdown, et JSON noyé dans du texte.
   - On valide la forme via `validateParsedCvShape` (clés obligatoires `personalInfo`, `workExperience`, `education`, `skills`, `languages` + `personalInfo.fullName`).
   - Méthode : `'pdf-text'`. Modèle : `SUPER_MODEL_ID`.
4. **Cas image** (PNG, JPEG, WebP, GIF) :
   - On détecte le vrai type MIME via `detectImageMimeType(buffer)` qui lit les magic bytes (`\x89PNG`, `\xFF\xD8\xFF`, `GIF8`, `RIFF....WEBP`). Ce MIME détecté est prioritaire sur le MIME déclaré par le client (souvent erroné).
   - On normalise `image/jpg` en `image/jpeg`.
   - On encode en base64 avec `bufferToBase64(buffer)`.
   - On appelle le modèle **omni** via `callNvidiaOmniModel` qui construit une data URL `data:<mime>;base64,<...>` et l'envoie comme `image_url` dans le contenu utilisateur (format vision OpenAI).
   - Extraction JSON + validation, comme pour le PDF.
   - Méthode : `'image-omni'`. Modèle : `OMNI_MODEL_ID`. Le `rawText` est une description synthétique (`[Image fournie — ...]`).

### Schéma JSON attendu (ParsedCv)

Le modèle doit renvoyer strictement un JSON conforme à l'interface `ParsedCv` :

```typescript
interface ParsedCv {
  personalInfo: {
    fullName: string;        // obligatoire
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    title?: string;
    summary?: string;
  };
  workExperience: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate: string;        // "présent" si en cours
    description: string;
    location?: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    startDate: string;
    endDate: string;
    field?: string;
    description?: string;
  }>;
  skills: Array<{
    name: string;
    level?: string;         // 'débutant' | 'intermédiaire' | 'avancé' | 'expert'
    category?: string;      // 'technique' | 'linguistique' | 'logiciel' | 'soft skill' | 'autre'
  }>;
  languages: Array<{        // langues humaines uniquement, pas les langages de programmation
    name: string;
    level?: string;         // A1|A2|B1|B2|C1|C2|natif|courant|professionnel
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    url?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
  interests?: string[];
  references?: Array<{
    name: string;
    contact?: string;
    relationship?: string;
  }>;
  detectedLanguage?: string;  // code ISO 639-1 : 'fr', 'en', 'es', ...
}
```

---

## 6. Comment le scoring fonctionne

Le scoring est orchestré par la fonction `scoreCv` dans `src/lib/cv/scoring.ts`, appelée par `POST /api/cv/process` et `POST /api/nvidia/score`.

### Étapes du scoring

1. **Vérification** `isNvidiaConfigured()` → erreur si non configurée.
2. **Sérialisation du `ParsedCv`** en JSON indenté (`JSON.stringify(parsedCv, null, 2)`) — l'indentation aide le modèle à lire le contenu.
3. **Construction des prompts** via `buildScoringPrompt(language)` (cf. `src/lib/nvidia/prompts.ts`). Le prompt système :
   - fixe le rôle : « Tu es un recruteur senior et expert en ressources humaines »,
   - impose **7 catégories** avec leurs noms exacts et leurs définitions,
   - donne un barème indicatif (0-39 faible, 40-59 moyen, 60-74 bon, 75-89 très bon, 90-100 excellent),
   - suggère des pondérations (Clarté 15%, Impact 20%, Compétences 15%, Expérience 25%, Formation 10%, Présentation 10%, Adéquation 5%),
   - exige un JSON strict conforme à l'interface `CvScore`.
4. **Appel au modèle Super** via `callNvidiaTextModel({ systemPrompt, userPrompt, modelId: SUPER_MODEL_ID })`.
5. **Extraction du JSON** via `extractJsonFromResponse`.
6. **Validation** via `validateCvScoreShape` (clés obligatoires : `overallScore`, `categories`, `strengths`, `improvements`, `recommendation`, `seniorityLevel` ; vérification des types).
7. **Bornage défensif** du `overallScore` dans `[0, 100]` via `Math.max(0, Math.min(100, Math.round(...)))`.
8. **Retour** : `{ score, modelUsed: SUPER_MODEL_ID }`.

### Les 7 catégories de scoring

| # | Nom exact | Critères évalués |
|---|---|---|
| 1 | **Clarté et structure** | Lisibilité, organisation des sections, hiérarchie visuelle, cohérence du format |
| 2 | **Impact et réalisations** | Résultats quantifiés, verbes d'action, indicateurs de performance, valeur ajoutée démontrée |
| 3 | **Compétences** | Pertinence et richesse des compétences techniques et transversales, alignment avec le poste visé |
| 4 | **Expérience professionnelle** | Progression de carrière, durée des postes, diversité des missions, niveau de responsabilité |
| 5 | **Formation** | Pertinence du parcours académique, certifications complémentaires, formation continue |
| 6 | **Présentation et orthographe** | Qualité rédactionnelle, orthographe, grammaire, ponctuation, longueur des phrases |
| 7 | **Adéquation au marché** | Adéquation du profil avec les attentes actuelles du marché de l'emploi |

### Schéma JSON attendu (CvScore)

```typescript
interface CvScore {
  overallScore: number;        // 0-100, moyenne pondérée des catégories
  categories: Array<{
    name: string;              // nom EXACT parmi les 7 imposés
    score: number;             // 0-100
    comment: string;           // 1 à 3 phrases, dans la langue demandée
  }>;
  strengths: string[];         // 3 à 6 éléments concrets
  improvements: string[];      // 3 à 6 axes d'amélioration concrets
  recommendation: string;      // 2 à 4 phrases, recommandation globale
  seniorityLevel: string;      // 'débutant' | 'intermédiaire' | 'confirmé' | 'senior' | 'lead' | 'expert'
}
```

### Libellés de score (`getScoreLabel`)

Cette fonction utilitaire convertit un score global en libellé qualitatif, couleur CSS et emoji :

| Score | Libellé | Couleur | Emoji |
|---|---|---|---|
| 85-100 | Excellent | `#16a34a` (vert) | 🌟 |
| 70-84 | Très bon | `#10b981` (émeraude) | ✅ |
| 55-69 | Correct | `#f59e0b` (ambre) | ⚠️ |
| 40-54 | À améliorer | `#f97316` (orange) | 🔧 |
| 0-39 | Insuffisant | `#dc2626` (rouge) | ❌ |

> 💡 Cette fonction est **bornée défensivement** : tout score hors `[0, 100]` est ramené dans cet intervalle avant la détermination du libellé.

---

## 7. Comment les convertisseurs fonctionnent

Deux convertisseurs transforment un `ParsedCv` en fichier binaire téléchargeable.

### 7.1. Convertisseur Word (`src/lib/converters/word-converter.ts`)

**Fonction principale** : `generateWordCv({ parsedCv, score? }) → Promise<Buffer>`

Utilise la bibliothèque `docx` (v9.7.1) qui produit un fichier `.docx` (format OOXML, ZIP contenant du XML).

**Structure du document généré :**

1. **En-tête** — bande grise claire (`f8fafc`) contenant :
   - le nom complet en 24 pt gras,
   - le titre professionnel en italique gris (`6b7280`),
   - un badge score optionnel (« Score CV : NN/100 »),
   - une ligne de contacts (email • phone • location • website • linkedin) en gris 10 pt.
2. **Section Profil** — si `summary` est non vide, paragraphe justifié.
3. **Section Expérience** — pour chaque poste :
   - ligne 1 : « Intitulé — Entreprise » en gras,
   - ligne 2 : « dates • localisation » en italique gris,
   - un paragraphe justifié par ligne de description (découpées par `\n`).
4. **Section Formation** — diplôme en gras, institution, dates et spécialité en italique gris.
5. **Section Compétences** — regroupement par `category` via `Map`, tri alphabétique avec « Autres » en dernier.
6. **Section Langues** — liste en ligne « Nom — niveau ».
7. **Section Projets** — nom en gras + URL cliquable (`ExternalHyperlink`).
8. **Section Certifications** — nom en gras + « — émetteur, date » en gris.
9. **Section Centres d'intérêt** — liste séparée par virgules.

**Styles clés :**
- accent émeraude `10b981` pour les titres de section et la bordure divider,
- texte `111827`, métadonnées `6b7280`, liens `2563eb`,
- marges 1 pouce (1440 twips),
- tailles en demi-points (24 pt = 48 unités).

**Localisation :** libellés FR/EN selon `parsedCv.detectedLanguage.startsWith('en')`.

**Fonction utilitaire :** `getWordFileName(fullName)` normalise le nom en `CV_<prenom>_<nom>.docx` (suppression des diacritiques via NFD, remplacement des non-alphanumériques par `_`, lower-case). Fallback : `CV_candidat.docx`.

### 7.2. Convertisseur PowerPoint (`src/lib/converters/powerpoint-converter.ts`)

**Fonction principale** : `generatePowerPointCv({ parsedCv, score? }) → Promise<Buffer>`

Utilise `pptxgenjs` (v4.0.1). Layout `LAYOUT_WIDE` (13.33″ × 7.5″, format 16:9).

**Structure de la présentation :**

1. **Diapo 1 — Couverture** — fond sombre `1F2937`, bande d'accent émeraude en haut, badge score optionnel en haut à droite, nom 44 pt blanc centré, titre pro 22 pt italique `D1FAE5`, ligne de contacts en bas.
2. **Diapo 2 — Profil** (omise si `summary` vide) — fond clair `F9FAFB`, titre « Profil », bloc de résumé avec `lineSpacingMultiple: 1.25`, barre de stats (années d'expérience, nb compétences, nb langues).
3. **Diapos 3+ — Expérience** — `chunk(experiences, 3)` → 1 diapo par lot de 3 max. Sous-titre `i / total` si > 1 diapo. Chaque expérience : intitulé gras accent 17 pt, méta italique gris, description en puces `•` (U+2022).
4. **Diapo Formation** — diplôme gras accent, institution et dates en italique gris, description tronquée à 240 caractères.
5. **Diapo Compétences & Langues** — deux colonnes : gauche compétences par catégorie, droite langues « Nom — niveau ».
6. **Diapo Projets & Certifications** — deux colonnes : projets avec URL en hyperlien cliquable, certifications avec émetteur et date.
7. **Diapo finale — Merci** — fond sombre, « Merci » 54 pt blanc centré, nom du candidat, ligne de contacts.

**Sections vides systématiquement omises** (pas de diapo orpheline), sauf la diapo Merci toujours présente.

**Couleurs :** accent émeraude `10B981`, texte `1F2937`, muted `6B7280`, accent clair `D1FAE5`, fond clair `F9FAFB`, fond sombre `1F2937`, blanc `FFFFFF`, blanc muted `CBD5E1`.

**Fonction utilitaire :** `getPowerPointFileName(fullName)` → `CV_<prenom>_<nom>.pptx` (mêmes règles de normalisation que Word).

**Estimation des années d'expérience :** `estimateYearsOfExperience` extrait les années 19xx/20xx dans `startDate`/`endDate` (regex `\b(19|20)\d{2}\b`), traite « présent/current/now/aujourd » comme année courante. Fallback sur le nombre d'expériences si < 2 dates distinctes.

**Normalisation défensive du retour `pptx.write({ outputType: 'nodebuffer' })`** : bien que pptxgenjs retourne un `Buffer` en Node, le type déclaré est plus large. On gère tous les cas avec `Buffer.isBuffer` / `Buffer.from`.

---

## 8. Comment ajouter une nouvelle route API

Voici la marche à suivre, **étape par étape**, pour ajouter une nouvelle route API au projet.

### Étape 1 — Créer le dossier et le fichier `route.ts`

Dans Next.js 16 App Router, chaque route API est un fichier `route.ts` dans un dossier correspondant au chemin de la route.

```bash
mkdir -p src/app/api/ma-route
touch src/app/api/ma-route/route.ts
```

> Si la route a un paramètre dynamique (ex: `/api/ma-route/[id]`), créez le dossier `src/app/api/ma-route/[id]/` et le fichier `route.ts` à l'intérieur.

### Étape 2 — Exporter les fonctions de handler

Next.js reconnaît les handlers par leurs noms : `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. Chaque handler est une fonction `async` qui reçoit un `NextRequest` (et optionnellement un `context` avec `params` pour les routes dynamiques) et renvoie un `NextResponse`.

### Étape 3 — Exemple complet

Voici un exemple complet d'une nouvelle route `POST /api/ma-route` qui accepte du JSON et renvoie un résultat :

```typescript
// src/app/api/ma-route/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';           // obligatoire si vous utilisez Prisma, Buffer, fs…
export const maxDuration = 60;              // secondes (utile sur Vercel)

/**
 * POST /api/ma-route
 * Corps attendu : { "name": string, "value": number }
 */
export async function POST(request: NextRequest) {
  // 1. Lire et valider le corps JSON
  let body: { name?: string; value?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps JSON invalide.' },
      { status: 400 }
    );
  }

  if (!body.name || typeof body.value !== 'number') {
    return NextResponse.json(
      { error: "Champs 'name' (string) et 'value' (number) requis." },
      { status: 400 }
    );
  }

  // 2. Traitement métier (appelez ici vos fonctions de src/lib/...)
  const result = {
    name: body.name.toUpperCase(),
    doubled: body.value * 2,
    timestamp: new Date().toISOString(),
  };

  // 3. Renvoyer la réponse JSON
  return NextResponse.json(result);
}

/**
 * GET /api/ma-route — résumé d'utilisation.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/ma-route',
    description: 'Exemple de route API.',
    fields: {
      name: 'string (requis)',
      value: 'number (requis)',
    },
  });
}
```

### Étape 4 — Gérer les paramètres dynamiques (routes `[id]`)

Pour une route `/api/ma-route/[id]`, on récupère l'id depuis le paramètre `params` (qui est une `Promise` dans Next.js 16) :

```typescript
// src/app/api/ma-route/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const record = await db.cvRecord.findUnique({ where: { id } });
  if (!record) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await db.cvRecord.delete({ where: { id } });
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }
}
```

### Étape 5 — Tester

Une fois le fichier créé, démarrez le serveur (`bun run dev`) et testez avec curl :

```bash
curl http://localhost:3000/api/ma-route
curl -X POST http://localhost:3000/api/ma-route \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": 21}'
```

### Bonnes pratiques

- ✅ Toujours déclarer `export const runtime = 'nodejs'` si la route utilise Prisma, Buffer, fs, pdf-parse, etc.
- ✅ Toujours valider les entrées et renvoyer un 400 clair en cas d'erreur de validation.
- ✅ Toujours catcher les erreurs inattendues et renvoyer un 500 avec un message explicite.
- ✅ Utiliser `NextResponse.json()` pour les réponses JSON et `new NextResponse(buffer, {...})` pour les réponses binaires.
- ✅ Mettre des JSDoc en français sur les handlers et fonctions utilitaires.
- ❌ Ne jamais exposer `process.env` ou des chemins absolus dans la réponse.
- ❌ Ne jamais faire confiance au type MIME déclaré par le client (toujours vérifier avec magic bytes ou extension).

---

## 9. Comment appeler les APIs depuis le frontend

L'application fournit déjà deux hooks React (`src/hooks/use-cv-processing.ts` et `src/hooks/use-cv-history.ts`) qui encapsulent les appels aux routes API. Voici des exemples réutilisables.

### 9.1. Appel au pipeline complet (`POST /api/cv/process`)

```typescript
async function processCv(file: File, outputFormat: 'word' | 'powerpoint', language?: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('outputFormat', outputFormat);
  if (language) formData.append('language', language);

  const response = await fetch('/api/cv/process', {
    method: 'POST',
    body: formData,
    // NE PAS définir Content-Type : le navigateur le fait automatiquement avec le boundary multipart
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors du traitement.');
  }

  return response.json();
}

// Utilisation :
try {
  const result = await processCv(file, 'word', 'français');
  console.log('Score :', result.score.overallScore);
  console.log('Téléchargement :', result.downloadUrl);
} catch (error) {
  console.error(error);
  // Afficher un toast d'erreur à l'utilisateur
}
```

### 9.2. Lister l'historique (`GET /api/cv/history`)

```typescript
async function fetchHistory(limit = 50, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.append('status', status);

  const response = await fetch(`/api/cv/history?${params}`);
  if (!response.ok) throw new Error('Erreur lors du chargement de l\'historique.');

  const data = await response.json();
  return data.items;  // tableau de résumés de CvRecord
}
```

### 9.3. Récupérer le détail d'un CV (`GET /api/cv/history/[id]`)

```typescript
async function fetchCvDetail(id: string) {
  const response = await fetch(`/api/cv/history/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Erreur lors du chargement du CV.');
  return response.json();
}
```

### 9.4. Supprimer un CV (`DELETE /api/cv/history/[id]`)

```typescript
async function deleteCv(id: string) {
  const response = await fetch(`/api/cv/history/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Erreur lors de la suppression.');
  return response.json();
}
```

### 9.5. Télécharger un fichier généré (`GET /api/download`)

```typescript
function downloadGeneratedFile(downloadUrl: string, fallbackName: string) {
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fallbackName;  // nom proposé si le navigateur ne lit pas le Content-Disposition
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Utilisation :
downloadGeneratedFile(result.downloadUrl, result.outputFileName);
```

### 9.6. Vérifier le statut du service (`GET /api/status`)

```typescript
async function checkStatus() {
  const response = await fetch('/api/status');
  const status = await response.json();
  return {
    nvidiaOk: status.nvidiaConfigured,
    databaseOk: status.database,
    cvCount: status.cvCount,
  };
}
```

### Gestion d'erreur générique

```typescript
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `Erreur HTTP ${response.status}`;
    try {
      const error = await response.json();
      message = error.error || message;
    } catch {
      // Réponse non JSON, on garde le message par défaut
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// Utilisation :
try {
  const result = await apiCall<CvProcessingResult>('/api/cv/process', {
    method: 'POST',
    body: formData,
  });
} catch (error) {
  showToast(error.message);
}
```

---

## 10. Sécurité

La sécurité a été pensée à plusieurs niveaux dans les routes API.

### 10.1. Validation des entrées

Toutes les routes valident les entrées avant tout traitement :

- **`POST /api/cv/process` et `POST /api/nvidia/extract`** :
  - Vérifient la présence du champ `file`.
  - Vérifient que `file` est bien une instance de `File` (et non une chaîne ou un tableau).
  - Vérifient la taille (`file.size > MAX_FILE_SIZE` → 413).
  - Valident le type MIME via `resolveMimeType` + `isAcceptedMime` (comparaison avec la liste blanche).
- **`POST /api/nvidia/score`** : valide que `body.parsedCv` est présent et contient `personalInfo`.
- **`GET /api/cv/history`** : plafonne `limit` à 200 et ignore les valeurs non numériques.
- **`GET /api/download`** : valide la présence de `file` et son chemin (cf. 10.3).

### 10.2. Limite de taille des fichiers

La constante `MAX_FILE_SIZE = 10 * 1024 * 1024` (10 Mo) est appliquée dans :

- `src/app/api/cv/process/route.ts`
- `src/app/api/nvidia/extract/route.ts`

Au-delà, la route renvoie `413 Payload Too Large` avec un message explicite.

### 10.3. Prévention de la traversée de répertoire (path traversal)

La route `GET /api/download` est particulièrement sensible : elle prend un nom de fichier en paramètre et sert un fichier depuis le disque. Sans protection, un appel comme `?file=../../../../etc/passwd` pourrait exposer des fichiers système.

**Mesures prises** (dans `src/app/api/download/route.ts`) :

1. **Résolution canonique** : `const resolved = path.resolve(DOWNLOAD_DIR, file)`.
2. **Vérification de l'appartenance** : on s'assure que `resolved` commence par `DOWNLOAD_DIR + path.sep` (ou est exactement égal au basename). Si non → 400.
3. **Basename forcé** : on utilise `path.basename(file)` pour ne garder que le nom du fichier, ignorant tout préfixe de dossier.
4. **Vérification finale** : `fs.stat(fullPath)` puis `stat.isFile()` pour confirmer qu'on sert bien un fichier régulier.

```typescript
// Extrait de src/app/api/download/route.ts
const resolved = path.resolve(DOWNLOAD_DIR, file);
if (!resolved.startsWith(DOWNLOAD_DIR + path.sep) && resolved !== path.join(DOWNLOAD_DIR, path.basename(file))) {
  return NextResponse.json({ error: 'Chemin de fichier invalide.' }, { status: 400 });
}

const safeName = path.basename(file);
const fullPath = path.join(DOWNLOAD_DIR, safeName);
```

### 10.4. Non-exposition du chemin brut

Dans la réponse de `GET /api/cv/history`, le champ `filePath` (chemin relatif du fichier sur le disque) est explicitement mis à `undefined`. À la place, on renvoie une `downloadUrl` construite (`/api/download?file=...`) qui passe par la route sécurisée.

### 10.5. Validation du JSON retourné par le modèle IA

Le modèle NVIDIA peut halluciner ou retourner un JSON mal formé. Pour éviter des bugs en aval :

- `extractJsonFromResponse` (dans `src/lib/nvidia/client.ts`) gère plusieurs cas : JSON pur, fences markdown ```json ... ```, JSON noyé dans du texte (détection de bloc équilibré `{}`/`[]`), sanitization des caractères de contrôle.
- `validateParsedCvShape` vérifie la présence des clés obligatoires de `ParsedCv`.
- `validateCvScoreShape` vérifie la présence et les types des clés de `CvScore`.
- Le `overallScore` est **borné défensivement** dans `[0, 100]` via `Math.max(0, Math.min(100, ...))`.

### 10.6. Variables d'environnement

- La clé API NVIDIA n'est **jamais** envoyée au client ; elle est lue côté serveur uniquement (`process.env.NVIDIA_API_KEY`).
- Le fichier `.env.local` doit être dans `.gitignore` (c'est le cas dans ce projet).

### 10.7. Runtime Node.js

Toutes les routes déclarent `export const runtime = 'nodejs'` pour éviter le runtime Edge (qui n'a pas accès à Prisma, Buffer, fs, ni aux bibliothèques natives).

---

## 11. Tests des APIs

Plusieurs méthodes pour tester les routes API.

### 11.1. Test rapide avec `/api/status`

Le point d'entrée le plus simple pour vérifier que tout fonctionne :

```bash
curl http://localhost:3000/api/status
```

Si `nvidiaConfigured: true` et `database: true`, le service est prêt à traiter des CV.

### 11.2. Test du pipeline complet avec curl

```bash
# Préparer un fichier CV de test
ls mon-cv.pdf

# Lancer le traitement
curl -X POST http://localhost:3000/api/cv/process \
  -F "file=@mon-cv.pdf" \
  -F "outputFormat=word" \
  -F "language=français" \
  | jq

# Récupérer l'URL de téléchargement depuis la réponse, puis :
curl -OJ "http://localhost:3000/api/download?file=<id>_CV_jean_dupont.docx"
```

### 11.3. Test de l'extraction seule

```bash
curl -X POST http://localhost:3000/api/nvidia/extract \
  -F "file=@cv.png" \
  | jq '.parsedCv.personalInfo'
```

### 11.4. Test du scoring seul

```bash
curl -X POST http://localhost:3000/api/nvidia/score \
  -H "Content-Type: application/json" \
  -d '{
    "language": "français",
    "parsedCv": {
      "personalInfo": { "fullName": "Test", "title": "Dev" },
      "workExperience": [],
      "education": [],
      "skills": [{ "name": "TypeScript" }],
      "languages": [{ "name": "Français", "level": "natif" }]
    }
  }' | jq '.score.overallScore'
```

### 11.5. Test de l'historique

```bash
# Lister tout l'historique
curl http://localhost:3000/api/cv/history | jq

# Filtrer par statut
curl "http://localhost:3000/api/cv/history?status=done&limit=5" | jq
```

### 11.6. Test depuis le navigateur

Toutes les routes `GET` peuvent être testées directement dans le navigateur :

- **http://localhost:3000/api/status** — état du service
- **http://localhost:3000/api/cv/process** — résumé d'utilisation (handler GET secondaire)
- **http://localhost:3000/api/cv/history** — liste de l'historique
- **http://localhost:3000/api/cv/history/<id>** — détail d'un CV
- **http://localhost:3000/api/download?file=<filename>** — téléchargement d'un fichier

Pour les routes `POST` et `DELETE`, utilisez un outil comme **Postman**, **Insomnia** ou **Bruno**, ou curl.

### 11.7. Test en JavaScript (script Node.js)

```typescript
// test-api.ts
const BASE = 'http://localhost:3000';

async function main() {
  // 1. Status
  const status = await fetch(`${BASE}/api/status`).then(r => r.json());
  console.log('Status :', status);

  if (!status.nvidiaConfigured) {
    console.error('⚠️ NVIDIA non configuré. Abandon.');
    return;
  }

  // 2. Pipeline complet
  const formData = new FormData();
  formData.append('file', new Blob([await Bun.file('mon-cv.pdf').arrayBuffer()]), 'mon-cv.pdf');
  formData.append('outputFormat', 'word');
  formData.append('language', 'français');

  const result = await fetch(`${BASE}/api/cv/process`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json());

  console.log('Score :', result.score.overallScore);
  console.log('Téléchargement :', result.downloadUrl);

  // 3. Historique
  const history = await fetch(`${BASE}/api/cv/history`).then(r => r.json());
  console.log(`${history.count} CV dans l'historique`);
}

main().catch(console.error);
```

Exécutez avec `bun test-api.ts`.

### 11.8. Vérification des erreurs

Testez délibérément les cas d'erreur pour vérifier le bon comportement :

```bash
# Fichier manquant → 400
curl -X POST http://localhost:3000/api/cv/process

# Mauvais type MIME → 415
curl -X POST http://localhost:3000/api/cv/process -F "file=@text.txt"

# ID inexistant → 404
curl http://localhost:3000/api/cv/history/inexistant

# Tentative de traversée de répertoire → 400
curl "http://localhost:3000/api/download?file=../../../etc/passwd"
```

---

<p align="center">
  📘 Fin du HOWTO — Pour toute question, consultez le <a href="../README.md">README.md</a> ou le <a href="../worklog.md">worklog.md</a>.
</p>
