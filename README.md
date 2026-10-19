# Stellar Front — 0.0.3

Socle statique HTML/CSS/JavaScript, servi par Nginx. La connexion par mot de passe est disponible ; les écrans métier restent à porter. Ce dépôt ne contient ni PHP, ni Symfony, ni Redis, ni compte technique.

Navigateur → `${PROJECT_CODE}-web` : `/` sert les fichiers ; `/api/…` relaie vers `sk-route:80`
en retirant **uniquement** `/api/`. Exemples : `/api/FR/public/bootstrap` → `/FR/public/bootstrap`,
`/api/login_check` → `/login_check`, `/api/v1/FR/auth/login` → `/v1/FR/auth/login`.
Méthode, corps, query string et Bearer utilisateur sont transmis ; aucun Bearer de service n'est injecté.
Les callbacks `/api/internal/` et `/api/_router/` sont bloqués.
Le DNS Docker du routeur est résolu à nouveau après remplacement de son conteneur.

## Installation

1. Déployer SK puis Stellar 0.0.24, avec son compte technique configuré côté serveur.
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
