import { createAction, createService } from '@area/sdk';

const SERVICE_ID = 'google';
const DEFAULT_GMAIL_LABEL = 'INBOX';
const MAX_TRACKED_MESSAGE_IDS = 20;

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface GmailMessageListItem {
  id?: string;
  threadId?: string;
}

interface GmailMessageListResponse {
  messages?: GmailMessageListItem[];
}

interface GmailMessageHeader {
  name?: string;
  value?: string;
}

interface GmailMessagePayload {
  headers?: GmailMessageHeader[];
}

interface GmailMessageDetail {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  historyId?: string;
  payload?: GmailMessagePayload;
}

type GmailTriggerState = {
  initialized?: boolean;
  processedMessageIds?: string[];
};

function getHeaderValue(
  headers: GmailMessageHeader[] | undefined,
  target: string,
): string | undefined {
  if (!headers?.length) {
    return undefined;
  }

  const found = headers.find(
    (header) => header.name?.toLowerCase() === target.toLowerCase(),
  );

  return found?.value;
}

function ensureState(state: unknown): GmailTriggerState {
  if (!state || typeof state !== 'object') {
    return {};
  }

  const typedState = state as GmailTriggerState;
  if (!Array.isArray(typedState.processedMessageIds)) {
    typedState.processedMessageIds = [];
  }

  return typedState;
}

function buildGmailQuery(params: Record<string, unknown>): string {
  const filters: string[] = [];

  const query = params.query ? String(params.query).trim() : '';
  if (query) {
    filters.push(query);
  }

  const from = params.from ? String(params.from).trim() : '';
  if (from) {
    filters.push(`from:${from}`);
  }

  const subject = params.subject ? String(params.subject).trim() : '';
  if (subject) {
    filters.push(`subject:${subject}`);
  }

  const after = params.newerThan ? String(params.newerThan).trim() : '';
  if (after) {
    filters.push(after);
  }

  return filters.join(' ').trim();
}

export default createService({
  id: SERVICE_ID,
  name: 'Google',
  version: '1.0.0',
  description: 'Connect your Google account to enable Google-powered workflows.',
  logo: 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
  auth: {
    type: 'oauth2',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    authorizationParams: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  },
  onConnect: async (ctx) => {
    if (!ctx.connection?.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${ctx.connection.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to authenticate with Google: ${response.status}`);
    }

    const profile = (await response.json()) as GoogleUserInfo;

    ctx.logger?.log?.(
      `Google connected for account ${profile.email ?? profile.sub ?? 'unknown'}`,
      'GoogleService',
    );
  },
  actions: [
    createAction({
      id: 'gmail-email-received',
      name: 'Gmail Email Received',
      description: 'Triggers when a new email arrives in Gmail matching the provided filters.',
      input: {
        label: 'string',
        from: 'string',
        subject: 'string',
        query: 'string',
        newerThan: 'string',
      },
      output: {
        message_id: 'string',
        thread_id: 'string',
        subject: 'string',
        from: 'string',
        to: 'string',
        snippet: 'string',
        received_at: 'string',
        history_id: 'string',
        raw_payload: 'object',
      },
      run: async (params, ctx) => {
        const accessToken = ctx.connection?.accessToken;

        if (!accessToken) {
          ctx.logger?.warn?.(
            '[google] Missing access token for Gmail trigger',
            'GoogleService',
          );
          return null;
        }

        const state = ensureState(ctx.state);
        ctx.state = state;
        const trackedIds = state.processedMessageIds ?? [];

        const searchParams = new URLSearchParams();
        searchParams.set('maxResults', '5');
        const label = params.label ? String(params.label).trim() : '';
        searchParams.append('labelIds', label || DEFAULT_GMAIL_LABEL);

        const gmailQuery = buildGmailQuery(params);
        if (gmailQuery) {
          searchParams.set('q', gmailQuery);
        }

        const listResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?${searchParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!listResponse.ok) {
          ctx.logger?.error?.(
            `[google] Failed to list Gmail messages: ${listResponse.status}`,
            'GoogleService',
          );
          return null;
        }

        const listData = (await listResponse.json()) as GmailMessageListResponse;
        const messages = listData.messages ?? [];

        if (!state.initialized) {
          state.initialized = true;
          state.processedMessageIds = messages
            .map((message) => message.id)
            .filter((id): id is string => Boolean(id))
            .slice(0, MAX_TRACKED_MESSAGE_IDS);
          return null;
        }

        const newMessages = messages.filter(
          (message) => message.id && !trackedIds.includes(message.id),
        );

        if (newMessages.length === 0) {
          return null;
        }

        const targetMessage = newMessages[newMessages.length - 1];
        const messageId = targetMessage.id;

        if (!messageId) {
          ctx.logger?.warn?.(
            '[google] Skipping Gmail message without an id',
            'GoogleService',
          );
          return null;
        }

        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!detailResponse.ok) {
          ctx.logger?.error?.(
            `[google] Failed to load Gmail message ${targetMessage.id}: ${detailResponse.status}`,
            'GoogleService',
          );
          return null;
        }

        const detail = (await detailResponse.json()) as GmailMessageDetail;

        const subjectValue = getHeaderValue(detail.payload?.headers, 'Subject') ?? '';
        const fromValue = getHeaderValue(detail.payload?.headers, 'From') ?? '';
        const toValue = getHeaderValue(detail.payload?.headers, 'To') ?? '';
        const dateHeader = getHeaderValue(detail.payload?.headers, 'Date');

        let receivedAt = '';
        if (detail.internalDate) {
          const timestamp = Number(detail.internalDate);
          receivedAt = Number.isFinite(timestamp)
            ? new Date(timestamp).toISOString()
            : '';
        }

        if (!receivedAt && dateHeader) {
          const parsedDate = new Date(dateHeader);
          if (!Number.isNaN(parsedDate.getTime())) {
            receivedAt = parsedDate.toISOString();
          }
        }

        if (!receivedAt) {
          receivedAt = new Date().toISOString();
        }

        if (messageId) {
          trackedIds.push(messageId);
          if (trackedIds.length > MAX_TRACKED_MESSAGE_IDS) {
            trackedIds.splice(0, trackedIds.length - MAX_TRACKED_MESSAGE_IDS);
          }
          state.processedMessageIds = trackedIds;
        }

        ctx.logger?.log?.(
          `[google] Detected new Gmail message ${detail.id ?? 'unknown'}`,
          'GoogleService',
        );

        return {
          message_id: detail.id ?? messageId,
          thread_id: detail.threadId ?? '',
          subject: subjectValue,
          from: fromValue,
          to: toValue,
          snippet: detail.snippet ?? '',
          received_at: receivedAt,
          history_id: detail.historyId ?? '',
          raw_payload: detail as unknown as Record<string, unknown>,
        };
      },
    }),
  ],
});
