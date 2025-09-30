import { Module } from '@nestjs/common';
import { ServiceLoader } from './service-loader.service';
import { ServiceRegistry } from './service-registry.service';
import { WebhookController } from './webhook.controller';
import { WebhookEventsService } from './webhook-events.service';

@Module({
  controllers: [WebhookController],
  providers: [ServiceLoader, ServiceRegistry, WebhookEventsService],
  exports: [ServiceLoader, ServiceRegistry, WebhookEventsService],
})
export class ServicesModule {}
