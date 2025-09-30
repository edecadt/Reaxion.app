import {
  All,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { ServiceRegistry } from './service-registry.service';
import { WebhookEventsService } from './webhook-events.service';
import type { PluginWebhookContext } from './plugin.types';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly serviceRegistry: ServiceRegistry,
    private readonly webhookEvents: WebhookEventsService,
  ) {}

  @All(':service/:event/:token')
  @All(':service/:event')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('service') serviceId: string,
    @Param('event') event: string,
    @Param('token') token: string | undefined,
    @Req() req: Request,
  ): Promise<unknown> {
    this.logger.debug(
      `Received webhook for service: ${serviceId}, event: ${event}`,
    );

    const webhooks = this.serviceRegistry.getWebhooks(serviceId);
    if (!webhooks) {
      throw new NotFoundException(
        `Service '${serviceId}' not found or has no webhooks`,
      );
    }

    const webhookDef = webhooks.get(event);
    if (!webhookDef) {
      throw new NotFoundException(
        `Event '${event}' not found for service '${serviceId}'`,
      );
    }

    const handler = this.serviceRegistry.getHandler(serviceId);
    if (!handler) {
      throw new BadRequestException(
        `No handler available for service '${serviceId}'`,
      );
    }

    if (!handler.onWebhook) {
      throw new BadRequestException(
        `Service '${serviceId}' does not implement webhook handling`,
      );
    }

    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers[key] = value;
      }
    }

    const query: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        query[key] = value;
      } else if (Array.isArray(value)) {
        query[key] = value.filter((v): v is string => typeof v === 'string');
      }
    }

    const context: PluginWebhookContext = {
      serviceId,
      event,
      payload: req.body,
      logger: this.logger,
      rawRequest: {
        headers,
        query,
      },
    };

    try {
      const result = await handler.onWebhook(event, req.body, context);

      this.webhookEvents.storeEvent(
        serviceId,
        event,
        req.body,
        undefined,
        token,
        headers,
      );
      this.logger.debug(
        `Stored webhook event for action triggers: ${serviceId}:${event}${token ? ` (token: ${token})` : ''}`,
      );

      return result || { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Webhook handler failed for ${serviceId}:${event}: ${message}`,
      );
      throw new BadRequestException(`Webhook processing failed: ${message}`);
    }
  }
}
