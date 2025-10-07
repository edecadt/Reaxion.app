import type { CreateWorkflowDto, Workflow } from "@reaxion/common";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  body?: unknown;
  token?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, timeoutMs = 10000, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const init: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: signal ?? controller.signal,
  };

  try {
    const res = await fetch(`${API_URL}${path}`, init);
    const text = await res.text();
    const isJson = (res.headers.get("content-type") || "").includes(
      "application/json",
    );
    const data = text ? (isJson ? JSON.parse(text) : text) : null;

    if (!res.ok) {
      const message =
        (data &&
        typeof data === "object" &&
        "message" in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).message)
          : res.statusText) || "Request failed";
      throw new ApiError(message, res.status, data);
    }

    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export type AboutService = {
  id?: string;
  name: string;
  actions: {
    id?: string;
    name: string;
    description: string;
    input?: Record<string, string>;
  }[];
  reactions: {
    id?: string;
    name: string;
    description: string;
    input?: Record<string, string>;
  }[];
};

export type AboutPayload = {
  client: { host: string };
  server: { current_time: number; services: AboutService[] };
};

export type WorkflowRunStatus = "running" | "completed" | "failed";

export type WorkflowRunLog = {
  id: string;
  runId: string;
  nodeId: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  logs: WorkflowRunLog[];
};

export async function getAbout(token?: string): Promise<AboutPayload> {
  return await request<AboutPayload>("GET", "/about.json", { token });
}

export async function getWorkflows(token?: string): Promise<Workflow[]> {
  return await request<Workflow[]>("GET", "/workflows", { token });
}

export async function createWorkflow(
  dto: CreateWorkflowDto,
  token?: string,
): Promise<Workflow> {
  return await request<Workflow>("POST", "/workflows", { body: dto, token });
}

export async function activateWorkflow(
  id: string,
  token?: string,
): Promise<Workflow> {
  return await request<Workflow>(
    "POST",
    `/workflows/${encodeURIComponent(id)}/activate`,
    { token },
  );
}

export async function deactivateWorkflow(
  id: string,
  token?: string,
): Promise<Workflow> {
  return await request<Workflow>(
    "POST",
    `/workflows/${encodeURIComponent(id)}/deactivate`,
    { token },
  );
}

export async function executeWorkflow(
  id: string,
  token?: string,
): Promise<{ runId: string }> {
  return await request<{ runId: string }>(
    "POST",
    `/workflows/${encodeURIComponent(id)}/execute`,
    { token },
  );
}

export async function getRun(
  runId: string,
  token?: string,
): Promise<WorkflowRun> {
  return await request<WorkflowRun>(
    "GET",
    `/workflows/runs/${encodeURIComponent(runId)}`,
    { token },
  );
}

export async function getRunLogs(
  runId: string,
  token?: string,
): Promise<WorkflowRunLog[]> {
  return await request<WorkflowRunLog[]>(
    "GET",
    `/workflows/runs/${encodeURIComponent(runId)}/logs`,
    { token },
  );
}

export async function login(
  email: string,
  password: string,
): Promise<{
  token: string;
  user: { id: number; email: string; name?: string | null };
}> {
  return await request("POST", "/auth/login", { body: { email, password } });
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<{
  token: string;
  user: { id: number; email: string; name?: string | null };
}> {
  return await request("POST", "/auth/register", {
    body: { email, password, name },
  });
}
