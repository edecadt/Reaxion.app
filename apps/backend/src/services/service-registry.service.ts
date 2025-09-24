import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { existsSync, FSWatcher, watch } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  LoadedService,
  ManifestAction,
  ManifestReaction,
  ManifestWebhook,
  ServiceManifest,
} from './manifest.types';
import { ServiceLoader } from './service-loader.service';
import type { PluginHandler } from './plugin.types';

type ActionRegistryEntry = {
  serviceId: string;
  serviceName: string;
  definition: ManifestAction;
};

type ReactionRegistryEntry = {
  serviceId: string;
  serviceName: string;
  definition: ManifestReaction;
};

type WebhookRegistry = Map<string, ManifestWebhook>;

type RegistrySnapshot = {
  services: ReadonlyArray<LoadedService>;
  servicesById: ReadonlyMap<string, LoadedService>;
  actionsById: ReadonlyMap<string, ActionRegistryEntry>;
  reactionsById: ReadonlyMap<string, ReactionRegistryEntry>;
  webhooksByService: ReadonlyMap<string, WebhookRegistry>;
  handlerPaths: ReadonlyMap<string, string | null>;
  handlers: ReadonlyMap<string, PluginHandler>;
};

const composeKey = (serviceId: string, itemId: string): string =>
  `${serviceId}:${itemId}`;

