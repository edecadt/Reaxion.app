import type { LoggerService } from '@nestjs/common';

import type { ManifestDictionary } from './manifest.types';

export type PluginState = ManifestDictionary;

export type PluginConnection = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date | string | null;
  scopes?: string[];
  metadata?: ManifestDictionary;
};

export type PluginContextBase = {
  serviceId: string;
  userId?: string;
  logger: LoggerService;
  connection?: PluginConnection | null;
  state?: PluginState;
};

export type PluginActionContext = PluginContextBase & {
  actionId: string;
  params: ManifestDictionary;
};

export type PluginReactionContext = PluginContextBase & {
  reactionId: string;
  params: ManifestDictionary;
  previousOutput?: ManifestDictionary | null;
};

export type PluginWebhookContext = PluginContextBase & {
  event: string;
  payload: unknown;
  rawRequest?: {
    headers?: Record<string, string | string[]>;
    query?: Record<string, string | string[]>;
  };
};

export type PluginDetectResult = ManifestDictionary;
export type PluginExecuteResult = ManifestDictionary;

export interface PluginHandler {
  onConnect?(ctx: PluginContextBase): Promise<void> | void;
  onDisconnect?(ctx: PluginContextBase): Promise<void> | void;
  detect(
    actionId: string,
    params: ManifestDictionary,
    ctx: PluginActionContext,
  ): Promise<PluginDetectResult | null> | PluginDetectResult | null;
  execute(
    reactionId: string,
    params: ManifestDictionary,
    ctx: PluginReactionContext,
  ): Promise<PluginExecuteResult> | PluginExecuteResult;
  onWebhook?(
    event: string,
    payload: unknown,
    ctx: PluginWebhookContext,
  ): Promise<PluginDetectResult | null> | PluginDetectResult | null;
}
