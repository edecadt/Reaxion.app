import { createAction, createService, createWebhook, textInput } from "@area/sdk";

const SERVICE_ID = "github";
const ISSUES_WEBHOOK_ID = "issues";
const PULL_REQUESTS_WEBHOOK_ID = "pull-requests";

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

interface GitHubPullRequest {
  id?: number;
  number?: number;
  title?: string | null;
  body?: string | null;
  html_url?: string | null;
  state?: string | null;
  draft?: boolean;
  user?: GitHubUser | null;
  merged?: boolean;
  created_at?: string | null;
  base?: {
    repo?: GitHubRepository | null;
  } | null;
  head?: {
    repo?: GitHubRepository | null;
  } | null;
}

interface GitHubPullRequestEventPayload {
  action?: string;
  pull_request?: GitHubPullRequest | null;
  repository?: GitHubRepository | null;
  sender?: GitHubUser | null;
}

function normalizeHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function parseRepositoryFromSshUrl(
  url: string,
): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(
    /^git@github\.com:([\w.-]+)\/([\w.-]+)(?:\.git)?$/i,
  );
  if (!match) {
    return null;
  }

  const owner = match[1]?.toLowerCase();
  const repo = match[2]?.toLowerCase();

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

export default createService({
  id: SERVICE_ID,
  name: "GitHub",
  version: "1.2.0",
  description:
    "Triggers workflows when new issues or pull requests are created on a GitHub repository.",
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
        repository_ssh_url: textInput({
          label: "Repository SSH URL",
          description: "Exact SSH URL of the repository. Example: git@github.com:octocat/hello-world.git",
          placeholder: "git@github.com:octocat/hello-world.git",
          validation: { required: true },
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

        const repositoryUrl = String(params.repository_ssh_url ?? "");
        const parsedRepository = parseRepositoryFromSshUrl(repositoryUrl);

        if (!parsedRepository) {
          ctx.logger?.warn?.(
            `[github] Invalid repository SSH URL provided: ${repositoryUrl}`,
            "GitHubService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            ISSUES_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const { owner: ownerFilter, repo: repoFilter } = parsedRepository;

        const repository = payload.repository;
        const repoFullName = repository?.full_name ?? "";

        if (!repoFullName) {
          ctx.logger?.log?.(
            `[github] Ignored issue: missing repository information in payload`,
            "GitHubService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            ISSUES_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const [payloadOwner = "", payloadRepo = ""] = repoFullName
          .toLowerCase()
          .split("/");

        if (ownerFilter !== payloadOwner || repoFilter !== payloadRepo) {
          ctx.logger?.log?.(
            `[github] Ignored issue: expected ${ownerFilter}/${repoFilter}, received ${payloadOwner}/${payloadRepo}`,
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
    createAction({
      id: "pull-request-opened",
      name: "Pull Request Opened",
      description:
        "Triggers when a new pull request is opened on the specified repository.",
      input: {
        repository_ssh_url: textInput({
          label: "Repository SSH URL",
          description: "Exact SSH URL of the repository. Example: git@github.com:octocat/hello-world.git",
          placeholder: "git@github.com:octocat/hello-world.git",
          validation: { required: true },
        }),
      },
      output: {
        pull_request_number: "number",
        pull_request_title: "string",
        pull_request_body: "string",
        pull_request_url: "string",
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
          PULL_REQUESTS_WEBHOOK_ID,
          ctx.userId,
          ctx.workflowToken,
        );

        if (!event) {
          return null;
        }

        const payload = event.payload as GitHubPullRequestEventPayload | null;

        if (!payload || payload.action !== "opened" || !payload.pull_request) {
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            PULL_REQUESTS_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const repositoryUrl = String(params.repository_ssh_url ?? "");
        const parsedRepository = parseRepositoryFromSshUrl(repositoryUrl);

        if (!parsedRepository) {
          ctx.logger?.warn?.(
            `[github] Invalid repository SSH URL provided: ${repositoryUrl}`,
            "GitHubService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            PULL_REQUESTS_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const { owner: ownerFilter, repo: repoFilter } = parsedRepository;

        const repository =
          payload.repository ?? payload.pull_request.base?.repo ?? undefined;
        const repoFullName = repository?.full_name ?? "";

        if (!repoFullName) {
          ctx.logger?.log?.(
            `[github] Ignored pull request: missing repository information in payload`,
            "GitHubService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            PULL_REQUESTS_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const [payloadOwner = "", payloadRepo = ""] = repoFullName
          .toLowerCase()
          .split("/");

        if (ownerFilter !== payloadOwner || repoFilter !== payloadRepo) {
          ctx.logger?.log?.(
            `[github] Ignored pull request: expected ${ownerFilter}/${repoFilter}, received ${payloadOwner}/${payloadRepo}`,
            "GitHubService",
          );
          ctx.webhookEvents.markAsProcessed(
            SERVICE_ID,
            PULL_REQUESTS_WEBHOOK_ID,
            event.timestamp,
          );
          return null;
        }

        const pullRequest = payload.pull_request;

        const output = {
          pull_request_number: Number(pullRequest.number ?? 0),
          pull_request_title: String(pullRequest.title ?? ""),
          pull_request_body: String(pullRequest.body ?? ""),
          pull_request_url: String(pullRequest.html_url ?? ""),
          repository: repoFullName,
          sender: String(payload.sender?.login ?? ""),
          raw_payload: payload as Record<string, unknown>,
        };

        ctx.logger?.log?.(
          `[github] Detected pull request #${output.pull_request_number} on ${repoFullName}`,
          "GitHubService",
        );

        ctx.webhookEvents.markAsProcessed(
          SERVICE_ID,
          PULL_REQUESTS_WEBHOOK_ID,
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
    createWebhook({
      id: PULL_REQUESTS_WEBHOOK_ID,
      name: "Pull Requests",
      description: "Receives GitHub pull request webhooks.",
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

        const body = payload as GitHubPullRequestEventPayload | undefined;

        return {
          received: true,
          action: String(body?.action ?? ""),
        };
      },
    }),
  ],
});
