import {
  createReaction,
  createService,
  urlInput,
  textInput,
} from "@area/sdk";

const SERVICE_ID = "discord";
const WEBHOOK_REACTION_ID = "send-webhook-message";

function ensureWebhookUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  if (!url) {
    throw new Error("Webhook URL is required");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("Invalid Discord webhook URL");
  }

  return url;
}

function resolveContent(
  explicitContent: unknown,
  previousOutput: Record<string, unknown> | undefined,
): { content: string; usedFallback: boolean } {
  const direct = String(explicitContent ?? "").trim();
  if (direct) {
    return { content: truncateForDiscord(direct), usedFallback: false };
  }

  if (previousOutput) {
    const preferredKeys = [
      "message",
      "content",
      "text",
      "title",
      "description",
    ];

    for (const key of preferredKeys) {
      const value = previousOutput[key];
      if (typeof value === "string" && value.trim()) {
        return { content: truncateForDiscord(value), usedFallback: true };
      }
    }

    const serialised = JSON.stringify(previousOutput, null, 2);
    if (serialised) {
      return {
        content: truncateForDiscord(serialised),
        usedFallback: true,
      };
    }
  }

  throw new Error(
    "Message content is required (set the content field or provide usable previous output)",
  );
}

function truncateForDiscord(value: string): string {
  const LIMIT = 2000;
  if (value.length <= LIMIT) {
    return value;
  }

  return `${value.slice(0, LIMIT - 3)}...`;
}

export default createService({
  id: SERVICE_ID,
  name: "Discord",
  version: "1.0.0",
  description: "Send messages to a Discord channel using an incoming webhook.",
  logo: "https://cdn-icons-png.flaticon.com/512/5968/5968756.png",
  auth: { type: "none" },

  reactions: [
    createReaction({
      id: WEBHOOK_REACTION_ID,
      name: "Send Webhook Message",
      description: "Send a text message to a Discord channel via webhook URL.",
      input: {
        webhookUrl: urlInput({
          label: "Webhook URL",
          description: "Discord webhook URL to send the message to",
          placeholder: "https://discord.com/api/webhooks/...",
          validation: {
            required: true,
          },
        }),
        content: textInput({
          label: "Message Content",
          description: "The message to send (max 2000 characters)",
          placeholder: "Enter your message",
          multiline: true,
          validation: {
            maxLength: 2000,
          },
        }),
        username: textInput({
          label: "Username (Optional)",
          description: "Override the default webhook username",
          placeholder: "Custom Bot Name",
        }),
        avatarUrl: urlInput({
          label: "Avatar URL (Optional)",
          description: "Override the default webhook avatar",
          placeholder: "https://example.com/avatar.png",
        }),
      },
      output: {
        delivered: "boolean",
        status: "string",
        messageId: "string",
        usedFallback: "boolean",
        responseBody: "object",
      },
      run: async (params, ctx) => {
        const webhookUrl = ensureWebhookUrl(params.webhookUrl);

        const previousOutput =
          (ctx.previousOutput as Record<string, unknown> | null) ?? undefined;
        const { content, usedFallback } = resolveContent(
          params.content,
          previousOutput,
        );

        const payload: Record<string, unknown> = {
          content,
        };

        const username = String(params.username ?? "").trim();
        if (username) {
          payload.username = username;
        }

        const avatarUrl = String(params.avatarUrl ?? "").trim();
        if (avatarUrl) {
          payload.avatar_url = avatarUrl;
        }


        let response: Response;
        try {
          response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          ctx.logger?.error?.(
            `[discord] Failed to reach webhook: ${error instanceof Error ? error.message : String(error)}`,
            "DiscordService",
          );
          throw new Error("Failed to send request to Discord webhook");
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          ctx.logger?.warn?.(
            `[discord] Webhook responded with ${response.status}: ${errorText}`,
            "DiscordService",
          );
          throw new Error(
            `Discord webhook returned ${response.status}${errorText ? `: ${errorText}` : ""}`,
          );
        }

        const responseBody =
          response.status === 204
            ? null
            : await response
                .json()
                .catch(() => null as Record<string, unknown> | null);

        const messageId =
          (responseBody && typeof responseBody === "object"
            ? (responseBody as Record<string, unknown>).id
            : null) ?? "";

        ctx.logger?.log?.(
          `[discord] Message delivered${messageId ? ` (id: ${messageId})` : ""}`,
          "DiscordService",
        );

        return {
          delivered: true,
          status: String(response.status),
          messageId: String(messageId || ""),
          usedFallback,
          responseBody: responseBody ?? {},
        };
      },
    }),
  ],
});
