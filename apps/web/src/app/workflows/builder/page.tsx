"use client";

import type { Workflow } from "@reaxion/common";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
import type { Node, Edge } from "reactflow";

import { ThemeToggle } from "../../../components/theme/ThemeToggle";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { SearchableSelect } from "../../../components/ui/searchable-select";
import { MobileWorkflowBuilder } from "../../../components/workflow-builder/MobileWorkflowBuilder";
import { WorkflowCanvas } from "../../../components/workflow-builder/WorkflowCanvas";
import {
  createWorkflow,
  getAbout,
  type AboutService,
  getWorkflows,
  updateWorkflow,
} from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth";

type InputMetadata = {
  type: string;
  uiType?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{
    label: string;
    value: string | number;
    description?: string;
  }>;
  validation?: Record<string, unknown>;
};

type InputDefinitionValue = string | InputMetadata;

function getInputMetadata(value: InputDefinitionValue): {
  type: string;
  uiType?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{
    label: string;
    value: string | number;
    description?: string;
    icon?: string;
    color?: string;
  }>;
} {
  if (typeof value === "string") {
    return { type: value.toLowerCase() };
  }
  return {
    type: value.type.toLowerCase(),
    uiType: value.uiType,
    label: value.label,
    description: value.description,
    placeholder: value.placeholder,
    defaultValue: value.defaultValue,
    options: value.options,
  };
}

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workflowId = searchParams.get("id");
  const [token, setToken] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [services, setServices] = useState<AboutService[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const reactFlowInstanceRef = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const sortNodesByEdges = useCallback(
    (nodesList: Node[], edgesList: Edge[]): Node[] => {
      if (nodesList.length === 0) return [];
      if (edgesList.length === 0) return nodesList;

      const outgoingEdges = new Map<string, string[]>();
      const incomingCount = new Map<string, number>();

      nodesList.forEach((node) => {
        outgoingEdges.set(node.id, []);
        incomingCount.set(node.id, 0);
      });

      edgesList.forEach((edge) => {
        if (outgoingEdges.has(edge.source)) {
          outgoingEdges.get(edge.source)!.push(edge.target);
        }
        incomingCount.set(
          edge.target,
          (incomingCount.get(edge.target) || 0) + 1,
        );
      });

      const startNodes = nodesList.filter(
        (node) => incomingCount.get(node.id) === 0,
      );
      if (startNodes.length === 0) {
        return nodesList;
      }

      const sorted: Node[] = [];
      const queue = [...startNodes];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const currentNode = queue.shift()!;
        if (visited.has(currentNode.id)) continue;

        visited.add(currentNode.id);
        sorted.push(currentNode);

        const targets = outgoingEdges.get(currentNode.id) || [];
        targets.forEach((targetId) => {
          const targetNode = nodesList.find((n) => n.id === targetId);
          if (targetNode && !visited.has(targetId)) {
            queue.push(targetNode);
          }
        });
      }

      nodesList.forEach((node) => {
        if (!visited.has(node.id)) {
          sorted.push(node);
        }
      });

      return sorted;
    },
    [],
  );

  const getSortedNodesForMobile = useCallback(() => {
    if (edges.length > 0 && nodes.length > 0) {
      return sortNodesByEdges(nodes, edges);
    }
    return nodes;
  }, [nodes, edges, sortNodesByEdges]);

  useEffect(() => {
    if (token) {
      loadServices();
      if (workflowId) {
        loadWorkflow(workflowId);
      }
    }
  }, [token, workflowId]);

  const loadServices = async () => {
    if (!token) return;
    try {
      const about = await getAbout(token);
      setServices(about.server.services);
    } catch (err) {
      console.error("Failed to load services:", err);
    }
  };

  const loadWorkflow = async (id: string) => {
    if (!token) {
      return;
    }
    try {
      const workflows = await getWorkflows(token);
      const workflow = workflows.find((w) => w.id === id);

      if (!workflow) {
        console.error("loadWorkflow: Workflow not found");
        setError("Workflow introuvable");
        setTimeout(() => router.push("/workflows"), 2000);
        return;
      }

      setWorkflowName(workflow.name);
      setIsEditing(true);

      const flowNodes: Node[] = (workflow.nodes || []).map((node, index) => {
        const isAction = node.actionId && node.actionId.trim() !== "";
        const isReaction = node.reactionId && node.reactionId.trim() !== "";

        return {
          id: node.id,
          type: isAction ? "action" : "reaction",
          position: node.position || {
            x: 100 + index * 250,
            y: 100 + Math.floor(index / 3) * 150,
          },
          data: {
            label: node.label || undefined,
            serviceId: node.serviceId,
            actionId: node.actionId || undefined,
            reactionId: node.reactionId || undefined,
            params: node.params || {},
          },
        };
      });

      const flowEdges: Edge[] = [];
      (workflow.nodes || []).forEach((node) => {
        const nextIds = Array.isArray(node.next) ? node.next : [];
        nextIds.forEach((targetId) => {
          flowEdges.push({
            id: `${node.id}-${targetId}`,
            source: node.id,
            target: targetId as string,
            type: "smoothstep",
            animated: true,
          });
        });
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      console.error("Failed to load workflow:", err);
      setError("Échec du chargement du workflow");
    }
  };

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      if (isMobile) {
        setConfigModalOpen(true);
      }
    },
    [isMobile],
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      if (!isMobile) {
        setConfigModalOpen(true);
      }
    },
    [isMobile],
  );

  const updateSelectedNode = useCallback(
    (updates: Partial<Node["data"]>) => {
      if (!selectedNode) return;

      setSelectedNode((prev) => {
        if (!prev) return null;
        return { ...prev, data: { ...prev.data, ...updates } };
      });
    },
    [selectedNode],
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      if (!reactFlowInstanceRef.current) {
        console.error("React Flow instance not available!");
        return;
      }

      const rfInstance = reactFlowInstanceRef.current;
      const currentNodes = rfInstance.getNodes();
      const currentEdges = rfInstance.getEdges();

      const filteredNodes = currentNodes.filter((n: Node) => n.id !== nodeId);

      const filteredEdges = currentEdges.filter(
        (e: Edge) => e.source !== nodeId && e.target !== nodeId,
      );

      rfInstance.setNodes(filteredNodes);
      rfInstance.setEdges(filteredEdges);

      setNodes(filteredNodes);
      setEdges(filteredEdges);
    },
    [setNodes, setEdges],
  );

  const applyNodeChanges = useCallback(() => {
    if (!selectedNode || !reactFlowInstanceRef.current) return;

    const rfInstance = reactFlowInstanceRef.current;
    const currentNodes = rfInstance.getNodes();

    const updatedNodes = currentNodes.map((node: Node) =>
      node.id === selectedNode.id
        ? { ...node, data: { ...selectedNode.data, onDeleteNode } }
        : node,
    );

    rfInstance.setNodes(updatedNodes);
    setNodes(updatedNodes);
  }, [selectedNode, onDeleteNode]);

  const deleteNode = useCallback(
    (nodeId: string) => {
      onDeleteNode(nodeId);
      setSelectedNode(null);
      setConfigModalOpen(false);
    },
    [onDeleteNode],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedNode &&
        !configModalOpen
      ) {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          event.preventDefault();
          deleteNode(selectedNode.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, configModalOpen, deleteNode]);

  const handleSave = async () => {
    if (!token || !workflowName.trim()) {
      setError("Veuillez fournir un nom de workflow");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (nodes.length === 0) {
      setError("Veuillez ajouter au moins un nœud au workflow");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const rfInstance = reactFlowInstanceRef.current;
      const currentNodes = rfInstance ? rfInstance.getNodes() : nodes;
      const currentEdges = rfInstance ? rfInstance.getEdges() : edges;

      const workflowNodes = currentNodes.map((node: Node) => {
        const customLabel =
          node.data.label &&
          node.data.label !== node.id &&
          node.data.label !== "New Trigger" &&
          node.data.label !== "New Action"
            ? node.data.label
            : undefined;

        return {
          id: node.id,
          serviceId: node.data.serviceId || "timer",
          actionId: node.data.actionId,
          reactionId: node.data.reactionId,
          params: node.data.params || {},
          label: customLabel,
          position: node.position,
          next: currentEdges
            .filter((edge: Edge) => edge.source === node.id)
            .map((edge: Edge) => edge.target),
        };
      });

      const workflow = {
        id: workflowId || `workflow-${Date.now()}`,
        name: workflowName,
        active: false,
        nodes: workflowNodes,
      };

      if (isEditing && workflowId) {
        await updateWorkflow(workflowId, workflow, token);
      } else {
        await createWorkflow(workflow, token);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/workflows");
      }, 1500);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Échec de la sauvegarde du workflow";
      setError(message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const createEdgesFromNodes = useCallback((nodesList: Node[]): Edge[] => {
    const newEdges: Edge[] = [];
    for (let i = 0; i < nodesList.length - 1; i++) {
      const currentNode = nodesList[i];
      const nextNode = nodesList[i + 1];
      if (currentNode && nextNode) {
        newEdges.push({
          id: `${currentNode.id}-${nextNode.id}`,
          source: currentNode.id,
          target: nextNode.id,
          type: "smoothstep",
          animated: true,
        });
      }
    }
    return newEdges;
  }, []);

  const handleMobileAddNode = useCallback(
    (type: "action" | "reaction") => {
      const newNode: Node = {
        id: `node-${Date.now()}`,
        type,
        position: { x: 0, y: 0 },
        data: {
          label: type === "action" ? "New Trigger" : "New Action",
          serviceId: "",
          ...(type === "action" ? { actionId: "" } : { reactionId: "" }),
          params: {},
        },
      };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      setEdges(createEdgesFromNodes(newNodes));
    },
    [nodes, createEdgesFromNodes],
  );

  const handleMobileUpdateNode = useCallback(
    (nodeId: string, updates: Partial<Node["data"]>) => {
      setNodes(
        nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node,
        ),
      );
    },
    [nodes],
  );

  const handleMobileUpdateNodeConnections = useCallback(
    (nodeId: string, nextNodeIds: string[]) => {
      const updatedNodes = nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, next: nextNodeIds } }
          : node,
      );
      setNodes(updatedNodes);

      const newEdges: Edge[] = [];
      updatedNodes.forEach((node) => {
        const nextIds = Array.isArray(node.data.next)
          ? node.data.next
          : node.data.next
            ? [node.data.next]
            : [];

        nextIds.forEach((targetId: string) => {
          newEdges.push({
            id: `${node.id}-${targetId}`,
            source: node.id,
            target: targetId,
            type: "smoothstep",
            animated: true,
          });
        });
      });
      setEdges(newEdges);
    },
    [nodes],
  );

  const handleMobileDeleteNode = useCallback(
    (nodeId: string) => {
      const filteredNodes = nodes.filter((n) => n.id !== nodeId);
      setNodes(filteredNodes);
      setEdges(createEdgesFromNodes(filteredNodes));
    },
    [nodes, createEdgesFromNodes],
  );

  const handleMobileNodesChange = useCallback(
    (newNodes: Node[]) => {
      setNodes(newNodes);
      setEdges(createEdgesFromNodes(newNodes));
    },
    [createEdgesFromNodes],
  );

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))] transition-colors md:flex-row">
      {isMobile ? (
        <div className="flex h-full flex-col pt-16">
          <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 px-4 py-3 backdrop-blur transition-colors supports-[backdrop-filter]:bg-[hsl(var(--background))]/75">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                Workflow Builder
              </h2>
              <div className="flex items-center gap-2">
                <ThemeToggle className="h-9 w-9" />
                <Button
                  onClick={handleSave}
                  disabled={!workflowName.trim() || nodes.length === 0}
                  size="sm"
                  className="touch-manipulation"
                >
                  Save
                </Button>
              </div>
            </div>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name"
              className="text-lg font-semibold text-[hsl(var(--foreground))]"
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <MobileWorkflowBuilder
              nodes={getSortedNodesForMobile()}
              services={services}
              onNodesChange={handleMobileNodesChange}
              onAddNode={handleMobileAddNode}
              onDeleteNode={handleMobileDeleteNode}
              onUpdateNode={handleMobileUpdateNode}
              onUpdateNodeConnections={handleMobileUpdateNodeConnections}
            />
          </div>

          {success && (
            <div className="absolute left-4 right-4 top-20 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-lg">
              Workflow saved successfully!
            </div>
          )}
          {error && (
            <div className="absolute left-4 right-4 top-20 rounded-lg bg-[hsl(var(--destructive))] px-4 py-3 text-sm font-medium text-[hsl(var(--destructive-foreground))] shadow-lg">
              {error}
            </div>
          )}
        </div>
      ) : (
        <>
          <div
            className={`z-10 overflow-hidden border-r border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 transition-all duration-300 ease-in-out backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/80 ${
              sidebarOpen ? "w-80" : "w-0"
            }`}
          >
            <div
              className="h-full space-y-4 overflow-y-auto p-6 transition-colors"
              style={{ width: "320px" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                  Workflow Builder
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Workflow Name
                </Label>
                <Input
                  id="name"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="My Workflow"
                  className="w-full"
                />
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  Drag Nodes
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Drag and drop nodes onto the canvas
                </p>

                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/reactflow", "action");
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="flex cursor-move items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 transition-all hover:scale-[1.02] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] hover:shadow-lg"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white dark:from-violet-600 dark:to-purple-500">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      Trigger Node
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Starts the workflow
                    </div>
                  </div>
                </div>

                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/reactflow", "reaction");
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="flex cursor-move items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 transition-all hover:scale-[1.02] hover:border-emerald-400 hover:bg-[hsl(var(--accent))] hover:shadow-lg"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white dark:from-emerald-600 dark:to-teal-500">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      Action Node
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Performs an action
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  Available Services
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {services.length === 0 ? (
                    <div className="text-sm italic text-[hsl(var(--muted-foreground))]">
                      Loading services...
                    </div>
                  ) : (
                    services.map((service) => (
                      <div
                        key={service.name}
                        className="rounded-lg border border-transparent bg-[hsl(var(--muted))] p-3 text-sm transition-colors hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                      >
                        <div className="font-medium text-[hsl(var(--foreground))]">
                          {service.name}
                        </div>
                        <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                          {service.actions.length} triggers •{" "}
                          {service.reactions.length} actions
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-[hsl(var(--border))] pt-4">
                <Button
                  onClick={handleSave}
                  disabled={!workflowName.trim()}
                  className="w-full"
                >
                  Save Workflow
                </Button>
              </div>
            </div>
          </div>

          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed left-4 top-24 z-20 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 shadow-lg transition-all hover:shadow-xl"
              title="Open sidebar"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}

          <div className="relative flex-1">
            <div className="absolute left-0 right-0 top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 px-6 py-4 backdrop-blur transition-colors supports-[backdrop-filter]:bg-[hsl(var(--background))]/75">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                    {workflowName || "Untitled Workflow"}
                  </h1>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Drag nodes from the sidebar and connect them to build your
                    workflow
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ThemeToggle className="h-10 w-10" />
                  <Button
                    variant="outline"
                    onClick={() => router.push("/workflows")}
                    className="bg-[hsl(var(--background))]"
                  >
                    Back to Workflows
                  </Button>
                </div>
              </div>
            </div>

            <div className="absolute top-[88px] left-0 right-0 bottom-0">
              <WorkflowCanvas
                initialNodes={nodes}
                initialEdges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onInit={(instance) => {
                  reactFlowInstanceRef.current = instance;
                }}
                onDeleteNode={onDeleteNode}
              />
            </div>
          </div>

          <Dialog
            open={configModalOpen}
            onClose={() => {
              setConfigModalOpen(false);
              setSelectedNode(null);
            }}
            title="Node Configuration"
          >
            {selectedNode && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="node-label" className="text-sm font-medium">
                      Label
                    </Label>
                    <Input
                      id="node-label"
                      value={
                        selectedNode.data.label &&
                        selectedNode.data.label !== selectedNode.id &&
                        selectedNode.data.label !== "New Trigger" &&
                        selectedNode.data.label !== "New Action"
                          ? selectedNode.data.label
                          : ""
                      }
                      onChange={(e) =>
                        updateSelectedNode({
                          label: e.target.value || undefined,
                        })
                      }
                      placeholder="Custom label (optional)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="node-service"
                      className="text-sm font-medium"
                    >
                      Service
                    </Label>
                    <SearchableSelect
                      ariaLabel="Select service"
                      options={services.map((s) => ({
                        label: s.name,
                        value: s.name,
                      }))}
                      value={selectedNode.data.serviceId || ""}
                      onChange={(val) =>
                        updateSelectedNode({
                          serviceId: val,
                          actionId: undefined,
                          reactionId: undefined,
                          params: {},
                        })
                      }
                      placeholder="Select service"
                    />
                  </div>

                  {selectedNode.type === "action" &&
                    selectedNode.data.serviceId && (
                      <div className="space-y-2">
                        <Label
                          htmlFor="node-action"
                          className="text-sm font-medium"
                        >
                          Action
                        </Label>
                        <SearchableSelect
                          ariaLabel="Select action"
                          options={(
                            services.find(
                              (s) => s.name === selectedNode.data.serviceId,
                            )?.actions || []
                          ).map((a) => ({ label: a.name, value: a.name }))}
                          value={selectedNode.data.actionId || ""}
                          onChange={(val) =>
                            updateSelectedNode({ actionId: val, params: {} })
                          }
                          placeholder="Select action"
                        />
                      </div>
                    )}

                  {selectedNode.type === "reaction" &&
                    selectedNode.data.serviceId && (
                      <div className="space-y-2">
                        <Label
                          htmlFor="node-reaction"
                          className="text-sm font-medium"
                        >
                          Reaction
                        </Label>
                        <SearchableSelect
                          ariaLabel="Select reaction"
                          options={(
                            services.find(
                              (s) => s.name === selectedNode.data.serviceId,
                            )?.reactions || []
                          ).map((r) => ({ label: r.name, value: r.name }))}
                          value={selectedNode.data.reactionId || ""}
                          onChange={(val) =>
                            updateSelectedNode({ reactionId: val, params: {} })
                          }
                          placeholder="Select reaction"
                        />
                      </div>
                    )}

                  {(() => {
                    const service = services.find(
                      (s) => s.name === selectedNode.data.serviceId,
                    );
                    const actionOrReaction =
                      selectedNode.type === "action"
                        ? service?.actions.find(
                            (a) => a.name === selectedNode.data.actionId,
                          )
                        : service?.reactions.find(
                            (r) => r.name === selectedNode.data.reactionId,
                          );

                    const inputDefinition = (actionOrReaction?.input ||
                      {}) as Record<string, InputDefinitionValue>;
                    const inputKeys = Object.keys(inputDefinition);

                    if (inputKeys.length > 0) {
                      return (
                        <div className="space-y-3 border-t border-[hsl(var(--border))] pt-3">
                          <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                            Parameters
                          </h4>
                          {inputKeys.map((key) => {
                            const inputMeta = getInputMetadata(
                              inputDefinition[key] || "string",
                            );
                            const type = inputMeta.type;
                            const uiType = inputMeta.uiType || type;
                            const label = inputMeta.label || key;
                            const description = inputMeta.description;
                            const placeholder =
                              inputMeta.placeholder || `Enter ${key}`;
                            const options = inputMeta.options;

                            const params = (selectedNode.data.params ||
                              {}) as Record<string, unknown>;
                            const value = params[key];

                            if (
                              uiType === "select" &&
                              options &&
                              options.length > 0
                            ) {
                              return (
                                <div key={key} className="space-y-1">
                                  <Label
                                    htmlFor={`param-${key}`}
                                    className="text-sm font-medium"
                                  >
                                    {label}
                                  </Label>
                                  {description && (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                      {description}
                                    </p>
                                  )}
                                  <select
                                    id={`param-${key}`}
                                    value={String(value ?? "")}
                                    onChange={(e) => {
                                      const newParams = {
                                        ...params,
                                        [key]: e.target.value,
                                      };
                                      updateSelectedNode({ params: newParams });
                                    }}
                                    className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]"
                                  >
                                    <option value="">{placeholder}</option>
                                    {options.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.icon ? `${opt.icon} ` : ""}
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  {options.find((opt) => opt.value === value)
                                    ?.description && (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                      {
                                        options.find(
                                          (opt) => opt.value === value,
                                        )?.description
                                      }
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            if (type === "boolean") {
                              return (
                                <div key={key} className="space-y-1">
                                  <div className="flex items-center justify-between py-2">
                                    <div className="flex-1">
                                      <Label
                                        htmlFor={`param-${key}`}
                                        className="text-sm font-medium"
                                      >
                                        {label}
                                      </Label>
                                      {description && (
                                        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                                          {description}
                                        </p>
                                      )}
                                    </div>
                                    <input
                                      id={`param-${key}`}
                                      type="checkbox"
                                      checked={Boolean(value)}
                                      onChange={(e) => {
                                        const newParams = {
                                          ...params,
                                          [key]: e.target.checked,
                                        };
                                        updateSelectedNode({
                                          params: newParams,
                                        });
                                      }}
                                      className="h-4 w-4 ml-2"
                                    />
                                  </div>
                                </div>
                              );
                            }

                            if (type === "number") {
                              return (
                                <div key={key} className="space-y-1">
                                  <Label
                                    htmlFor={`param-${key}`}
                                    className="text-sm font-medium"
                                  >
                                    {label}
                                  </Label>
                                  {description && (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                      {description}
                                    </p>
                                  )}
                                  <Input
                                    id={`param-${key}`}
                                    type="number"
                                    value={String(value ?? "")}
                                    onChange={(e) => {
                                      const newParams = {
                                        ...params,
                                        [key]: e.target.value,
                                      };
                                      updateSelectedNode({ params: newParams });
                                    }}
                                    placeholder={placeholder}
                                  />
                                </div>
                              );
                            }

                            if (uiType === "textarea") {
                              return (
                                <div key={key} className="space-y-1">
                                  <Label
                                    htmlFor={`param-${key}`}
                                    className="text-sm font-medium"
                                  >
                                    {label}
                                  </Label>
                                  {description && (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                      {description}
                                    </p>
                                  )}
                                  <textarea
                                    id={`param-${key}`}
                                    value={String(value ?? "")}
                                    onChange={(e) => {
                                      const newParams = {
                                        ...params,
                                        [key]: e.target.value,
                                      };
                                      updateSelectedNode({ params: newParams });
                                    }}
                                    placeholder={placeholder}
                                    rows={4}
                                    className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]"
                                  />
                                  {options && options.length > 0 && (
                                    <div className="mt-2">
                                      <p className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
                                        Quick presets:
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {options.map((opt) => (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                              const newParams = {
                                                ...params,
                                                [key]: opt.value,
                                              };
                                              updateSelectedNode({
                                                params: newParams,
                                              });
                                            }}
                                            className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))]"
                                            title={opt.description}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div key={key} className="space-y-1">
                                <Label
                                  htmlFor={`param-${key}`}
                                  className="text-sm font-medium"
                                >
                                  {label}
                                </Label>
                                {description && (
                                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {description}
                                  </p>
                                )}
                                <Input
                                  id={`param-${key}`}
                                  type={
                                    uiType === "password"
                                      ? "password"
                                      : uiType === "email"
                                        ? "email"
                                        : uiType === "url"
                                          ? "url"
                                          : "text"
                                  }
                                  value={String(value ?? "")}
                                  onChange={(e) => {
                                    const newParams = {
                                      ...params,
                                      [key]: e.target.value,
                                    };
                                    updateSelectedNode({ params: newParams });
                                  }}
                                  placeholder={placeholder}
                                />
                                {options && options.length > 0 && (
                                  <div className="mt-2">
                                    <p className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
                                      Quick presets:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {options.map((opt) => (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => {
                                            const newParams = {
                                              ...params,
                                              [key]: opt.value,
                                            };
                                            updateSelectedNode({
                                              params: newParams,
                                            });
                                          }}
                                          className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))]"
                                          title={opt.description}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfigModalOpen(false);
                      setSelectedNode(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      applyNodeChanges();
                      setConfigModalOpen(false);
                      setSelectedNode(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </Dialog>

          {!isMobile && error && (
            <div className="fixed bottom-4 right-4 rounded-lg bg-[hsl(var(--destructive))] px-4 py-3 text-sm font-medium text-[hsl(var(--destructive-foreground))] shadow-lg">
              {error}
            </div>
          )}
          {!isMobile && success && (
            <div className="fixed bottom-4 right-4 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-lg">
              Workflow saved successfully!
            </div>
          )}
        </>
      )}
    </div>
  );
}
