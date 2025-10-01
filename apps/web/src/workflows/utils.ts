import type { Workflow } from "@reaxion/common";

export function toId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function knownActionIdFor(
  serviceId: string,
  displayName: string,
): string {
  const name = displayName.toLowerCase();
  if (serviceId === "timer") {
    if (name.includes("cron")) return "cron";
  }
  if (serviceId === "test-webhook") {
    if (name.includes("webhook")) return "on-test-webhook";
  }
  return toId(displayName);
}

export function knownReactionIdFor(
  serviceId: string,
  displayName: string,
): string {
  const name = displayName.toLowerCase();
  if (serviceId === "timer") {
    if (name.includes("log")) return "log";
    if (name.includes("wait")) return "wait";
  }
  return toId(displayName);
}

export function computeEntryNode(workflow: Workflow): string | null {
  if (!workflow.nodes || workflow.nodes.length === 0) return null;

  const referenced = new Set<string>();
  for (const node of workflow.nodes) {
    const next = node.next;
    if (typeof next === "string") {
      referenced.add(next);
    } else if (Array.isArray(next)) {
      next.forEach((id) => referenced.add(id));
    }
  }

  const entry = workflow.nodes.find((node) => !referenced.has(node.id));
  return entry ? entry.id : null;
}
