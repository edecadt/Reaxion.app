import {
  booleanInput,
  createReaction,
  createService,
  passwordInput,
  selectInput,
  textInput,
} from "@area/sdk";

const SERVICE_ID = "telegram";
const SEND_MESSAGE_REACTION_ID = "send-channel-message";
const TELEGRAM_API_BASE = "https://api.telegram.org";

function ensureBotToken(value: unknown): string {
  const token = String(value ?? "").trim();
  if (!token) {
    throw new Error("Telegram bot token is required");
  }

  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("Telegram bot token format looks invalid");
  }

  return token;
}

function ensureChatId(value: unknown): string {
  const chatId = String(value ?? "").trim();
  if (!chatId) {
    throw new Error("Channel chat ID or @username is required");
  }

  if (!/^@[\w\d_]{5,}$/.test(chatId) && !/^-?\d+$/.test(chatId)) {
    throw new Error(
      "Chat identifier must be a numeric ID (e.g. -1001234567890) or channel username (e.g. @my_channel)",
    );
  }

  return chatId;
}

function resolveMessage(
  explicitText: unknown,
  previousOutput: Record<string, unknown> | undefined,
): { text: string; usedFallback: boolean } {
  const direct = String(explicitText ?? "").trim();
  if (direct) {
    return { text: truncateForTelegram(direct), usedFallback: false };
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
        return { text: truncateForTelegram(value), usedFallback: true };
      }
    }

    const serialised = JSON.stringify(previousOutput, null, 2);
    if (serialised) {
      return {
        text: truncateForTelegram(serialised),
        usedFallback: true,
      };
    }
  }

  throw new Error(
    "Message text is required (set the text field or provide usable previous output)",
  );
}

function truncateForTelegram(value: string): string {
  const LIMIT = 4096;
  if (value.length <= LIMIT) {
    return value;
  }

  return `${value.slice(0, LIMIT - 3)}...`;
}

function resolveParseMode(raw: unknown): "HTML" | "MarkdownV2" | "Markdown" | null {
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  if (!normalized || normalized.toLowerCase() === "none") {
    return null;
  }

  const allowed = new Set(["HTML", "MarkdownV2", "Markdown"]);
  if (!allowed.has(normalized as "HTML" | "MarkdownV2" | "Markdown")) {
    throw new Error("Unsupported parse mode");
  }

  return normalized as "HTML" | "MarkdownV2" | "Markdown";
}

export default createService({
  id: SERVICE_ID,
  name: "Telegram",
  version: "1.0.0",
  description:
    "Send a message to a Telegram channel using a bot with the appropriate permissions.",
  logo: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg",
  auth: { type: "none" },

  reactions: [
    createReaction({
      id: SEND_MESSAGE_REACTION_ID,
      name: "Send Channel Message",
      description:
        "Post a text message to a Telegram channel via the Bot API.",
      input: {
        botToken: passwordInput({
          label: "Bot Token",
          description:
            "The token provided by BotFather. Keep this value secret.",
          placeholder: "123456789:ABCDEF-ghIJKLmnoPQrstuvWXyz",
          validation: {
            required: true,
          },
        }),
        chatId: textInput({
          label: "Channel Chat ID",
          description:
            "Use the numeric chat ID (e.g. -1001234567890) or the public @channel username.",
          placeholder: "@my_channel or -1001234567890",
          validation: {
            required: true,
          },
        }),
        text: textInput({
          label: "Message Text",
          description:
            "Content of the message (max 4096 characters). If left empty, the service tries to use the previous node output.",
          placeholder: "What should be posted to Telegram?",
          multiline: true,
          validation: {
            maxLength: 4096,
          },
        }),
        parseMode: selectInput(
          [
            { label: "None", value: "none" },
            { label: "MarkdownV2", value: "MarkdownV2" },
            { label: "Markdown (Legacy)", value: "Markdown" },
            { label: "HTML", value: "HTML" },
          ],
          {
            label: "Parse Mode",
            description:
              "Enable Markdown or HTML formatting. Leave as None if you are sending plain text.",
            defaultValue: "none",
          },
        ),
        disableNotification: booleanInput({
          label: "Silent Message",
          description:
            "Send the message without a sound notification for subscribers.",
          defaultValue: false,
        }),
        disableWebPagePreview: booleanInput({
          label: "Disable Link Preview",
          description: "Prevent Telegram from generating link previews.",
          defaultValue: false,
        }),
      },
      output: {
        delivered: "boolean",
        status: "string",
        ok: "boolean",
        messageId: "string",
        chatId: "string",
        usedFallback: "boolean",
        responseBody: "object",
      },
      run: async (params, ctx) => {
        const botToken = ensureBotToken(params.botToken);
        const chatId = ensureChatId(params.chatId);

        const previousOutput =
          (ctx.previousOutput as Record<string, unknown> | null) ?? undefined;
        const { text, usedFallback } = resolveMessage(
          params.text,
          previousOutput,
        );

        const parseMode = resolveParseMode(params.parseMode);
        const disableNotification = Boolean(params.disableNotification);
        const disableWebPagePreview = Boolean(params.disableWebPagePreview);

        const payload: Record<string, unknown> = {
          chat_id: chatId,
          text,
        };

        if (parseMode) {
          payload.parse_mode = parseMode;
        }

        if (disableNotification) {
          payload.disable_notification = true;
        }

        if (disableWebPagePreview) {
          payload.disable_web_page_preview = true;
        }

        let response: Response;
        try {
          response = await fetch(
            `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
        } catch (error) {
          ctx.logger?.error?.(
            `[telegram] Failed to reach Telegram API: ${
              error instanceof Error ? error.message : String(error)
            }`,
            "TelegramService",
          );
          throw new Error("Failed to send request to the Telegram API");
        }

        let responseBody: Record<string, unknown> | null = null;
        try {
          responseBody = (await response.json()) as Record<string, unknown>;
        } catch {
          responseBody = null;
        }

        const ok =
          typeof responseBody?.ok === "boolean"
            ? (responseBody.ok as boolean)
            : response.ok;

        if (!response.ok || !ok) {
          const description =
            typeof responseBody?.description === "string"
              ? responseBody.description
              : "";
          ctx.logger?.warn?.(
            `[telegram] API responded with ${response.status}: ${description}`,
            "TelegramService",
          );
          throw new Error(
            `Telegram API returned ${response.status}${
              description ? `: ${description}` : ""
            }`,
          );
        }

        const result =
          (responseBody?.result as Record<string, unknown> | undefined) ??
          undefined;
        const messageId =
          result && typeof result.message_id !== "undefined"
            ? String(result.message_id)
            : "";
        const resolvedChatId =
          result && typeof result.chat === "object" && result.chat !== null
            ? String(
                (result.chat as Record<string, unknown>).id ?? chatId,
              )
            : chatId;

        ctx.logger?.log?.(
          `[telegram] Message delivered${
            messageId ? ` (id: ${messageId})` : ""
          }`,
          "TelegramService",
        );

        return {
          delivered: true,
          status: String(response.status),
          ok: true,
          messageId,
          chatId: resolvedChatId,
          usedFallback,
          responseBody: responseBody ?? {},
        };
      },
    }),
  ],

  actions: [],
  webhooks: [],
});
