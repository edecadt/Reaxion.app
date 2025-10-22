import { createAction, createService } from '@area/sdk';

const SERVICE_ID = 'google';
const DEFAULT_GMAIL_LABEL = 'INBOX';
const DEFAULT_CALENDAR_ID = 'primary';
const MAX_TRACKED_MESSAGE_IDS = 20;
const MAX_TRACKED_CALENDAR_EVENT_IDS = 20;

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

interface CalendarEventDateInfo {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

interface CalendarEventParticipant {
  email?: string;
  displayName?: string;
}

interface CalendarEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  updated?: string;
  created?: string;
  start?: CalendarEventDateInfo;
  end?: CalendarEventDateInfo;
  creator?: CalendarEventParticipant;
  organizer?: CalendarEventParticipant;
  location?: string;
}

interface CalendarEventsListResponse {
  items?: CalendarEvent[];
}

type GmailTriggerState = {
  initialized?: boolean;
  processedMessageIds?: string[];
};

type CalendarTriggerState = {
  initialized?: boolean;
  lastUpdated?: string;
  processedEventIds?: string[];
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

function ensureGmailState(state: unknown): GmailTriggerState {
  if (!state || typeof state !== 'object') {
    return {};
  }

  const typedState = state as GmailTriggerState;
  if (!Array.isArray(typedState.processedMessageIds)) {
    typedState.processedMessageIds = [];
  }

  return typedState;
}

function ensureCalendarState(state: unknown): CalendarTriggerState {
  if (!state || typeof state !== 'object') {
    return {};
  }

  const typedState = state as CalendarTriggerState;

  if (typedState.lastUpdated && typeof typedState.lastUpdated !== 'string') {
    typedState.lastUpdated = String(typedState.lastUpdated);
  }

  if (!Array.isArray(typedState.processedEventIds)) {
    typedState.processedEventIds = [];
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

function getDateTimeValue(info: CalendarEventDateInfo | undefined): string {
  if (!info) {
    return '';
  }

  if (info.dateTime) {
    return info.dateTime;
  }

  if (info.date) {
    return info.date;
  }

  return '';
}

function getLatestUpdated(events: CalendarEvent[]): string | undefined {
  let latest: string | undefined;

  for (const event of events) {
    if (!event.updated) {
      continue;
    }

    if (!latest || event.updated > latest) {
      latest = event.updated;
    }
  }

  return latest;
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
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ],
    clientIdEnvVar: 'GOOGLE_CLIENT_ID_ACTION_REACTION',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET_ACTION_REACTION',
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

        const state = ensureGmailState(ctx.state);
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
    createAction({
      id: 'calendar-event-created',
      name: 'Google Calendar Event Created',
      description:
        'Triggers when a new event is created in a Google Calendar.',
      input: {
        calendarId: 'string',
      },
      output: {
        event_id: 'string',
        calendar_id: 'string',
        summary: 'string',
        description: 'string',
        status: 'string',
        start_time: 'string',
        end_time: 'string',
        html_link: 'string',
        creator_email: 'string',
        organizer_email: 'string',
        location: 'string',
        raw_payload: 'object',
      },
      run: async (params, ctx) => {
        const accessToken = ctx.connection?.accessToken;

        if (!accessToken) {
          ctx.logger?.warn?.(
            '[google] Missing access token for Calendar trigger',
            'GoogleService',
          );
          return null;
        }

        const state = ensureCalendarState(ctx.state);
        ctx.state = state;

        if (!state.initialized) {
          state.initialized = true;
          state.lastUpdated = new Date().toISOString();
          state.processedEventIds = [];
          return null;
        }

        const trackedIds = state.processedEventIds ?? [];
        const lastUpdated = state.lastUpdated ?? '';

        const calendarIdParam = params.calendarId
          ? String(params.calendarId).trim()
          : '';
        const calendarId = calendarIdParam || DEFAULT_CALENDAR_ID;

        const searchParams = new URLSearchParams();
        searchParams.set('maxResults', '10');
        searchParams.set('orderBy', 'updated');
        searchParams.set('showDeleted', 'false');
        if (state.lastUpdated) {
          searchParams.set('updatedMin', state.lastUpdated);
        }

        const listResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendarId,
          )}/events?${searchParams.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!listResponse.ok) {
          ctx.logger?.error?.(
            `[google] Failed to list Calendar events: ${listResponse.status}`,
            'GoogleService',
          );
          return null;
        }

        const listData = (await listResponse.json()) as CalendarEventsListResponse;
        const events = listData.items ?? [];

        if (!events.length) {
          return null;
        }

        if (!lastUpdated) {
          const latest = getLatestUpdated(events);

          if (!latest) {
            state.lastUpdated = new Date().toISOString();
            state.processedEventIds = [];
            return null;
          }

          state.lastUpdated = latest;
          state.processedEventIds = events
            .filter((event) => Boolean(event?.id) && event?.updated === latest)
            .map((event) => event.id as string)
            .slice(-MAX_TRACKED_CALENDAR_EVENT_IDS);
          return null;
        }

        const newEvents = events.filter((event) => {
          if (!event) {
            return false;
          }

          const eventId = event.id ?? '';
          if (!eventId) {
            return false;
          }

          const updated = event.updated ?? '';
          if (!updated) {
            return !trackedIds.includes(eventId);
          }

          if (updated > lastUpdated) {
            return true;
          }

          if (updated === lastUpdated && !trackedIds.includes(eventId)) {
            return true;
          }

          return false;
        });

        if (newEvents.length === 0) {
          const latest = getLatestUpdated(events);
          if (latest) {
            if (!state.lastUpdated || latest > state.lastUpdated) {
              state.lastUpdated = latest;
            }

            if (state.lastUpdated === latest) {
              state.processedEventIds = events
                .filter(
                  (event) => Boolean(event?.id) && event?.updated === latest,
                )
                .map((event) => event.id as string)
                .slice(-MAX_TRACKED_CALENDAR_EVENT_IDS);
            }
          }
          return null;
        }

        const targetEvent = newEvents[0];
        const targetUpdated = targetEvent.updated ?? '';

        if (targetUpdated) {
          if (targetUpdated > lastUpdated) {
            state.lastUpdated = targetUpdated;
            state.processedEventIds = targetEvent.id ? [targetEvent.id] : [];
          } else if (targetUpdated === lastUpdated && targetEvent.id) {
            if (!trackedIds.includes(targetEvent.id)) {
              trackedIds.push(targetEvent.id);
            }

            if (trackedIds.length > MAX_TRACKED_CALENDAR_EVENT_IDS) {
              trackedIds.splice(
                0,
                trackedIds.length - MAX_TRACKED_CALENDAR_EVENT_IDS,
              );
            }

            state.processedEventIds = trackedIds;
          }
        } else if (targetEvent.id) {
          if (!trackedIds.includes(targetEvent.id)) {
            trackedIds.push(targetEvent.id);
          }

          if (trackedIds.length > MAX_TRACKED_CALENDAR_EVENT_IDS) {
            trackedIds.splice(
              0,
              trackedIds.length - MAX_TRACKED_CALENDAR_EVENT_IDS,
            );
          }

          state.processedEventIds = trackedIds;
        }

        const logId = targetEvent.id ?? 'unknown';

        if (targetEvent.status === 'cancelled') {
          ctx.logger?.log?.(
            `[google] Ignoring cancelled Calendar event ${logId}`,
            'GoogleService',
          );
          return null;
        }

        ctx.logger?.log?.(
          `[google] Detected new Calendar event ${logId}`,
          'GoogleService',
        );

        const startTime = getDateTimeValue(targetEvent.start);
        const endTime = getDateTimeValue(targetEvent.end);

        return {
          event_id: targetEvent.id ?? '',
          calendar_id: calendarId,
          summary: targetEvent.summary ?? '',
          description: targetEvent.description ?? '',
          status: targetEvent.status ?? '',
          start_time: startTime,
          end_time: endTime,
          html_link: targetEvent.htmlLink ?? '',
          creator_email: targetEvent.creator?.email ?? '',
          organizer_email: targetEvent.organizer?.email ?? '',
          location: targetEvent.location ?? '',
          raw_payload: targetEvent as unknown as Record<string, unknown>,
        };
      },
    }),
  ],
});
