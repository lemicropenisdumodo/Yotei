# Yotei

Un refuge privé pour un cercle d’amis. Client React, TypeScript et Vite en français, hébergé sur GitHub Pages. Supabase assure les sessions, la base PostgreSQL, les médias et la messagerie.

## Démarrage local

Utiliser Node 24, puis `npm ci` et `npm run dev`. Ouvrir le chemin `/Yotei/` indiqué par Vite. `npm run build` vérifie TypeScript et produit le site dans `dist/`. Les deux paramètres Vite publics peuvent être remplacés à partir de `.env.example`. Les secrets administratifs restent dans Supabase.

## Mise en service depuis un téléphone

1. Dans **Settings → Pages → Build and deployment**, choisir **GitHub Actions**. Dans **Actions → Yotei Pages**, relancer le déploiement si nécessaire. Adresse prévue : https://dada2777.github.io/Yotei/.
2. Dans Supabase **Authentication → Sign In / Providers**, désactiver **Allow new users to sign up** et l’authentification anonyme. Dans **URL Configuration**, utiliser l’adresse Pages avec son slash final comme Site URL et comme redirection autorisée. Vérifier l’envoi de courriels de récupération pour les adresses du cercle. L’expéditeur Supabase par défaut peut être limité aux membres de l’équipe du projet. Un SMTP autorisant vos destinataires est alors nécessaire pour la récupération.
3. Vérifier l’historique des migrations avant d’appliquer le fichier de `supabase/migrations/`. Il complète les quatre tables de départ. L’audit initial a trouvé douze politiques autorisant la lecture aux utilisateurs authentifiés et les écritures aux propriétaires. La migration ajoute une condition restrictive d’adhésion à ces politiques, limite les privilèges de colonnes, et crée les autres tables et le bucket privé. Les créations de comptes sans invitation sont aussi refusées par la base. Aucun compte existant n’est promu automatiquement.
4. Déployer `supabase/functions/invitations` à partir de la version du dépôt. Sa configuration assure la vérification du jeton utilisateur dans la fonction, puis du rôle administrateur en base. Le mode d’amorçage envoie uniquement un courriel à l’adresse initialement réservée.
5. Pour initialiser une instance vide, dans **SQL Editor**, exécuter la requête ci-dessous avec l’adresse réelle. Dans **Authentication → Users → Invite user**, inviter cette même adresse. Une invitation émise avant la réservation ne crée pas d’administrateur. Ouvrir le courriel et choisir un mot de passe. L’adresse réelle n’est pas versionnée.

```sql
insert into yotei_private.bootstrap(email)
values (lower('ADRESSE-DU-PROPRIETAIRE'))
on conflict do nothing;
```

## Utilisation

- Dans **Profil**, choisir un pseudo, une bio, une image, une bannière, une couleur et une musique. Les demandes d’amitié se lancent depuis l’annuaire et s’acceptent depuis le profil. Le livre d’or est partagé avec les membres actifs.
- Le fil affiche les dernières publications en premier. Chaque membre peut commenter, aimer et supprimer ses propres publications. Les administrateurs disposent de la suppression sur toutes les publications.
- Dans **Messages**, sélectionner un ou plusieurs destinataires. Les nouveaux messages et notifications passent par Supabase Realtime sous RLS. Le nombre de messages non lus figure dans la navigation. La présence correspond à une activité dans les 90 dernières secondes.
- Dans **Administration**, créer une invitation nominative et transmettre le lien à son destinataire par un canal privé. Ce lien est un secret à usage unique. Les membres et invitations en attente peuvent être suspendus. Une suspension interrompt les accès en base, y compris avec une session existante.
- Les images du cercle sont limitées à 5 Mo et téléchargées avec la session active depuis le bucket privé. Les photos du fil et des profils sont visibles par le cercle. Les conversations sont accessibles à leurs seuls participants actifs.

## Vérification

`npm test` applique les migrations et vérifie les scénarios RLS dans PostgreSQL embarqué (PGlite), avec des interfaces locales pour Auth et Storage. Ces tests sont aussi exécutés dans GitHub Actions.

Exécuter `supabase/tests/access.sql` après la migration dans une base de test ou dans SQL Editor sous le rôle postgres. Le script ouvre une transaction, crée trois identités temporaires, exerce les rôles anon et authenticated, puis annule les écritures. Il vérifie l’admission sur invitation, les likes, les commentaires, les notifications, la confidentialité des conversations, les droits du propriétaire et la suspension. Une exception indique un échec. En cas d’arrêt manuel, annuler la transaction avant de poursuivre.

Le workflow Pages compile le client avant de le déployer. L’activation du backend Supabase est distincte du déploiement du client.
