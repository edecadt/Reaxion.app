export interface CreateNodeDto {
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
  label?: string;
  position?: { x: number; y: number };
}

export interface CreateWorkflowDto {
  id: string;
  name: string;
  active: boolean;
  nodes: CreateNodeDto[];
  userId?: string;
}
