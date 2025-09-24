const handler = {
  async onConnect(ctx) {
    ctx?.logger?.log?.('[timer] onConnect invoked', 'TimerPlugin');
  },
  async onDisconnect(ctx) {
    ctx?.logger?.log?.('[timer] onDisconnect invoked', 'TimerPlugin');
  },
  async detect(actionId, params, ctx) {
    ctx?.logger?.log?.(
      `[timer] detect(${actionId}) called with params ${JSON.stringify(params ?? {})}`,
      'TimerPlugin',
    );
    return null;
  },
  async execute(reactionId, params, ctx) {
    ctx?.logger?.log?.(
      `[timer] execute(${reactionId}) called with params ${JSON.stringify(params ?? {})}`,
      'TimerPlugin',
    );

    if (reactionId === 'wait') {
      const seconds = Number(params?.seconds ?? 0);
      return {
        completed: true,
        waited_seconds: Number.isFinite(seconds) ? seconds : 0,
      };
    }

    return {};
  },
  async onWebhook(event, payload, ctx) {
    ctx?.logger?.log?.(
      `[timer] onWebhook(${event}) called with payload ${JSON.stringify(payload ?? {})}`,
      'TimerPlugin',
    );
    return null;
  },
};

export default handler;
