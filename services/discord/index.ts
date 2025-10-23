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
const WEBHOOK_REACTION_ID = "send-webhook-message";
const MESSAGE_RECEIVED_ACTION_ID = "message-received";
const DISCORD_API_BASE = "https://discord.com/api/v10";
const ACTION_STATE_KEY = "__discordMessageReceived";

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

function ensureBotToken(value: unknown): string {
  const token = String(value ?? "").trim();
  if (!token) {
    throw new Error("Discord bot token is required");
  }

  return token;
}

function ensureSnowflake(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!id) {
    throw new Error(`${label} is required`);
  }

  if (!/^\d{5,}$/.test(id)) {
    throw new Error(`${label} must be a numeric Discord snowflake`);
  }

  return id;
}

function ensureOptionalSnowflake(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return ensureSnowflake(value, label);
}

function compareSnowflakes(a: string, b: string): number {
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  if (aBig === bBig) return 0;
  return aBig > bBig ? 1 : -1;
}

type DiscordAPIUser = {
  id: string;
  username?: string;
  global_name?: string | null;
};

type DiscordAPIMember = {
  roles?: string[];
  nick?: string | null;
};

type DiscordAPIMessage = {
  id: string;
  content: string;
  author: DiscordAPIUser;
  timestamp: string;
  edited_timestamp?: string | null;
  member?: DiscordAPIMember;
  guild_id?: string;
  channel_id: string;
};

type DiscordMessageChannelState = {
  lastMessageId?: string;
  guildId?: string;
  memberRoleCache?: Record<string, string[]>;
};

type DiscordMessageActionState = {
  botUserId?: string;
  channels: Record<string, DiscordMessageChannelState>;
};

function normaliseContent(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function getStateRecord(ctx: ActionContext): Record<string, unknown> {
  if (!ctx.state || typeof ctx.state !== "object" || ctx.state === null) {
    ctx.state = {};
  }

  return ctx.state as Record<string, unknown>;
}

function ensureActionState(ctx: ActionContext): DiscordMessageActionState {
  const stateRecord = getStateRecord(ctx);
  const existing = stateRecord[ACTION_STATE_KEY];

  if (
    existing &&
    typeof existing === "object" &&
    existing !== null &&
    "channels" in (existing as Record<string, unknown>)
  ) {
    return existing as DiscordMessageActionState;
  }

  const initial: DiscordMessageActionState = {
    botUserId: undefined,
    channels: {},
  };
  stateRecord[ACTION_STATE_KEY] = initial;
  return initial;
}

function ensureChannelState(
  actionState: DiscordMessageActionState,
  channelId: string,
): DiscordMessageChannelState {
  const existing = actionState.channels[channelId];
  if (existing && typeof existing === "object" && existing !== null) {
    return existing;
  }

  const channelState: DiscordMessageChannelState = {};
  actionState.channels[channelId] = channelState;
  return channelState;
}

function updateChannelLastMessageId(
  ctx: ActionContext,
  previousState: DiscordMessageActionState,
  channelId: string,
  lastMessageId: string | undefined,
): void {
  const channelState = ensureChannelState(previousState, channelId);
  const current = channelState.lastMessageId;
  channelState.lastMessageId = lastMessageId;

  ctx.logger?.log?.(
    `[discord] Updated channel ${channelId} lastMessageId: ${current ?? "none"} -> ${lastMessageId ?? "none"}`,
    "DiscordService",
  );
}

async function ensureBotUserId(
  ctx: ActionContext,
  botToken: string,
  state: DiscordMessageActionState,
): Promise<string> {
  if (state.botUserId) {
    return state.botUserId;
  }

  let response: Response;
  try {
    response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      method: "GET",
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });
  } catch (error) {
    ctx.logger?.error?.(
      `[discord] Failed to resolve bot identity: ${error instanceof Error ? error.message : String(error)}`,
      "DiscordService",
    );
    throw new Error("Unable to fetch Discord bot identity");
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    ctx.logger?.warn?.(
      `[discord] Failed to fetch bot identity (status ${response.status})${errorText ? `: ${errorText}` : ""}`,
      "DiscordService",
    );
    throw new Error("Discord API rejected bot identity lookup");
  }

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  const botUserId = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!botUserId) {
    throw new Error("Discord API did not return bot user id");
  }

  state.botUserId = botUserId;
  ctx.logger?.log?.(
    `[discord] Cached bot user id ${botUserId}`,
    "DiscordService",
  );

  return botUserId;
}

