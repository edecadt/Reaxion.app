# ACTION-REACTION

Une plateforme d'automatisation complète inspirée de IFTTT et Zapier, développée avec une architecture moderne et multi-clients.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [API Documentation](#api-documentation)
- [Services disponibles](#services-disponibles)
- [Développement](#développement)
- [Déploiement](#déploiement)
- [Contribution](#contribution)

## 🎯 Vue d'ensemble

Action-Reaction est une suite logicielle permettant aux utilisateurs de créer des automatisations (AREA) en interconnectant des **Actions** (déclencheurs) et des **REActions** (actions à exécuter) provenant de différents services externes.

### Fonctionnalités principales

- **Gestion utilisateur** : Inscription, authentification (email/mot de passe + OAuth2)
- **Services multiples** : Intégration avec des services externes (Google, Facebook, OneDrive, etc.)
- **AREA personnalisables** : Création d'automatisations Action → REAction
- **Hooks automatiques** : Système de surveillance et déclenchement automatique
- **Clients multiples** : Interface web, mobile Android et API REST

## 🏗️ Architecture

Le projet suit une architecture en monorepo avec trois composants principaux :

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Mobile Client  │    │   Web Client    │    │   REST API      │
│  (React Native) │◄───┤   (Next.js)     │◄───┤   (NestJS)      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                               │
                                               ▼
                                         ┌─────────────────┐
                                         │   Database      │
                                         │   (PostgreSQL)  │
                                         │   + Redis       │
                                         └─────────────────┘
```

### Composants

- **Backend** (`/apps/backend`) : Serveur d'application NestJS avec toute la logique métier
- **Web** (`/apps/web`) : Client web Next.js pour l'interface utilisateur
- **Mobile** (`/apps/mobile`) : Application mobile React Native/Expo pour Android
- **Packages partagés** (`/packages`) : Configuration commune (ESLint, TypeScript, DTOs)

## 🚀 Stack technique

### Backend

- **Framework** : NestJS (Node.js/TypeScript)
- **Base de données** : PostgreSQL + Redis
- **Authentication** : JWT + OAuth2 (Google, Facebook, etc.)
- **API** : REST avec documentation automatique

### Frontend Web

- **Framework** : Next.js (React/TypeScript)
- **Styling** : Tailwind CSS
- **State Management** : React Context/Hooks

### Mobile

- **Framework** : React Native + Expo
- **Platform** : Android (APK généré automatiquement)

### DevOps

- **Containerisation** : Docker + Docker Compose
- **Monorepo** : Turbo + pnpm
- **CI/CD** : Configuration pour développement et production

## 📦 Installation

### Prérequis

- Node.js 18+
- pnpm
- Docker & Docker Compose
- Git

### Installation rapide

```bash
# Cloner le repository
git clone <url-du-projet>
cd action-reaction

# Installer les dépendances
pnpm install

# Configuration de l'environnement
cp .env.example .env
# Éditer le fichier .env avec vos configurations

# Lancer avec Docker Compose
docker-compose up --build
```

### Installation pour développement

```bash
# Installer les dépendances
pnpm install

# Démarrer les services de base (DB)
docker-compose up postgres redis

# Lancer le backend en mode dev
pnpm --filter backend start:dev

# Lancer le web client en mode dev
pnpm --filter web dev

# Générer l'APK mobile
pnpm --filter mobile build:android
```

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Base de données
POSTGRES_USER=actionreaction
POSTGRES_PASSWORD=votre_mot_de_passe
POSTGRES_DB=actionreaction_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}

# Redis
REDIS_PASSWORD=votre_redis_password
REDIS_PORT=6379
REDIS_URL=redis://localhost:${REDIS_PORT}

# Serveur
BACKEND_NODE_ENV=development
BACKEND_PORT=8080

# Client Web
WEB_NODE_ENV=development
WEB_PORT=8081

# OAuth2 (optionnel)
GOOGLE_CLIENT_ID=votre_google_client_id
GOOGLE_CLIENT_SECRET=votre_google_client_secret
FACEBOOK_APP_ID=votre_facebook_app_id
FACEBOOK_APP_SECRET=votre_facebook_app_secret

# JWT
JWT_SECRET=votre_jwt_secret_très_sécurisé
```

### Configuration des services OAuth2

Pour utiliser l'authentification OAuth2, vous devez configurer les applications sur chaque plateforme :

1. **Google** : [Console développeur Google](https://console.developers.google.com/)
2. **Facebook** : [Facebook for Developers](https://developers.facebook.com/)

## 🖥️ Utilisation

### Accès aux applications

Après avoir lancé `docker-compose up` :

- **Interface web** : http://localhost:8081
- **API REST** : http://localhost:8080
- **Documentation API** : http://localhost:8080/api/docs
- **APK Android** : http://localhost:8081/client.apk

### Workflow utilisateur

1. **Inscription/Connexion** : Créer un compte ou se connecter (email ou OAuth2)
2. **Souscription aux services** : Lier ses comptes externes (Google, Facebook, etc.)
3. **Création d'AREA** : Choisir une Action et une REAction pour créer une automatisation
4. **Activation automatique** : Les hooks surveillent et déclenchent les AREA automatiquement

### Exemple d'AREA

**Gmail → OneDrive**

- **Action** : "Réception d'un email avec pièce jointe"
- **REAction** : "Sauvegarder la pièce jointe dans OneDrive"

## 📚 API Documentation

### Endpoints principaux

#### Authentification

```http
POST /auth/register
POST /auth/login
POST /auth/oauth/google
POST /auth/oauth/facebook
```

#### Services

```http
GET /services                    # Liste des services disponibles
POST /services/{id}/subscribe    # S'abonner à un service
DELETE /services/{id}/unsubscribe # Se désabonner d'un service
```

#### AREA

```http
GET /areas          # Lister mes AREA
POST /areas         # Créer une AREA
PUT /areas/{id}     # Modifier une AREA
DELETE /areas/{id}  # Supprimer une AREA
```

#### About (requis)

```http
GET /about.json
```

Response :

```json
{
  "client": {
    "host": "10.101.53.35"
  },
  "server": {
    "current_time": 1531680780,
    "services": [
      {
        "name": "facebook",
        "actions": [
          {
            "name": "new_message_in_group",
            "description": "A new message is posted in the group"
          }
        ],
        "reactions": [
          {
            "name": "like_message",
            "description": "The user likes a message"
          }
        ]
      }
    ]
  }
}
```

## 🔌 Services disponibles

### Services d'exemple implémentés

#### Social Media

- **Facebook** : Messages, likes, nouveaux followers
- **Twitter/X** : Tweets, mentions, hashtags
- **Instagram** : Nouvelles photos, likes

#### Cloud Storage

- **OneDrive** : Nouveaux fichiers, partage
- **Dropbox** : Synchronisation, collaboration

#### Email

- **Gmail** : Nouveaux emails, filtres
- **Outlook 365** : Gestion des emails

#### Utilitaires

- **Timer** : Déclenchement temporel (date, heure)
- **RSS** : Nouveaux articles

## 👨‍💻 Développement

### Structure du projet

```
.
├── apps/                    # Applications
│   ├── backend/            # Serveur NestJS
│   ├── mobile/             # App React Native
│   └── web/                # Client Next.js
├── packages/               # Packages partagés
│   ├── common/            # DTOs et types partagés
│   ├── eslint-config/     # Configuration ESLint
│   └── typescript-config/ # Configuration TypeScript
├── docker-compose.yml     # Configuration Docker
├── turbo.json            # Configuration Turbo
└── pnpm-workspace.yaml   # Configuration pnpm
```

### Scripts disponibles

```bash
# Développement
pnpm dev                    # Lancer tous les services en dev
pnpm --filter backend dev   # Backend seulement
pnpm --filter web dev       # Web seulement

# Build
pnpm build                  # Build tous les projets
pnpm --filter mobile build  # Build mobile APK

# Tests
pnpm test                   # Lancer tous les tests
pnpm lint                   # Linter le code

# Base de données
pnpm db:migrate            # Migrations
pnpm db:seed              # Données de test
```

### Ajout d'un nouveau service

Voir le fichier [HOWTOCONTRIBUTE.md](./HOWTOCONTRIBUTE.md) pour le guide détaillé.

## 🐳 Déploiement

### Avec Docker Compose

```bash
# Production
docker-compose up --build

# Développement avec hot-reload
docker-compose --profile dev up --build
```

### Services Docker

- **server** : Application backend (port 8080)
- **client_web** : Interface web (port 8081)
- **client_mobile** : Build de l'APK Android
- **postgres** : Base de données
- **redis** : Cache et sessions

### Volumes partagés

- **apk_shared** : Partage de l'APK entre mobile et web
- **turbo-cache** : Cache Turbo pour les builds

## 🤝 Contribution

### Workflow de contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

### Standards de code

- **TypeScript** strict activé
- **ESLint** + **Prettier** pour le formatage
- **Conventional Commits** pour les messages
- **Tests** requis pour les nouvelles fonctionnalités

### Structure des commits

```
type(scope): description

feat(backend): ajout du service Instagram
fix(mobile): correction de la navigation
docs(readme): mise à jour de la documentation
```

## 📄 Licence

Ce projet est développé dans le cadre d'un projet éducatif EPITECH.

## 👥 Équipe

Développé par une équipe d'étudiants EPITECH dans le cadre du projet Action-Reaction.

---

Pour plus d'informations sur l'extension du projet, consultez [HOWTOCONTRIBUTE.md](./HOWTOCONTRIBUTE.md).
