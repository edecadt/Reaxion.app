import { createAction, createService, createWebhook, textInput } from "@area/sdk";

const SERVICE_ID = "github";
const ISSUES_WEBHOOK_ID = "issues";
const PULL_REQUESTS_WEBHOOK_ID = "pull-requests";

const MAX_TRACKED_PULL_REQUEST_IDS = 50;
const MAX_TRACKED_PULL_REQUEST_COMMENT_IDS = 50;
const MAX_TRACKED_ISSUE_COMMENT_IDS = 50;

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

interface GitHubIssueComment {
  id?: number;
  body?: string | null;
  html_url?: string | null;
  user?: GitHubUser | null;
  created_at?: string | null;
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
  merged_at?: string | null;
  merged_by?: GitHubUser | null;
  merge_commit_sha?: string | null;
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

function parseRepositoryInput(
  value: string,
): { owner: string; repo: string } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sshMatch = trimmed.match(
    /^git@github\.com:([\w.-]+)\/([\w.-]+)(?:\.git)?$/i,
  );
  const httpsMatch = trimmed.match(
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\.git)?$/i,
  );
  const ownerRepoMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)(?:\.git)?$/);

  const match = sshMatch ?? httpsMatch ?? ownerRepoMatch;
  if (!match) {
    return null;
  }

  const owner = match[1]?.trim();
  const repoWithSuffix = match[2]?.trim();

  if (!owner || !repoWithSuffix) {
    return null;
  }

  const repo = repoWithSuffix.replace(/\.git$/i, "");

  if (!owner || !repo) {
    return null;
  }

  return {
    owner: owner.toLowerCase(),
    repo: repo.toLowerCase(),
  };
}

function parsePullRequestInput(
  value: string,
): { owner?: string; repo?: string; pullRequestNumber: number } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const urlMatch = trimmed.match(
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)(?:\/.*)?$/i,
  );
  if (urlMatch) {
    const owner = urlMatch[1]?.trim().toLowerCase();
    const repo = urlMatch[2]?.trim().toLowerCase();
    const numberValue = Number(urlMatch[3]);

    if (!owner || !repo || !Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }

    return { owner, repo, pullRequestNumber: numberValue };
  }

  const hashMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (hashMatch) {
    const owner = hashMatch[1]?.trim().toLowerCase();
    const repo = hashMatch[2]?.trim().toLowerCase();
    const numberValue = Number(hashMatch[3]);

    if (!owner || !repo || !Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }

    return { owner, repo, pullRequestNumber: numberValue };
  }

  const simpleMatch = trimmed.match(/^#?(\d+)$/);
  if (simpleMatch) {
    const numberValue = Number(simpleMatch[1]);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }

    return { pullRequestNumber: numberValue };
  }

  return null;
}

function parseIssueInput(
  value: string,
): { owner?: string; repo?: string; issueNumber: number } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const urlMatch = trimmed.match(
    /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)(?:\/.*)?$/i,
  );
  if (urlMatch) {
    const owner = urlMatch[1]?.trim().toLowerCase();
    const repo = urlMatch[2]?.trim().toLowerCase();
    const numberValue = Number(urlMatch[3]);

    if (!owner || !repo || !Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }

    return { owner, repo, issueNumber: numberValue };
  }

  const hashMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (hashMatch) {
    const owner = hashMatch[1]?.trim().toLowerCase();
    const repo = hashMatch[2]?.trim().toLowerCase();
    const numberValue = Number(hashMatch[3]);

    if (!owner || !repo || !Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }

    return { owner, repo, issueNumber: numberValue };
  }

  const simpleMatch = trimmed.match(/^#?(\d+)$/);
  if (simpleMatch) {
    const numberValue = Number(simpleMatch[1]);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }

    return { issueNumber: numberValue };
  }

  return null;
}

type GitHubPullRequestPollingState = {
  initialized?: boolean;
  trackedPullRequestIds?: number[];
  lastSeenCreatedAt?: string;
};

