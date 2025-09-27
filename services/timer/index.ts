import { createService, createAction, createReaction } from "@area/sdk";
import { CronExpressionParser } from "cron-parser";

export default createService({
  id: "timer",
  name: "Timer",
  version: "1.0.0",
  description:
    "The Timer service allows workflows to be triggered at intervals or based on cron expressions.",
  logo: "https://cdn-icons-png.flaticon.com/512/1827/1827504.png",
  auth: { type: "none" },

  actions: [
    createAction({
      id: "cron",
      name: "Cron",
      description:
        "Trigger based on a cron expression (e.g. */10 * * * * = every 10 minutes).",
      input: { expression: "string" },
      output: { triggered_at: "string" },
      run: async (params, ctx) => {
        const expr = params.expression as string;
        if (!expr) return null;

        const now = new Date();
        const lastChecked = ctx.state?.lastChecked
          ? new Date(ctx.state.lastChecked as string)
          : new Date(0);
        if (ctx.state) {
          ctx.state.lastChecked = now.toISOString();
        }

        try {
          const interval = CronExpressionParser.parse(expr, {
            currentDate: lastChecked,
          });
          const next = interval.next().toDate();

          if (next <= now) {
            ctx.logger?.log?.(`[timer] cron(${expr}) triggered`, "TimerPlugin");
            return { triggered_at: now.toISOString() };
          }
        } catch (err) {
          ctx.logger?.error?.(
            `[timer] invalid cron expression: ${expr} (${err instanceof Error ? err.message : String(err)})`,
            "TimerPlugin",
          );
        }

        return null;
      },
    }),
  ],

  reactions: [
    createReaction({
      id: "wait",
      name: "Wait",
      description: "Pause workflow execution for N seconds",
      input: { seconds: "number" },
      output: { completed: "boolean", waited_seconds: "number" },
      run: async (params, ctx) => {
        const seconds = Number(params.seconds) || 0;
        ctx.logger?.log?.(`[timer] wait for ${seconds} seconds`, "TimerPlugin");

        if (seconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        }

        return {
          completed: true,
          waited_seconds: seconds,
        };
      },
    }),
  ],

  onConnect: async (ctx) => {
    ctx.logger?.log?.("[timer] onConnect invoked", "TimerPlugin");
  },

  onDisconnect: async (ctx) => {
    ctx.logger?.log?.("[timer] onDisconnect invoked", "TimerPlugin");
  },
});
