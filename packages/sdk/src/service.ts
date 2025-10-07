import type {
  ServiceDefinition,
  CreatedService,
  ServiceManifest,
  ServiceHandler,
  ActionContext,
  ReactionContext,
  WebhookContext,
  ParameterSchema,
} from "./types";

function normalizeAuthConfig(
  auth: ServiceDefinition["auth"],
): ServiceDefinition["auth"] {
  if (auth.type === "oauth2") {
    return {
      type: "oauth2",
      authorizationUrl: auth.authorizationUrl,
      tokenUrl: auth.tokenUrl,
      scopes: [...auth.scopes],
      clientIdEnvVar: auth.clientIdEnvVar,
      clientSecretEnvVar: auth.clientSecretEnvVar,
    };
  }

  if (auth.type === "api_key") {
    return {
      type: "api_key",
      keyName: auth.keyName,
      keyLocation: auth.keyLocation,
      description: auth.description,
    };
  }

  return { type: "none" };
}

function convertParameterSchema(
  schema: ParameterSchema = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, type] of Object.entries(schema)) {
    result[key] = type;
  }

  return result;
}

export function createService(definition: ServiceDefinition): CreatedService {
  if (!definition.id || !definition.name || !definition.description) {
    throw new Error("Service must have id, name, and description");
  }

  if (!/^[a-z0-9._-]+$/i.test(definition.id)) {
    throw new Error(
      "Service id must be alphanumeric with dots, underscores, or hyphens only",
    );
  }

  if (!definition.logo) {
    throw new Error("Service must have a logo URL");
  }

  if (!definition.auth) {
    throw new Error("Service must have auth configuration");
  }

  const actions = definition.actions || [];
  const reactions = definition.reactions || [];
  const webhooks = definition.webhooks || [];

  const actionIds = new Set<string>();
  const reactionIds = new Set<string>();
  const webhookIds = new Set<string>();

  for (const action of actions) {
    if (actionIds.has(action.id)) {
      throw new Error(`Duplicate action id: ${action.id}`);
    }
    actionIds.add(action.id);
  }

  for (const reaction of reactions) {
    if (reactionIds.has(reaction.id)) {
      throw new Error(`Duplicate reaction id: ${reaction.id}`);
    }
    reactionIds.add(reaction.id);
  }

  for (const webhook of webhooks) {
    if (webhookIds.has(webhook.id)) {
      throw new Error(`Duplicate webhook id: ${webhook.id}`);
    }
    webhookIds.add(webhook.id);
  }

  const service: CreatedService = {
    ...definition,
    version: definition.version || "1.0.0",
    __isSDKService: true,

    getManifest(): ServiceManifest {
      return {
        id: definition.id,
        name: definition.name,
        version: definition.version || "1.0.0",
        description: definition.description,
        logo: definition.logo,
        auth: normalizeAuthConfig(definition.auth),
        actions: actions.map((action) => ({
          id: action.id,
          name: action.name,
          description: action.description,
          input: convertParameterSchema(action.input),
          output: convertParameterSchema(action.output),
        })),
        reactions: reactions.map((reaction) => ({
          id: reaction.id,
          name: reaction.name,
          description: reaction.description,
          input: convertParameterSchema(reaction.input),
          output: convertParameterSchema(reaction.output),
        })),
        webhooks: webhooks.map((webhook) => ({
          id: webhook.id,
          name: webhook.name,
          description: webhook.description,
          input: {},
          output: convertParameterSchema(webhook.output),
        })),
      };
    },

    getHandler(): ServiceHandler {
      return {
        onConnect: definition.onConnect,
        onDisconnect: definition.onDisconnect,

        async detect(
          actionId: string,
          params: Record<string, unknown>,
          ctx: ActionContext,
        ) {
          const action = actions.find((a) => a.id === actionId);
          if (!action) {
            throw new Error(`Action not found: ${actionId}`);
          }

          try {
            const result = await action.run(params, ctx);
            return result || null;
          } catch (error) {
            ctx.logger?.error?.(
              `Action ${actionId} failed: ${error instanceof Error ? error.message : String(error)}`,
              "SDK",
            );
            return null;
          }
        },

        async execute(
          reactionId: string,
          params: Record<string, unknown>,
          ctx: ReactionContext,
        ) {
          const reaction = reactions.find((r) => r.id === reactionId);
          if (!reaction) {
            throw new Error(`Reaction not found: ${reactionId}`);
          }

          try {
            const result = await reaction.run(params, ctx);
            return result || {};
          } catch (error) {
            ctx.logger?.error?.(
              `Reaction ${reactionId} failed: ${error instanceof Error ? error.message : String(error)}`,
              "SDK",
            );
            throw error;
          }
        },

        async onWebhook(event: string, payload: unknown, ctx: WebhookContext) {
          const webhook = webhooks.find((w) => w.id === event);
          if (!webhook) {
            ctx.logger?.warn?.(`Webhook not found: ${event}`, "SDK");
            return null;
          }

          try {
            const result = await webhook.run(event, payload, ctx);
            return result || null;
          } catch (error) {
            ctx.logger?.error?.(
              `Webhook ${event} failed: ${error instanceof Error ? error.message : String(error)}`,
              "SDK",
            );
            return null;
          }
        },
      };
    },
  };

  return service;
}
