import { getApiUrl } from "./api-config";
import type { CreateWorkflowDto, Workflow } from "@reaxion/common";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

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
  body?: unknown,
  timeoutMs = 10000,
): Promise<T> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const init: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const isJson = (res.headers.get("content-type") || "").includes(
    "application/json",
  );
  const data = text ? (isJson ? (JSON.parse(text) as unknown) : text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in (data as any)
        ? String((data as any).message)
        : res.statusText) || "Request failed";
    throw new ApiError(message, res.status, data);
  }

  return data as T;
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

export async function getAbout(): Promise<AboutPayload> {
  return await request<AboutPayload>("GET", "/about.json");
}

export async function getWorkflows(): Promise<Workflow[]> {
  return await request<Workflow[]>("GET", "/workflows");
}

export async function createWorkflow(
  dto: CreateWorkflowDto,
): Promise<Workflow> {
  return await request<Workflow>("POST", "/workflows", dto);
}

export async function activateWorkflow(id: string): Promise<Workflow> {
  return await request<Workflow>(
    "POST",
    `/workflows/${encodeURIComponent(id)}/activate`,
  );
}

export async function deactivateWorkflow(id: string): Promise<Workflow> {
  return await request<Workflow>(
    "POST",
    `/workflows/${encodeURIComponent(id)}/deactivate`,
  );
}

export async function executeWorkflow(id: string): Promise<{ runId: string }> {
  return await request<{ runId: string }>(
    "POST",
    `/workflows/${encodeURIComponent(id)}/execute`,
  );
}

export async function getRun(runId: string): Promise<WorkflowRun> {
  return await request<WorkflowRun>(
    "GET",
    `/workflows/runs/${encodeURIComponent(runId)}`,
  );
}

export async function getRunLogs(runId: string): Promise<WorkflowRunLog[]> {
  return await request<WorkflowRunLog[]>(
    "GET",
    `/workflows/runs/${encodeURIComponent(runId)}/logs`,
  );
}
