/**
 * CV d'exemple réalistes pour tester l'interface sans clé API NVIDIA.
 *
 * Trois profils sont disponibles :
 *  - full    : profil confirmé polyvalent (score ~82)
 *  - junior  : profil débutant (score ~68)
 *  - senior  : profil senior avec leadership (score ~91)
 */

import type { ParsedCv } from '@/lib/cv/types'

export const SAMPLE_CVS: Record<string, ParsedCv> = {
  full: {
    personalInfo: {
      fullName: 'Marie Laurent',
      email: 'marie.laurent@email.com',
      phone: '+33 6 78 90 12 34',
      location: 'Lyon, France',
      website: 'https://marie-laurent.dev',
      linkedin: 'linkedin.com/in/marie-laurent',
      github: 'github.com/mlaurent',
      title: 'Développeuse Full-Stack',
      summary:
        "Développeuse full-stack avec 6 ans d'expérience dans la conception et le développement d'applications web modernes. Passionnée par les architectures scalables, l'UX et l'innovation. Expérience internationale en startup et grande entreprise.",
    },
    workExperience: [
      {
        title: 'Lead Developer',
        company: 'TechNova (Startup)',
        startDate: '2022',
        endDate: 'présent',
        location: 'Lyon',
        description:
          "Pilote technique d'une équipe de 5 développeurs. Migration d'une architecture monolithique vers microservices (Node.js + React + AWS). Réduction du temps de déploiement de 40%.\nMise en place d'une CI/CD complète et de tests automatisés (couverture 85%).",
      },
      {
        title: 'Développeuse Full-Stack',
        company: 'Digital Services SA',
        startDate: '2019',
        endDate: '2022',
        location: 'Paris',
        description:
          "Développement de plateformes SaaS pour des clients B2B. Stack : React, TypeScript, Node.js, PostgreSQL.\nIntégration de services IA (OpenAI, AWS Rekognition).",
      },
      {
        title: 'Développeuse Front-End',
        company: 'Web Agency Créatif',
        startDate: '2018',
        endDate: '2019',
        location: 'Bordeaux',
        description:
          'Création de sites vitrines et e-commerce pour des PME. HTML/CSS/JS, Vue.js, WordPress.',
      },
    ],
    education: [
      {
        degree: 'Master en Informatique — Logiciels',
        institution: 'Université Claude Bernard Lyon 1',
        startDate: '2015',
        endDate: '2018',
        field: 'Spécialité Génie Logiciel',
        description: 'Mention Bien. Projet de fin d\'études sur les architectures microservices.',
      },
      {
        degree: 'Licence en Informatique',
        institution: 'Université de Bordeaux',
        startDate: '2012',
        endDate: '2015',
        field: 'Informatique générale',
      },
    ],
    skills: [
      { name: 'JavaScript', level: 'Expert', category: 'Langages' },
      { name: 'TypeScript', level: 'Expert', category: 'Langages' },
      { name: 'React', level: 'Expert', category: 'Frontend' },
      { name: 'Node.js', level: 'Avancé', category: 'Backend' },
      { name: 'PostgreSQL', level: 'Avancé', category: 'Base de données' },
      { name: 'AWS', level: 'Intermédiaire', category: 'Cloud' },
      { name: 'Docker', level: 'Avancé', category: 'DevOps' },
      { name: 'Git', level: 'Expert', category: 'Outils' },
      { name: 'Figma', level: 'Intermédiaire', category: 'Design' },
      { name: 'Agile / Scrum', level: 'Avancé', category: 'Méthodologie' },
    ],
    languages: [
      { name: 'Français', level: 'Natif' },
      { name: 'Anglais', level: 'C1 — Courant' },
      { name: 'Espagnol', level: 'B2 — Intermédiaire' },
    ],
    projects: [
      {
        name: 'OpenMeteoApp',
        description: 'Application météo open source avec prévisions hyperlocales (12k étoiles GitHub).',
        url: 'github.com/mlaurent/openmeteoapp',
      },
      {
        name: 'DevPortfolio CMS',
        description: 'CMS headless pour portfolios de développeurs, utilisé par 500+ devs.',
        url: 'devportfolio.io',
      },
    ],
    certifications: [
      { name: 'AWS Certified Developer — Associate', issuer: 'Amazon Web Services', date: '2023' },
      { name: 'Professional Scrum Master I', issuer: 'Scrum.org', date: '2021' },
    ],
    interests: ['Trail running', 'Photographie', 'Contributions open source', 'Cuisine japonaise'],
    detectedLanguage: 'fr',
  },

  junior: {
    personalInfo: {
      fullName: 'Thomas Petit',
      email: 'thomas.petit@email.com',
      phone: '+33 7 01 23 45 67',
      location: 'Nantes, France',
      linkedin: 'linkedin.com/in/thomas-petit',
      github: 'github.com/tpetit',
      title: 'Développeur Front-End Junior',
      summary:
        "Diplômé d'un Master en Informatique, passionné par le développement web front-end et l'UX. À la recherche de mon premier poste pour mettre en pratique mes compétences en React et TypeScript.",
    },
    workExperience: [
      {
        title: 'Stage Développeur Front-End',
        company: 'Startup Nantaise',
        startDate: '2024',
        endDate: '2024',
        location: 'Nantes',
        description:
          "Stage de fin d'études (6 mois). Développement de composants React réutilisables et refonte de l'interface d'un dashboard SaaS.",
      },
      {
        title: 'Stage Développeur Web',
        company: 'Agence Web Loire',
        startDate: '2023',
        endDate: '2023',
        location: 'Nantes',
        description: 'Stage de 3 mois. Création de sites vitrines avec WordPress et intégration HTML/CSS.',
      },
    ],
    education: [
      {
        degree: 'Master Informatique — Web Mobile',
        institution: 'Polytech Nantes',
        startDate: '2022',
        endDate: '2024',
        field: 'Spécialité Développement Web',
      },
      {
        degree: 'Licence Informatique',
        institution: 'Université de Nantes',
        startDate: '2019',
        endDate: '2022',
      },
    ],
    skills: [
      { name: 'HTML/CSS', level: 'Avancé', category: 'Frontend' },
      { name: 'JavaScript', level: 'Intermédiaire', category: 'Langages' },
      { name: 'React', level: 'Intermédiaire', category: 'Frontend' },
      { name: 'TypeScript', level: 'Débutant', category: 'Langages' },
      { name: 'Git', level: 'Intermédiaire', category: 'Outils' },
      { name: 'Figma', level: 'Intermédiaire', category: 'Design' },
    ],
    languages: [
      { name: 'Français', level: 'Natif' },
      { name: 'Anglais', level: 'B2 — Intermédiaire' },
    ],
    projects: [
      {
        name: 'Portfolio personnel',
        description: 'Site portfolio développé en React/Next.js avec animations Framer Motion.',
        url: 'thomaspetit.fr',
      },
      {
        name: 'App Méteo (projet école)',
        description: "Application météo consommant l'API OpenWeatherMap, réalisée en équipe de 3.",
      },
    ],
    certifications: [
      { name: 'TOEIC 850', issuer: 'ETS', date: '2023' },
    ],
    interests: ['Jeux vidéo', 'Musique (guitare)', 'Sport (badminton)'],
    detectedLanguage: 'fr',
  },

  senior: {
    personalInfo: {
      fullName: 'Sophie Moreau',
      email: 'sophie.moreau@email.com',
      phone: '+33 6 12 34 56 78',
      location: 'Paris, France',
      linkedin: 'linkedin.com/in/sophie-moreau',
      website: 'sophiemoreau.tech',
      title: 'VP of Engineering — Tech Lead',
      summary:
        "Leader technique avec 12+ ans d'expérience dans le pilotage d'équipes d'ingénierie de 20+ personnes. Expertise en architecture distribuée, transformation digitale et accompagnement de startups en hypercroissance. Passée par scale-up européenne et FATEC 100.",
    },
    workExperience: [
      {
        title: 'VP of Engineering',
        company: 'UnicornStartup (Série C)',
        startDate: '2021',
        endDate: 'présent',
        location: 'Paris',
        description:
          "Direction de 4 équipes d'ingénierie (28 personnes). Pilotage de la refonte de l'architecture microservices (Kubernetes, Go, Python). Réduction des coûts d'infrastructure de 35% (-1,2M€/an).\nMentorat de 4 tech leads, mise en place d'un programme d'architecture review.",
      },
      {
        title: 'Engineering Manager',
        company: 'GlobalTech Group',
        startDate: '2018',
        endDate: '2021',
        location: 'Paris',
        description:
          "Management d'une équipe de 12 ingénieurs. Livraison de 3 produits SaaS B2B (chiffre d'affaires généré : 8M€). Migration de l'infrastructure vers AWS (EKS, RDS, Lambda).\nAugmentation du taux de rétention de 22%.",
      },
      {
        title: 'Senior Software Engineer',
        company: 'InnovCorp',
        startDate: '2014',
        endDate: '2018',
        location: 'Lyon',
        description:
          "Développement d'une plateforme big data traitant 500M d'événements/jour (Java, Kafka, Spark). Leadership technique sur 3 projets majeurs.\nDépôt de 2 brevets.",
      },
      {
        title: 'Software Engineer',
        company: 'TechStart',
        startDate: '2012',
        endDate: '2014',
        location: 'Lyon',
        description: 'Développement full-stack (Python, Django, PostgreSQL, AngularJS).',
      },
    ],
    education: [
      {
        degree: 'MBA — Management de l\'Innovation',
        institution: 'HEC Paris',
        startDate: '2016',
        endDate: '2018',
        field: 'Executive MBA',
      },
      {
        degree: 'Ingénieure Diplômée — Informatique',
        institution: 'INSA Lyon',
        startDate: '2008',
        endDate: '2012',
        field: 'Spécialité Informatique',
        description: 'Major de promotion. Stage de fin d\'études chez Google (Mountain View).',
      },
    ],
    skills: [
      { name: 'Leadership technique', level: 'Expert', category: 'Soft skills' },
      { name: 'Architecture distribuée', level: 'Expert', category: 'Architecture' },
      { name: 'Kubernetes', level: 'Expert', category: 'DevOps' },
      { name: 'Go', level: 'Avancé', category: 'Langages' },
      { name: 'Python', level: 'Expert', category: 'Langages' },
      { name: 'AWS', level: 'Expert', category: 'Cloud' },
      { name: 'Kafka', level: 'Avancé', category: 'Big Data' },
      { name: 'Spark', level: 'Avancé', category: 'Big Data' },
      { name: 'Strategy & Vision', level: 'Expert', category: 'Soft skills' },
      { name: 'Recrutement', level: 'Expert', category: 'Soft skills' },
    ],
    languages: [
      { name: 'Français', level: 'Natif' },
      { name: 'Anglais', level: 'C2 — Bilingue' },
      { name: 'Allemand', level: 'B1 — Seuil' },
    ],
    projects: [
      {
        name: 'Conférence AWS re:Invent 2023',
        description: 'Keynote speaker sur l\'architecture multi-régions à 10k participants.',
        url: 'awsreinvent2023.com/talks/smoreau',
      },
    ],
    certifications: [
      { name: 'AWS Solutions Architect — Professional', issuer: 'Amazon Web Services', date: '2022' },
      { name: 'Certified Kubernetes Administrator (CKA)', issuer: 'CNCF', date: '2021' },
      { name: 'PMP — Project Management Professional', issuer: 'PMI', date: '2019' },
    ],
    interests: ['Mentorat de femmes dans la tech', 'Triathlon', 'Lecture', 'IA éthique'],
    detectedLanguage: 'fr',
  },
}
