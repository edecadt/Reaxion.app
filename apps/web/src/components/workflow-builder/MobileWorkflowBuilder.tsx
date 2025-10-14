"use client";

import { useState } from "react";
import type { Node as FlowNode } from "reactflow";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { AboutService } from "../../lib/api";

type MobileWorkflowBuilderProps = {
  nodes: FlowNode[];
  services: AboutService[];
  onNodesChange: (nodes: FlowNode[]) => void;
  onAddNode: (type: "action" | "reaction") => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<FlowNode["data"]>) => void;
  onUpdateNodeConnections: (nodeId: string, nextNodeIds: string[]) => void;
};

export function MobileWorkflowBuilder({
  nodes,
  services,
  onNodesChange,
  onAddNode,
  onDeleteNode,
  onUpdateNode,
  onUpdateNodeConnections,
}: MobileWorkflowBuilderProps) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const getServiceForNode = (node: FlowNode) => {
    return services.find((s) => s.name === node.data.serviceId);
  };

  const getActionsForService = (serviceId: string) => {
    const service = services.find((s) => s.name === serviceId);
    return service?.actions || [];
  };

  const getReactionsForService = (serviceId: string) => {
    const service = services.find((s) => s.name === serviceId);
    return service?.reactions || [];
  };

  const isAction = (node: FlowNode) =>
    node.type === "action" || !!node.data.actionId;

  const moveNodeUp = (index: number) => {
    if (index === 0) return;
    const newNodes = [...nodes];
    const temp = newNodes[index - 1];
    if (temp && newNodes[index]) {
      newNodes[index - 1] = newNodes[index];
      newNodes[index] = temp;
      onNodesChange(newNodes);
    }
  };

  const moveNodeDown = (index: number) => {
    if (index === nodes.length - 1) return;
    const newNodes = [...nodes];
    const temp = newNodes[index + 1];
    if (temp && newNodes[index]) {
      newNodes[index + 1] = newNodes[index];
      newNodes[index] = temp;
      onNodesChange(newNodes);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {nodes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              Aucun noeud. Commencez par ajouter un trigger.
            </p>
          </div>
        ) : (
          nodes.map((node, index) => {
            const service = getServiceForNode(node);
            const nodeIsAction = isAction(node);
            const isExpanded = expandedNode === node.id;

            return (
              <div
                key={node.id}
                className={`bg-white rounded-lg border-2 shadow-sm ${
                  nodeIsAction ? "border-violet-500" : "border-emerald-500"
                }`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedNode(isExpanded ? null : node.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          nodeIsAction
                            ? "bg-gradient-to-br from-violet-500 to-purple-600"
                            : "bg-gradient-to-br from-emerald-500 to-teal-600"
                        }`}
                      >
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {nodeIsAction ? (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          ) : (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          )}
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-500 uppercase">
                          {nodeIsAction ? "Trigger" : "Action"} #{index + 1}
                        </div>
                        <div className="text-sm font-bold text-gray-900 truncate">
                          {node.data.label ||
                            (nodeIsAction ? "New Trigger" : "New Action")}
                        </div>
                        {service && (
                          <div className="text-xs text-gray-600 truncate">
                            {service.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor={`label-${node.id}`}
                        className="text-sm font-medium"
                      >
                        Label
                      </Label>
                      <Input
                        id={`label-${node.id}`}
                        value={node.data.label || ""}
                        onChange={(e) =>
                          onUpdateNode(node.id, {
                            label: e.target.value || undefined,
                          })
                        }
                        placeholder="Custom label (optional)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor={`service-${node.id}`}
                        className="text-sm font-medium"
                      >
                        Service
                      </Label>
                      <select
                        id={`service-${node.id}`}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={node.data.serviceId || ""}
                        onChange={(e) =>
                          onUpdateNode(node.id, {
                            serviceId: e.target.value,
                            actionId: undefined,
                            reactionId: undefined,
                            params: {},
                          })
                        }
                      >
                        <option value="">Select service</option>
                        {services
                          .filter((service) =>
                            nodeIsAction
                              ? service.actions.length > 0
                              : service.reactions.length > 0,
                          )
                          .map((service) => (
                            <option key={service.name} value={service.name}>
                              {service.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {node.data.serviceId && (
                      <div className="space-y-2">
                        <Label
                          htmlFor={`action-${node.id}`}
                          className="text-sm font-medium"
                        >
                          {nodeIsAction ? "Action" : "Reaction"}
                        </Label>
                        <select
                          id={`action-${node.id}`}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={
                            nodeIsAction
                              ? node.data.actionId || ""
                              : node.data.reactionId || ""
                          }
                          onChange={(e) =>
                            onUpdateNode(node.id, {
                              [nodeIsAction ? "actionId" : "reactionId"]:
                                e.target.value,
                              params: {},
                            })
                          }
                        >
                          <option value="">
                            Select {nodeIsAction ? "action" : "reaction"}
                          </option>
                          {(nodeIsAction
                            ? getActionsForService(node.data.serviceId)
                            : getReactionsForService(node.data.serviceId)
                          ).map((item) => (
                            <option key={item.name} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {node.data.serviceId &&
                      (node.data.actionId || node.data.reactionId) && (
                        <div className="space-y-3 pt-2 border-t border-gray-200 mt-4">
                          <div className="text-sm font-medium text-gray-700">
                            Parameters
                          </div>
                          {(() => {
                            const service = getServiceForNode(node);
                            const actionOrReaction = nodeIsAction
                              ? service?.actions.find(
                                  (a) => a.name === node.data.actionId,
                                )
                              : service?.reactions.find(
                                  (r) => r.name === node.data.reactionId,
                                );

                            const inputDefinition = (actionOrReaction?.input ||
                              {}) as Record<string, string>;
                            const inputKeys = Object.keys(inputDefinition);

                            if (inputKeys.length === 0) {
                              return (
                                <div className="text-sm text-gray-500 italic">
                                  No parameters required
                                </div>
                              );
                            }

                            return inputKeys.map((key) => {
                              const type = (
                                inputDefinition[key] || "string"
                              ).toLowerCase();
                              const params = (node.data.params || {}) as Record<
                                string,
                                unknown
                              >;
                              const value = params[key];

                              if (type === "boolean") {
                                return (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between py-2"
                                  >
                                    <Label
                                      htmlFor={`param-${node.id}-${key}`}
                                      className="text-xs font-medium"
                                    >
                                      {key}
                                    </Label>
                                    <input
                                      id={`param-${node.id}-${key}`}
                                      type="checkbox"
                                      checked={Boolean(value)}
                                      onChange={(e) => {
                                        const newParams = {
                                          ...params,
                                          [key]: e.target.checked,
                                        };
                                        onUpdateNode(node.id, {
                                          params: newParams,
                                        });
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
                                      htmlFor={`param-${node.id}-${key}`}
                                      className="text-xs font-medium"
                                    >
                                      {key}
                                    </Label>
                                    <Input
                                      id={`param-${node.id}-${key}`}
                                      type="number"
                                      value={String(value ?? "")}
                                      onChange={(e) => {
                                        const newParams = {
                                          ...params,
                                          [key]: e.target.value,
                                        };
                                        onUpdateNode(node.id, {
                                          params: newParams,
                                        });
                                      }}
                                      placeholder={`Enter ${key}`}
                                      className="text-sm"
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div key={key} className="space-y-1">
                                  <Label
                                    htmlFor={`param-${node.id}-${key}`}
                                    className="text-xs font-medium"
                                  >
                                    {key}
                                  </Label>
                                  <Input
                                    id={`param-${node.id}-${key}`}
                                    type="text"
                                    value={String(value ?? "")}
                                    onChange={(e) => {
                                      const newParams = {
                                        ...params,
                                        [key]: e.target.value,
                                      };
                                      onUpdateNode(node.id, {
                                        params: newParams,
                                      });
                                    }}
                                    placeholder={`Enter ${key}`}
                                    className="text-sm"
                                  />
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}

                    <div className="space-y-3 pt-2 border-t border-gray-200 mt-4">
                      <div className="text-sm font-medium text-gray-700">
                        Next Nodes (What happens after this node?)
                      </div>
                      <div className="space-y-2">
                        {nodes
                          .filter((n) => n.id !== node.id && !isAction(n))
                          .map((targetNode) => {
                            const isConnected =
                              node.data.next?.includes(targetNode.id) || false;
                            return (
                              <label
                                key={targetNode.id}
                                className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isConnected}
                                  onChange={(e) => {
                                    const currentNext = Array.isArray(
                                      node.data.next,
                                    )
                                      ? node.data.next
                                      : node.data.next
                                        ? [node.data.next]
                                        : [];

                                    let newNext: string[];
                                    if (e.target.checked) {
                                      newNext = [...currentNext, targetNode.id];
                                    } else {
                                      newNext = currentNext.filter(
                                        (id: string) => id !== targetNode.id,
                                      );
                                    }

                                    onUpdateNodeConnections(node.id, newNext);
                                  }}
                                  className="h-4 w-4"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium">
                                    {targetNode.data.label ||
                                      (isAction(targetNode)
                                        ? "New Trigger"
                                        : "New Action")}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {targetNode.data.serviceId || "No service"}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        {nodes.filter((n) => n.id !== node.id && !isAction(n))
                          .length === 0 && (
                          <div className="text-sm text-gray-500 italic">
                            No actions available. Add action nodes to create
                            connections.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveNodeUp(index)}
                        disabled={index === 0}
                        className="flex-1"
                      >
                        ↑ Move Up
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveNodeDown(index)}
                        disabled={index === nodes.length - 1}
                        className="flex-1"
                      >
                        ↓ Move Down
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDeleteNode(node.id)}
                        className="flex-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-200 bg-white p-4 space-y-2">
        <Button
          onClick={() => onAddNode("action")}
          className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
        >
          <svg
            className="w-5 h-5 mr-2"
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
          Add Trigger
        </Button>
        <Button
          onClick={() => onAddNode("reaction")}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Add Action
        </Button>
      </div>
    </div>
  );
}
