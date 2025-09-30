import { useMemo, useReducer } from "react";
import type { Workflow as WFWorkflow, Node as WFNode } from "@reaxion/common";

export type WorkflowBuilderState = Pick<
  WFWorkflow,
  "id" | "name" | "active"
> & {
  nodes: WFNode[];
};

type Action =
  | {
      type: "SET_META";
      payload: Partial<Pick<WFWorkflow, "id" | "name" | "active">>;
    }
  | { type: "ADD_NODE"; payload?: Partial<WFNode> }
  | { type: "REMOVE_NODE"; payload: { id: string } }
  | { type: "UPDATE_NODE"; payload: { id: string; updates: Partial<WFNode> } }
  | {
      type: "SET_NODE_PARAMS";
      payload: { id: string; params: Record<string, unknown> };
    }
  | { type: "SET_NODE_NEXT"; payload: { id: string; next?: string | string[] } }
  | { type: "RESET" };

const initialState: WorkflowBuilderState = {
  id: "",
  name: "",
  active: false,
  nodes: [],
};

function generateNodeId(existing: Set<string>): string {
  let i = 1;
  while (existing.has(`node-${i}`)) i += 1;
  return `node-${i}`;
}

function normalizeNext(next: WFNode["next"]): WFNode["next"] {
  if (Array.isArray(next)) return Array.from(new Set(next));
  return next;
}

function removeIdFromConnections(id: string, node: WFNode): WFNode {
  const next = node.next;
  let newNext: WFNode["next"] | undefined = next;
  if (typeof next === "string" && next === id) newNext = undefined;
  if (Array.isArray(next)) newNext = next.filter((n) => n !== id);

  const c = node.connections;
  if (!c) return newNext === next ? node : { ...node, next: newNext };
  const clean = {
    success: c.success?.filter((n) => n !== id),
    error: c.error?.filter((n) => n !== id),
    always: c.always?.filter((n) => n !== id),
  };
  const hasAny =
    (clean.success && clean.success.length > 0) ||
    (clean.error && clean.error.length > 0) ||
    (clean.always && clean.always.length > 0);
  const connections = hasAny ? clean : undefined;
  if (newNext === next && connections === node.connections) return node;
  return { ...node, next: newNext, connections };
}

function reducer(
  state: WorkflowBuilderState,
  action: Action,
): WorkflowBuilderState {
  switch (action.type) {
    case "SET_META":
      return { ...state, ...action.payload };
    case "ADD_NODE": {
      const ids = new Set(state.nodes.map((n) => n.id));
      const id = action.payload?.id || generateNodeId(ids);
      const node: WFNode = {
        id,
        serviceId: action.payload?.serviceId || "",
        actionId: action.payload?.actionId,
        reactionId: action.payload?.reactionId,
        params: action.payload?.params ?? {},
        next: normalizeNext(action.payload?.next),
        connections: action.payload?.connections,
      };
      return { ...state, nodes: [...state.nodes, node] };
    }
    case "REMOVE_NODE": {
      const id = action.payload.id;
      const nodes = state.nodes
        .filter((n) => n.id !== id)
        .map((n) => removeIdFromConnections(id, n));
      return { ...state, nodes };
    }
    case "UPDATE_NODE": {
      const { id, updates } = action.payload;
      const nodes = state.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              ...updates,
              next:
                updates.next !== undefined
                  ? normalizeNext(updates.next)
                  : n.next,
              params:
                updates.params !== undefined
                  ? (updates.params as Record<string, unknown>)
                  : n.params,
            }
          : n,
      );
      return { ...state, nodes };
    }
    case "SET_NODE_PARAMS": {
      const { id, params } = action.payload;
      const nodes = state.nodes.map((n) =>
        n.id === id ? { ...n, params } : n,
      );
      return { ...state, nodes };
    }
    case "SET_NODE_NEXT": {
      const { id, next } = action.payload;
      const nodes = state.nodes.map((n) =>
        n.id === id ? { ...n, next: normalizeNext(next) } : n,
      );
      return { ...state, nodes };
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function useWorkflowBuilder() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo(
    () => ({
      setMeta: (payload: Partial<Pick<WFWorkflow, "id" | "name" | "active">>) =>
        dispatch({ type: "SET_META", payload }),
      addNode: (payload?: Partial<WFNode>) =>
        dispatch({ type: "ADD_NODE", payload }),
      removeNode: (id: string) =>
        dispatch({ type: "REMOVE_NODE", payload: { id } }),
      updateNode: (id: string, updates: Partial<WFNode>) =>
        dispatch({ type: "UPDATE_NODE", payload: { id, updates } }),
      setNodeParams: (id: string, params: Record<string, unknown>) =>
        dispatch({ type: "SET_NODE_PARAMS", payload: { id, params } }),
      setNodeNext: (id: string, next?: string | string[]) =>
        dispatch({ type: "SET_NODE_NEXT", payload: { id, next } }),
      reset: () => dispatch({ type: "RESET" }),
    }),
    [],
  );

  return { state, actions } as const;
}
