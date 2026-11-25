// Contenu de référencement partagé entre la page d'accueil (Home.jsx) et le build (tools/seo.js) :
// mots-clés, foire aux questions (affichée ET publiée en données structurées FAQPage), texte « genre ».
// Les noms de jeux cités (SimCity, Les Sims, Caesar, Cities: Skylines…) servent uniquement à situer le
// genre : marques de leurs propriétaires, sans lien avec Imperium Urbis (mention affichée sur la page).

// Mots-clés, du plus large au plus précis. Sert à la balise <meta name="keywords"> (ignorée par Google,
// lue par Bing, Yandex et certains annuaires) et de liste de travail pour les textes de la page.
export const MOTS_CLES = {
  'Jeux en ligne': [
    'jeu en ligne', 'jeux en ligne', 'jeu navigateur', 'jeu sur navigateur', 'jeu sans téléchargement',
    'jeu sans installation', 'jeu web', 'jeu HTML5', 'jeu WebGL', 'jeu 3D en ligne', 'jeu PC navigateur',
    'jeu mobile navigateur', 'jeu solo en ligne', 'browser game', 'online game', 'no download game',
  ],
  'Jeux de gestion et construction': [
    'jeu de gestion', 'jeu de gestion en ligne', 'jeu de construction', 'jeu de construction de ville',
    'jeu de construction en ligne', 'jeu de gestion de ville', 'city builder', 'city-builder', 'city building game',
    'jeu de simulation', 'simulation de ville', 'jeu de stratégie', 'jeu de stratégie en ligne',
    'jeu de bâtisseur', 'jeu d’urbanisme', 'jeu de gestion économique', 'tycoon', 'city simulator', 'town builder',
  ],
  'Dans le style de': [
    'jeu comme SimCity', 'jeu type SimCity', 'alternative à SimCity', 'SimCity en ligne', 'SimCity navigateur',
    'jeu comme Les Sims', 'jeu style Sims', 'jeu comme Caesar 3', 'jeu comme Caesar 4', 'Caesar III', 'Caesar IV',
    'jeu comme Pharaoh', 'jeu comme Cities Skylines', 'jeu comme Anno', 'jeu comme Banished', 'jeu comme Tropico',
    'jeu comme Age of Empires', 'jeu comme Civilization', 'games like SimCity', 'games like Caesar 3',
  ],
  'Rome antique': [
    'jeu romain', 'jeu Rome antique', 'jeu antiquité', 'cité romaine', 'construire une cité romaine',
    'jeu Empire romain', 'gouverneur romain', 'jeu historique', 'jeu de gestion historique', 'Roman city builder',
  ],
  'Gameplay': [
    'chaînes de production', 'gestion des ressources', 'construire une ville', 'bâtir une ville', 'aqueducs',
    'logements', 'villas', 'monuments', 'commerce', 'campagne', 'partie libre', 'bac à sable', 'sandbox',
  ],
};

export const MOTS_CLES_LISTE = [...new Set(Object.values(MOTS_CLES).flat())];
// Version courte pour la balise meta (les moteurs qui la lisent tronquent au-delà de ~25 termes).
export const MOTS_CLES_META = [
  'Imperium Urbis', 'jeu en ligne', 'jeu navigateur', 'jeu sans téléchargement', 'jeu de gestion',
  'jeu de construction de ville', 'city builder', 'jeu de simulation', 'jeu de stratégie', 'jeu comme SimCity',
  'alternative à SimCity', 'jeu style Sims', 'jeu comme Caesar 3', 'Caesar IV', 'jeu comme Cities Skylines',
  'jeu Rome antique', 'cité romaine', 'jeu 3D en ligne', 'jeu WebGL', 'browser city builder',
];

export const GENRE = {
  titre: 'Un city-builder en ligne, dans la lignée de SimCity et Caesar',
  paragraphes: [
    'Vous aimez les jeux de construction de ville comme SimCity, Caesar III, Caesar IV, Pharaoh ou Cities: Skylines ? Imperium Urbis reprend ce qui fait le sel du genre — tracer des routes, zoner des quartiers, équilibrer l’économie, répondre aux besoins des habitants — et le transpose dans la Rome antique.',
    'Comme dans Les Sims, vos citoyens ont des besoins concrets : eau, nourriture variée, religion, éducation, thermes. Les satisfaire fait évoluer leur logement, de la tente jusqu’à la villa. Comme dans un jeu de stratégie, il faut aussi défendre la province et garder la faveur de César.',
    'Le tout est un jeu en ligne jouable directement dans le navigateur, sans téléchargement ni installation, sur PC, Mac, tablette ou smartphone.',
  ],
  marques: 'SimCity, Les Sims, Caesar, Pharaoh, Cities: Skylines, Anno, Banished, Tropico, Age of Empires et Civilization sont des marques de leurs propriétaires respectifs. Imperium Urbis est un jeu indépendant, sans lien avec ces éditeurs.',
};

export const FAQ = [
  ['Imperium Urbis est-il un jeu comme SimCity ?', 'Oui, c’est un city-builder : vous tracez routes et quartiers, gérez l’eau, la nourriture, l’économie et les services publics, comme dans SimCity. La différence : tout se passe dans la Rome antique, avec des chaînes de production, des monuments et une campagne en quatre provinces, à la manière de Caesar III et Caesar IV.'],
  ['Peut-on jouer en ligne sans téléchargement ?', 'Oui. Imperium Urbis est un jeu sur navigateur : il tourne dans Chrome, Edge, Firefox ou Safari récents grâce à WebGL, sans rien installer, sur ordinateur comme sur smartphone ou tablette (commandes tactiles : glisser, pincer, tourner à deux doigts).'],
  ['Est-ce un jeu de simulation de vie comme Les Sims ?', 'Pas tout à fait : vous ne dirigez pas un personnage, mais toute une ville. On retrouve toutefois l’esprit des Sims dans les besoins des habitants (eau, vivres, temple, école, thermes) qui font évoluer leurs maisons, de la tente à la villa.'],
  ['Comment se passe le paiement ?', 'Par carte bancaire sur la page sécurisée de Stripe. Une fois le paiement validé, vous revenez ici et le jeu s’ouvre directement.'],
  ['Mon achat est-il conservé ?', 'L’achat est mémorisé par un cookie sur le navigateur utilisé pour payer. Si vous effacez vos cookies ou changez d’appareil, gardez votre reçu Stripe et contactez-nous.'],
  ['Où sont mes parties ?', 'Dans le stockage de votre navigateur, avec une copie en ligne de chaque sauvegarde (fichier .txt) dans notre base de données. Le bouton « Exporter » télécharge un fichier de sauvegarde que vous pouvez réimporter ici ou ouvrir dans la version Windows.'],
  ['Que deviennent mes données de sauvegarde ?', 'Toutes les données de sauvegarde de partie sont utilisées à des fins d’apprentissage de modèles d’IA, dans le but d’améliorer leurs performances de représentation d’arborescences de données.'],
];
