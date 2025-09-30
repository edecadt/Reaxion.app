import { createService, createAction, createWebhook } from "@area/sdk";

export default createService({
  id: "test-webhook",
  name: "Test Webhook",
  version: "1.0.0",
  description: "Service de test pour les webhooks",
  logo: "https://cdn-icons-png.flaticon.com/512/2621/2621062.png",
  auth: { type: "none" },

  actions: [
    createAction({
      id: "on-test-webhook",
      name: "On Test Webhook Received",
      description: "Se déclenche quand un webhook est reçu avec type='test'",
      input: {},
      output: {
        type: "string",
        message: "string",
        timestamp: "string",
        payload: "object",
      },
      run: async (_params, ctx) => {
        if (!ctx.webhookEvents) {
          ctx.logger?.log?.(
            `[test-webhook] ❌ WebhookEventsService not available in context`,
            "TestWebhookPlugin",
          );
          return null;
        }

        const lastEvent = ctx.webhookEvents.getLastUnprocessedEvent(
          "test-webhook",
          "test",
          ctx.userId,
          ctx.workflowToken,
        );

        if (!lastEvent) {
          return null;
        }

        const payload = lastEvent.payload as Record<string, unknown>;

        if (payload.type !== "test") {
          return null;
        }

        ctx.logger?.log?.(
          `[test-webhook] ✅ Action triggered by webhook with type=test (token: ${ctx.workflowToken || "none"})`,
          "TestWebhookPlugin",
        );

        ctx.webhookEvents.markAsProcessed(
          "test-webhook",
          "test",
          lastEvent.timestamp,
        );

        return {
          type: payload.type as string,
          message: (payload.message as string) || "Test webhook received",
          timestamp: lastEvent.timestamp.toISOString(),
          payload: payload,
        };
      },
    }),
  ],

  webhooks: [
    createWebhook({
      id: "test",
      name: "Test Webhook",
      description: "Reçoit les webhooks avec type='test'",
      output: {
        type: "string",
        message: "string",
        timestamp: "string",
        payload: "object",
      },
      run: async (event, payload, ctx) => {
        ctx.logger?.log?.(
          `[test-webhook] Received webhook - event: ${event}, payload: ${JSON.stringify(payload)}`,
          "TestWebhookPlugin",
        );

        const webhookData = payload as Record<string, unknown>;
        const timestamp = new Date().toISOString();

        ctx.logger?.log?.(
          `[test-webhook] Webhook event will be stored by controller`,
          "TestWebhookPlugin",
        );

        return {
          type: webhookData.type as string,
          message: (webhookData.message as string) || "Test webhook received",
          timestamp,
          payload: webhookData,
        };
      },
    }),
  ],
});
