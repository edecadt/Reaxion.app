import { Module, forwardRef } from '@nestjs/common';
import { ServiceLoader } from './service-loader.service';
import { ServiceRegistry } from './service-registry.service';
import { WebhookController } from './webhook.controller';
import { WebhookEventsService } from './webhook-events.service';
import { DiscordGatewayService } from './discord-gateway.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [forwardRef(() => WorkflowModule)],
  controllers: [WebhookController],
  providers: [
    ServiceLoader,
    ServiceRegistry,
    WebhookEventsService,
    DiscordGatewayService,
  ],
  exports: [
    ServiceLoader,
    ServiceRegistry,
    WebhookEventsService,
    DiscordGatewayService,
  ],
})
export class ServicesModule {}
