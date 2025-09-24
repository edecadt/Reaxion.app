import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FSWatcher, watch } from 'node:fs';

import {
  LoadedService,
  ManifestAction,
  ManifestReaction,
  ManifestWebhook,
  ServiceManifest,
} from './manifest.types';
import { ServiceLoader } from './service-loader.service';

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

  private async refresh(): Promise<void> {
    if (this.refreshInFlight) {
      await this.refreshInFlight;
      return;
    }

    this.refreshInFlight = this.loader
      .discover()
      .then((services) => {
        this.materialize(services);
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

  private materialize(services: LoadedService[]): void {
    const servicesById = new Map<string, LoadedService>();
    const actionsById = new Map<string, ActionRegistryEntry>();
    const reactionsById = new Map<string, ReactionRegistryEntry>();
    const webhooksByService = new Map<string, WebhookRegistry>();
    const handlerPaths = new Map<string, string | null>();

    for (const service of services) {
      servicesById.set(service.id, service);
      handlerPaths.set(service.id, service.handlerPath);

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

    this.logger.log(`Loaded ${services.length} services from manifests`);
    this.registerWatchers();
  }

  private registerWatchers(): void {
    this.disposeWatchers();

    const register = (target: string) => {
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

    register(this.loader.root);

    for (const service of this.services) {
      register(service.manifestPath);
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
