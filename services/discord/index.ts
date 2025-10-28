import {
  createAction,
  createReaction,
  createService,
  textInput,
  urlInput,
} from "@area/sdk";

const SERVICE_ID = "discord";
const DISCORD_API_BASE = "https://discord.com/api/v10";

const MESSAGE_RECEIVED_ACTION_ID = "message-received";
const MEMBER_JOIN_ACTION_ID = "member-join";
const MEMBER_LEAVE_ACTION_ID = "member-leave";
const REACTION_ADDED_ACTION_ID = "reaction-added";

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
      "body",
      "description",
      "summary",
      "title",
    ];

    for (const key of preferredKeys) {
      const candidateValue = previousOutput[key];
      if (candidateValue && typeof candidateValue === "string") {
        const trimmed = candidateValue.trim();
        if (trimmed) {
          return { content: truncateForDiscord(trimmed), usedFallback: true };
        }
      }
    }

    const fallbackContent = JSON.stringify(previousOutput);
    return { content: truncateForDiscord(fallbackContent), usedFallback: true };
  }

  throw new Error("No message content provided");
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
  version: "2.0.0",
  description:
    "Trigger workflows from Discord events (messages, members, reactions) in real-time using a shared bot, and send messages via webhooks.",
  logo: "https://cdn-icons-png.flaticon.com/512/5968/5968756.png",
  auth: {
    type: "oauth2",
    authorizationUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scopes: ["identify", "email", "guilds", "bot"],
    clientIdEnvVar: "DISCORD_CLIENT_ID",
    clientSecretEnvVar: "DISCORD_CLIENT_SECRET",
    authorizationParams: {
      permissions: "67584",
    },
  },

  onConnect: async (ctx) => {
    if (!ctx.connection?.accessToken) {
      throw new Error("No access token available");
    }

    try {
      const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ctx.connection.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to authenticate with Discord: ${response.status}`,
        );
      }

      const user = await response.json();
      ctx.logger?.log?.(
        `[discord] Successfully connected Discord account for user ${user.username ?? "Unknown"} (${user.id})`,
        "DiscordService",
      );

      const guildsResponse = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ctx.connection.accessToken}`,
        },
      });

      if (guildsResponse.ok) {
        const guilds = await guildsResponse.json();
        ctx.logger?.log?.(
          `[discord] User has access to ${guilds.length} servers`,
          "DiscordService",
        );
      }
    } catch (error) {
      ctx.logger?.error?.(
        `[discord] Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
        "DiscordService",
      );
      throw new Error("Failed to authenticate with Discord");
    }
  },

  actions: [
    createAction({
      id: MESSAGE_RECEIVED_ACTION_ID,
      name: "Message Received",
      description:
        "Triggered when a message is received in a Discord channel where the bot is present.",
      input: {},
      output: {
        messageId: "string",
        channelId: "string",
        guildId: "string",
        authorId: "string",
        authorUsername: "string",
        content: "string",
        createdAt: "string",
        messageUrl: "string",
      },
      run: async (params, ctx) => {
        if (!ctx.webhookEvents) {
          ctx.logger?.warn?.(
            `[discord] WebhookEventsService missing, cannot process events`,
            "DiscordService",
          );
          return null;
        }

        const event = ctx.webhookEvents.getLastUnprocessedEvent(
          SERVICE_ID,
          MESSAGE_RECEIVED_ACTION_ID,
          ctx.userId,
          ctx.workflowToken,
        );

        if (!event) {
          return null;
        }

        const payload = event.payload as Record<string, unknown> | undefined;

        if (!payload) {
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        ctx.logger?.log?.(
          `[discord] Message received: ${payload.messageId} in channel ${payload.channelId}`,
          "DiscordService",
        );

        ctx.webhookEvents.markAsProcessed(
          SERVICE_ID,
          MESSAGE_RECEIVED_ACTION_ID,
          event.timestamp,
        );

        return payload;
      },
    }),

    createAction({
      id: MEMBER_JOIN_ACTION_ID,
      name: "Member Joined",
      description:
        "Triggered when a member joins a Discord server where the bot is present.",
      input: {},
      output: {
        userId: "string",
        username: "string",
        discriminator: "string",
        joinedAt: "string",
        isBot: "boolean",
        guildId: "string",
        memberCount: "number",
      },
      run: async (params, ctx) => {
        if (!ctx.webhookEvents) {
          ctx.logger?.warn?.(
            `[discord] WebhookEventsService missing, cannot process events`,
            "DiscordService",
          );
          return null;
        }

        const event = ctx.webhookEvents.getLastUnprocessedEvent(
          SERVICE_ID,
          MEMBER_JOIN_ACTION_ID,
          ctx.userId,
          ctx.workflowToken,
        );

        if (!event) {
          return null;
        }

        const payload = event.payload as Record<string, unknown> | undefined;

        if (!payload) {
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MEMBER_JOIN_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        ctx.logger?.log?.(
          `[discord] Member joined: ${payload.username} (${payload.userId}) in guild ${payload.guildId}`,
          "DiscordService",
        );

        ctx.webhookEvents.markAsProcessed(
          SERVICE_ID,
          MEMBER_JOIN_ACTION_ID,
          event.timestamp,
        );

        return payload;
      },
    }),

    createAction({
      id: MEMBER_LEAVE_ACTION_ID,
      name: "Member Left",
      description:
        "Triggered when a member leaves a Discord server where the bot is present.",
      input: {},
      output: {
        userId: "string",
        username: "string",
        guildId: "string",
        memberCount: "number",
        leftAt: "string",
      },
      run: async (params, ctx) => {
        if (!ctx.webhookEvents) {
          ctx.logger?.warn?.(
            `[discord] WebhookEventsService missing, cannot process events`,
            "DiscordService",
          );
          return null;
        }

        const event = ctx.webhookEvents.getLastUnprocessedEvent(
          SERVICE_ID,
          MEMBER_LEAVE_ACTION_ID,
          ctx.userId,
          ctx.workflowToken,
        );

        if (!event) {
          return null;
        }

        const payload = event.payload as Record<string, unknown> | undefined;

        if (!payload) {
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MEMBER_LEAVE_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        ctx.logger?.log?.(
          `[discord] Member left: ${payload.username} (${payload.userId}) from guild ${payload.guildId}`,
          "DiscordService",
        );

        ctx.webhookEvents.markAsProcessed(
          SERVICE_ID,
          MEMBER_LEAVE_ACTION_ID,
          event.timestamp,
        );

        return payload;
      },
    }),

    createAction({
      id: REACTION_ADDED_ACTION_ID,
      name: "Reaction Added",
      description:
        "Triggered when a reaction is added to a message in a Discord channel where the bot is present.",
      input: {},
      output: {
        messageId: "string",
        channelId: "string",
        guildId: "string",
        emoji: "string",
        emojiId: "string",
        isCustomEmoji: "boolean",
        reactionCount: "number",
        userId: "string",
        username: "string",
      },
      run: async (params, ctx) => {
        if (!ctx.webhookEvents) {
          ctx.logger?.warn?.(
            `[discord] WebhookEventsService missing, cannot process events`,
            "DiscordService",
          );
          return null;
        }

        const event = ctx.webhookEvents.getLastUnprocessedEvent(
          SERVICE_ID,
          REACTION_ADDED_ACTION_ID,
          ctx.userId,
          ctx.workflowToken,
        );

        if (!event) {
          return null;
        }

        const payload = event.payload as Record<string, unknown> | undefined;

        if (!payload) {
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            REACTION_ADDED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        ctx.logger?.log?.(
          `[discord] Reaction added: ${payload.emoji} on message ${payload.messageId} by ${payload.username}`,
          "DiscordService",
        );

        ctx.webhookEvents.markAsProcessed(
          SERVICE_ID,
          REACTION_ADDED_ACTION_ID,
          event.timestamp,
        );

        return payload;
      },
    }),
  ],

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
      run: async (params, previousOutput, ctx) => {
        const webhookUrl = ensureWebhookUrl(params.webhookUrl);
        const { content, usedFallback } = resolveContent(
          params.content,
          previousOutput,
        );
        const username =
          typeof params.username === "string" && params.username.trim()
            ? params.username.trim()
            : undefined;
        const avatarUrl =
          typeof params.avatarUrl === "string" && params.avatarUrl.trim()
            ? params.avatarUrl.trim()
            : undefined;

        const body: Record<string, unknown> = { content };
        if (username) {
          body.username = username;
        }
        if (avatarUrl) {
          body.avatar_url = avatarUrl;
        }

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to send Discord message: ${response.status} ${errorText}`,
          );
        }

        ctx.logger?.log?.(
          `[discord] Sent message via webhook${usedFallback ? " (used fallback content from previous step)" : ""}`,
          "DiscordService",
        );

        return {
          success: true,
          message: content,
          usedFallback,
        };
      },
    }),
  ],
});
