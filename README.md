# Stellar Front — 0.0.13

Socle statique HTML/CSS/JavaScript, servi par Nginx. La connexion par mot de passe est disponible ; le dashboard et la lecture des portfolios sont disponibles. Ce dépôt ne contient ni PHP, ni Symfony, ni Redis, ni compte technique.

Navigateur → `${PROJECT_CODE}-web` : `/` sert les fichiers ; `/api/…` relaie vers `sk-route:80`
en retirant **uniquement** `/api/`. Exemples : `/api/FR/public/bootstrap` → `/FR/public/bootstrap`,
`/api/login_check` → `/login_check`, `/api/v1/FR/auth/login` → `/v1/FR/auth/login`.
Méthode, corps, query string et Bearer utilisateur sont transmis ; aucun Bearer de service n'est injecté.
Les callbacks `/api/internal/` et `/api/_router/` sont bloqués.
Le DNS Docker du routeur est résolu à nouveau après remplacement de son conteneur.

## Installation

1. Déployer SK puis Stellar 0.0.25, avec son compte technique configuré côté serveur.
2. Depuis Stellar, importer `migration/014-public-bootstrap` suivant son README.
3. Ici, copier `.env.example` vers `.env` et sélectionner PROJECT_CODE/sca, le réseau et le port.
4. `sh scripts/setup-front.sh` (ou `sh scripts/setup-front.sh sca-network`).
5. Ouvrir `http://127.0.0.1:8080/` et vérifier `/api/FR/public/bootstrap`.

Le script construit l'image puis démarre le conteneur `${PROJECT_CODE}-web`. Il ne touche ni aux
données, ni aux services SK/Stellar. Il exige un réseau Docker existant. Aucun backend front supplémentaire.
Le Nginx interne `${PROJECT_CODE}-server` reste la passerelle de PHP-FPM ; il n'est pas remplacé.

Pour un test LAN : `FRONT_BIND=0.0.0.0`, choisir un port libre (ex. 8080). Pour l'accès internet,
terminer HTTPS devant ce Nginx et conserver son port lié à loopback ; ne pas envoyer de mots de passe
sur HTTP. Le certificat et le domaine public ne sont pas encore configurés dans ce socle.
Ne pas exposer directement les ports de sk-auth ou de Stellar. Les règles d'accès restent appliquées par SK.

## Bootstrap et cache

La page charge `/api/FR/public/bootstrap` sans compte ni jeton. Stellar lit une liste fermée de données
avec son compte technique privé. Seuls les libellés de connexion, langues et branding sont retournés.
Les libellés sont affichés avec textContent, sans HTML exécuté. Les logos restent des références pour
l'étape suivante ; cette version utilise le nom du client et n'ouvre aucun média privé.

`?client=cnes` sélectionne explicitement le branding public ; sans paramètre, le client par défaut
est défini dans Stellar (`STELLAR_PUBLIC_DEFAULT_CLIENT=app`). La résolution automatique depuis le
sous-domaine sera raccordée avec les pages, après définition du domaine public. Le branding ne choisit
jamais le workspace d'un utilisateur et ne donne aucun droit.

Le bootstrap seul est stocké dans sessionStorage (par origine, langue, client), au maximum cinq minutes.
Un échec de stockage n'empêche pas l'utilisation. Après expiration, le contenu est rechargé et sa révision
actualisée. Il ne s'agit pas d'un cache des réponses métier. Aucun token n'est enregistré dans ce cache.
Le refresh fera l'objet d'une prochaine étape.

## Vérifications

`node --test tests/*.test.mjs` ; `python tests/proxy.py` vérifie le proxy réel avec Docker.
La CI exécute les deux ; le test proxy n'a besoin ni de SK, ni d'un compte, ni de données métier.
`node tests/login-browser.mjs` teste le formulaire avec Playwright et une API locale synthétique
(installer Playwright et Chromium, ou définir PLAYWRIGHT_MODULE/BROWSER_EXECUTABLE).

## Connexion — 0.0.3

La page reprend le layout, les couleurs, la police Inter et le logo du frontend historique fourni.
Le formulaire appelle `/api/{language}/login_check` (alias Stellar existant) avec username/password.
Aucun nouvel import SK n'est nécessaire. Le scope app reste implicite. Le compte technique ne quitte pas Stellar.

