"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Node, Edge } from "reactflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { WorkflowCanvas } from "../../../components/workflow-builder/WorkflowCanvas";
import { getAuthToken } from "../../../lib/auth";
import {
  createWorkflow,
  getAbout,
  type AboutService,
  getWorkflows,
  updateWorkflow,
} from "../../../lib/api";
import { Dialog } from "../../../components/ui/dialog";
import type { Workflow } from "@reaxion/common";

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

  useEffect(() => {
    setToken(getAuthToken());
  }, []);

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
      console.log("loadWorkflow: No token, skipping");
      return;
    }
    try {
      console.log("loadWorkflow: Loading workflow with id:", id);
      const workflows = await getWorkflows(token);
      console.log("loadWorkflow: Got workflows:", workflows);
      const workflow = workflows.find((w) => w.id === id);

      if (!workflow) {
        console.error("loadWorkflow: Workflow not found");
        setError("Workflow introuvable");
        setTimeout(() => router.push("/workflows"), 2000);
        return;
      }

      console.log("loadWorkflow: Found workflow:", workflow);
      setWorkflowName(workflow.name);
      setIsEditing(true);

      const flowNodes: Node[] = (workflow.nodes || []).map((node, index) => {
        const isAction = node.actionId && node.actionId.trim() !== "";
        const isReaction = node.reactionId && node.reactionId.trim() !== "";

        console.log(
          "loadWorkflow: Converting node:",
          node,
          "isAction:",
          isAction,
          "isReaction:",
          isReaction,
        );

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
        (node.next || []).forEach((targetId) => {
          flowEdges.push({
            id: `${node.id}-${targetId}`,
            source: node.id,
            target: targetId,
            type: "smoothstep",
            animated: true,
          });
        });
      });

      console.log("loadWorkflow: Setting nodes:", flowNodes);
      console.log("loadWorkflow: Setting edges:", flowEdges);
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
      setConfigModalOpen(true);
    },
    [],
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
      console.log("onDeleteNode called with nodeId:", nodeId);

      if (!reactFlowInstanceRef.current) {
        console.error("React Flow instance not available!");
        return;
      }

      const rfInstance = reactFlowInstanceRef.current;
      const currentNodes = rfInstance.getNodes();
      const currentEdges = rfInstance.getEdges();

      console.log(
        "Current nodes before delete:",
        currentNodes.map((n: Node) => n.id),
      );
      const filteredNodes = currentNodes.filter((n: Node) => n.id !== nodeId);
      console.log(
        "Nodes after delete:",
        filteredNodes.map((n: Node) => n.id),
      );

      console.log("Current edges before delete:", currentEdges.length);
      const filteredEdges = currentEdges.filter(
        (e: Edge) => e.source !== nodeId && e.target !== nodeId,
      );
      console.log("Edges after delete:", filteredEdges.length);

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

    const updatedNodes = currentNodes.map((node) =>
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

      console.log("handleSave: Saving nodes:", currentNodes);
      console.log("handleSave: Saving edges:", currentEdges);

      const workflowNodes = currentNodes.map((node) => {
        const customLabel =
          node.data.label &&
          node.data.label !== node.id &&
          node.data.label !== "New Trigger" &&
          node.data.label !== "New Action"
            ? node.data.label
            : undefined;

        console.log(
          `Node ${node.id}: data.label="${node.data.label}", customLabel="${customLabel}"`,
        );

        return {
          id: node.id,
          serviceId: node.data.serviceId || "timer",
          actionId: node.data.actionId,
          reactionId: node.data.reactionId,
          params: node.data.params || {},
          label: customLabel,
          position: node.position,
          next: currentEdges
            .filter((edge) => edge.source === node.id)
            .map((edge) => edge.target),
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

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gray-50">
      {/* Retractable Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "w-80" : "w-0"
        } overflow-hidden z-10`}
      >
        <div
          className="h-full overflow-y-auto p-6 space-y-4"
          style={{ width: "320px" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Workflow Builder</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-5 h-5"
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

          {/* Workflow Settings */}
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

          {/* Drag Nodes Section */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-semibold text-gray-700">Drag Nodes</h3>
            <p className="text-xs text-gray-500">
              Drag and drop nodes onto the canvas
            </p>

            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", "action");
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex items-center gap-3 p-3 rounded-lg border-2 border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 cursor-move hover:shadow-lg transition-all hover:scale-105"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-white"
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
                <div className="text-sm font-bold text-gray-900">
                  Trigger Node
                </div>
                <div className="text-xs text-gray-500">Starts the workflow</div>
              </div>
            </div>

            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", "reaction");
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex items-center gap-3 p-3 rounded-lg border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 cursor-move hover:shadow-lg transition-all hover:scale-105"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-white"
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
                <div className="text-sm font-bold text-gray-900">
                  Action Node
                </div>
                <div className="text-xs text-gray-500">Performs an action</div>
              </div>
            </div>
          </div>

          {/* Available Services */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Available Services
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {services.length === 0 ? (
                <div className="text-sm text-gray-400 italic">
                  Loading services...
                </div>
              ) : (
                services.map((service) => (
                  <div
                    key={service.name}
                    className="text-sm p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="font-medium text-gray-900">
                      {service.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {service.actions.length} triggers •{" "}
                      {service.reactions.length} actions
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-gray-200">
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

      {/* Toggle Sidebar Button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-24 z-20 bg-white rounded-lg p-3 shadow-lg hover:shadow-xl transition-all border border-gray-200"
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

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {workflowName || "Untitled Workflow"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Drag nodes from the sidebar and connect them to build your
                workflow
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/workflows")}
              className="bg-white"
            >
              Back to Workflows
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="absolute top-[88px] left-0 right-0 bottom-0">
          <WorkflowCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            onNodeClick={handleNodeClick}
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
            }}
            onDeleteNode={onDeleteNode}
          />
        </div>
      </div>

      {/* Node Configuration Modal */}
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
                    updateSelectedNode({ label: e.target.value || undefined })
                  }
                  placeholder="Custom label (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="node-service" className="text-sm font-medium">
                  Service
                </Label>
                <select
                  id="node-service"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedNode.data.serviceId || ""}
                  onChange={(e) => {
                    updateSelectedNode({
                      serviceId: e.target.value,
                      actionId: undefined,
                      reactionId: undefined,
                      params: {},
                    });
                  }}
                >
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.name} value={service.name}>
                      {service.name}
                    </option>
                  ))}
                </select>
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
                    <select
                      id="node-action"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedNode.data.actionId || ""}
                      onChange={(e) => {
                        updateSelectedNode({
                          actionId: e.target.value,
                          params: {},
                        });
                      }}
                    >
                      <option value="">Select action</option>
                      {services
                        .find((s) => s.name === selectedNode.data.serviceId)
                        ?.actions.map((action) => (
                          <option key={action.name} value={action.name}>
                            {action.name}
                          </option>
                        ))}
                    </select>
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
                    <select
                      id="node-reaction"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedNode.data.reactionId || ""}
                      onChange={(e) => {
                        updateSelectedNode({
                          reactionId: e.target.value,
                          params: {},
                        });
                      }}
                    >
                      <option value="">Select reaction</option>
                      {services
                        .find((s) => s.name === selectedNode.data.serviceId)
                        ?.reactions.map((reaction) => (
                          <option key={reaction.name} value={reaction.name}>
                            {reaction.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

              {/* Parameters Section */}
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
                  {}) as Record<string, string>;
                const inputKeys = Object.keys(inputDefinition);

                if (inputKeys.length > 0) {
                  return (
                    <div className="space-y-3 pt-3 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700">
                        Parameters
                      </h4>
                      {inputKeys.map((key) => {
                        const type = (
                          inputDefinition[key] || "string"
                        ).toLowerCase();
                        const params = (selectedNode.data.params ||
                          {}) as Record<string, unknown>;
                        const value = params[key];

                        if (type === "boolean") {
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between py-2"
                            >
                              <Label
                                htmlFor={`param-${key}`}
                                className="text-sm font-medium"
                              >
                                {key}
                              </Label>
                              <input
                                id={`param-${key}`}
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(e) => {
                                  const newParams = {
                                    ...params,
                                    [key]: e.target.checked,
                                  };
                                  updateSelectedNode({ params: newParams });
                                }}
                                className="h-4 w-4"
                              />
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
                                {key}
                              </Label>
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
                                placeholder={`Enter ${key}`}
                              />
                            </div>
                          );
                        }

                        return (
                          <div key={key} className="space-y-1">
                            <Label
                              htmlFor={`param-${key}`}
                              className="text-sm font-medium"
                            >
                              {key}
                            </Label>
                            <Input
                              id={`param-${key}`}
                              value={String(value ?? "")}
                              onChange={(e) => {
                                const newParams = {
                                  ...params,
                                  [key]: e.target.value,
                                };
                                updateSelectedNode({ params: newParams });
                              }}
                              placeholder={`Enter ${key}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 justify-end">
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

      {/* Error/Success Messages */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg">
          Workflow saved successfully!
        </div>
      )}
    </div>
  );
}
