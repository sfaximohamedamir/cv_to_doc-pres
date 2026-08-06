/**
 * Constructeurs de prompts pour les modèles NVIDIA.
 *
 * Ce module centralise tous les prompts envoyés aux modèles Nemotron :
 *  - extraction structurée d'un CV (texte ou image) vers le format `ParsedCv`.
 *  - scoring d'un CV vers le format `CvScore`.
 *  - guidance de schéma JSON réutilisable.
 *
 * Les prompts sont volontairement détaillés et en français pour garantir
 * une cohérence maximale avec les types définis dans `@/lib/cv/types`.
 */

/**
 * Construit le schéma JSON attendu pour un `ParsedCv`, sous forme de chaîne
 * de caractères destinée à être incluse dans un prompt.
 *
 * Ce schéma est dérivé directement de l'interface `ParsedCv` de
 * `@/lib/cv/types` et documente chaque champ attendu.
 *
 * @returns Une chaîne décrivant la structure JSON attendue.
 */
export function buildStructuredExtractionGuidance(): string {
  return `{
  "personalInfo": {
    "fullName": "string — Nom complet du candidat (obligatoire)",
    "email": "string — Adresse email (optionnel)",
    "phone": "string — Numéro de téléphone (optionnel)",
    "location": "string — Ville, pays (optionnel)",
    "website": "string — Site web personnel (optionnel)",
    "linkedin": "string — URL LinkedIn (optionnel)",
    "github": "string — URL GitHub (optionnel)",
    "title": "string — Titre professionnel / poste recherché (optionnel)",
    "summary": "string — Résumé ou profil professionnel (optionnel)"
  },
  "workExperience": [
    {
      "title": "string — Intitulé du poste (obligatoire)",
      "company": "string — Nom de l'entreprise (obligatoire)",
      "startDate": "string — Date de début au format texte libre, ex: 'Janvier 2021' (obligatoire)",
      "endDate": "string — Date de fin au format texte libre, ou 'présent' (obligatoire)",
      "description": "string — Description des missions et réalisations, en prose ou en puces concaténées (obligatoire)",
      "location": "string — Localisation (ville, pays) (optionnel)"
    }
  ],
  "education": [
    {
      "degree": "string — Diplôme ou certification (obligatoire)",
      "institution": "string — Établissement (obligatoire)",
      "startDate": "string — Date de début (obligatoire)",
      "endDate": "string — Date de fin (obligatoire)",
      "field": "string — Mention ou spécialisation (optionnel)",
      "description": "string — Description (optionnel)"
    }
  ],
  "skills": [
    {
      "name": "string — Nom de la compétence (obligatoire)",
      "level": "string — Niveau : 'débutant' | 'intermédiaire' | 'avancé' | 'expert' (optionnel)",
      "category": "string — Catégorie : 'technique' | 'linguistique' | 'logiciel' | 'soft skill' | 'autre' (optionnel)"
    }
  ],
  "languages": [
    {
      "name": "string — Nom de la langue (obligatoire)",
      "level": "string — Niveau : A1|A2|B1|B2|C1|C2|natif|courant|professionnel (optionnel)"
    }
  ],
  "projects": [
    {
      "name": "string — Nom du projet (obligatoire)",
      "description": "string — Description (optionnel)",
      "url": "string — URL du projet (optionnel)"
    }
  ],
  "certifications": [
    {
      "name": "string — Nom de la certification (obligatoire)",
      "issuer": "string — Organisme émetteur (optionnel)",
      "date": "string — Date d'obtention (optionnel)"
    }
  ],
  "interests": ["string — Centre d'intérêt"],
  "references": [
    {
      "name": "string — Nom du référent (obligatoire)",
      "contact": "string — Coordonnées (optionnel)",
      "relationship": "string — Lien avec le candidat (optionnel)"
    }
  ],
  "detectedLanguage": "string — Code ISO 639-1 de la langue principale du CV (ex: 'fr', 'en')"
}`;
}