La réponse raw est vérifiée avant de conserver le JWT utilisateur, son profil et son contexte dans
sessionStorage, limité à l'onglet. Le mot de passe et le refresh_token ne sont jamais enregistrés.
Si le stockage est refusé, la session reste uniquement en mémoire. Le cache public du bootstrap reste séparé.
La date exp du JWT sert uniquement à masquer une session expirée ; elle ne prouve aucun droit côté API.

Après succès, un écran confirme l'identité et le client courant. Il ne simule pas un dashboard ou
un consentement CGU : les écrans métier viendront ensuite. « Fermer la session sur cet onglet »
efface la session locale, sans annoncer de révocation globale côté SK.
Pas de remember-me, refresh, changement de mot de passe, mot de passe oublié ni connexion par code
dans cette étape. Les réponses must_change_password/MFA ne créent pas de session connectée.
Les contrôles historiques non raccordés ne sont pas affichés comme de fausses actions.

## Dashboard — 0.0.4

Déployer Stellar 0.0.25 avant ce front. Aucun import SK supplémentaire.
GET /{language}/dashboard fournit les quatre listes et context.clientContext (source de vérité).
PUT /{language}/clients/{id}/switch mémorise le client côté serveur, puis le dashboard est rechargé.
Les one-shots restent personnels comme dans le front historique. Les listes ne sont jamais mises en cache.
Le changement de client est sérialisé ; les anciennes réponses et données sont écartées pendant la transition.
Au retour dans l'onglet, le dashboard est relu pour reprendre une sélection faite ailleurs.
Le backend reste seul responsable des droits ; 401 ferme la session locale, 403/CGU affiche le refus.
Les liens ouvrent une lecture simple via les API métier, sans prétendre remplacer les écrans d'édition à venir.
La page de connexion reprend les arrondis et deux accès secondaires historiques ; ceux-ci annoncent
explicitement que leurs parcours ne sont pas encore portés. Aucun appel factice n'est envoyé.

## Fidélité graphique — 0.0.5

Les styles Bootstrap et Stellar historiques sont conservés dans assets/vendor et assets/legacy,
avec leur ordre de chargement original. Aucune reconstruction approximative des panneaux ou des contrôles.
Les icônes proviennent du Font Awesome livré avec le StarterKit UI, les trois graisses Inter sont locales.
Le sélecteur client et le menu utilisateur reprennent la présentation historique ; les appels API restent inchangés.

## Portfolios — 0.0.6

Liste `/portfolios` et détail `/portfolios/{id}` : reprise des templates historiques
shared/_index, portfolio/detail et des cartes portfolio/projet avec les CSS du ZIP.
Navigation depuis le dashboard, fil d’Ariane, liens directs, rechargement et historique navigateur.
Le menu retrouve One shots (lecture simple existante, écran complet à porter).
Les cartes projets ouvrent encore la lecture simple existante ; les pages projets et les formulaires
création/modification ne font pas partie de cette étape de lecture.

Les appels utilisent le JWT utilisateur et aucun cache métier. La liste GET /{language}/portfolios
est filtrée par le client courant côté API. Un détail doit appartenir à cette liste avant lecture.
Le contexte est resynchronisé via le dashboard ; changer de client depuis un portfolio ramène à la liste.
Les réponses périmées sont écartées lors des navigations/changements de client.
Aucun nouvel import ni modification SK/Stellar nécessaire.

Les dates sont affichées en toutes lettres et les compteurs utilisent les clés singulier/pluriel
historiques (pluriel uniquement au-delà de 1), y compris dans le dashboard.

### Corrections visuelles et navigation

Les widgets retrouvent overflow-y-auto du template historique (listes longues défilantes).
Le bouton Actualiser a été retiré, le fil d’Ariane reprend sa structure originale.
Les bulles One shots sont pleines ; les petites cartes du header utilisent capitalize et menuOneShots.
Le sélecteur de langue reprend les langues du bootstrap, recharge les libellés et utilise la langue
choisie pour les API et dates. La préférence reste dans la session de cet onglet.

Les logos clients (logoSmallKey) sont lus avec le JWT utilisateur depuis SK Asset, via le proxy même origine,
puis affichés comme images blob temporaires, révoquées au changement de contexte/déconnexion.
Les initiales restent le repli en l’absence de logo ou de droit de lecture.
Configurer SK_API_ROOT dans .env avec le même préfixe que Stellar/SK (v1 par défaut, par exemple vA
si c’est le préfixe de votre installation), puis reconstruire le front avec setup-front.sh.
Aucun compte de service ni jeton dans une URL d’image.

