import {
  booleanInput,
  createReaction,
  createService,
  integerInput,
  jsonInput,
  textInput,
} from "@area/sdk";

import vm from "node:vm";

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default createService({
  id: "javascript",
  name: "JavaScript",
  version: "1.0.0",
  description:
    "Run custom JavaScript in a lightweight, sandboxed environment.",
  logo: "https://cdn-icons-png.flaticon.com/512/5968/5968292.png",
  auth: { type: "none" },

  reactions: [
    createReaction({
      id: "run",
      name: "Run JavaScript",
      description:
        "Execute a JavaScript snippet. The code can return a value; async is supported.",
      input: {
        code: textInput({
          label: "JavaScript Code",
          multiline: true,
          placeholder: "// Example\nreturn params.a + params.b;",
          validation: { required: true },
        }),
        params: jsonInput({
          label: "Params (JSON)",
          description: 'JSON object available as "params" in your code',
          placeholder: '{"a": 1, "b": 2}',
        }),
        timeoutMs: integerInput({
          label: "Timeout (ms)",
          description: "Max execution time before abort",
          min: 1,
          max: 5000,
          defaultValue: 1000,
        }),
        async: booleanInput({
          label: "Async function",
          description: "Run code inside an async function",
          defaultValue: true,
        }),
      },
      output: {
        result: "string",
        duration_ms: "number",
        logs: "object",
      },
      run: async (params, ctx) => {
        const code = String(params.code ?? "");
        const timeoutMs = Math.max(1, Math.min(5000, Number(params.timeoutMs) || 1000));
        const runAsync = Boolean(params.async ?? true);

        let parsedParams: Record<string, unknown> = {};
        try {
          const raw = (params.params as string) || "";
          parsedParams = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch (err) {
          throw new Error(
            `Invalid JSON in params: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        const logs: string[] = [];
        const safeConsole = {
          log: (msg: unknown, ...rest: unknown[]) => {
            logs.push([msg, ...rest].map(safeStringify).join(" "));
          },
        };

        const sandbox = {
          params: parsedParams,
          console: safeConsole,
        } as Record<string, unknown>;

        const context = vm.createContext(sandbox, {
          name: "javascript-service",
          codeGeneration: { strings: true, wasm: false },
        });

        const wrapped = runAsync
          ? `(async (params) => { ${code}\n})`
          : `((params) => { ${code}\n})`;

        const script = new vm.Script(wrapped, { timeout: timeoutMs });
        const fn = script.runInContext(context, { timeout: timeoutMs }) as (
          p: Record<string, unknown>,
        ) => unknown | Promise<unknown>;

        const start = Date.now();
        const exec = Promise.resolve(fn(parsedParams));
        const result = await Promise.race([
          exec,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Execution timed out")), timeoutMs),
          ),
        ]);
        const duration = Date.now() - start;

        ctx.logger?.log?.(
          `[javascript] executed in ${duration}ms`,
          "JavaScriptService",
        );

        // If user returned an object, expose its top-level fields
        // so they can be referenced by following nodes (e.g. {{sum}}).
        const extra: Record<string, unknown> = {};
        if (result && typeof result === "object" && !Array.isArray(result)) {
          for (const [key, value] of Object.entries(
            result as Record<string, unknown>,
          )) {
            if (key === "result" || key === "duration_ms" || key === "logs") {
              continue;
            }
            if (
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
            ) {
              extra[key] = value;
            } else {
              extra[key] = safeStringify(value);
            }
          }
        }

        return {
          result: safeStringify(result),
          duration_ms: duration,
          logs,
          ...extra,
        };
      },
    }),
  ],
});
