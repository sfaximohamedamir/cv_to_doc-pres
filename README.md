# 📄 Agent de Transformation de CV — Propulsé par NVIDIA Nemotron

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![NVIDIA](https://img.shields.io/badge/NVIDIA-Nemotron-76B900?logo=nvidia&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-FBF0DF?logo=bun&logoColor=black)
![Licence](https://img.shields.io/badge/Licence-MIT-green)

> Un agent IA qui transforme un CV (PDF ou image) en document **Word** ou **PowerPoint**,
> puis attribue un **score détaillé sur 100** basé sur 7 critères de recrutement.

---

## 📑 Sommaire

1. [Description complète](#-description-complète)
2. [Fonctionnalités](#-fonctionnalités)
3. [Modèles NVIDIA utilisés](#-modèles-nvidia-utilisés)
4. [Architecture du projet](#-architecture-du-projet)
5. [Pipeline de traitement](#-pipeline-de-traitement)
6. [Prérequis](#-prérequis)
7. [Installation étape par étape](#-installation-étape-par-étape)
8. [Configuration](#-configuration)
9. [Lancement en développement](#-lancement-en-développement)
10. [Lancement en production](#-lancement-en-production)
11. [Utilisation de l'interface](#-utilisation-de-linterface)
12. [Base de données](#-base-de-données)
13. [Scripts disponibles](#-scripts-disponibles)
14. [Dépannage](#-dépannage)
15. [Licence](#-licence)

---

## 📖 Description complète

**Agent de Transformation de CV** est une application web propulsée par les modèles **NVIDIA Nemotron** qui automatise entièrement la vie d'un CV : de la lecture du fichier brut à la production d'un document propre et à l'évaluation qualitative du profil.

Le projet s'appuie sur deux modèles IA complémentaires de la famille Nemotron :
le **Nemotron-3-Super-120B** (LLM texte) pour structurer le contenu et le scorer, et le
**Nemotron-3-Nano-Omni-30B** (modèle omni multimodal) pour lire visuellement les images
de CV. L'API NVIDIA étant compatible OpenAI, le SDK `openai` est réutilisé tel quel,
simplement reconfiguré pour pointer vers `https://integrate.api.nvidia.com/v1`.

Le pipeline fonctionne en trois temps. D'abord, l'**extraction** : à partir d'un PDF (texte sélectionnable) on tire le texte avec `pdf-parse`, à partir d'une image (PNG, JPEG, WebP, GIF) on envoie directement l'image au modèle omni. Dans les deux cas, on obtient un objet JSON fortement typé (`ParsedCv`) décrivant le candidat. Ensuite, la **conversion** : ce JSON est passé à un convertisseur `docx` ou `pptxgenjs` qui produit un fichier Word ou PowerPoint propre et stylé. Enfin, le **scoring** : le CV structuré est soumis au modèle texte, qui renvoie une note globale sur 100 accompagnée d'un commentaire par catégorie, de points forts, d'axes d'amélioration et d'une recommandation de niveau de seniorité.

Tous les traitements sont persistés dans une base **SQLite** via **Prisma** (modèle `CvRecord`),
ce qui permet de consulter l'historique, de re-télécharger les fichiers générés et de supprimer
les entrées obsolètes depuis l'interface.

---

## ✨ Fonctionnalités

- 📤 **Téléversement de CV** au format PDF (texte sélectionnable) ou image (PNG, JPEG, WebP, GIF)
- 🧠 **Extraction IA structurée** — le CV est transformé en objet JSON fortement typé (infos perso, expériences, formations, compétences, langues, projets, certifications, etc.)
- 🔁 **Deux chemins d'extraction** — `pdf-text` (texte → LLM texte) pour les PDF, `image-omni` (image → modèle multimodal) pour les images
- 📝 **Génération de document Word (.docx)** avec en-tête stylé, sections, hyperliens, libellés localisés FR/EN
- 🎞️ **Génération de présentation PowerPoint (.pptx)** en 16:9 avec couverture, profil, expériences, formation, compétences/langues, projets/certifications, diapo de clôture
- 📊 **Scoring sur 7 critères** — Clarté et structure, Impact et réalisations, Compétences, Expérience professionnelle, Formation, Présentation et orthographe, Adéquation au marché — score global sur 100
- 🌈 **Code couleur du score** — Excellent 🌟 / Très bon ✅ / Correct ⚠️ / À améliorer 🔧 / Insuffisant ❌
- 🗂️ **Historique complet** en base SQLite — liste, détail, suppression, re-téléchargement
- 🌐 **Multilingue** — la langue du CV est détectée automatiquement, et les résumés rédigés par l'IA peuvent être générés dans la langue demandée
- 🛡️ **Validation et sécurité** — limite de 10 Mo, validation du type MIME par magic bytes, protection contre la traversée de répertoire sur le endpoint de téléchargement
- ⚡ **API HTTP REST** — 8 routes API testables au curl, prêtes pour l'intégration frontend
- 🎨 **UI moderne** — Next.js 16 App Router, Tailwind CSS 4, shadcn/ui (style New York), Framer Motion, icônes Lucide

---

## 🤖 Modèles NVIDIA utilisés

L'application s'appuie sur **deux modèles NVIDIA Nemotron**, sélectionnés automatiquement selon le type de fichier traité. Les deux modèles sont déclarés dans le registre `NVIDIA_MODELS` (cf. `src/lib/nvidia/models.ts`) et appelés via le SDK `openai` configuré pour pointer vers `https://integrate.api.nvidia.com/v1`.

| Identifiant du modèle | Nom affichable | Type | Rôle dans le pipeline | Température | Max tokens |
|---|---|---|---|---|---|
| `nvidia/nemotron-3-super-120b-a12b` | Nemotron-3-Super-120B | `text` (LLM) | Extraction structurée des PDF texte + scoring du CV | 0.3 | 4096 |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Nemotron-3-Nano-Omni-30B | `omni` (multimodal) | Lecture visuelle des images de CV (PNG, JPEG, WebP, GIF) | 0.3 | 4096 |

> ℹ️ Le modèle Super a 120 milliards de paramètres dont 12 milliards actifs (MoE), tandis que le modèle Nano-Omni a 30 milliards de paramètres dont 3 milliards actifs. Les deux sont servis via l'API NVIDIA integrate, compatible OpenAI.

---

## 🏗 Architecture du projet

Voici l'arborescence complète du projet, avec une explication pour chaque dossier et fichier important :

```text
my-project/
├── docs/
│   └── HOWTO.md                       # Guide détaillé des routes API
├── prisma/
│   └── schema.prisma                  # Schéma de base de données (modèle CvRecord)
├── db/
│   └── custom.db                      # Base SQLite générée par Prisma
├── download/                          # Stockage des fichiers Word/PowerPoint générés
├── public/                            # Assets statiques (logo, robots.txt)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cv/
│   │   │   │   ├── process/route.ts       # POST — pipeline complet
│   │   │   │   └── history/
│   │   │   │       ├── route.ts           # GET — liste de l'historique
│   │   │   │       └── [id]/route.ts      # GET/DELETE — détail + suppression
│   │   │   ├── nvidia/
│   │   │   │   ├── extract/route.ts       # POST — extraction seule
│   │   │   │   └── score/route.ts         # POST — scoring seul
│   │   │   ├── download/route.ts          # GET — téléchargement de fichier
│   │   │   ├── status/route.ts            # GET — état du service
│   │   │   └── route.ts                   # GET — racine /api
│   │   ├── layout.tsx                     # Layout racine (HTML, providers)
│   │   ├── page.tsx                       # Page d'accueil (UI principale)
│   │   └── globals.css                    # Styles globaux Tailwind 4
│   ├── components/
│   │   ├── cv/
│   │   │   ├── upload-zone.tsx            # Zone de dépôt de fichier (drag & drop)
│   │   │   ├── format-selector.tsx        # Sélecteur Word / PowerPoint
│   │   │   ├── processing-steps.tsx       # Affichage des étapes en cours
│   │   │   ├── score-display.tsx          # Jauge de score + catégories
│   │   │   ├── cv-preview.tsx             # Aperçu du CV structuré
│   │   │   ├── result-panel.tsx           # Panneau de résultat (score + preview)
│   │   │   ├── history-list.tsx           # Liste de l'historique
│   │   │   └── nvidia-status-banner.tsx   # Bannière d'état NVIDIA
│   │   ├── layout/
│   │   │   ├── header.tsx                 # En-tête de page
│   │   │   └── footer.tsx                 # Pied de page
│   │   └── ui/                            # Composants shadcn/ui (New York)
│   ├── hooks/
│   │   ├── use-cv-processing.ts           # Hook : appel au pipeline complet
│   │   ├── use-cv-history.ts              # Hook : gestion de l'historique
│   │   ├── use-toast.ts                   # Hook : notifications toast
│   │   └── use-mobile.ts                  # Hook : détection mobile
│   └── lib/
│       ├── cv/
│       │   ├── types.ts                   # Toutes les interfaces TypeScript
│       │   └── scoring.ts                 # Logique de scoring (appel NVIDIA)
│       ├── nvidia/
│       │   ├── client.ts                  # Client OpenAI configuré pour NVIDIA
│       │   ├── models.ts                  # Registre des modèles Nemotron
│       │   └── prompts.ts                 # Prompts d'extraction et de scoring
│       ├── parsers/
│       │   ├── pdf-parser.ts              # Extraction texte PDF (pdf-parse v2)
│       │   ├── image-parser.ts            # Détection MIME + base64 pour images
│       │   └── cv-extractor.ts            # Orchestration de l'extraction
│       ├── converters/
│       │   ├── word-converter.ts          # Génération .docx (bibliothèque docx)
│       │   └── powerpoint-converter.ts    # Génération .pptx (pptxgenjs)
│       ├── db.ts                          # Instance Prisma Client
│       └── utils.ts                       # Utilitaires (cn, etc.)
├── package.json                       # Dépendances et scripts
├── tsconfig.json                      # Configuration TypeScript
├── next.config.ts                     # Configuration Next.js
├── tailwind.config.ts                 # Configuration Tailwind
├── postcss.config.mjs                 # Configuration PostCSS
├── eslint.config.mjs                  # Configuration ESLint
├── components.json                    # Configuration shadcn/ui
├── .env                               # Variables d'environnement
└── worklog.md                         # Journal des tâches effectuées
```

### Explication des fichiers clés

| Fichier | Rôle |
|---|---|
| `src/lib/cv/types.ts` | Définit toutes les interfaces : `ParsedCv`, `WorkExperience`, `Education`, `Skill`, `Language`, `CvScore`, `ScoreCategory`, `CvProcessingResult`, `NvidiaModelConfig`, `OutputFormat`, `ProcessingStatus` |
| `src/lib/nvidia/models.ts` | Constantes `SUPER_MODEL_ID` et `OMNI_MODEL_ID`, registre `NVIDIA_MODELS`, helper `getModelConfig()` |
| `src/lib/nvidia/client.ts` | Client OpenAI mis en cache pointant vers `https://integrate.api.nvidia.com/v1` ; fonctions `isNvidiaConfigured()`, `getNvidiaClient()`, `callNvidiaTextModel()`, `callNvidiaOmniModel()`, `extractJsonFromResponse()` |
| `src/lib/nvidia/prompts.ts` | Prompts système + utilisateur pour l'extraction (`buildExtractionPrompt`) et le scoring (`buildScoringPrompt`), avec le schéma JSON strict |
| `src/lib/parsers/pdf-parser.ts` | Extrait le texte d'un PDF via `pdf-parse` v2 (classe `PDFParse`) ; vérifie le magic number `%PDF-` ; seuil `MIN_SUBSTANTIAL_TEXT_LENGTH = 200` |
| `src/lib/parsers/image-parser.ts` | Détection MIME par magic bytes (PNG, JPEG, GIF, WebP), validation, encodage base64, construction de data URL |
| `src/lib/parsers/cv-extractor.ts` | Orchestration : PDF → texte → Super ; image → omni. Validation `validateParsedCvShape`. Retourne un `ExtractionResult` |
| `src/lib/cv/scoring.ts` | `scoreCv()` sérialise le CV, appelle le Super modèle, extrait le JSON, valide `CvScore`, borne le score [0, 100]. `getScoreLabel()` renvoie libellé + couleur + emoji |
| `src/lib/converters/word-converter.ts` | `generateWordCv({ parsedCv, score? })` → `Promise<Buffer>` ; `getWordFileName(fullName)` normalise le nom de fichier |
| `src/lib/converters/powerpoint-converter.ts` | `generatePowerPointCv({ parsedCv, score? })` → `Promise<Buffer>` ; `getPowerPointFileName(fullName)` normalise le nom |
| `src/app/api/cv/process/route.ts` | Pipeline complet : extraction → conversion → scoring → sauvegarde BDD + fichier |
| `src/app/api/cv/history/route.ts` | Liste l'historique avec filtres `limit` et `status` |
| `src/app/api/cv/history/[id]/route.ts` | Détail (GET) et suppression (DELETE) d'un `CvRecord` |
| `src/app/api/nvidia/extract/route.ts` | Extraction seule (sans conversion ni scoring) |
| `src/app/api/nvidia/score/route.ts` | Scoring seul d'un `ParsedCv` fourni en JSON |
| `src/app/api/download/route.ts` | Sert un fichier généré avec protection contre la traversée de répertoire |
| `src/app/api/status/route.ts` | Indique si NVIDIA est configuré, liste les modèles, vérifie la BDD |
| `prisma/schema.prisma` | Schéma Prisma — modèle `CvRecord` (17 champs) avec index sur `status` et `createdAt` |
| `src/lib/db.ts` | Exporte l'instance singleton de `PrismaClient` |

---

## 🔄 Pipeline de traitement

Le cœur fonctionnel de l'application est un pipeline en **3 étapes** exécuté par la route `POST /api/cv/process`. Chaque étape met à jour le statut du `CvRecord` en base, ce qui permet de suivre la progression.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        POST /api/cv/process                                │
│   FormData : { file, outputFormat: 'word' | 'powerpoint', language? }     │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
                                  ▼
                ┌─────────────────────────────────┐
                │  0. Vérifications préalables    │
                │  • NVIDIA_API_KEY présente ?    │
                │  • Fichier fourni et < 10 Mo ?  │
                │  • Type MIME accepté ?          │
                │  → Création du CvRecord (status │
                │    = 'extracting')              │
                └────────────────┬────────────────┘
                                 │
                                 ▼
       ┌──────────────────────────────────────────────────┐
       │  ÉTAPE 1 — EXTRACTION                            │
       │  src/lib/parsers/cv-extractor.ts                 │
       │                                                  │
       │  ┌─ Si PDF ──────────────────────────────────┐   │
       │  │ parsePdf() (pdf-parse v2)                 │   │
       │  │   → texte concaténé de toutes les pages   │   │
       │  │ Si texte vide → erreur « PDF scanné »     │   │
       │  │ Texte → callNvidiaTextModel(SUPER_MODEL)  │   │
       │  │   → JSON ParsedCv                         │   │
       │  │ Méthode : 'pdf-text'                      │   │
       │  └───────────────────────────────────────────┘   │
       │                                                  │
       │  ┌─ Si image ────────────────────────────────┐   │
       │  │ detectImageMimeType() (magic bytes)       │   │
       │  │ bufferToBase64() + data URL               │   │
       │  │ callNvidiaOmniModel(OMNI_MODEL)            │   │
       │  │   → JSON ParsedCv                         │   │
       │  │ Méthode : 'image-omni'                    │   │
       │  └───────────────────────────────────────────┘   │
       │                                                  │
       │  → validateParsedCvShape()                       │
       │  → status = 'converting'                         │
       └──────────────────────┬───────────────────────────┘
                              │
                              ▼
       ┌──────────────────────────────────────────────────┐
       │  ÉTAPE 2 — CONVERSION                            │
       │                                                  │
       │  ┌─ outputFormat = 'word' ───────────────────┐   │
       │  │ generateWordCv({ parsedCv })              │   │
       │  │   → Buffer .docx                          │   │
       │  │ getWordFileName(fullName)                 │   │
       │  └───────────────────────────────────────────┘   │
       │                                                  │
       │  ┌─ outputFormat = 'powerpoint' ─────────────┐   │
       │  │ generatePowerPointCv({ parsedCv })        │   │
       │  │   → Buffer .pptx                          │   │
       │  │ getPowerPointFileName(fullName)           │   │
       │  └───────────────────────────────────────────┘   │
       │                                                  │
       │  → Sauvegarde dans /download/<id>_<filename>     │
       │  → status = 'scoring'                            │
       └──────────────────────┬───────────────────────────┘
                              │
                              ▼
       ┌──────────────────────────────────────────────────┐
       │  ÉTAPE 3 — SCORING                               │
       │  src/lib/cv/scoring.ts                           │
       │                                                  │
       │  JSON.stringify(parsedCv, null, 2)               │
       │  buildScoringPrompt(language)                    │
       │  callNvidiaTextModel(SUPER_MODEL)                 │
       │    → JSON CvScore {                              │
       │        overallScore: 0-100,                      │
       │        categories: [7 catégories],               │
       │        strengths: [...],                         │
       │        improvements: [...],                      │
       │        recommendation: '...',                    │
       │        seniorityLevel: '...'                     │
       │      }                                           │
       │  validateCvScoreShape() + bornage [0, 100]       │
       │  → status = 'done'                               │
       └──────────────────────┬───────────────────────────┘
                              │
                              ▼
       ┌──────────────────────────────────────────────────┐
       │  RÉPONSE — CvProcessingResult                    │
       │  { id, status: 'done', parsedCv, score,          │
       │    outputFormat, downloadUrl, outputFileName,    │
       │    extractedText, durationMs,                    │
       │    extractionModel, scoringModel }               │
       └──────────────────────────────────────────────────┘
```

En cas d'échec à n'importe quelle étape, le `CvRecord` est marqué `status = 'error'` avec le message d'erreur dans `errorMessage`, et la route renvoie un HTTP 500 contenant le détail.

---

## 📋 Prérequis

Avant d'installer et de lancer le projet, vous devez disposer des éléments suivants :

| Prérequis | Version minimale | Vérification |
|---|---|---|
| **Node.js** | 18+ (recommandé 20+) | `node --version` |
| **Bun** (runtime et gestionnaire de paquets) | 1.1+ | `bun --version` |
| **Une clé API NVIDIA** | — | Voir [Installation](#-installation-étape-par-étape) ci-dessous |
| **Système d'exploitation** | Linux, macOS ou Windows (WSL2 recommandé) | — |

> ℹ️ Le projet utilise **Bun** comme runtime par défaut (scripts `bun run dev`, `bun run build`). Vous pouvez néanmoins utiliser `npm`, `pnpm` ou `yarn` si vous préférez, à condition d'adapter les commandes.

---

## 🛠 Installation étape par étape

Suivez ces étapes **dans l'ordre** pour mettre le projet en route depuis zéro.

### Étape 1 — Cloner le dépôt

```bash
git clone <url-du-depot> my-project
cd my-project
```

> Si vous disposez déjà du code source, ignorez cette étape et placez-vous à la racine du projet :
> ```bash
> cd /home/z/my-project
> ```

### Étape 2 — Installer les dépendances

```bash
bun install
```

Cette commande lit `package.json` et installe toutes les dépendances (Next.js, React, Prisma, docx, pptxgenjs, pdf-parse, openai, shadcn/ui, etc.). Avec Bun, l'installation prend généralement moins de 30 secondes.

### Étape 3 — Obtenir une clé API NVIDIA

L'agent utilise l'API NVIDIA integrate, accessible depuis **https://build.nvidia.com**. Voici comment obtenir une clé :

1. Rendez-vous sur **https://build.nvidia.com** dans votre navigateur.
2. Créez un compte NVIDIA (gratuit) ou connectez-vous si vous en avez déjà un.
3. Une fois connecté, recherchez l'un des deux modèles utilisés :
   - `nvidia/nemotron-3-super-120b-a12b`
   - `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
4. Cliquez sur le bouton **"Get API key"** en haut à droite de la page du modèle.
5. Copiez la clé générée. Elle commence toujours par `nvapi-` et fait environ 100 caractères.

> ⚠️ **Sécurité** : ne committez **jamais** votre clé API dans Git. Ajoutez bien `.env.local` à votre `.gitignore` (c'est déjà le cas dans ce projet).

### Étape 4 — Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine du projet (à côté du `package.json`) :

```bash
touch .env.local
```

Ouvrez-le avec votre éditeur préféré et ajoutez les deux lignes suivantes :

```env
DATABASE_URL=file:/home/z/my-project/db/custom.db
NVIDIA_API_KEY=nvapi-votre-cle-ici
```

> ℹ️ Remplacez `nvapi-votre-cle-ici` par la clé réelle obtenue à l'étape 3. La valeur de `DATABASE_URL` pointe vers le fichier SQLite qui sera créé par Prisma dans le dossier `db/`.

### Étape 5 — Synchroniser la base de données

Le schéma Prisma étant défini dans `prisma/schema.prisma`, on crée/migre la base SQLite avec :

```bash
bun run db:push
```

Cette commande :
- lit `prisma/schema.prisma`,
- crée (ou met à jour) le fichier `db/custom.db`,
- régénère le client Prisma (`@prisma/client`).

Vous devriez voir un message du type `🚀 Your database is now in sync with your Prisma schema.`.

### Étape 6 — (Optionnel) Générer le client Prisma

Si vous modifiez le schéma plus tard, régénérez le client :

```bash
bun run db:generate
```

### Étape 7 — Lancer le serveur de développement

```bash
bun run dev
```

Le serveur démarre sur le port **3000**. Ouvrez **http://localhost:3000** dans votre navigateur.

> ✅ Si tout s'est bien passé, vous devriez voir l'interface de l'agent avec la zone de téléversement de CV. La bannière d'état NVIDIA doit être verte (« NVIDIA configuré »).

---

## ⚙️ Configuration

Le projet charge ses variables d'environnement via le fichier `.env.local` (prioritaire sur `.env`). Voici la liste complète des variables attendues :

| Variable | Obligatoire | Description | Exemple |
|---|---|---|---|
| `DATABASE_URL` | ✅ Oui | URL de connexion SQLite (format Prisma). Doit pointer vers un fichier local. | `file:/home/z/my-project/db/custom.db` |
| `NVIDIA_API_KEY` | ✅ Oui | Clé API NVIDIA (préfixe `nvapi-`) pour appeler les modèles Nemotron. | `nvapi-XXXXXXXXXXXXXXXXXXXXXXXX` |

### Exemple complet de `.env.local`

```env
# Base de données SQLite (chemin absolu recommandé)
DATABASE_URL=file:/home/z/my-project/db/custom.db

# Clé API NVIDIA (obtenue sur https://build.nvidia.com)
NVIDIA_API_KEY=nvapi-votre-cle-api-ici
```

### Vérifier que la configuration est bien prise en compte

Une fois le serveur démarré, ouvrez **http://localhost:3000/api/status** dans votre navigateur. Vous devriez obtenir une réponse JSON du type :

```json
{
  "nvidiaConfigured": true,
  "models": [
    { "id": "nvidia/nemotron-3-super-120b-a12b", "name": "Nemotron-3-Super-120B", "type": "text", "description": "..." },
    { "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "name": "Nemotron-3-Nano-Omni-30B", "type": "omni", "description": "..." }
  ],
  "database": true,
  "cvCount": 0,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

Si `nvidiaConfigured` vaut `false`, votre `NVIDIA_API_KEY` n'est pas détectée. Si `database` vaut `false`, la base SQLite est inaccessible.

---

## 🚀 Lancement en développement

Le mode développement active le hot-reload et des messages d'erreur détaillés.

```bash
bun run dev
```

**Détails :**
- La commande exécutée est `next dev -p 3000 2>&1 | tee dev.log` (voir `package.json`).
- Le serveur écoute sur le port **3000**.
- Les logs sont également écrits dans `dev.log` à la racine du projet.
- Accédez à l'application : **http://localhost:3000**.
- Les routes API sont disponibles sous **http://localhost:3000/api/**.

> 💡 En cas de modification des fichiers `src/lib/**` ou `src/app/**`, Next.js recompile automatiquement la page concernée.

---

## 🏭 Lancement en production

Pour déployer en production, le projet fournit un build standalone Next.js.

### Étape 1 — Construire l'application

```bash
bun run build
```

Cette commande :
1. exécute `next build` (génère `.next/standalone/` et `.next/static/`),
2. copie `.next/static/` dans `.next/standalone/.next/`,
3. copie `public/` dans `.next/standalone/`.

### Étape 2 — Lancer le serveur de production

```bash
bun start
```

Cette commande exécute `NODE_ENV=production bun .next/standalone/server.js`. Le serveur écoute par défaut sur le port **3000** (modifiable via la variable d'environnement `PORT`).

> ⚠️ **Note** : dans l'environnement de développement actuel, le projet tourne via `bun run dev` sur le port 3000. Les commandes de production ci-dessus sont fournies à titre indicatif pour un déploiement réel.

---

## 🖱 Utilisation de l'interface

L'interface web est conçue pour être utilisée sans aucune compétence technique. Voici le déroulé complet d'un traitement de CV.

### 1️⃣ Téléverser un CV

1. Ouvrez **http://localhost:3000** dans votre navigateur.
2. Dans la zone centrale **« Déposer un CV ici »**, vous pouvez :
   - **glisser-déposer** un fichier PDF ou image directement depuis votre explorateur,
   - ou **cliquer** sur la zone pour ouvrir le sélecteur de fichiers.
3. Le fichier doit être au format **PDF** (avec texte sélectionnable), **PNG**, **JPEG**, **WebP** ou **GIF**. Taille maximale : **10 Mo**.
4. Une fois le fichier sélectionné, son nom s'affiche dans la zone.

### 2️⃣ Choisir le format de sortie

Sous la zone de dépôt, un sélecteur propose deux options :

- 📝 **Word (.docx)** — génère un document Word stylé (en-tête, sections, hyperliens).
- 🎞️ **PowerPoint (.pptx)** — génère une présentation 16:9 (couverture, profil, expériences, etc.).

Cliquez sur l'option souhaitée. Par défaut, **Word** est sélectionné.

### 3️⃣ Choisir la langue (optionnel)

Un champ de sélection de langue permet de demander à l'IA de rédiger les résumés et commentaires dans une langue donnée (par exemple `français` ou `anglais`). Si vous ne renseignez rien, la langue d'origine du CV est conservée.

### 4️⃣ Lancer le traitement

Cliquez sur le bouton **« Traiter le CV »**. L'interface affiche alors les étapes en cours :

```text
✓ Extraction du contenu du CV…
✓ Conversion au format Word…
✓ Scoring du CV…
```

Le traitement complet prend généralement entre **10 et 40 secondes** selon la taille du CV et la charge de l'API NVIDIA.

### 5️⃣ Consulter le score

Une fois le traitement terminé, le panneau de résultat s'affiche avec :

- **une jauge de score global** (0 à 100) avec code couleur et emoji,
- **le détail des 7 catégories** (Clarté et structure, Impact et réalisations, Compétences, Expérience professionnelle, Formation, Présentation et orthographe, Adéquation au marché) — chacune avec sa note et son commentaire,
- **les points forts** du CV (3 à 6 éléments),
- **les axes d'amélioration** (3 à 6 éléments concrets),
- **la recommandation générale** (2 à 4 phrases),
- **le niveau de seniorité estimé** (débutant, intermédiaire, confirmé, senior, lead, expert).

L'échelle des scores est la suivante :

| Score | Libellé | Couleur | Emoji |
|---|---|---|---|
| 85-100 | Excellent | vert `#16a34a` | 🌟 |
| 70-84 | Très bon | émeraude `#10b981` | ✅ |
| 55-69 | Correct | ambre `#f59e0b` | ⚠️ |
| 40-54 | À améliorer | orange `#f97316` | 🔧 |
| 0-39 | Insuffisant | rouge `#dc2626` | ❌ |

### 6️⃣ Consulter l'aperçu du CV

À côté du score, un panneau **« Aperçu du CV »** affiche le contenu structuré extrait par l'IA : informations personnelles, expériences, formations, compétences, langues, projets, certifications. Cela permet de vérifier que l'extraction est correcte.

### 7️⃣ Télécharger le document généré

Cliquez sur le bouton **« Télécharger »** (icône de téléchargement). Le navigateur démarre le téléchargement du fichier `.docx` ou `.pptx`. Le nom du fichier est normalisé à partir du nom du candidat (par exemple `CV_jean_dupont.docx`).

### 8️⃣ Utiliser l'historique

Le panneau **« Historique »** (en bas ou sur le côté de l'écran) liste tous les CV déjà traités. Pour chaque entrée, vous voyez :

- le nom du fichier original,
- le format de sortie,
- le score (si disponible),
- la date de traitement,
- le statut (`done`, `error`, etc.).

Vous pouvez :
- **cliquer sur une entrée** pour recharger son résultat dans l'interface,
- **re-télécharger** le fichier généré (icône de téléchargement),
- **supprimer** une entrée (icône de corbeille) — le fichier sur disque est également supprimé.

---

## 🗄 Base de données

Le projet utilise **SQLite** via **Prisma ORM**. Le schéma est défini dans `prisma/schema.prisma`.

### Modèle `CvRecord`

Chaque CV traité est persisté comme un enregistrement `CvRecord`. Voici le détail des champs :

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | `String` | ✅ | Identifiant unique (CUID), généré automatiquement |
| `originalName` | `String` | ✅ | Nom du fichier original téléversé (ex: `cv_dupont.pdf`) |
| `sourceType` | `String` | ✅ | Type MIME du fichier source (`application/pdf`, `image/png`, …) |
| `outputFormat` | `String` | ✅ | Format de sortie choisi (`word` ou `powerpoint`) |
| `outputName` | `String?` | ❌ | Nom du fichier généré (sans le préfixe d'ID) |
| `status` | `String` | ✅ (défaut `pending`) | Statut : `pending`, `extracting`, `converting`, `scoring`, `done`, `error` |
| `errorMessage` | `String?` | ❌ | Message d'erreur en cas d'échec |
| `extractedText` | `String?` | ❌ | Texte brut extrait du CV (texte PDF ou description synthétique pour image) |
| `structuredData` | `String?` | ❌ | Données structurées du CV au format JSON (sérialisation de `ParsedCv`) |
| `score` | `Int?` | ❌ | Score global (0-100) |
| `scoreDetails` | `String?` | ❌ | Détail du score au format JSON (sérialisation de `CvScore`) |
| `filePath` | `String?` | ❌ | Chemin relatif du fichier généré dans `/download` (préfixé par l'ID) |
| `fileSize` | `Int` | ✅ | Taille du fichier source en octets |
| `language` | `String?` | ❌ | Langue détectée du CV (ex: `fr`, `en`) |
| `extractionModel` | `String?` | ❌ | Modèle NVIDIA utilisé pour l'extraction |
| `scoringModel` | `String?` | ❌ | Modèle NVIDIA utilisé pour le scoring |
| `durationMs` | `Int?` | ❌ | Durée totale du traitement en millisecondes |
| `createdAt` | `DateTime` | ✅ (auto) | Date de création |
| `updatedAt` | `DateTime` | ✅ (auto) | Date de dernière mise à jour |

**Index** : `status` et `createdAt` sont indexés pour accélérer les requêtes de filtrage et de tri chronologique.

> ℹ️ Le schéma contient aussi les modèles `User` et `Post` (présents par défaut dans le template Prisma) mais ils ne sont **pas utilisés** par l'agent de CV.

### Emplacement du fichier SQLite

La base est stockée dans `db/custom.db` (chemin configurable via `DATABASE_URL`). Le dossier `db/` est créé automatiquement par Prisma lors du premier `db:push`.

---

## 📜 Scripts disponibles

Tous les scripts sont définis dans `package.json` et s'exécutent via `bun run <script>`.

| Script | Commande exécutée | Description |
|---|---|---|
| `dev` | `next dev -p 3000 2>&1 \| tee dev.log` | Démarre le serveur de développement sur le port 3000, avec logs dans `dev.log` |
| `build` | `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/` | Construit l'application Next.js standalone pour la production |
| `start` | `NODE_ENV=production bun .next/standalone/server.js 2>&1 \| tee server.log` | Lance le serveur de production (après `build`) |
| `lint` | `eslint .` | Vérifie le code avec ESLint |
| `db:push` | `prisma db push --accept-data-loss` | Synchronise le schéma Prisma avec la base (avec perte de données potentielle) |
| `db:generate` | `prisma generate` | Régénère le client Prisma (`@prisma/client`) |
| `db:migrate` | `prisma migrate dev` | Crée une migration Prisma en mode développement |
| `db:reset` | `prisma migrate reset` | Réinitialise la base (supprime toutes les données) |

### Exemples d'utilisation

```bash
bun run dev          # Démarrer en développement
bun run build        # Build production
bun run lint         # Linter le code
bun run db:push      # Synchroniser la base
bun run db:generate  # Régénérer le client Prisma
```

---

## 🚧 Dépannage

Voici les problèmes les plus fréquents et leur résolution.

### ❌ « La clé API NVIDIA n'est pas configurée »

**Symptôme** : à l'ouverture de l'application, la bannière d'état est rouge et indique « NVIDIA non configuré ». Toute tentative de traitement renvoie le code `NVIDIA_NOT_CONFIGURED` (HTTP 503).

**Cause** : la variable d'environnement `NVIDIA_API_KEY` n'est pas définie (ou est vide).

**Solution** :
1. Vérifiez que le fichier `.env.local` existe à la racine du projet.
2. Vérifiez qu'il contient bien `NVIDIA_API_KEY=nvapi-...` (la clé doit commencer par `nvapi-`).
3. **Redémarrez** le serveur de développement (`Ctrl+C` puis `bun run dev`) — Next.js ne recharge pas automatiquement les variables d'environnement.
4. Vérifiez avec `curl http://localhost:3000/api/status` que `nvidiaConfigured` vaut `true`.

### ❌ « Le PDF semble être scanné (pas de texte extractible) »

**Symptôme** : erreur renvoyée lors du traitement d'un PDF.

**Cause** : le PDF est composé d'images scannées sans couche de texte sélectionnable. La bibliothèque `pdf-parse` ne peut extraire aucun texte.

**Solution** :
- Convertissez votre PDF en image (PNG ou JPEG) — par exemple avec `pdftoppm` ou un outil en ligne — puis téléversez l'image à la place. L'agent utilisera alors le modèle omni multimodal pour lire visuellement le CV.

### ❌ « Le fichier dépasse la taille maximale autorisée (10 Mo) »

**Symptôme** : HTTP 413 Payload Too Large lors du téléversement.

**Cause** : le fichier dépasse la limite de **10 Mo** (`MAX_FILE_SIZE = 10 * 1024 * 1024`).

**Solution** :
- Compressez le PDF (avec Ghostscript ou un outil en ligne).
- Réduisez la résolution de l'image (en dessous de 2 Mo suffit largement pour un CV).
- Ou modifiez la constante `MAX_FILE_SIZE` dans `src/app/api/cv/process/route.ts` et `src/app/api/nvidia/extract/route.ts` si vous avez besoin d'une limite plus généreuse.

### ❌ « Port already in use » (port 3000 déjà utilisé)

**Symptôme** : au démarrage de `bun run dev`, Next.js affiche `Port 3000 is in use`.

**Cause** : un autre processus occupe déjà le port 3000.

**Solution** :
- Identifiez le processus :
  ```bash
  lsof -i :3000   # sous Linux / macOS
  netstat -ano | findstr :3000   # sous Windows
  ```
- Tuez-le :
  ```bash
  kill -9 <PID>
  ```
- Ou démarrez Next.js sur un autre port en éditant temporairement le script :
  ```bash
  bunx next dev -p 3001
  ```

### ❌ « Le score retourné est invalide »

**Symptôme** : erreur `PROCESSING_ERROR` avec un message du type « la clé obligatoire "overallScore" est manquante ».

**Cause** : le modèle NVIDIA n'a pas retourné un JSON strictement conforme au schéma `CvScore`.

**Solution** :
- Réessayez : il s'agit le plus souvent d'un souci transitoire (réponse tronquée, hallucination).
- Si le problème persiste, vérifiez que la clé API NVIDIA est valide et que vous avez des crédits disponibles sur https://build.nvidia.com.

### ❌ La base de données est inaccessible

**Symptôme** : `curl http://localhost:3000/api/status` renvoie `"database": false`.

**Solution** :
1. Vérifiez que `DATABASE_URL` pointe vers un chemin accessible en écriture.
2. Exécutez `bun run db:push` pour (re)créer la base.
3. Vérifiez que le fichier `db/custom.db` existe.

---

## 📄 Licence

Ce projet est distribué sous licence **MIT**.

```
MIT License

Copyright (c) 2025 Agent de Transformation de CV

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📚 Documentation complémentaire

- **Guide détaillé des routes API** : voir [`docs/HOWTO.md`](docs/HOWTO.md)
- **Journal des tâches effectuées** : voir [`worklog.md`](worklog.md)
- **API NVIDIA** : https://docs.api.nvidia.com
- **Prisma ORM** : https://www.prisma.io/docs
- **Next.js 16** : https://nextjs.org/docs

---

<p align="center">
  Fait avec ❤️ et propulsé par <a href="https://build.nvidia.com">NVIDIA Nemotron</a>
</p>