@Injectable()
export class ServiceRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceRegistry.name);
  private services: LoadedService[] = [];
  private servicesById = new Map<string, LoadedService>();
  private actionsById = new Map<string, ActionRegistryEntry>();
  private reactionsById = new Map<string, ReactionRegistryEntry>();
  private webhooksByService = new Map<string, WebhookRegistry>();
  private handlerPaths = new Map<string, string | null>();
  private handlers = new Map<string, PluginHandler>();
  private watchers: FSWatcher[] = [];
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshInFlight: Promise<void> | null = null;

  constructor(private readonly loader: ServiceLoader) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async onModuleDestroy(): Promise<void> {
    this.disposeWatchers();
  }

  getPublicServices(): ServiceManifest[] {
    return this.services.map((service) => {
      const {
        manifestPath: _manifestPath,
        servicePath: _servicePath,
        handlerPath: _handlerPath,
        ...publicData
      } = service;
      return publicData;
    });
  }

  getSnapshot(): RegistrySnapshot {
    return {
      services: this.services,
      servicesById: this.servicesById,
      actionsById: this.actionsById,
      reactionsById: this.reactionsById,
      webhooksByService: this.webhooksByService,
      handlerPaths: this.handlerPaths,
      handlers: this.handlers,
    };
  }

  getAction(
    serviceId: string,
    actionId: string,
  ): ActionRegistryEntry | undefined {
    return this.actionsById.get(composeKey(serviceId, actionId));
  }

  getReaction(
    serviceId: string,
    reactionId: string,
  ): ReactionRegistryEntry | undefined {
    return this.reactionsById.get(composeKey(serviceId, reactionId));
  }

  getWebhooks(serviceId: string): WebhookRegistry | undefined {
    return this.webhooksByService.get(serviceId);
  }

  getHandlerPath(serviceId: string): string | null | undefined {
    return this.handlerPaths.get(serviceId);
  }

  getHandler(serviceId: string): PluginHandler | undefined {
    return this.handlers.get(serviceId);
  }

  private async refresh(): Promise<void> {
    if (this.refreshInFlight) {
      await this.refreshInFlight;
      return;
    }

    this.refreshInFlight = this.loader
      .discover()
      .then(async (services) => {
        await this.materialize(services);
      })
      .catch((error) => {
        this.logger.error(`Failed to refresh services: ${error.message}`);
        throw error;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });

    await this.refreshInFlight;
  }

  private async materialize(services: LoadedService[]): Promise<void> {
    const servicesById = new Map<string, LoadedService>();
    const actionsById = new Map<string, ActionRegistryEntry>();
    const reactionsById = new Map<string, ReactionRegistryEntry>();
    const webhooksByService = new Map<string, WebhookRegistry>();
    const handlerPaths = new Map<string, string | null>();
    const handlers = new Map<string, PluginHandler>();

    for (const service of services) {
      servicesById.set(service.id, service);
      handlerPaths.set(service.id, service.handlerPath);

      const handler = await this.loadHandlerForService(service);
      if (handler) {
        handlers.set(service.id, handler);
      }

      for (const action of service.actions) {
        const key = composeKey(service.id, action.id);
        if (actionsById.has(key)) {
          throw new Error(`Duplicate action key detected: ${key}`);
        }

        actionsById.set(key, {
          serviceId: service.id,
          serviceName: service.name,
          definition: action,
        });
      }

      for (const reaction of service.reactions) {
        const key = composeKey(service.id, reaction.id);
        if (reactionsById.has(key)) {
          throw new Error(`Duplicate reaction key detected: ${key}`);
        }

        reactionsById.set(key, {
          serviceId: service.id,
          serviceName: service.name,
          definition: reaction,
        });
      }

      const webhookMap: WebhookRegistry = new Map();
      for (const webhook of service.webhooks) {
        if (webhookMap.has(webhook.id)) {
          throw new Error(
            `Duplicate webhook id detected for service ${service.id}: ${webhook.id}`,
          );
        }
        webhookMap.set(webhook.id, webhook);
      }

      webhooksByService.set(service.id, webhookMap);
    }

    this.services = services;
    this.servicesById = servicesById;
    this.actionsById = actionsById;
    this.reactionsById = reactionsById;
    this.webhooksByService = webhooksByService;
    this.handlerPaths = handlerPaths;
    this.handlers = handlers;

    this.logger.log(`Loaded ${services.length} services from manifests`);
    this.registerWatchers();
  }

  private async loadHandlerForService(
    service: LoadedService,
  ): Promise<PluginHandler | null> {
    if (!service.handlerPath) {
      if (
        service.actions.length > 0 ||
        service.reactions.length > 0 ||
        service.webhooks.length > 0
      ) {
        throw new Error(
          `Service ${service.id} declares capabilities but has no handler module`,
        );
      }

      return null;
    }

    if (!existsSync(service.handlerPath)) {
      throw new Error(
        `Handler module not found for service ${service.id} at ${service.handlerPath}`,
      );
    }

    try {
      const moduleUrl = pathToFileURL(service.handlerPath);
      moduleUrl.searchParams.set('t', Date.now().toString());
      const moduleExports = await import(moduleUrl.href);
      return this.resolveHandlerExport(
        service.id,
        service.handlerPath,
        moduleExports,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to load handler for service ${service.id}: ${message}`,
      );
    }
  }

  private resolveHandlerExport(
    serviceId: string,
    handlerPath: string,
    moduleExports: unknown,
  ): PluginHandler {
    let candidate = moduleExports as unknown;

    if (
      candidate &&
      typeof candidate === 'object' &&
      'default' in (candidate as Record<string, unknown>)
    ) {
      candidate = (candidate as Record<string, unknown>).default;
    }

    if (typeof candidate === 'function') {
      try {
        candidate = (candidate as () => unknown)();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Handler factory for service ${serviceId} threw: ${message}`,
        );
      }
    }

    if (!candidate || typeof candidate !== 'object') {
      throw new Error(
        `Handler at ${handlerPath} for service ${serviceId} must export an object implementing PluginHandler`,
      );
    }

    const handler = candidate as Record<string, unknown>;

    this.assertHandlerFunction(handler, 'detect', serviceId, false);
    this.assertHandlerFunction(handler, 'execute', serviceId, false);
    this.assertHandlerFunction(handler, 'onConnect', serviceId, true);
    this.assertHandlerFunction(handler, 'onDisconnect', serviceId, true);
    this.assertHandlerFunction(handler, 'onWebhook', serviceId, true);

    return handler as unknown as PluginHandler;
  }

  private assertHandlerFunction(
    handler: Record<string, unknown>,
    key: string,
    serviceId: string,
    optional: boolean,
  ): void {
    const value = handler[key];

    if (value === undefined) {
      if (!optional) {
        throw new Error(
          `Handler for service ${serviceId} is missing required method "${key}"`,
        );
      }

      return;
    }

    if (typeof value !== 'function') {
      throw new Error(
        `Handler method "${key}" for service ${serviceId} must be a function`,
      );
    }
  }

  private registerWatchers(): void {
    this.disposeWatchers();

    const register = (target: string) => {
      if (!existsSync(target)) {
        return;
      }

      try {
        const watcher = watch(target, () => this.scheduleRefresh());
        watcher.on('error', (error) => {
          this.logger.warn(
            `Watcher error on ${target}: ${error instanceof Error ? error.message : error}`,
          );
          this.scheduleRefresh();
        });
        this.watchers.push(watcher);
      } catch (error) {
        this.logger.warn(
          `Unable to watch ${target}: ${error instanceof Error ? error.message : error}`,
        );
      }
    };

    if (existsSync(this.loader.root)) {
      register(this.loader.root);
    }

    for (const service of this.services) {
      register(service.servicePath);
      register(service.manifestPath);
      if (service.handlerPath) {
        register(service.handlerPath);
      }
    }
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        // ignore
      }
    }

    this.watchers = [];

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refresh().catch((error) => {
        this.logger.error(`Failed to rescan services: ${error.message}`);
      });
    }, 200);
  }
}
