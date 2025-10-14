import {
  createReaction,
  createService,
  textInput,
  selectInput,
  numberInput,
} from "@area/sdk";
import OpenAI from "openai";

const SERVICE_ID = "openai";

const OPENAI_MODELS = [
  { label: "GPT-4o", value: "gpt-4o", description: "Most advanced model" },
  {
    label: "GPT-4o Mini",
    value: "gpt-4o-mini",
    description: "Fast and cost-effective",
  },
  {
    label: "GPT-4 Turbo",
    value: "gpt-4-turbo",
    description: "Extended context",
  },
  { label: "GPT-4", value: "gpt-4", description: "Standard GPT-4" },
  {
    label: "GPT-3.5 Turbo",
    value: "gpt-3.5-turbo",
    description: "Fast and economical",
  },
];

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-3.5-turbo": { input: 0.0015, output: 0.002 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS["gpt-3.5-turbo"];
  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;
  return inputCost + outputCost;
}

export default createService({
  id: SERVICE_ID,
  name: "OpenAI",
  version: "1.0.0",
  description: "Interact with OpenAI models to generate text completions",
  logo: "https://static.vecteezy.com/system/resources/previews/022/227/364/non_2x/openai-chatgpt-logo-icon-free-png.png",
  auth: {
    type: "api_key",
    keyName: "OPENAI_API_KEY",
    keyLocation: "header",
    description: "API key from OpenAI (https://platform.openai.com/api-keys)",
  },

  reactions: [
    createReaction({
      id: "generate-completion",
      name: "Prompt",
      description:
        "Send a prompt to OpenAI and receive a completion response with token usage and cost information",
      input: {
        prompt: textInput({
          label: "Prompt",
          description:
            "The prompt to send to the model. You can use {variable} syntax to reference previous outputs.",
          placeholder: "Summarize this text: {previous_output}",
          multiline: true,
          validation: {
            required: true,
            minLength: 1,
            maxLength: 10000,
          },
        }),
        model: selectInput(OPENAI_MODELS, {
          label: "Model",
          description: "OpenAI model to use",
          defaultValue: "gpt-4o-mini",
          validation: {
            required: false,
          },
        }),
        maxTokens: numberInput({
          label: "Max Tokens",
          description:
            "Maximum tokens to generate (leave empty for model default)",
          placeholder: "1000",
          min: 1,
          max: 16000,
          validation: {
            required: false,
          },
        }),
        temperature: numberInput({
          label: "Temperature",
          description:
            "Sampling temperature (0-2). Lower = more focused, higher = more creative",
          placeholder: "1.0",
          min: 0,
          max: 2,
          validation: {
            required: false,
          },
        }),
      },
      output: {
        response: "string",
        model_used: "string",
        prompt_tokens: "number",
        completion_tokens: "number",
        total_tokens: "number",
        estimated_cost_usd: "number",
        finish_reason: "string",
      },
      run: async (params, ctx) => {
        const apiKey = ctx.connection?.accessToken;
        if (!apiKey) {
          throw new Error("OpenAI API key not configured");
        }

        const openai = new OpenAI({
          apiKey,
        });

        const prompt = String(params.prompt || "").trim();
        if (!prompt) {
          throw new Error("Prompt is required");
        }

        const model = String(params.model || "gpt-4o-mini").trim();

        const requestParams: any = {
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        };

        if (params.maxTokens !== undefined && params.maxTokens !== null) {
          const maxTokens = Number(params.maxTokens);
          if (!isNaN(maxTokens) && maxTokens > 0) {
            requestParams.max_tokens = Math.floor(maxTokens);
          }
        }

        if (params.temperature !== undefined && params.temperature !== null) {
          const temperature = Number(params.temperature);
          if (!isNaN(temperature) && temperature >= 0 && temperature <= 2) {
            requestParams.temperature = temperature;
          }
        }

        ctx.logger?.log?.(
          `[openai] Sending prompt to ${model} (${prompt.length} chars)`,
          "OpenAIService",
        );

        try {
          const completion =
            await openai.chat.completions.create(requestParams);

          const response = completion.choices[0]?.message?.content || "";
          const usage = completion.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          };

          const estimatedCost = calculateCost(
            model,
            usage.prompt_tokens,
            usage.completion_tokens,
          );

          const finishReason =
            completion.choices[0]?.finish_reason || "unknown";

          ctx.logger?.log?.(
            `[openai] Completion received: ${usage.total_tokens} tokens, cost: $${estimatedCost.toFixed(6)}`,
            "OpenAIService",
          );

          return {
            response,
            model_used: model,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            estimated_cost_usd: Number(estimatedCost.toFixed(6)),
            finish_reason: finishReason,
          };
        } catch (error) {
          ctx.logger?.error?.(
            `[openai] API error: ${error instanceof Error ? error.message : String(error)}`,
            "OpenAIService",
          );
          throw new Error(
            `OpenAI API error: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      },
    }),
  ],
});
