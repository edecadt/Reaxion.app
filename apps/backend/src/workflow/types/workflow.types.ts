export interface Node {
  id: string;
  serviceId: string;
  actionId?: string;
  reactionId?: string;
  params: Record<string, unknown>;
  next?: string;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: Node[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  currentNodeId?: string;
  logs: WorkflowLog[];
  error?: string;
}

export interface WorkflowLog {
  id: string;
  runId: string;
  nodeId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface NodeExecution {
  nodeId: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  executedAt: Date;
  success: boolean;
  error?: string;
}

export interface WorkflowContext {
  runId: string;
  workflowId: string;
  nodeId: string;
  previousOutput?: Record<string, unknown>;
  state: Record<string, unknown>;
}
