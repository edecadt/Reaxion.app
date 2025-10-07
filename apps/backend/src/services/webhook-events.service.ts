import { Injectable, Logger } from '@nestjs/common';

export type WebhookEvent = {
  serviceId: string;
  webhookId: string;
  payload: unknown;
  headers?: Record<string, string | string[]>;
  timestamp: Date;
  processed: boolean;
  userId?: string;
  workflowToken?: string;
};

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);
  private events: Map<string, WebhookEvent[]> = new Map();
  private readonly MAX_EVENTS_PER_SERVICE = 100;

  storeEvent(
    serviceId: string,
    webhookId: string,
    payload: unknown,
    userId?: string,
    workflowToken?: string,
    headers?: Record<string, string | string[]>,
  ): void {
    const key = `${serviceId}:${webhookId}`;
    const event: WebhookEvent = {
      serviceId,
      webhookId,
      payload,
      headers,
      timestamp: new Date(),
      processed: false,
      userId,
      workflowToken,
    };

    if (!this.events.has(key)) {
      this.events.set(key, []);
    }

    const events = this.events.get(key)!;
    events.push(event);

    if (events.length > this.MAX_EVENTS_PER_SERVICE) {
      events.shift();
    }

    this.logger.debug(
      `Stored webhook event for ${serviceId}:${webhookId} (total: ${events.length})`,
    );
  }

  getUnprocessedEvents(
    serviceId: string,
    webhookId: string,
    userId?: string,
    workflowToken?: string,
  ): WebhookEvent[] {
    const key = `${serviceId}:${webhookId}`;
    const events = this.events.get(key) || [];

    return events.filter((event) => {
      if (event.processed) return false;

      if (
        event.userId !== undefined &&
        userId !== undefined &&
        event.userId !== userId
      ) {
        return false;
      }

      if (
        workflowToken &&
        event.workflowToken &&
        event.workflowToken !== workflowToken
      ) {
        return false;
      }

      return true;
    });
  }

  getLastUnprocessedEvent(
    serviceId: string,
    webhookId: string,
    userId?: string,
    workflowToken?: string,
  ): WebhookEvent | null {
    const events = this.getUnprocessedEvents(
      serviceId,
      webhookId,
      userId,
      workflowToken,
    );
    return events.length > 0 ? (events[events.length - 1] ?? null) : null;
  }

  markAsProcessed(serviceId: string, webhookId: string, timestamp: Date): void {
    const key = `${serviceId}:${webhookId}`;
    const events = this.events.get(key) || [];

    const event = events.find(
      (e) => e.timestamp.getTime() === timestamp.getTime(),
    );

    if (event) {
      event.processed = true;
      this.logger.debug(`Marked webhook event as processed for ${key}`);
    }
  }

  cleanupOldEvents(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let totalCleaned = 0;

    for (const [key, events] of this.events.entries()) {
      const before = events.length;
      const filtered = events.filter((event) => event.timestamp > oneHourAgo);
      this.events.set(key, filtered);
      totalCleaned += before - filtered.length;
    }

    if (totalCleaned > 0) {
      this.logger.log(`Cleaned up ${totalCleaned} old webhook events`);
    }
  }
}
