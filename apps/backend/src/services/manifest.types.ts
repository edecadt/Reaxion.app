import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthConfig } from '@area/sdk';

export type ManifestDictionary = Record<string, unknown>;

export type ManifestAction = {
  id: string;
  name: string;
  description: string;
  input: ManifestDictionary;
  output: ManifestDictionary;
};

export type ManifestReaction = ManifestAction;

export type ManifestWebhook = ManifestAction;

export type ServiceManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  logo: string;
  auth: AuthConfig;
  actions: ManifestAction[];
  reactions: ManifestReaction[];
  webhooks: ManifestWebhook[];
};

export type LoadedService = ServiceManifest & {
  manifestPath: string;
  servicePath: string;
  handlerPath: string | null;
};

class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestValidationError';
  }
}

const ensureNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ManifestValidationError(`${field} must be a non-empty string`);
  }

  return value;
};

const ensureDictionary = (
  value: unknown,
  field: string,
): ManifestDictionary => {
  if (value === undefined) {
    return {};
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManifestValidationError(`${field} must be an object`);
  }

  return value as ManifestDictionary;
};

const ensureArray = (value: unknown, field: string): unknown[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ManifestValidationError(`${field} must be an array`);
  }

  return value;
};

const ensureStringArray = (value: unknown, field: string): string[] => {
  const arr = ensureArray(value, field);
  return arr.map((entry, index) =>
    ensureNonEmptyString(entry, `${field}[${index}]`),
  );
};

const parseAuthConfig = (value: unknown, serviceId: string): AuthConfig => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManifestValidationError('auth must be an object');
  }

  const auth = value as Record<string, unknown>;
  const type = ensureNonEmptyString(auth.type, 'auth.type').toLowerCase();

  switch (type) {
    case 'none':
      return { type: 'none' };
    case 'api_key': {
      const keyLocation = ensureNonEmptyString(
        auth.keyLocation,
        'auth.keyLocation',
      ).toLowerCase();
      if (keyLocation !== 'header' && keyLocation !== 'query') {
        throw new ManifestValidationError(
          'auth.keyLocation must be "header" or "query"',
        );
      }

      const apiKeyConfig: AuthConfig = {
        type: 'api_key',
        keyName: ensureNonEmptyString(auth.keyName, 'auth.keyName'),
        keyLocation: keyLocation as 'header' | 'query',
      };

      if (auth.description !== undefined) {
        apiKeyConfig.description = ensureNonEmptyString(
          auth.description,
          'auth.description',
        );
      }

      return apiKeyConfig;
    }
    case 'oauth2': {
      const scopes = ensureStringArray(auth.scopes, 'auth.scopes');

      return {
        type: 'oauth2',
        authorizationUrl: ensureNonEmptyString(
          auth.authorizationUrl,
          'auth.authorizationUrl',
        ),
        tokenUrl: ensureNonEmptyString(auth.tokenUrl, 'auth.tokenUrl'),
        scopes,
        clientIdEnvVar: ensureNonEmptyString(
          auth.clientIdEnvVar,
          'auth.clientIdEnvVar',
        ),
        clientSecretEnvVar: ensureNonEmptyString(
          auth.clientSecretEnvVar,
          'auth.clientSecretEnvVar',
        ),
      };
    }
    default:
      throw new ManifestValidationError(`Unsupported auth type: ${type}`);
  }
};

const parseFlowDefinition = (
  value: unknown,
  kind: string,
  serviceId: string,
  index: number,
): ManifestAction => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManifestValidationError(`${kind}[${index}] must be an object`);
  }

  const block = value as Record<string, unknown>;
  const id = ensureNonEmptyString(block.id, `${kind}[${index}].id`);
  const name = ensureNonEmptyString(block.name, `${kind}[${index}].name`);
  const description = ensureNonEmptyString(
    block.description,
    `${kind}[${index}].description`,
  );

  if (!/^[a-z0-9_-]+$/i.test(id)) {
    throw new ManifestValidationError(
      `${kind}[${index}].id must be alphanumeric plus _ or -`,
    );
  }

  return {
    id,
    name,
    description,
    input: ensureDictionary(block.input, `${kind}[${index}].input`),
    output: ensureDictionary(block.output, `${kind}[${index}].output`),
  };
};

