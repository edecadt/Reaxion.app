import type {
  ActionDefinition,
  ReactionDefinition,
  WebhookDefinition,
  ParameterSchema,
} from "./types";

export function createAction<
  TInput extends ParameterSchema = ParameterSchema,
  TOutput extends ParameterSchema = ParameterSchema,
>(
  definition: ActionDefinition<TInput, TOutput>,
): ActionDefinition<TInput, TOutput> {
  if (!definition.id || !definition.name || !definition.description) {
    throw new Error("Action must have id, name, and description");
  }

  if (!/^[a-z0-9_-]+$/i.test(definition.id)) {
    throw new Error(
      "Action id must be alphanumeric with underscores or hyphens only",
    );
  }

  if (typeof definition.run !== "function") {
    throw new Error("Action must have a run function");
  }

  return {
    input: {} as TInput,
    output: {} as TOutput,
    ...definition,
  };
}

export function createReaction<
  TInput extends ParameterSchema = ParameterSchema,
  TOutput extends ParameterSchema = ParameterSchema,
>(
  definition: ReactionDefinition<TInput, TOutput>,
): ReactionDefinition<TInput, TOutput> {
  if (!definition.id || !definition.name || !definition.description) {
    throw new Error("Reaction must have id, name, and description");
  }

  if (!/^[a-z0-9_-]+$/i.test(definition.id)) {
    throw new Error(
      "Reaction id must be alphanumeric with underscores or hyphens only",
    );
  }

  if (typeof definition.run !== "function") {
    throw new Error("Reaction must have a run function");
  }

  return {
    input: {} as TInput,
    output: {} as TOutput,
    ...definition,
  };
}

export function createWebhook<
  TOutput extends ParameterSchema = ParameterSchema,
>(definition: WebhookDefinition<TOutput>): WebhookDefinition<TOutput> {
  if (!definition.id || !definition.name || !definition.description) {
    throw new Error("Webhook must have id, name, and description");
  }

  if (!/^[a-z0-9_-]+$/i.test(definition.id)) {
    throw new Error(
      "Webhook id must be alphanumeric with underscores or hyphens only",
    );
  }

  if (typeof definition.run !== "function") {
    throw new Error("Webhook must have a run function");
  }

  return {
    output: {} as TOutput,
    ...definition,
  };
}
