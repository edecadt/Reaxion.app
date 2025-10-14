import { createAction, createService, createWebhook, textInput } from "@area/sdk";

const SERVICE_ID = "github";
const ISSUES_WEBHOOK_ID = "issues";

interface GitHubUser {
  login?: string;
  html_url?: string;
}

interface GitHubRepository {
  id?: number;
  name?: string;
  full_name?: string;
  html_url?: string;
  private?: boolean;
  owner?: GitHubUser;
}

interface GitHubIssue {
  id?: number;
  number?: number;
  title?: string;
  body?: string | null;
  html_url?: string;
  state?: string;
  user?: GitHubUser;
  labels?: Array<{ name?: string }>;
  created_at?: string;
}

interface GitHubIssuesEventPayload {
  action?: string;
  issue?: GitHubIssue;
  repository?: GitHubRepository;
  sender?: GitHubUser;
}

function normalizeHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

export default createService({
  id: SERVICE_ID,
  name: "GitHub",
  version: "1.0.0",
  description:
    "Triggers workflows when a new issue is created on a GitHub repository.",
  logo: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
  auth: {
    type: "oauth2",
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo", "user"],
    clientIdEnvVar: "GITHUB_CLIENT_ID",
    clientSecretEnvVar: "GITHUB_CLIENT_SECRET",
  },

  onConnect: async (ctx) => {
    if (!ctx.connection?.accessToken) {
      throw new Error("No access token available");
    }

    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${ctx.connection.accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate with GitHub: ${response.status}`);
    }

    const user = await response.json();
    ctx.logger?.log?.(
      `GitHub connected successfully for user ${user.login}`,
      "GitHubService",
    );
  },

  actions: [
    createAction({
      id: "issue-created",
      name: "Issue Created",
      description:
        "Triggers when a new issue is opened on the specified repository.",
      input: {
        owner: textInput({
          label: "Repository Owner",
          description: "GitHub username or organization name (leave empty for any)",
          placeholder: "octocat",
        }),
        repo: textInput({
          label: "Repository Name",
          description: "Repository name (leave empty for any)",
          placeholder: "hello-world",
        }),
      },
      output: {
        issue_number: "number",
        issue_title: "string",
        issue_body: "string",
        issue_url: "string",
        repository: "string",
        sender: "string",
        raw_payload: "object",
      },
      run: async (params, ctx) => {
        if (!ctx.webhookEvents) {
          ctx.logger?.warn?.(
            `[github] WebhookEventsService missing, cannot process events`,
            "GitHubService",
          );
          return null;
        }

        const event = ctx.webhookEvents.getLastUnprocessedEvent(
          SERVICE_ID,
          ISSUES_WEBHOOK_ID,
          ctx.userId,
          ctx.workflowToken,
        );

        if (!event) {
          return null;
        }

        const payload = event.payload as GitHubIssuesEventPayload | undefined;

        if (!payload || payload.action !== "opened" || !payload.issue) {
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            ISSUES_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const ownerFilter = String(params.owner ?? "")
          .trim()
          .toLowerCase();
        const repoFilter = String(params.repo ?? "")
          .trim()
          .toLowerCase();

        const repository = payload.repository;
        const repoFullName = repository?.full_name ?? "";
        const [payloadOwner = "", payloadRepo = ""] = repoFullName
          .toLowerCase()
          .split("/");

        if (ownerFilter && ownerFilter !== payloadOwner) {
          ctx.logger?.log?.(
            `[github] Ignored issue: owner ${payloadOwner} does not match filter ${ownerFilter}`,
            "GitHubService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            ISSUES_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        if (repoFilter && repoFilter !== payloadRepo) {
          ctx.logger?.log?.(
            `[github] Ignored issue: repo ${payloadRepo} does not match filter ${repoFilter}`,
            "GitHubService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            ISSUES_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const output = {
          issue_number: Number(payload.issue.number ?? 0),
          issue_title: String(payload.issue.title ?? ""),
          issue_body: String(payload.issue.body ?? ""),
          issue_url: String(payload.issue.html_url ?? ""),
          repository: repoFullName,
          sender: String(payload.sender?.login ?? ""),
          raw_payload: payload as Record<string, unknown>,
        };

        ctx.logger?.log?.(
          `[github] Detected issue #${output.issue_number} on ${repoFullName}`,
          "GitHubService",
        );

        ctx.webhookEvents.markAsProcessed(
          SERVICE_ID,
          ISSUES_WEBHOOK_ID,
          event.timestamp,
        );

        return output;
      },
    }),
  ],

  webhooks: [
    createWebhook({
      id: ISSUES_WEBHOOK_ID,
      name: "Issues",
      description: "Receives GitHub issue webhooks.",
      output: {
        received: "boolean",
        action: "string",
      },
      run: async (_eventName, payload, ctx) => {
        const headers = ctx.rawRequest?.headers ?? {};
        const deliveryId = normalizeHeaderValue(headers["x-github-delivery"]);
        const eventName = normalizeHeaderValue(headers["x-github-event"]);

        ctx.logger?.log?.(
          `[github] Webhook received${deliveryId ? ` (#${deliveryId})` : ""} for event ${eventName ?? "unknown"}`,
          "GitHubService",
        );

        const body = payload as GitHubIssuesEventPayload | undefined;

        return {
          received: true,
          action: String(body?.action ?? ""),
        };
      },
    }),
  ],
});