type GitHubIssueCommentState = {
  initialized?: boolean;
  trackedCommentIds?: number[];
  lastSeenCreatedAt?: string;
};

type GitHubPullRequestCommentState = {
  initialized?: boolean;
  trackedCommentIds?: number[];
  lastSeenCreatedAt?: string;
};

type GitHubPullRequestMergedState = {
  initialized?: boolean;
  lastKnownMergedAt?: string;
  lastKnownMergeCommitSha?: string;
};

function ensurePullRequestState(
  state: unknown,
): GitHubPullRequestPollingState {
  if (!state || typeof state !== "object") {
    return { initialized: false, trackedPullRequestIds: [] };
  }

  const typedState = state as GitHubPullRequestPollingState;

  if (!Array.isArray(typedState.trackedPullRequestIds)) {
    typedState.trackedPullRequestIds = [];
  } else {
    typedState.trackedPullRequestIds = typedState.trackedPullRequestIds
      .map((value) => {
        if (typeof value === "number") {
          return value;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => typeof value === "number");
  }

  if (
    typedState.lastSeenCreatedAt &&
    typeof typedState.lastSeenCreatedAt !== "string"
  ) {
    typedState.lastSeenCreatedAt = String(typedState.lastSeenCreatedAt);
  }

  typedState.initialized = Boolean(typedState.initialized);

  return typedState;
}

function ensurePullRequestCommentState(
  state: unknown,
): GitHubPullRequestCommentState {
  if (!state || typeof state !== "object") {
    return { initialized: false, trackedCommentIds: [] };
  }

  const typedState = state as GitHubPullRequestCommentState;

  if (!Array.isArray(typedState.trackedCommentIds)) {
    typedState.trackedCommentIds = [];
  } else {
    typedState.trackedCommentIds = typedState.trackedCommentIds
      .map((value) => {
        if (typeof value === "number") {
          return value;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => typeof value === "number");
  }

  if (
    typedState.lastSeenCreatedAt &&
    typeof typedState.lastSeenCreatedAt !== "string"
  ) {
    typedState.lastSeenCreatedAt = String(typedState.lastSeenCreatedAt);
  }

  typedState.initialized = Boolean(typedState.initialized);

  return typedState;
}

function ensureIssueCommentState(
  state: unknown,
): GitHubIssueCommentState {
  if (!state || typeof state !== "object") {
    return { initialized: false, trackedCommentIds: [] };
  }

  const typedState = state as GitHubIssueCommentState;

  if (!Array.isArray(typedState.trackedCommentIds)) {
    typedState.trackedCommentIds = [];
  } else {
    typedState.trackedCommentIds = typedState.trackedCommentIds
      .map((value) => {
        if (typeof value === "number") {
          return value;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => typeof value === "number");
  }

  if (
    typedState.lastSeenCreatedAt &&
    typeof typedState.lastSeenCreatedAt !== "string"
  ) {
    typedState.lastSeenCreatedAt = String(typedState.lastSeenCreatedAt);
  }

  typedState.initialized = Boolean(typedState.initialized);

  return typedState;
}

function ensurePullRequestMergedState(
  state: unknown,
): GitHubPullRequestMergedState {
  if (!state || typeof state !== "object") {
    return { initialized: false };
  }

  const typedState = state as GitHubPullRequestMergedState;

  if (
    typedState.lastKnownMergedAt &&
    typeof typedState.lastKnownMergedAt !== "string"
  ) {
    typedState.lastKnownMergedAt = String(typedState.lastKnownMergedAt);
  }

  if (
    typedState.lastKnownMergeCommitSha &&
    typeof typedState.lastKnownMergeCommitSha !== "string"
  ) {
    typedState.lastKnownMergeCommitSha = String(
      typedState.lastKnownMergeCommitSha,
    );
  }

  typedState.initialized = Boolean(typedState.initialized);

  return typedState;
}

function parseTimestamp(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default createService({
  id: SERVICE_ID,
  name: "GitHub",
  version: "1.4.0",
  description:
    "Triggers workflows when GitHub issues are created, pull requests open, or pull requests are merged.",
  logo: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
  auth: {
    type: "oauth2",
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo", "user"],
    clientIdEnvVar: "GITHUB_CLIENT_ID_ACTION",
    clientSecretEnvVar: "GITHUB_CLIENT_SECRET_ACTION",
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
          label: "Repository",
          description:
            "Target repository in owner/name format or as a Git URL. Examples: octocat/hello-world, git@github.com:octocat/hello-world.git",
          placeholder: "octocat/hello-world",
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
        const parsedRepository = parseRepositoryInput(repositoryUrl);

        if (!parsedRepository) {
          ctx.logger?.warn?.(
            `[github] Invalid repository provided: ${repositoryUrl}`,
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
      id: "issue-comment-created",
      name: "Issue Comment Added",
      description:
        "Triggers when a new comment is added to the specified issue.",
      input: {
        issue_url: textInput({
          label: "Issue URL",
          description:
            "Full GitHub issue URL, for example: https://github.com/octocat/hello-world/issues/42",
          placeholder: "https://github.com/octocat/hello-world/issues/42",
          validation: { required: true },
        }),
      },
      output: {
        issue_number: "number",
        comment_body: "string",
        comment_url: "string",
        comment_author: "string",
        comment_created_at: "string",
        repository: "string",
        raw_payload: "object",
      },
      run: async (params, ctx) => {
        const issueInput = String(params.issue_url ?? "");
        const issue = parseIssueInput(issueInput);

        if (!issue) {
          ctx.logger?.warn?.(
            `[github] Invalid issue identifier provided: ${issueInput}`,
            "GitHubService",
          );
          return null;
        }

        const owner = issue.owner;
        const repo = issue.repo;

        if (!owner || !repo) {
          ctx.logger?.warn?.(
            `[github] Issue URL must include owner and repository: ${issueInput}`,
            "GitHubService",
          );
          return null;
        }

        const accessToken = ctx.connection?.accessToken;

        if (!accessToken) {
          ctx.logger?.warn?.(
            `[github] Missing access token for issue comment polling on ${owner}/${repo}#${issue.issueNumber}`,
            "GitHubService",
          );
          return null;
        }

        const state = ensureIssueCommentState(ctx.state);
        ctx.state = state;

        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${issue.issueNumber}/comments?per_page=${MAX_TRACKED_ISSUE_COMMENT_IDS}&sort=created&direction=desc`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "ReaxionApp/1.0",
            },
          },
        );

        if (!response.ok) {
          ctx.logger?.error?.(
            `[github] Failed to fetch issue comments for ${owner}/${repo}#${issue.issueNumber}: ${response.status}`,
            "GitHubService",
          );
          return null;
        }

        const comments =
          ((await response.json()) as GitHubIssueComment[] | undefined) ?? [];

        const validComments = comments.filter((comment) => {
          if (!comment) {
            return false;
          }

          if (typeof comment.id !== "number") {
            return false;
          }

          if (!comment.created_at) {
            return false;
          }

          return true;
        });

        if (!state.initialized) {
          state.initialized = true;
          state.trackedCommentIds = validComments
            .map((comment) => comment.id)
            .filter((id): id is number => typeof id === "number")
            .slice(0, MAX_TRACKED_ISSUE_COMMENT_IDS);
          state.lastSeenCreatedAt = validComments[0]?.created_at ?? undefined;
          return null;
        }

        const trackedIds = state.trackedCommentIds ?? [];
        const lastSeenTimestamp = parseTimestamp(state.lastSeenCreatedAt);

        const newComments = validComments.filter((comment) => {
          const commentId = typeof comment.id === "number" ? comment.id : undefined;

          if (!commentId) {
            return false;
          }

          if (trackedIds.includes(commentId)) {
            return false;
          }

          const createdTimestamp = parseTimestamp(comment.created_at);

          if (createdTimestamp === undefined) {
            return false;
          }

          if (
            lastSeenTimestamp !== undefined &&
            createdTimestamp <= lastSeenTimestamp
          ) {
            return false;
          }

          return true;
        });

        if (newComments.length === 0) {
          return null;
        }

        newComments.sort((a, b) => {
          const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
          const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
          return aCreated - bCreated;
        });

        const targetComment = newComments[0];

        if (!targetComment || typeof targetComment.id !== "number") {
          return null;
        }

        const existingTracked = state.trackedCommentIds ?? [];
        const updatedTracked = [targetComment.id, ...existingTracked];
        state.trackedCommentIds = updatedTracked
          .filter((value, index, array) => array.indexOf(value) === index)
          .slice(0, MAX_TRACKED_ISSUE_COMMENT_IDS);

        if (targetComment.created_at) {
          const targetTimestamp = parseTimestamp(targetComment.created_at);
          if (
            targetTimestamp !== undefined &&
            (lastSeenTimestamp === undefined ||
              targetTimestamp > lastSeenTimestamp)
          ) {
            state.lastSeenCreatedAt = targetComment.created_at;
          }
        }

        const output = {
          issue_number: issue.issueNumber,
          comment_body: String(targetComment.body ?? ""),
          comment_url: String(targetComment.html_url ?? issueInput),
          comment_author: String(targetComment.user?.login ?? ""),
          comment_created_at: String(targetComment.created_at ?? ""),
          repository: `${owner}/${repo}`,
          raw_payload: targetComment as Record<string, unknown>,
        };

        ctx.logger?.log?.(
          `[github] Detected comment on issue #${issue.issueNumber} for ${owner}/${repo}`,
          "GitHubService",
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
          label: "Repository",
          description:
            "Target repository in owner/name format or as a Git URL. Examples: octocat/hello-world, git@github.com:octocat/hello-world.git",
          placeholder: "octocat/hello-world",
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
        const repositoryInput = String(params.repository_ssh_url ?? "");
        const repository = parseRepositoryInput(repositoryInput);

        if (!repository) {
          ctx.logger?.warn?.(
            `[github] Invalid repository provided: ${repositoryInput}`,
            "GitHubService",
          );
          return null;
        }

        const accessToken = ctx.connection?.accessToken;

        if (!accessToken) {
          ctx.logger?.warn?.(
            `[github] Missing access token for pull request polling on ${repository.owner}/${repository.repo}`,
            "GitHubService",
          );
          return null;
        }

        const state = ensurePullRequestState(ctx.state);
        ctx.state = state;

        const response = await fetch(
          `https://api.github.com/repos/${repository.owner}/${repository.repo}/pulls?state=all&sort=created&direction=desc&per_page=${MAX_TRACKED_PULL_REQUEST_IDS}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "ReaxionApp/1.0",
            },
          },
        );

        if (!response.ok) {
          ctx.logger?.error?.(
            `[github] Failed to fetch pull requests for ${repository.owner}/${repository.repo}: ${response.status}`,
            "GitHubService",
          );
          return null;
        }

        const pullRequests =
          ((await response.json()) as GitHubPullRequest[] | undefined) ?? [];

        const validPulls = pullRequests.filter(
          (pull): pull is GitHubPullRequest =>
            Boolean(pull?.id && pull?.number && pull?.created_at),
        );

        if (!state.initialized) {
          state.initialized = true;
          state.trackedPullRequestIds = validPulls
            .map((pull) => pull.id)
            .filter((id): id is number => typeof id === "number")
            .slice(0, MAX_TRACKED_PULL_REQUEST_IDS);
          state.lastSeenCreatedAt = validPulls[0]?.created_at ?? undefined;
          return null;
        }

        const trackedIds = state.trackedPullRequestIds ?? [];

        const lastSeenTimestamp = parseTimestamp(state.lastSeenCreatedAt);

        const newPulls = validPulls.filter((pull) => {
          const pullId = typeof pull.id === "number" ? pull.id : undefined;
          if (!pullId) {
            return false;
          }

          if (trackedIds.includes(pullId)) {
            return false;
          }

          if (!pull.created_at) {
            return false;
          }

          if (lastSeenTimestamp !== undefined) {
            const createdTimestamp = parseTimestamp(pull.created_at);
            if (
              createdTimestamp !== undefined &&
              createdTimestamp < lastSeenTimestamp
            ) {
              return false;
            }
          }

          return true;
        });

        if (newPulls.length === 0) {
          return null;
        }

        newPulls.sort((a, b) => {
          const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
          const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
          return aCreated - bCreated;
        });

        const targetPull = newPulls[0];

        if (!targetPull || typeof targetPull.id !== "number") {
          return null;
        }

        const repositoryFullName = `${repository.owner}/${repository.repo}`;

        const existingTracked = state.trackedPullRequestIds ?? [];
        const updatedTracked = [targetPull.id, ...existingTracked];
        state.trackedPullRequestIds = updatedTracked
          .filter((value, index, array) => array.indexOf(value) === index)
          .slice(0, MAX_TRACKED_PULL_REQUEST_IDS);

        if (targetPull.created_at) {
          const targetTimestamp = parseTimestamp(targetPull.created_at);
          if (
            targetTimestamp !== undefined &&
            (lastSeenTimestamp === undefined ||
              targetTimestamp > lastSeenTimestamp)
          ) {
            state.lastSeenCreatedAt = targetPull.created_at;
          }
        }

        const output = {
          pull_request_number: Number(targetPull.number ?? 0),
          pull_request_title: String(targetPull.title ?? ""),
          pull_request_body: String(targetPull.body ?? ""),
          pull_request_url: String(targetPull.html_url ?? ""),
          repository: repositoryFullName,
          sender: String(targetPull.user?.login ?? ""),
          raw_payload: targetPull as Record<string, unknown>,
        };

        ctx.logger?.log?.(
          `[github] Detected pull request #${output.pull_request_number} on ${repositoryFullName}`,
          "GitHubService",
        );

        return output;
      },
    }),
    createAction({
      id: "pull-request-merged",
      name: "Pull Request Merged",
      description:
        "Triggers when the specified pull request is merged.",
      input: {
        pull_request_url: textInput({
          label: "Pull Request URL",
          description:
            "Full GitHub pull request URL, for example: https://github.com/octocat/hello-world/pull/42",
          placeholder: "https://github.com/octocat/hello-world/pull/42",
          validation: { required: true },
        }),
      },
      output: {
        pull_request_number: "number",
        pull_request_title: "string",
        pull_request_url: "string",
        repository: "string",
        merged_by: "string",
        merged_at: "string",
        merge_commit_sha: "string",
        sender: "string",
        raw_payload: "object",
      },
      run: async (params, ctx) => {
        const pullRequestInput = String(params.pull_request_url ?? "");
        const pullRequest = parsePullRequestInput(pullRequestInput);

        if (!pullRequest) {
          ctx.logger?.warn?.(
            `[github] Invalid pull request identifier provided: ${pullRequestInput}`,
            "GitHubService",
          );
          return null;
        }

        const owner = pullRequest.owner;
        const repo = pullRequest.repo;

        if (!owner || !repo) {
          ctx.logger?.warn?.(
            `[github] Pull request URL must include owner and repository: ${pullRequestInput}`,
            "GitHubService",
          );
          return null;
        }

        const accessToken = ctx.connection?.accessToken;

        if (!accessToken) {
          ctx.logger?.warn?.(
            `[github] Missing access token for pull request merge polling on ${owner}/${repo}#${pullRequest.pullRequestNumber}`,
            "GitHubService",
          );
          return null;
        }

        const state = ensurePullRequestMergedState(ctx.state);
        ctx.state = state;

        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${pullRequest.pullRequestNumber}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "ReaxionApp/1.0",
            },
          },
        );

        if (!response.ok) {
          ctx.logger?.error?.(
            `[github] Failed to fetch pull request details for ${owner}/${repo}#${pullRequest.pullRequestNumber}: ${response.status}`,
            "GitHubService",
          );
          return null;
        }

        const pull = (await response.json()) as GitHubPullRequest | undefined;

        if (!pull) {
          ctx.logger?.warn?.(
            `[github] Ignored pull request merge polling: missing payload for ${owner}/${repo}#${pullRequest.pullRequestNumber}`,
            "GitHubService",
          );
          return null;
        }

        const mergedAtRaw = pull.merged_at;
        const mergedAt = typeof mergedAtRaw === "string" ? mergedAtRaw : undefined;
        const mergeCommitSha = pull.merge_commit_sha ?? undefined;

        if (!state.initialized) {
          state.initialized = true;
          state.lastKnownMergedAt = mergedAt;
          state.lastKnownMergeCommitSha = mergeCommitSha;
          return null;
        }

        if (!mergedAt) {
          state.lastKnownMergedAt = undefined;
          state.lastKnownMergeCommitSha = undefined;
          return null;
        }

        const normalizedMergedAt = mergedAt;

        if (
          state.lastKnownMergedAt &&
          state.lastKnownMergedAt === normalizedMergedAt
        ) {
          return null;
        }

        state.lastKnownMergedAt = normalizedMergedAt;
        state.lastKnownMergeCommitSha = mergeCommitSha;

        const repositoryFullName =
          pull.base?.repo?.full_name ?? `${owner}/${repo}`;

        const output = {
          pull_request_number: Number(pull.number ?? pullRequest.pullRequestNumber),
          pull_request_title: String(pull.title ?? ""),
          pull_request_url: String(pull.html_url ?? pullRequestInput),
          repository: repositoryFullName,
          merged_by: String(pull.merged_by?.login ?? ""),
          merged_at: normalizedMergedAt,
          merge_commit_sha: String(mergeCommitSha ?? ""),
          sender: String(pull.user?.login ?? ""),
          raw_payload: pull as Record<string, unknown>,
        };

        ctx.logger?.log?.(
          `[github] Detected merged pull request #${output.pull_request_number} on ${repositoryFullName}`,
          "GitHubService",
        );

        return output;
      },
    }),
    createAction({
      id: "pull-request-comment-created",
      name: "Pull Request Comment Added",
      description:
        "Triggers when a new comment is added to the specified pull request.",
      input: {
        pull_request_url: textInput({
          label: "Pull Request URL",
          description:
            "Full GitHub pull request URL, for example: https://github.com/octocat/hello-world/pull/42",
          placeholder: "https://github.com/octocat/hello-world/pull/42",
          validation: { required: true },
        }),
      },
      output: {
        pull_request_number: "number",
        comment_body: "string",
        comment_url: "string",
        comment_author: "string",
        comment_created_at: "string",
        repository: "string",
        raw_payload: "object",
      },
      run: async (params, ctx) => {
        const pullRequestInput = String(params.pull_request_url ?? "");
        const pullRequest = parsePullRequestInput(pullRequestInput);

        if (!pullRequest) {
          ctx.logger?.warn?.(
            `[github] Invalid pull request identifier provided: ${pullRequestInput}`,
            "GitHubService",
          );
          return null;
        }

        const owner = pullRequest.owner;
        const repo = pullRequest.repo;

        if (!owner || !repo) {
          ctx.logger?.warn?.(
            `[github] Pull request URL must include owner and repository: ${pullRequestInput}`,
            "GitHubService",
          );
          return null;
        }

        const accessToken = ctx.connection?.accessToken;

        if (!accessToken) {
          ctx.logger?.warn?.(
            `[github] Missing access token for pull request comment polling on ${owner}/${repo}#${pullRequest.pullRequestNumber}`,
            "GitHubService",
          );
          return null;
        }

        const state = ensurePullRequestCommentState(ctx.state);
        ctx.state = state;

        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${pullRequest.pullRequestNumber}/comments?per_page=${MAX_TRACKED_PULL_REQUEST_COMMENT_IDS}&sort=created&direction=desc`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "ReaxionApp/1.0",
            },
          },
        );

        if (!response.ok) {
          ctx.logger?.error?.(
            `[github] Failed to fetch pull request comments for ${owner}/${repo}#${pullRequest.pullRequestNumber}: ${response.status}`,
            "GitHubService",
          );
          return null;
        }

        const comments =
          ((await response.json()) as GitHubIssueComment[] | undefined) ?? [];

        const validComments = comments.filter(
          (comment): comment is GitHubIssueComment =>
            Boolean(comment?.id && comment?.created_at),
        );

        if (!state.initialized) {
          state.initialized = true;
          state.trackedCommentIds = validComments
            .map((comment) => comment.id)
            .filter((id): id is number => typeof id === "number")
            .slice(0, MAX_TRACKED_PULL_REQUEST_COMMENT_IDS);
          state.lastSeenCreatedAt = validComments[0]?.created_at ?? undefined;
          return null;
        }

        const trackedIds = state.trackedCommentIds ?? [];
        const lastSeenTimestamp = parseTimestamp(state.lastSeenCreatedAt);

        const newComments = validComments.filter((comment) => {
          const commentId = typeof comment.id === "number" ? comment.id : undefined;
          if (!commentId) {
            return false;
          }

          if (trackedIds.includes(commentId)) {
            return false;
          }

          if (!comment.created_at) {
            return false;
          }

          if (lastSeenTimestamp !== undefined) {
            const createdTimestamp = parseTimestamp(comment.created_at);
            if (
              createdTimestamp !== undefined &&
              createdTimestamp <= lastSeenTimestamp
            ) {
              return false;
            }
          }

          return true;
        });

        if (newComments.length === 0) {
          return null;
        }

        newComments.sort((a, b) => {
          const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
          const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
          return aCreated - bCreated;
        });

        const targetComment = newComments[0];

        if (!targetComment || typeof targetComment.id !== "number") {
          return null;
        }

        const existingTracked = state.trackedCommentIds ?? [];
        const updatedTracked = [targetComment.id, ...existingTracked];
        state.trackedCommentIds = updatedTracked
          .filter((value, index, array) => array.indexOf(value) === index)
          .slice(0, MAX_TRACKED_PULL_REQUEST_COMMENT_IDS);

        if (targetComment.created_at) {
          const targetTimestamp = parseTimestamp(targetComment.created_at);
          if (
            targetTimestamp !== undefined &&
            (lastSeenTimestamp === undefined ||
              targetTimestamp > lastSeenTimestamp)
          ) {
            state.lastSeenCreatedAt = targetComment.created_at;
          }
        }

        const output = {
          pull_request_number: pullRequest.pullRequestNumber,
          comment_body: String(targetComment.body ?? ""),
          comment_url: String(targetComment.html_url ?? ""),
          comment_author: String(targetComment.user?.login ?? ""),
          comment_created_at: String(targetComment.created_at ?? ""),
          repository: `${owner}/${repo}`,
          raw_payload: targetComment as Record<string, unknown>,
        };

        ctx.logger?.log?.(
          `[github] Detected comment on pull request #${pullRequest.pullRequestNumber} for ${owner}/${repo}`,
          "GitHubService",
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