/**
 * Construit les prompts (système + utilisateur) pour l'extraction structurée
 * d'un CV. Le modèle doit retourner STRICTEMENT du JSON conforme à `ParsedCv`.
 *
 * @param language - Langue souhaitée pour le contenu du résumé et des descriptions
 *                   extraits (par défaut : non spécifié, on garde la langue d'origine).
 * @returns Un objet `{ system, user }` contenant les deux prompts.
 */
export function buildExtractionPrompt(
  language?: string
): { system: string; user: string } {
  const languageInstruction = language
    ? `Toute valeur de type "summary" ou "description" que tu rédiges (et non extraite verbatim) doit être rédigée en ${language}. Si tu recopies verbatim du contenu source, conserve sa langue d'origine.`
    : "Conserve la langue d'origine du contenu source pour les champs recopiés verbatim.";

  const system = `Tu es un assistant expert en traitement de CV.
Ta tâche : lire un CV (fourni sous forme de texte ou d'image) et l'extraire
sous une forme structurée STRICTEMENT conforme au schéma JSON demandé.

Règles impératives :
1. Tu ne dois retourner QUE du JSON valide, sans texte avant ni après,
   sans commentaires, sans markdown, sans backticks.
2. Aucune clé hors schéma ne doit être présente.
3. Les champs marqués "obligatoire" doivent toujours être présents et non vides
   (utilise une chaîne vide "" si l'information est réellement introuvable,
   mais essaie toujours de l'inférer à partir du contexte).
4. Pour les tableaux (workExperience, education, skills, languages, projects,
   certifications, references), retourne un tableau vide [] si aucune
   information n'est trouvée.
5. Pour les dates, conserve le format texte libre tel qu'il apparaît
   (ex: "Janvier 2021", "2020-2023", "Septembre 2018 - Juin 2021").
   Si une expérience est en cours, utilise "présent" pour endDate.
6. Pour "detectedLanguage", identifie la langue principale du CV
   (code ISO 639-1 : fr, en, es, de, it, pt, ...).
7. ${languageInstruction}
8. Nettoie le texte : supprime les caractères parasites, normalise les
   puces, fusionne les lignes coupées de manière incohérente.
9. Si le CV contient des abréviations courantes (ex: "CDI", "CDD", "BTS",
   "DUT", "Master"), conserve-les telles quelles mais assure-toi que le
   contexte est compréhensible.

Schéma JSON STRICT attendu en sortie :
${buildStructuredExtractionGuidance()}`;

  const user = `Voici le contenu d'un CV à extraire et structurer.

Réponds UNIQUEMENT avec un objet JSON valide conforme au schéma suivant.
N'ajoute AUCUN texte explicatif, AUCUN markdown, AUCUNE balise de code.

Schéma attendu :
${buildStructuredExtractionGuidance()}

Rappels importants :
- "personalInfo.fullName" est obligatoire. Si tu ne trouves pas de nom complet,
  utilise "Nom non identifié".
- Toutes les clés présentes dans le schéma doivent exister dans ta réponse.
- Pour chaque expérience / formation, les champs title/degree, company/institution,
  startDate et endDate sont obligatoires.
- "skills" doit contenir TOUTES les compétences mentionnées (techniques, logiciels,
  langues de programmation, outils, méthodologies, soft skills, etc.).
- "languages" doit contenir uniquement les langues humaines parlées/écrites
  (français, anglais, espagnol, ...), PAS les langages de programmation.
- "detectedLanguage" doit refléter la langue dominante du CV.

Contenu du CV à traiter :`;

  return { system, user };
}

/**
 * Construit les prompts (système + utilisateur) pour le scoring d'un CV.
 *
 * Le scoring couvre 7 catégories notées chacune de 0 à 100, accompagnées
 * d'un commentaire. La réponse doit être STRICTEMENT du JSON conforme
 * à l'interface `CvScore`.
 *
 * @param language - Langue souhaitée pour les commentaires et recommandations
 *                   (par défaut : français).
 * @returns Un objet `{ system, user }` contenant les deux prompts.
 */