async function ensureChannelGuildId(
  ctx: ActionContext,
  botToken: string,
  state: DiscordMessageActionState,
  channelId: string,
): Promise<string | undefined> {
  const channelState = ensureChannelState(state, channelId);
  if (channelState.guildId) {
    return channelState.guildId;
  }

  let response: Response;
  try {
    response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}`, {
      method: "GET",
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });
  } catch (error) {
    ctx.logger?.error?.(
      `[discord] Failed to fetch channel metadata: ${error instanceof Error ? error.message : String(error)}`,
      "DiscordService",
    );
    return undefined;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    ctx.logger?.warn?.(
      `[discord] Channel metadata request failed (status ${response.status})${errorText ? `: ${errorText}` : ""}`,
      "DiscordService",
    );
    return undefined;
  }

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  const guildId =
    typeof payload.guild_id === "string" ? payload.guild_id : undefined;

  if (guildId) {
    channelState.guildId = guildId;
    ctx.logger?.log?.(
      `[discord] Cached guild ${guildId} for channel ${channelId}`,
      "DiscordService",
    );
  }

  return guildId;
}

async function getMemberRoles(
  ctx: ActionContext,
  botToken: string,
  state: DiscordMessageActionState,
  channelId: string,
  message: DiscordAPIMessage,
): Promise<string[]> {
  const authorId = message.author?.id;
  if (!authorId) {
    return [];
  }

  const channelState = ensureChannelState(state, channelId);
  if (!channelState.memberRoleCache) {
    channelState.memberRoleCache = {};
  }

  const cache = channelState.memberRoleCache;

  if (cache[authorId]) {
    return cache[authorId];
  }

  const messageRoles = Array.isArray(message.member?.roles)
    ? message.member.roles.filter(
        (role): role is string => typeof role === "string",
      )
    : [];

  if (messageRoles.length > 0) {
    cache[authorId] = messageRoles;
    return messageRoles;
  }

  const guildId =
    message.guild_id ??
    (await ensureChannelGuildId(ctx, botToken, state, channelId));
  if (!guildId) {
    ctx.logger?.warn?.(
      `[discord] Unable to resolve guild for channel ${channelId}; role filter skipped`,
      "DiscordService",
    );
    cache[authorId] = [];
    return [];
  }

  let response: Response;
  try {
    response = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildId}/members/${authorId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );
  } catch (error) {
    ctx.logger?.error?.(
      `[discord] Failed to fetch member ${authorId} roles: ${error instanceof Error ? error.message : String(error)}`,
      "DiscordService",
    );
    cache[authorId] = [];
    return [];
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    ctx.logger?.warn?.(
      `[discord] Unable to fetch member ${authorId} roles (status ${response.status})${errorText ? `: ${errorText}` : ""}`,
      "DiscordService",
    );
    cache[authorId] = [];
    return [];
  }

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  const roles = Array.isArray((payload as { roles?: unknown }).roles)
    ? ((payload as { roles?: unknown }).roles as unknown[]).filter(
        (role): role is string => typeof role === "string",
      )
    : [];

  cache[authorId] = roles;
  return roles;
}

export default createService({
  id: SERVICE_ID,
  name: "Discord",
  version: "1.0.0",
  description:
    "Trigger workflows from Discord messages and send messages via webhooks.",
  logo: "https://cdn-icons-png.flaticon.com/512/5968/5968756.png",
  auth: { type: "none" },

  actions: [
    createAction({
      id: MESSAGE_RECEIVED_ACTION_ID,
      name: "Message Received",
      description:
        "Triggers when a new message is posted in the selected channel. You can filter by author, role, or content.",
      input: {
        botToken: passwordInput({
          label: "Bot Token",
          description:
            "Discord bot token with access to read message history for the target channel.",
          placeholder:
            "MTEyMzQ1Njc4OTAxMjM0NTY3.abcdefghijklm_noPQRstuVWXyz",
          validation: {
            required: true,
          },
        }),
        channelId: textInput({
          label: "Channel ID",
          description: "Numeric ID of the channel to monitor.",
          placeholder: "123456789012345678",
          validation: {
            required: true,
          },
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
            "Only trigger when the author has this role. Requires the bot to have the necessary guild permissions.",
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
        triggered: "boolean",
        messageId: "string",
        channelId: "string",
        guildId: "string",
        authorId: "string",
        authorUsername: "string",
        content: "string",
        createdAt: "string",
        messageUrl: "string",
        rawMessage: "object",
      },
      run: async (params, ctx) => {
        const botToken = ensureBotToken(params.botToken);
        const channelId = ensureSnowflake(params.channelId, "Channel ID");
        const userId = ensureOptionalSnowflake(params.userId, "Author User ID");
        const roleId = ensureOptionalSnowflake(params.roleId, "Role ID");
        const contentFilter = String(params.contentIncludes ?? "").trim();
        const includeWebhookMessages = Boolean(params.includeWebhookMessages);
        const includeBotMessages = Boolean(params.includeBotMessages);

        const actionState = ensureActionState(ctx);
        const channelState = ensureChannelState(actionState, channelId);
        const lastProcessedId =
          channelState && typeof channelState.lastMessageId === "string"
            ? channelState.lastMessageId
            : undefined;

        if (!lastProcessedId) {
          const bootstrapEndpoint = `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=1&with_member=true`;

          let bootstrapResponse: Response;
          try {
            bootstrapResponse = await fetch(bootstrapEndpoint, {
              method: "GET",
              headers: {
                Authorization: `Bot ${botToken}`,
              },
            });
          } catch (error) {
            ctx.logger?.error?.(
              `[discord] Failed to bootstrap message state: ${error instanceof Error ? error.message : String(error)}`,
              "DiscordService",
            );
            throw new Error("Unable to initialise Discord channel state");
          }

          if (!bootstrapResponse.ok) {
            const errorText = await bootstrapResponse.text().catch(() => "");
            ctx.logger?.warn?.(
              `[discord] Bootstrap request failed with ${bootstrapResponse.status}${errorText ? `: ${errorText}` : ""}`,
              "DiscordService",
            );
            throw new Error(
              `Discord API returned ${bootstrapResponse.status}${errorText ? `: ${errorText}` : ""}`,
            );
          }

          const bootstrapMessages = (await bootstrapResponse.json().catch(
            () => [],
          )) as DiscordAPIMessage[];

          if (Array.isArray(bootstrapMessages) && bootstrapMessages.length > 0) {
            const newestId = bootstrapMessages[0]?.id;
            if (newestId) {
              updateChannelLastMessageId(
                ctx,
                actionState,
                channelId,
                newestId,
              );
              ctx.logger?.log?.(
                `[discord] Initialised channel ${channelId} lastMessageId to ${newestId}`,
                "DiscordService",
              );
            }
          } else {
            ctx.logger?.log?.(
              `[discord] No messages found when initialising channel ${channelId}`,
              "DiscordService",
            );
          }

          return null;
        }

        const endpoint = `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=100&with_member=true&after=${encodeURIComponent(lastProcessedId)}`;

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "GET",
            headers: {
              Authorization: `Bot ${botToken}`,
            },
          });
        } catch (error) {
          ctx.logger?.error?.(
            `[discord] Failed to fetch messages: ${error instanceof Error ? error.message : String(error)}`,
            "DiscordService",
          );
          throw new Error("Unable to reach the Discord API to read messages");
        }

        if (!response.ok) {
          let errorDetail = "";
          try {
            const body = await response.json();
            if (body && typeof body === "object" && "message" in body) {
              errorDetail = String((body as Record<string, unknown>).message);
            }
            if (
              body &&
              typeof body === "object" &&
              "retry_after" in body &&
              typeof (body as Record<string, unknown>).retry_after === "number"
            ) {
              errorDetail = `${errorDetail} (retry after ${(body as Record<string, unknown>).retry_after}s)`.trim();
            }
          } catch {
            errorDetail = await response.text().catch(() => "");
          }

          ctx.logger?.warn?.(
            `[discord] Discord API returned ${response.status}${errorDetail ? `: ${errorDetail}` : ""}`,
            "DiscordService",
          );
          throw new Error(
            `Discord API returned ${response.status}${
              errorDetail ? `: ${errorDetail}` : ""
            }`,
          );
        }

        let messages: DiscordAPIMessage[];
        try {
          const parsed = (await response.json()) as unknown;
          if (!Array.isArray(parsed)) {
            throw new Error("Expected an array response");
          }
          messages = parsed as DiscordAPIMessage[];
        } catch (error) {
          ctx.logger?.error?.(
            `[discord] Failed to parse Discord response: ${error instanceof Error ? error.message : String(error)}`,
            "DiscordService",
          );
          throw new Error("Discord returned an unexpected payload");
        }

        if (messages.length === 0) {
          ctx.logger?.log?.(
            `[discord] No new messages after ${lastProcessedId} for channel ${channelId}`,
            "DiscordService",
          );
          return null;
        }

        messages.sort((a, b) => compareSnowflakes(a.id, b.id));

        let latestId = lastProcessedId;
        for (const message of messages) {
          if (!latestId || compareSnowflakes(message.id, latestId) > 0) {
            latestId = message.id;
          }
        }

        ctx.logger?.log?.(
          `[discord] Polled ${messages.length} new messages (lastProcessed=${lastProcessedId}, latest=${latestId ?? "none"})`,
          "DiscordService",
        );

        const botUserId = await ensureBotUserId(ctx, botToken, actionState);

        let candidate: DiscordAPIMessage | undefined;
        for (const message of messages) {
          if (
            lastProcessedId &&
            compareSnowflakes(message.id, lastProcessedId) <= 0
          ) {
            continue;
          }

          if (
            !includeWebhookMessages &&
            typeof message.webhook_id === "string" &&
            message.webhook_id
          ) {
            ctx.logger?.log?.(
              `[discord] Skipping message ${message.id} created by webhook ${message.webhook_id}`,
              "DiscordService",
            );
            continue;
          }

          const authorId = message.author?.id;
          if (!authorId) {
            ctx.logger?.warn?.(
              `[discord] Message ${message.id} missing author id`,
              "DiscordService",
            );
            continue;
          }

          if (!includeBotMessages && message.author?.bot) {
            ctx.logger?.log?.(
              `[discord] Skipping message ${message.id} because author ${authorId} is a bot`,
              "DiscordService",
            );
            continue;
           }

          if (authorId === botUserId) {
            ctx.logger?.log?.(
              `[discord] Skipping message ${message.id} authored by the bot itself`,
              "DiscordService",
            );
            continue;
          }

          if (userId && authorId !== userId) {
            continue;
          }

          if (roleId) {
            const memberRoles = await getMemberRoles(
              ctx,
              botToken,
              actionState,
              channelId,
              message,
            );

            if (!memberRoles.includes(roleId)) {
              ctx.logger?.log?.(
                `[discord] Skipping message ${message.id} because author ${authorId} lacks role ${roleId}`,
                "DiscordService",
              );
              continue;
            }
          }

          if (contentFilter) {
            const contentRaw = message.content ?? "";
            const normalisedContent = normaliseContent(contentRaw);
            const normalisedFilter = normaliseContent(contentFilter);

            if (!normalisedContent.includes(normalisedFilter)) {
              ctx.logger?.log?.(
                `[discord] Skipping message ${message.id} due to content filter mismatch (content="${contentRaw}")`,
                "DiscordService",
              );
              continue;
            }
          }

          candidate = message;
          break;
        }

        if (!candidate) {
          if (latestId && latestId !== lastProcessedId) {
            updateChannelLastMessageId(
              ctx,
              actionState,
              channelId,
              latestId,
            );
          }
          ctx.logger?.log?.(
            `[discord] No new messages matched filters (user=${userId ?? "any"}, role=${roleId ?? "any"}, contains=${contentFilter || "any"})`,
            "DiscordService",
          );
          return null;
        }

        updateChannelLastMessageId(ctx, actionState, channelId, candidate.id);

        const guildId = candidate.guild_id ?? "";
        const messageUrl = guildId
          ? `https://discord.com/channels/${guildId}/${channelId}/${candidate.id}`
          : `https://discord.com/channels/@me/${channelId}/${candidate.id}`;
        const authorUsername =
          candidate.author?.global_name ??
          candidate.author?.username ??
          "Unknown";

        ctx.logger?.log?.(
          `[discord] Detected new message ${candidate.id} in channel ${channelId} (author=${candidate.author?.id ?? "unknown"}, content="${(candidate.content ?? "").slice(0, 80)}")`,
          "DiscordService",
        );

        return {
          triggered: true,
          messageId: candidate.id,
          channelId,
          guildId,
          authorId: candidate.author?.id ?? "",
          authorUsername,
          content: candidate.content ?? "",
          createdAt: candidate.timestamp,
          messageUrl,
          rawMessage: candidate as unknown as Record<string, unknown>,
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
