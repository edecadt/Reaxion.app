# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## API configuration

This app expects a backend API base URL.

- Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (example: `http://localhost:8080`).
- The value is embedded into the app via `app.config.ts` as `extra.apiUrl` and read at runtime.
- If it is not set, the home screen will show a warning and API calls should be considered disabled.

## Guide d’usage — Création de workflow (mobile)

Pré‑requis backend

- Backend en dev sur `http://localhost:8080` (ou configurez `EXPO_PUBLIC_API_URL`).
- CORS: le backend autorise `http://localhost:8082` par défaut.

Scénarios rapides

- Timer → Log
  1. Nom + Actif (optionnel), un id est généré.
  2. Ajoutez un nœud, choisissez `timer` puis Trigger `cron` et renseignez une expression à 6 champs (ex: `*/20 * * * * *`).
  3. Ajoutez un second nœud, choisissez `timer` puis Réaction `log` et entrez un message + niveau.
  4. Chaînez le premier nœud vers le second via `next`.
  5. Corrigez les validations si besoin, puis “Créer”.
  6. Dans le récap, vous pouvez “Activer” et “Exécuter maintenant”.
- Webhook → Log
  1. Créez un nœud `test-webhook` → Trigger `on-test-webhook` (pas de paramètres).
  2. Ajoutez un nœud `timer` → Réaction `log` et renseignez le message.
  3. Chaînez le premier vers le second, “Créer”.
  4. Copiez l’URL webhook affichée et envoyez un POST JSON vers `/webhooks/test-webhook/test/:token` avec `{ "type": "test", "message": "..." }`.
  5. Le scheduler déclenchera le workflow (latence ~5s).

Étapes pour tester

- Créer un workflow, l’activer, l’exécuter, vérifier le runId.
- Tester le webhook avec un POST, puis observer le déclenchement.

Notes UI

- États loading/empty/error intégrés avec spinners et toasts.
- Les erreurs techniques sont simplifiées en messages lisibles.

## Mes workflows (liste)

Pré‑requis

- Définissez `EXPO_PUBLIC_API_URL` dans `apps/mobile/.env` (ex: `http://localhost:8080`).

Accès

- Depuis l’accueil, appuyez sur le bouton « Mes workflows » pour ouvrir la liste.
- Tirez pour rafraîchir (pull‑to‑refresh) afin de recharger les workflows.

Affichage

- Chaque élément affiche: nom, badge « Actif/Inactif », ID, nombre de nœuds et nœud d’entrée.
- En cas d’erreur réseau/API, un message et un bouton « Réessayer » sont proposés, avec un toast.
