import {
  createAction,
  createReaction,
  createService,
  booleanInput,
  passwordInput,
  textInput,
  urlInput,
} from "@area/sdk";
import type { ActionContext } from "@area/sdk";

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

    const fallbackContent = JSON.stringify(previousOutput, null, 2);
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
    "Trigger workflows from Discord events (messages, members, reactions) in real-time, and send messages via webhooks. Connect your Discord account to invite the bot to your servers.",
  logo: "https://cdn-icons-png.flaticon.com/512/5968/5968756.png",
  auth: {
    type: "oauth2",
    authorizationUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scopes: ["identify", "guilds", "bot"],
    clientIdEnvVar: "DISCORD_CLIENT_ID",
    clientSecretEnvVar: "DISCORD_CLIENT_SECRET",
    callbackUrlEnvVar: "DISCORD_CALLBACK_URL",
  },

  actions: [
    createAction({
      id: MESSAGE_RECEIVED_ACTION_ID,
      name: "Message Received",
      description:
        "Triggered when a message is received in a Discord channel where the bot is present. Supports filtering by channel, server, author, role, and content.",
      input: {
        channelId: textInput({
          label: "Channel ID (Optional)",
          description:
            "Only trigger for messages in this specific channel (leave empty for all channels).",
          placeholder: "123456789012345678",
        }),
        guildId: textInput({
          label: "Server ID (Optional)",
          description:
            "Only trigger for messages in this specific server/guild (leave empty for all servers).",
          placeholder: "987654321098765432",
        }),
        userId: textInput({
          label: "Author User ID (Optional)",
          description:
            "Only trigger when the author matches this user ID (leave empty to accept any user).",
          placeholder: "123456789012345678",
        }),
        roleId: textInput({
          label: "Author Role ID (Optional)",
          description:
            "Only trigger when the author has this role.",
          placeholder: "234567890123456789",
        }),
        contentIncludes: textInput({
          label: "Content Includes (Optional)",
          description:
            "Only trigger when message content includes this text (case-insensitive).",
          placeholder: "urgent",
        }),
        includeWebhookMessages: booleanInput({
          label: "Include Webhook Messages",
          description:
            "If enabled, messages created by webhooks are considered. Disable to ignore webhook-generated messages.",
          defaultValue: false,
        }),
        includeBotMessages: booleanInput({
          label: "Include Bot Messages",
          description:
            "If enabled, messages authored by bots are considered. Disable to ignore bot messages.",
          defaultValue: false,
        }),
      },
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
          ctx.logger?.log?.(
            `[discord] No unprocessed events for userId=${ctx.userId}, token=${ctx.workflowToken}`,
            "DiscordService",
          );
          return null;
        }

        ctx.logger?.log?.(
          `[discord] Found unprocessed event: ${JSON.stringify(event).substring(0, 200)}`,
          "DiscordService",
        );

        const payload = event.payload as Record<string, unknown> | undefined;

        if (!payload) {
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Apply filters from params
        const channelIdFilter = String(params.channelId ?? "").trim();
        const guildIdFilter = String(params.guildId ?? "").trim();
        const userId = String(params.userId ?? "").trim();
        const roleId = String(params.roleId ?? "").trim();
        const contentFilter = String(params.contentIncludes ?? "").trim();
        const includeWebhookMessages = Boolean(params.includeWebhookMessages);
        const includeBotMessages = Boolean(params.includeBotMessages);

        const channelId = String(payload.channelId ?? "");
        const guildId = String(payload.guildId ?? "");
        const authorId = String(payload.authorId ?? "");
        const isBot = Boolean(payload.isBot);
        const isWebhook = Boolean(payload.isWebhook);
        const content = String(payload.content ?? "");
        const roles = Array.isArray(payload.roles) ? payload.roles as string[] : [];

        // Filter: channel ID
        if (channelIdFilter && channelId !== channelIdFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping message ${payload.messageId} (wrong channel)`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: guild ID
        if (guildIdFilter && guildId !== guildIdFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping message ${payload.messageId} (wrong server)`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: webhook messages
        if (!includeWebhookMessages && isWebhook) {
          ctx.logger?.log?.(
            `[discord] Skipping webhook message ${payload.messageId}`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: bot messages
        if (!includeBotMessages && isBot) {
          ctx.logger?.log?.(
            `[discord] Skipping bot message ${payload.messageId}`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: user ID
        if (userId && authorId !== userId) {
          ctx.logger?.log?.(
            `[discord] Skipping message ${payload.messageId} (author ${authorId} !== ${userId})`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: role ID
        if (roleId && !roles.includes(roleId)) {
          ctx.logger?.log?.(
            `[discord] Skipping message ${payload.messageId} (author lacks role ${roleId})`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MESSAGE_RECEIVED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: content includes
        if (contentFilter) {
          const normalizedContent = content.normalize("NFKC").toLowerCase();
          const normalizedFilter = contentFilter.normalize("NFKC").toLowerCase();

          if (!normalizedContent.includes(normalizedFilter)) {
            ctx.logger?.log?.(
              `[discord] Skipping message ${payload.messageId} (content filter mismatch)`,
              "DiscordService",
            );
            ctx.webhookEvents.markAsProcessed(
              SERVICE_ID,
              MESSAGE_RECEIVED_ACTION_ID,
              event.timestamp,
            );
            return null;
          }
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

        return {
          messageId: String(payload.messageId ?? ""),
          channelId: String(payload.channelId ?? ""),
          guildId: String(payload.guildId ?? ""),
          authorId: String(payload.authorId ?? ""),
          authorUsername: String(payload.authorUsername ?? ""),
          content: String(payload.content ?? ""),
          createdAt: String(payload.createdAt ?? ""),
          messageUrl: String(payload.messageUrl ?? ""),
        };
      },
    }),

    createAction({
      id: MEMBER_JOIN_ACTION_ID,
      name: "Member Joined",
      description:
        "Triggered when a member joins a Discord server where the bot is present.",
      input: {
        guildId: textInput({
          label: "Server ID (Optional)",
          description:
            "Only trigger for members joining this specific server/guild (leave empty for all servers).",
          placeholder: "987654321098765432",
        }),
        ignoreBots: booleanInput({
          label: "Ignore Bots",
          description:
            "If enabled, bot accounts joining will be ignored.",
          defaultValue: true,
        }),
      },
      output: {
        userId: "string",
        username: "string",
        discriminator: "string",
        joinedAt: "string",
        isBot: "boolean",
        guildId: "string",
        guildName: "string",
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

        // Apply filters
        const guildIdFilter = String(params.guildId ?? "").trim();
        const ignoreBots = Boolean(params.ignoreBots ?? true);

        const guildId = String(payload.guildId ?? "");
        const isBot = Boolean(payload.isBot);

        // Filter: guild ID
        if (guildIdFilter && guildId !== guildIdFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping member join ${payload.userId} (wrong server)`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            MEMBER_JOIN_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: bots
        if (ignoreBots && isBot) {
          ctx.logger?.log?.(
            `[discord] Skipping bot member join ${payload.userId}`,
            "DiscordService",
          );
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

        return {
          userId: String(payload.userId ?? ""),
          username: String(payload.username ?? ""),
          discriminator: String(payload.discriminator ?? ""),
          joinedAt: String(payload.joinedAt ?? ""),
          isBot: Boolean(payload.isBot),
          guildId: String(payload.guildId ?? ""),
          guildName: String(payload.guildName ?? ""),
          memberCount: Number(payload.memberCount ?? 0),
        };
      },
    }),

    createAction({
      id: MEMBER_LEAVE_ACTION_ID,
      name: "Member Left",
      description:
        "Triggered when a member leaves a Discord server where the bot is present.",
      input: {
        guildId: textInput({
          label: "Server ID (Optional)",
          description:
            "Only trigger for members leaving this specific server/guild (leave empty for all servers).",
          placeholder: "987654321098765432",
        }),
      },
      output: {
        userId: "string",
        username: "string",
        guildId: "string",
        guildName: "string",
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

        // Apply filters
        const guildIdFilter = String(params.guildId ?? "").trim();
        const guildId = String(payload.guildId ?? "");

        // Filter: guild ID
        if (guildIdFilter && guildId !== guildIdFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping member leave ${payload.userId} (wrong server)`,
            "DiscordService",
          );
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

        return {
          userId: String(payload.userId ?? ""),
          username: String(payload.username ?? ""),
          guildId: String(payload.guildId ?? ""),
          guildName: String(payload.guildName ?? ""),
          memberCount: Number(payload.memberCount ?? 0),
          leftAt: String(payload.leftAt ?? ""),
        };
      },
    }),

    createAction({
      id: REACTION_ADDED_ACTION_ID,
      name: "Reaction Added",
      description:
        "Triggered when a reaction is added to a message in a Discord channel where the bot is present.",
      input: {
        channelId: textInput({
          label: "Channel ID (Optional)",
          description:
            "Only trigger for reactions in this specific channel (leave empty for all channels).",
          placeholder: "123456789012345678",
        }),
        guildId: textInput({
          label: "Server ID (Optional)",
          description:
            "Only trigger for reactions in this specific server/guild (leave empty for all servers).",
          placeholder: "987654321098765432",
        }),
        emoji: textInput({
          label: "Emoji Filter (Optional)",
          description:
            "Only trigger for this specific emoji (leave empty for all emojis). Use emoji name like '👍' or custom emoji name.",
          placeholder: "👍",
        }),
        userId: textInput({
          label: "User ID (Optional)",
          description:
            "Only trigger when this specific user adds a reaction (leave empty for all users).",
          placeholder: "123456789012345678",
        }),
      },
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

        // Apply filters
        const channelIdFilter = String(params.channelId ?? "").trim();
        const guildIdFilter = String(params.guildId ?? "").trim();
        const emojiFilter = String(params.emoji ?? "").trim();
        const userIdFilter = String(params.userId ?? "").trim();

        const channelId = String(payload.channelId ?? "");
        const guildId = String(payload.guildId ?? "");
        const emoji = String(payload.emoji ?? "");
        const userId = String(payload.userId ?? "");

        // Filter: channel ID
        if (channelIdFilter && channelId !== channelIdFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping reaction on message ${payload.messageId} (wrong channel)`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            REACTION_ADDED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: guild ID
        if (guildIdFilter && guildId !== guildIdFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping reaction on message ${payload.messageId} (wrong server)`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            REACTION_ADDED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: emoji
        if (emojiFilter && emoji !== emojiFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping reaction on message ${payload.messageId} (wrong emoji: got ${emoji}, expected ${emojiFilter})`,
            "DiscordService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            REACTION_ADDED_ACTION_ID,
            event.timestamp,
          );
          return null;
        }

        // Filter: user ID
        if (userIdFilter && userId !== userIdFilter) {
          ctx.logger?.log?.(
            `[discord] Skipping reaction on message ${payload.messageId} (wrong user)`,
            "DiscordService",
          );
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

        return {
          messageId: String(payload.messageId ?? ""),
          channelId: String(payload.channelId ?? ""),
          guildId: String(payload.guildId ?? ""),
          emoji: String(payload.emoji ?? ""),
          emojiId: String(payload.emojiId ?? ""),
          isCustomEmoji: Boolean(payload.isCustomEmoji),
          reactionCount: Number(payload.reactionCount ?? 0),
          userId: String(payload.userId ?? ""),
          username: String(payload.username ?? ""),
        };
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
      run: async (params, ctx) => {
        const webhookUrl = ensureWebhookUrl(params.webhookUrl);
        const { content, usedFallback } = resolveContent(
          params.content,
          ctx.previousOutput as Record<string, unknown> | undefined,
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
