import { Injectable } from '@nestjs/common';

import { ServiceRegistry } from './services/service-registry.service';

@Injectable()
export class AppService {
  constructor(private readonly serviceRegistry: ServiceRegistry) {}

  getHello(): string {
    return 'Hello World!';
  }

  buildAboutPayload(clientHost: string | undefined) {
    const services = this.serviceRegistry.getPublicServices();

    const formattedServices = services.map((service) => ({
      name: service.name.toLowerCase(),
      actions: service.actions.map((action) => ({
        name: action.name,
        description: action.description,
      })),
      reactions: service.reactions.map((reaction) => ({
        name: reaction.name,
        description: reaction.description,
      })),
    }));

    return {
      client: {
        host: clientHost ?? '',
      },
      server: {
        current_time: Math.floor(Date.now() / 1000),
        services: formattedServices,
      },
    };
  }
}
