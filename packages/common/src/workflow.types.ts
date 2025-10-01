export interface Node {
  id: string;
  serviceId: string;
  actionId?: string;
  reactionId?: string;
  params: Record<string, unknown>;
  next?: string | string[];
  connections?: {
    success?: string[];
    error?: string[];
    always?: string[];
  };
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: Node[];
  webhookToken?: string;
  userId?: string;
}