const ensureUniqueIds = (
  entries: ManifestAction[],
  kind: string,
  serviceId: string,
) => {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new ManifestValidationError(
        `${kind} contains duplicate id "${entry.id}" for service ${serviceId}`,
      );
    }

    seen.add(entry.id);
  }
};

export const validateManifest = (
  raw: unknown,
  serviceId: string,
  manifestPath: string,
  servicePath: string,
): LoadedService => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ManifestValidationError('Manifest root must be an object');
  }

  const manifest = raw as Record<string, unknown>;
  const id = ensureNonEmptyString(manifest.id, 'id');

  if (id !== serviceId) {
    throw new ManifestValidationError(
      `Manifest id (${id}) does not match directory name (${serviceId})`,
    );
  }

  const name = ensureNonEmptyString(manifest.name, 'name');
  const version = ensureNonEmptyString(manifest.version, 'version');
  const description = ensureNonEmptyString(manifest.description, 'description');
  const logo = ensureNonEmptyString(manifest.logo, 'logo');
  const auth = parseAuthConfig(manifest.auth, id);

  const actionsRaw = ensureArray(manifest.actions, 'actions');
  const reactionsRaw = ensureArray(manifest.reactions, 'reactions');
  const webhooksRaw = ensureArray(manifest.webhooks, 'webhooks');

  const actions = actionsRaw.map((entry, index) =>
    parseFlowDefinition(entry, 'actions', id, index),
  );
  const reactions = reactionsRaw.map((entry, index) =>
    parseFlowDefinition(entry, 'reactions', id, index),
  );
  const webhooks = webhooksRaw.map((entry, index) =>
    parseFlowDefinition(entry, 'webhooks', id, index),
  );

  ensureUniqueIds(actions, 'actions', id);
  ensureUniqueIds(reactions, 'reactions', id);
  ensureUniqueIds(webhooks, 'webhooks', id);

  const handlerCandidates = [
    'index.ts',
    'index.js',
    'handler.ts',
    'handler.js',
  ];
  const handlerPath =
    handlerCandidates
      .map((candidate) => join(servicePath, candidate))
      .find((candidatePath) => existsSync(candidatePath)) ?? null;

  return {
    id,
    name,
    version,
    description,
    logo,
    auth,
    actions,
    reactions,
    webhooks,
    manifestPath,
    servicePath,
    handlerPath,
  };
};

export { ManifestValidationError };

export const serviceManifestJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Service Manifest',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'version', 'description', 'logo', 'auth'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[A-Za-z0-9_-]+$',
      minLength: 1,
      description: 'Unique identifier of the service (matches directory name).',
    },
    name: {
      type: 'string',
      minLength: 1,
    },
    version: {
      type: 'string',
      minLength: 1,
    },
    description: {
      type: 'string',
      minLength: 1,
    },
    logo: {
      type: 'string',
      minLength: 1,
    },
    auth: {
      type: 'string',
      minLength: 1,
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['id', 'name', 'description'],
        properties: {
          id: {
            type: 'string',
            pattern: '^[A-Za-z0-9_-]+$',
            minLength: 1,
          },
          name: {
            type: 'string',
            minLength: 1,
          },
          description: {
            type: 'string',
            minLength: 1,
          },
          input: {
            type: 'object',
            additionalProperties: true,
          },
          output: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      default: [],
    },
    reactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['id', 'name', 'description'],
        properties: {
          id: {
            type: 'string',
            pattern: '^[A-Za-z0-9_-]+$',
            minLength: 1,
          },
          name: {
            type: 'string',
            minLength: 1,
          },
          description: {
            type: 'string',
            minLength: 1,
          },
          input: {
            type: 'object',
            additionalProperties: true,
          },
          output: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      default: [],
    },
    webhooks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['id', 'name', 'description'],
        properties: {
          id: {
            type: 'string',
            pattern: '^[A-Za-z0-9_-]+$',
            minLength: 1,
          },
          name: {
            type: 'string',
            minLength: 1,
          },
          description: {
            type: 'string',
            minLength: 1,
          },
          input: {
            type: 'object',
            additionalProperties: true,
          },
          output: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      default: [],
    },
  },
};