## Portefeuilles, projets et activités — 0.0.7

Liste et lecture des projets et activités, création de portefeuilles/projets, modification du contexte
d’un portefeuille et d’un projet. Les activités se créent avec les quatre étapes du formulaire historique
et se modifient depuis leur détail. Les contributions et traitements IA sont disponibles depuis la version 0.0.13.
Les actions utilisent les AutoForms et les droits de l’API existante ; les corps envoyés respectent ses schémas stricts.
Aucun nouvel import SK n’est nécessaire si les migrations Stellar existantes sont déjà installées.

Le changement de client revient au dashboard. Les logos décodés sont réutilisés pendant la session
pour éviter le clignotement. Les libellés labelFO et profiles sont lus via l’API avec le JWT utilisateur
et gardés en mémoire cinq minutes, par utilisateur et langue, puis effacés à la déconnexion.
Le profil affiché utilise la valeur de settings/profiles, jamais sa clé technique.
Les icônes sont centrées dans leur conteneur sans décalage de ligne de base.

`node tests/workspace-browser.mjs` vérifie les parcours de création/modification, les refus de droits,
les erreurs d’enregistrement, le client courant, les logos et les libellés avec une API synthétique.

## Typographie — 0.0.8

Rétablissement des règles historiques des paragraphes : taille 1.1em, graisse 300 et interligne 1.7em.
Les styles propres aux composants restent prioritaires. La police Inter Light du ZIP est embarquée
pour afficher réellement la graisse 300, sans dépendance externe.

## Modales — 0.0.10

Les formulaires reprennent les sous-titres et pieds de formulaire traduits du ZIP (labelFO),
ainsi que la hauteur minimale de 40vh des champs Contexte. Le sélecteur des chefs de projet
affiche des pastilles supprimables et recherche par nom ou e-mail, avec navigation clavier.
Les droits et les corps des appels API restent inchangés.

## Contributions et traitements IA des activités — 0.0.13

Depuis une activité : choix du groupe, compteurs par axe, historique et accès à l’analyse.
Chaque axe propose les contributions du groupe courant, les filtres, la sélection, les favoris
et la synthèse de la sélection. La capture accepte du texte formaté, un fichier audio/vidéo
ou un enregistrement au microphone. Le lecteur conserve l’original et permet de modifier la copie.
Les styles, icônes et clés labelFO proviennent du ZIP historique. L’éditeur léger propose
les commandes de mise en forme utilisées par ce parcours sans dépendance au serveur Symfony.

Le parcours narratif conserve la sélection par onglet et identité de session, charge les choix
format/longueur/intention depuis SK, crée la demande puis lance le narratif. L’analyse transverse
est déclenchée lorsque le narratif est terminé. Les deux résultats s’affichent avec copie du texte,
blocs d’analyse repliables, historique et suivi toutes les deux secondes. Le rechargement reprend
la demande identifiée dans l’URL ; un échec exige une relance explicite. Le suivi s’arrête au départ
de la page, à la déconnexion, à l’état final ou après cinq erreurs consécutives.

Les fichiers passent par `/api/{language}/assets`, puis par la transcription Stellar, avec le JWT
utilisateur. Aucun compte de service n’est exposé. Les requêtes longues ont un délai adapté ; elles
ne sont pas rejouées automatiquement. Les messages métier/IA sont affichés comme du texte.
Le HTML des contributions et résultats est reconstruit à partir de balises de mise en forme autorisées.
Les scripts, médias intégrés et attributs d’événements sont retirés.

Aucun changement SK/Stellar et aucun nouvel import. Les migrations métier 005, processing 006
et les réglages/droits existants doivent être installés. Le worker Stellar doit fonctionner pour
le narratif et l’analyse. Le microphone nécessite HTTPS (ou localhost) ; l’import reste disponible
sur le LAN HTTP. Les fichiers sont limités à 50 Mo côté navigateur, sous la limite du proxy.

Validation locale : `node --test tests/*.test.mjs`, `node tests/activity-browser.mjs`,
`node tests/workspace-browser.mjs`, `node tests/login-browser.mjs` avec Playwright/Edge.
Le test activité emploie une API, des fichiers et un microphone simulés ; il ne consomme pas
le MaaS et n’écrit aucune donnée sur les environnements déployés. Le proxy Docker est testé en CI.
