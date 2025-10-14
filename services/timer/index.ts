import {
  createService,
  createAction,
  createReaction,
  cronInput,
  numberInput,
  textInput,
  selectInput,
} from "@area/sdk";
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
      input: {
        expression: cronInput({
          label: "Cron Expression",
          description:
            "6-field cron expression: second minute hour day month weekday",
          placeholder: "*/10 * * * * *",
          validation: {
            required: true,
          },
          options: [
            {
              label: "Every 10 seconds",
              value: "*/10 * * * * *",
              description: "Triggers every 10 seconds",
            },
            {
              label: "Every minute",
              value: "0 * * * * *",
              description: "Triggers at the start of every minute",
            },
            {
              label: "Every 5 minutes",
              value: "0 */5 * * * *",
              description: "Triggers every 5 minutes",
            },
            {
              label: "Every hour",
              value: "0 0 * * * *",
              description: "Triggers at the start of every hour",
            },
            {
              label: "Every day at midnight",
              value: "0 0 0 * * *",
              description: "Triggers at 00:00:00 every day",
            },
            {
              label: "Every Monday at 9am",
              value: "0 0 9 * * 1",
              description: "Triggers at 09:00:00 every Monday",
            },
            {
              label: "Every weekday at 9am",
              value: "0 0 9 * * 1-5",
              description: "Triggers at 09:00:00 Monday through Friday",
            },
            {
              label: "First day of month",
              value: "0 0 0 1 * *",
              description: "Triggers at midnight on the 1st of every month",
            },
          ],
        }),
      },
      output: { triggered_at: "string" },
      run: async (params, ctx) => {
        const expr = params.expression as string;
        if (!expr) return null;

        const now = new Date();
        const lastChecked = ctx.state?.lastChecked
          ? new Date(ctx.state.lastChecked as string)
          : new Date(0);

        try {
          const interval = CronExpressionParser.parse(expr, {
            currentDate: lastChecked,
          });
          const next = interval.next().toDate();

          if (next <= now) {
            if (ctx.state) {
              ctx.state.lastChecked = now.toISOString();
            }
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
      input: {
        seconds: numberInput({
          label: "Seconds",
          description: "Number of seconds to wait",
          placeholder: "10",
          min: 0,
          validation: {
            required: true,
            min: 0,
          },
        }),
      },
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
    createReaction({
      id: "log",
      name: "Log Message",
      description: "Log a message to the console for testing",
      input: {
        message: textInput({
          label: "Message",
          description: "Message to log",
          placeholder: "Enter your message",
          validation: {
            required: true,
          },
        }),
        level: selectInput(
          [
            {
              label: "Info",
              value: "info",
              description: "Informational message",
              icon: "ℹ️",
              color: "#3b82f6",
            },
            {
              label: "Warning",
              value: "warn",
              description: "Warning message",
              icon: "⚠️",
              color: "#f59e0b",
            },
            {
              label: "Error",
              value: "error",
              description: "Error message",
              icon: "❌",
              color: "#ef4444",
            },
          ],
          {
            label: "Log Level",
            description: "Severity level of the log message",
            defaultValue: "info",
          },
        ),
      },
      output: { logged: "boolean", message: "string" },
      run: async (params, ctx) => {
        const message = String(params.message) || "Test message";
        const level = String(params.level) || "info";

        switch (level) {
          case "error":
            ctx.logger?.error?.(message, "TimerPlugin");
            break;
          case "warn":
            ctx.logger?.warn?.(message, "TimerPlugin");
            break;
          default:
            ctx.logger?.log?.(message, "TimerPlugin");
            break;
        }

        return {
          logged: true,
          message,
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
