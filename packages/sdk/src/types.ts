export type ParameterSchema = Record<
  string,
  "string" | "number" | "boolean" | "object"
>;

export type ServiceContext = {
  serviceId: string;
  userId?: string;
  workflowToken?: string;
  logger?: {
    log?: (message: string, context?: string) => void;
    error?: (message: string, context?: string) => void;
    warn?: (message: string, context?: string) => void;
  };
  connection?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date | string | null;
    scopes?: string[];
    metadata?: Record<string, unknown>;
  };
  state?: Record<string, unknown>;
  webhookEvents?: {
    storeEvent: (
      serviceId: string,
      webhookId: string,
      payload: unknown,
      userId?: string,
      workflowToken?: string,
    ) => void;
    getUnprocessedEvents: (
      serviceId: string,
      webhookId: string,
      userId?: string,
      workflowToken?: string,
    ) => Array<{
      serviceId: string;
      webhookId: string;
      payload: unknown;
      headers?: Record<string, string | string[]>;
      timestamp: Date;
      processed: boolean;
      userId?: string;
      workflowToken?: string;
    }>;
    getLastUnprocessedEvent: (
      serviceId: string,
      webhookId: string,
      userId?: string,
      workflowToken?: string,
    ) => {
      serviceId: string;
      webhookId: string;
      payload: unknown;
      headers?: Record<string, string | string[]>;
      timestamp: Date;
      processed: boolean;
      userId?: string;
      workflowToken?: string;
    } | null;
    markAsProcessed: (
      serviceId: string,
      webhookId: string,
      timestamp: Date,
    ) => void;
    cleanupOldEvents: () => void;
  };
};

export type ActionContext = ServiceContext & {
  actionId: string;
  params: Record<string, unknown>;
};

export type ReactionContext = ServiceContext & {
  reactionId: string;
  params: Record<string, unknown>;
  previousOutput?: Record<string, unknown> | null;
};

export type WebhookContext = ServiceContext & {
  event: string;
  payload: unknown;
  rawRequest?: {
    headers?: Record<string, string | string[]>;
    query?: Record<string, string | string[]>;
  };
};

export type ActionDefinition<
  TInput extends ParameterSchema = ParameterSchema,
  TOutput extends ParameterSchema = ParameterSchema,
> = {
  id: string;
  name: string;
  description: string;
  input?: TInput;
  output?: TOutput;
  run: (
    params: Record<keyof TInput, unknown>,
    ctx: ActionContext,
  ) =>
    | Promise<Record<keyof TOutput, unknown> | null>
    | Record<keyof TOutput, unknown>
    | null;
};

export type ReactionDefinition<
  TInput extends ParameterSchema = ParameterSchema,
  TOutput extends ParameterSchema = ParameterSchema,
> = {
  id: string;
  name: string;
  description: string;
  input?: TInput;
  output?: TOutput;
  run: (
    params: Record<keyof TInput, unknown>,
    ctx: ReactionContext,
  ) => Promise<Record<keyof TOutput, unknown>> | Record<keyof TOutput, unknown>;
};

export type WebhookDefinition<
  TOutput extends ParameterSchema = ParameterSchema,
> = {
  id: string;
  name: string;
  description: string;
  output?: TOutput;
  run: (
    event: string,
    payload: unknown,
    ctx: WebhookContext,
  ) =>
    | Promise<Record<keyof TOutput, unknown> | null>
    | Record<keyof TOutput, unknown>
    | null;
};

export type OAuth2AuthConfig = {
  type: "oauth2";
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
};

export type ApiKeyAuthConfig = {
  type: "api_key";
  keyName: string;
  keyLocation: "header" | "query";
  description?: string;
};

export type NoneAuthConfig = {
  type: "none";
};

export type AuthConfig = OAuth2AuthConfig | ApiKeyAuthConfig | NoneAuthConfig;

export type ServiceDefinition = {
  id: string;
  name: string;
  version?: string;
  description: string;
  logo: string;
  auth: AuthConfig;
  actions?: ActionDefinition[];
  reactions?: ReactionDefinition[];
  webhooks?: WebhookDefinition[];
  onConnect?: (ctx: ServiceContext) => Promise<void> | void;
  onDisconnect?: (ctx: ServiceContext) => Promise<void> | void;
};

export type CreatedService = ServiceDefinition & {
  __isSDKService: true;
  getManifest(): ServiceManifest;
  getHandler(): ServiceHandler;
};

export type ServiceManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  logo: string;
  auth: AuthConfig;
  actions: Array<{
    id: string;
    name: string;
    description: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>;
  reactions: Array<{
    id: string;
    name: string;
    description: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>;
  webhooks: Array<{
    id: string;
    name: string;
    description: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>;
};

export type ServiceHandler = {
  onConnect?: (ctx: ServiceContext) => Promise<void> | void;
  onDisconnect?: (ctx: ServiceContext) => Promise<void> | void;
  detect: (
    actionId: string,
    params: Record<string, unknown>,
    ctx: ActionContext,
  ) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  execute: (
    reactionId: string,
    params: Record<string, unknown>,
    ctx: ReactionContext,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  onWebhook?: (
    event: string,
    payload: unknown,
    ctx: WebhookContext,
  ) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
};
