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
      id: service.id,
      name: service.name.toLowerCase(),
      auth: service.auth,
      actions: service.actions.map((action) => ({
        id: action.id,
        name: action.name,
        description: action.description,
        input: action.input ?? {},
      })),
      reactions: service.reactions.map((reaction) => ({
        id: reaction.id,
        name: reaction.name,
        description: reaction.description,
        input: reaction.input ?? {},
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
