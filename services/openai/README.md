# OpenAI Service

Service permettant d'interagir avec les modèles OpenAI pour générer des complétions de texte avec suivi détaillé de l'utilisation et des coûts.

Ce service est une **réaction** (action) qui peut être utilisée dans vos workflows pour traiter du texte, générer du contenu, analyser des données, et plus encore.

## Fonctionnalités

### Réaction: Generate Completion

Envoie un prompt à OpenAI et reçoit une réponse avec des informations détaillées sur l'utilisation et le coût.

**Type:** Réaction (Action dans un workflow)
**Utilisation:** Traitement de données reçues d'un trigger ou d'une action précédente

#### Paramètres d'entrée

- **prompt** (requis) : Le texte à envoyer au modèle (1-10000 caractères)
  - Vous pouvez utiliser la syntaxe `{variable}` pour référencer des sorties précédentes
  - Exemple: `"Résume ce texte: {issue_body}"` ou `"Réponds à cet email: {email_content}"`

- **model** (optionnel, select) : Le modèle OpenAI à utiliser (défaut: `gpt-4o-mini`)
  - **gpt-4o** - Modèle le plus avancé
  - **gpt-4o-mini** - Version optimisée et économique (recommandé)
  - **gpt-4-turbo** - GPT-4 avec contexte étendu
  - **gpt-4** - Modèle GPT-4 standard
  - **gpt-3.5-turbo** - Rapide et économique

- **maxTokens** (optionnel, number) : Nombre maximum de tokens à générer (1-16000)
  - Contrôle la longueur de la réponse
  - Laissez vide pour utiliser la valeur par défaut du modèle

- **temperature** (optionnel, number) : Température d'échantillonnage (0-2, défaut: 1)
  - **0-0.5** : Réponses plus déterministes et conservatrices
  - **0.7-1.0** : Équilibre créativité/cohérence (défaut)
  - **1.5-2.0** : Réponses plus créatives et variées

#### Données de sortie

- **response** : La réponse générée par le modèle
- **model_used** : Le modèle utilisé pour la génération
- **prompt_tokens** : Nombre de tokens dans le prompt
- **completion_tokens** : Nombre de tokens dans la réponse
- **total_tokens** : Total des tokens utilisés
- **estimated_cost_usd** : Coût estimé en USD
- **finish_reason** : Raison de fin (`stop`, `length`, etc.)

## Exemples de workflows

### Exemple 1 : Résumé automatique d'issues GitHub → Discord

```
Trigger: Issue Created (GitHub)

Reaction: Generate Completion (OpenAI)
  prompt: "Résume cette issue en 2-3 phrases: {issue_title} - {issue_body}"
  model: gpt-4o-mini
  maxTokens: 200
  temperature: 0.3

Reaction: Send Webhook Message (Discord)
  content: "Nouvelle issue: {issue_title}\n\nRésumé: {response}"
```

### Exemple 2 : Réponse automatique aux emails

```
Trigger: Email Received

Reaction: Generate Completion (OpenAI)
  prompt: "Génère une réponse professionnelle à cet email:
           De: {sender_email}
           Sujet: {email_subject}
           Message: {email_body}"
  model: gpt-4o
  temperature: 0.7
```

### Exemple 3 : Citation quotidienne

```
Trigger: Timer (tous les jours à 9h)

Reaction: Generate Completion (OpenAI)
  prompt: "Génère une citation inspirante pour commencer la journée"
  model: gpt-4o-mini
  temperature: 1.5
  maxTokens: 100
```

## Configuration

### 1. Obtenir une clé API OpenAI

1. Créez un compte sur [OpenAI Platform](https://platform.openai.com/)
2. Accédez à [API Keys](https://platform.openai.com/api-keys)
3. Créez une nouvelle clé API
4. **Important:** Ajoutez des crédits à votre compte

### 2. Connecter le service

#### Web

Settings → OpenAI → Connect → Entrez votre clé API

#### Mobile

Service Connections → OpenAI → Connect → Entrez votre clé API

## Tarification

| Modèle        | Input ($/1K tokens) | Output ($/1K tokens) |
| ------------- | ------------------- | -------------------- |
| gpt-4o        | $0.005              | $0.015               |
| gpt-4o-mini   | $0.00015            | $0.0006              |
| gpt-4-turbo   | $0.01               | $0.03                |
| gpt-4         | $0.03               | $0.06                |
| gpt-3.5-turbo | $0.0015             | $0.002               |

Le coût estimé est retourné dans `estimated_cost_usd`.

## Support

- [Documentation OpenAI](https://platform.openai.com/docs)
- [Tarifs OpenAI](https://openai.com/api/pricing/)