export function buildScoringPrompt(
  language?: string
): { system: string; user: string } {
  const outputLanguage = language ?? 'français';

  const system = `Tu es un recruteur senior et expert en ressources humaines.
Ta tâche : évaluer objectivement un CV et produire un score détaillé.

Tu dois retourner STRICTEMENT du JSON valide, sans texte avant ni après,
sans markdown, sans backticks, conforme au schéma suivant :

{
  "overallScore": "number — Score global sur 100 (moyenne pondérée des catégories)",
  "categories": [
    {
      "name": "string — Nom EXACT de la catégorie (parmi les 7 catégories imposées)",
      "score": "number — Note entre 0 et 100",
      "comment": "string — Commentaire justificatif en ${outputLanguage}, 1 à 3 phrases"
    }
  ],
  "strengths": ["string — Point fort du CV (3 à 6 éléments)"],
  "improvements": ["string — Axe d'amélioration concret (3 à 6 éléments)"],
  "recommendation": "string — Recommandation globale en ${outputLanguage}, 2 à 4 phrases",
  "seniorityLevel": "string — Niveau estimé parmi : 'débutant' | 'intermédiaire' | 'confirmé' | 'senior' | 'lead' | 'expert'"
}

Les 7 catégories IMPOSÉES (utilise EXACTEMENT ces noms, dans cet ordre) :
1. "Clarté et structure" — Lisibilité, organisation des sections, hiérarchie
   visuelle, cohérence du format.
2. "Impact et réalisations" — Présence de résultats quantifiés, verbes d'action,
   indicateurs de performance, valeur ajoutée démontrée.
3. "Compétences" — Pertinence et richesse des compétences techniques et
   transversales, alignment avec le poste visé.
4. "Expérience professionnelle" — Progression de carrière, durée des postes,
   diversité des missions, niveau de responsabilité.
5. "Formation" — Pertinence du parcours académique, certifications
   complémentaires, formation continue.
6. "Présentation et orthographe" — Qualité rédactionnelle, orthographe,
   grammaire, ponctuation, longueur des phrases.
7. "Adéquation au marché" — Adéquation du profil avec les attentes actuelles
   du marché de l'emploi pour le poste/secteur visé.

Barème indicatif :
- 90-100 : Excellent, CV exceptionnel
- 75-89 : Très bon CV
- 60-74 : Bon CV, améliorations mineures
- 40-59 : CV moyen, améliorations nécessaires
- 0-39 : CV faible, retravail important requis

Règles :
- "overallScore" doit être cohérent avec la moyenne (pondérée) des catégories.
  Pondérations suggérées : Clarté 15%, Impact 20%, Compétences 15%,
  Expérience 25%, Formation 10%, Présentation 10%, Adéquation 5%.
- "categories" doit contenir EXACTEMENT 7 entrées, une par catégorie imposée.
- "strengths" et "improvements" doivent contenir entre 3 et 6 éléments.
- Tous les commentaires et textes doivent être rédigés en ${outputLanguage}.
- Sois honnête, critique mais constructif. N'inflates pas les scores.`;

  const user = `Voici le contenu structuré d'un CV à évaluer.

Réponds UNIQUEMENT avec un objet JSON valide conforme au schéma fourni.
N'ajoute AUCUN texte explicatif, AUCUN markdown, AUCUNE balise de code.

Rappels :
- Utilise EXACTEMENT les 7 noms de catégories imposés.
- Chaque score de catégorie doit être un nombre entier entre 0 et 100.
- "overallScore" doit être un nombre entier entre 0 et 100.
- "strengths" et "improvements" : 3 à 6 éléments concrets et spécifiques.
- "seniorityLevel" doit être l'une des valeurs autorisées.

Contenu du CV à évaluer :`;

  return { system, user };
}
