# FleetMan Chauffeur (mobile)

Application mobile **chauffeur** de FleetMan, plateforme de gestion de flotte de véhicules
(projet d'école 5GI, ENSPY). Développée avec React Native (Expo SDK 58, Expo Router), elle utilise
le même backend Spring Boot que le front web et n'accepte que les utilisateurs ayant le rôle
`FLEET_DRIVER`.

Dépôts liés :

- Backend : https://github.com/Joel-Taba/FleetMan-DES-Backend
- Front web : https://github.com/Joel-Taba/FleetMan_DES_Front

## Installation et lancement

Prérequis : Node.js, le backend FleetMan démarré (port 8081) et l'application **Expo Go**
installée sur le téléphone.

```bash
npm install
EXPO_PUBLIC_API_URL=http://<IP de l'ordinateur>:8081 npx expo start --port 8082 --host lan
```

Scanner ensuite le QR code affiché avec Expo Go (Android) ou l'appareil photo (iOS).

- Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi, et le port 8081 doit être
  autorisé par le pare-feu.
- Sur un téléphone, `localhost` désigne le téléphone lui-même : utiliser l'adresse IP locale de
  l'ordinateur (`ip -4 addr` sous Linux, `ipconfig` sous Windows).
- On peut aussi copier `.env.example` en `.env` et y définir `EXPO_PUBLIC_API_URL`. Les variables
  `EXPO_PUBLIC_*` sont intégrées au bundle : relancer `npx expo start` après une modification.

| Où tourne l'application        | Valeur de `EXPO_PUBLIC_API_URL`         |
| ------------------------------ | --------------------------------------- |
| Web (`w`) sur la même machine  | `http://localhost:8081`                 |
| Émulateur Android              | `http://10.0.2.2:8081`                  |
| Téléphone physique             | `http://<IP de l'ordinateur>:8081`      |

Les comptes se connectent avec leur **nom d'utilisateur**, pas leur adresse e-mail.

## Organisation du code

```
src/app/                 écrans (Expo Router) : connexion, onglets Accueil, Trajets,
                         Véhicule, Déclarer, Profil, détail de trajet, documents...
src/api/                 client HTTP (jeton Bearer, rafraîchissement sur 401) et appels au backend
src/auth/                session et stockage des jetons (expo-secure-store)
src/features/            logique métier : trajets et arrêts, déclarations, documents,
                         file hors ligne, suivi de position, notifications
src/hooks/               useApiQuery (cache hors ligne), useOnline
src/i18n/                traductions (clé en français, EN / DE / ES)
src/components/ui/       composants d'interface
src/theme/               thème clair / sombre et jetons de style
```

## Traductions

Le texte français sert de clé. `src/i18n/base/*.ts` est généré depuis les dictionnaires du front web :

```bash
node scripts/sync-i18n.js                 # recopier les traductions du front web
node scripts/missing-i18n.js src          # lister les textes sans traduction EN / DE / ES
```

## Vérifications

```bash
npx tsc --noEmit
npx expo lint
node --test scripts/offline-rules.test.mjs
```
