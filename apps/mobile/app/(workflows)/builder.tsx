import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import type { AboutService } from "../../src/lib/api";
import { createWorkflow, getAbout } from "../../src/lib/api";
import { useToast } from "../../src/components/Toast";
import { useAuth } from "../../src/hooks/useAuth";

type Node = {
  id: string;
  type: "action" | "reaction";
  data: {
    label?: string;
    serviceId: string;
    actionId?: string;
    reactionId?: string;
    params: Record<string, unknown>;
    next?: string[];
  };
};

type PickerMode = "service" | "action" | "reaction" | "next" | null;

export default function MobileWorkflowBuilder() {
  const toast = useToast();
  const { token } = useAuth();

  const [workflowName, setWorkflowName] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [services, setServices] = useState<AboutService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerNodeId, setPickerNodeId] = useState<string | null>(null);

  useEffect(() => {
    const loadServices = async () => {
      setLoadingServices(true);
      try {
        const about = await getAbout(token ?? undefined);
        setServices(about.server.services);
      } catch (error) {
        toast.show(
          error instanceof Error ? error.message : "Failed to load services",
          "error",
        );
      } finally {
        setLoadingServices(false);
      }
    };
    void loadServices();
  }, [token]);

  const handleAddNode = useCallback((type: "action" | "reaction") => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      data: {
        label: type === "action" ? "New Trigger" : "New Action",
        serviceId: "",
        actionId: type === "action" ? "" : undefined,
        reactionId: type === "reaction" ? "" : undefined,
        params: {},
        next: [],
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setExpandedNode(newNode.id);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setExpandedNode(null);
  }, []);

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<Node["data"]>) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node,
        ),
      );
    },
    [],
  );

  const handleUpdateConnections = useCallback(
    (nodeId: string, nextIds: string[]) => {
      handleUpdateNode(nodeId, { next: nextIds });
    },
    [handleUpdateNode],
  );

  const openPicker = (mode: PickerMode, nodeId: string) => {
    setPickerMode(mode);
    setPickerNodeId(nodeId);
    setPickerVisible(true);
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerMode(null);
    setPickerNodeId(null);
  };

  const handleSave = async () => {
    if (!workflowName.trim()) {
      toast.show("Please enter a workflow name", "error");
      return;
    }

    if (nodes.length === 0) {
      toast.show("Please add at least one node", "error");
      return;
    }

    for (const node of nodes) {
      if (!node.data.serviceId) {
        toast.show(
          `Node "${node.data.label || node.id}" needs a service`,
          "error",
        );
        return;
      }
      if (!node.data.actionId && !node.data.reactionId) {
        toast.show(
          `Node "${node.data.label || node.id}" needs an action or reaction`,
          "error",
        );
        return;
      }
    }

    setSaving(true);
    try {
      const workflow = {
        id: `workflow-${Date.now()}`,
        name: workflowName,
        active: false,
        nodes: nodes.map((node) => {
          const mappedNode: any = {
            id: node.id,
            serviceId: node.data.serviceId,
            params: node.data.params || {},
          };

          if (node.data.actionId) {
            mappedNode.actionId = node.data.actionId;
          }
          if (node.data.reactionId) {
            mappedNode.reactionId = node.data.reactionId;
          }

          if (node.data.next && node.data.next.length > 0) {
            mappedNode.next =
              node.data.next.length === 1 ? node.data.next[0] : node.data.next;
          }

          return mappedNode;
        }),
      };

      await createWorkflow(workflow, token!);
      toast.show("Workflow created successfully!", "success");
      router.back();
    } catch (error) {
      console.error("Save error:", error);
      toast.show(
        error instanceof Error ? error.message : "Failed to save workflow",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const isAction = (node: Node) =>
    node.type === "action" || !!node.data.actionId;

  const getServiceForNode = (node: Node) => {
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

  const renderPickerContent = () => {
    if (!pickerNodeId || !pickerMode) return null;

    const node = nodes.find((n) => n.id === pickerNodeId);
    if (!node) return null;

    if (pickerMode === "service") {
      return (
        <ScrollView style={styles.pickerScroll}>
          {services.map((service) => (
            <Pressable
              key={service.name}
              style={[
                styles.pickerOption,
                node.data.serviceId === service.name &&
                  styles.pickerOptionSelected,
              ]}
              onPress={() => {
                handleUpdateNode(node.id, {
                  serviceId: service.name,
                  actionId: undefined,
                  reactionId: undefined,
                  params: {},
                });
                closePicker();
              }}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  node.data.serviceId === service.name &&
                    styles.pickerOptionTextSelected,
                ]}
              >
                {service.name}
              </Text>
              {node.data.serviceId === service.name && (
                <Feather name="check" size={20} color="#8b5cf6" />
              )}
            </Pressable>
          ))}
        </ScrollView>
      );
    }

    if (pickerMode === "action" || pickerMode === "reaction") {
      const items =
        pickerMode === "action"
          ? getActionsForService(node.data.serviceId)
          : getReactionsForService(node.data.serviceId);

      return (
        <ScrollView style={styles.pickerScroll}>
          {items.map((item) => {
            const isSelected =
              pickerMode === "action"
                ? node.data.actionId === item.name
                : node.data.reactionId === item.name;

            return (
              <Pressable
                key={item.name}
                style={[
                  styles.pickerOption,
                  isSelected && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  handleUpdateNode(node.id, {
                    [pickerMode === "action" ? "actionId" : "reactionId"]:
                      item.name,
                    params: {},
                  });
                  closePicker();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.pickerOptionText,
                      isSelected && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.description && (
                    <Text style={styles.pickerOptionDescription}>
                      {item.description}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Feather name="check" size={20} color="#8b5cf6" />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      );
    }

    if (pickerMode === "next") {
      const availableNodes = nodes.filter(
        (n) => n.id !== node.id && !isAction(n),
      );
      const currentNext = node.data.next || [];

      return (
        <ScrollView style={styles.pickerScroll}>
          {availableNodes.length === 0 ? (
            <Text style={styles.emptyPickerText}>
              No actions available. Add action nodes first.
            </Text>
          ) : (
            availableNodes.map((targetNode) => {
              const isSelected = currentNext.includes(targetNode.id);

              return (
                <Pressable
                  key={targetNode.id}
                  style={[
                    styles.pickerOption,
                    isSelected && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    const newNext = isSelected
                      ? currentNext.filter((id) => id !== targetNode.id)
                      : [...currentNext, targetNode.id];
                    handleUpdateConnections(node.id, newNext);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {targetNode.data.label || "New Action"}
                    </Text>
                    <Text style={styles.pickerOptionDescription}>
                      {targetNode.data.serviceId || "No service"}
                    </Text>
                  </View>
                  {isSelected && (
                    <Feather name="check" size={20} color="#8b5cf6" />
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      );
    }

    return null;
  };

  if (loadingServices) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TextInput
            style={styles.nameInput}
            value={workflowName}
            onChangeText={setWorkflowName}
            placeholder="Workflow name"
            placeholderTextColor="#9ca3af"
          />
          <Pressable
            style={[
              styles.saveButton,
              (!workflowName.trim() || nodes.length === 0 || saving) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!workflowName.trim() || nodes.length === 0 || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {nodes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No nodes yet. Add a trigger to get started.
            </Text>
          </View>
        ) : (
          nodes.map((node, index) => {
            const service = getServiceForNode(node);
            const nodeIsAction = isAction(node);
            const isExpanded = expandedNode === node.id;

            const actionOrReaction = nodeIsAction
              ? service?.actions.find((a) => a.name === node.data.actionId)
              : service?.reactions.find((r) => r.name === node.data.reactionId);

            const inputDefinition = (actionOrReaction?.input || {}) as Record<
              string,
              string
            >;
            const inputKeys = Object.keys(inputDefinition);

            return (
              <Pressable
                key={node.id}
                style={[
                  styles.nodeCard,
                  nodeIsAction
                    ? styles.nodeCardAction
                    : styles.nodeCardReaction,
                ]}
                onPress={() => setExpandedNode(isExpanded ? null : node.id)}
              >
                <View style={styles.nodeHeader}>
                  <View
                    style={[
                      styles.nodeIcon,
                      nodeIsAction
                        ? styles.nodeIconAction
                        : styles.nodeIconReaction,
                    ]}
                  >
                    <Feather
                      name={nodeIsAction ? "zap" : "play-circle"}
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.nodeInfo}>
                    <Text style={styles.nodeType}>
                      {nodeIsAction ? "Trigger" : "Action"} #{index + 1}
                    </Text>
                    <Text style={styles.nodeLabel}>
                      {node.data.label ||
                        (nodeIsAction ? "New Trigger" : "New Action")}
                    </Text>
                    {service && (
                      <Text style={styles.nodeService}>{service.name}</Text>
                    )}
                  </View>
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9ca3af"
                  />
                </View>

                {isExpanded && (
                  <View style={styles.nodeContent}>
                    <View style={styles.field}>
                      <Text style={styles.label}>Label</Text>
                      <TextInput
                        style={styles.input}
                        value={node.data.label || ""}
                        onChangeText={(text) =>
                          handleUpdateNode(node.id, {
                            label: text || undefined,
                          })
                        }
                        placeholder="Custom label (optional)"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Service</Text>
                      <Pressable
                        style={styles.selectButton}
                        onPress={() => openPicker("service", node.id)}
                      >
                        <Text
                          style={[
                            styles.selectButtonText,
                            !node.data.serviceId &&
                              styles.selectButtonTextPlaceholder,
                          ]}
                        >
                          {node.data.serviceId || "Select service"}
                        </Text>
                        <Feather
                          name="chevron-down"
                          size={20}
                          color="#6b7280"
                        />
                      </Pressable>
                    </View>

                    {node.data.serviceId && (
                      <View style={styles.field}>
                        <Text style={styles.label}>
                          {nodeIsAction ? "Action" : "Reaction"}
                        </Text>
                        <Pressable
                          style={styles.selectButton}
                          onPress={() =>
                            openPicker(
                              nodeIsAction ? "action" : "reaction",
                              node.id,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.selectButtonText,
                              !(nodeIsAction
                                ? node.data.actionId
                                : node.data.reactionId) &&
                                styles.selectButtonTextPlaceholder,
                            ]}
                          >
                            {(nodeIsAction
                              ? node.data.actionId
                              : node.data.reactionId) ||
                              `Select ${nodeIsAction ? "action" : "reaction"}`}
                          </Text>
                          <Feather
                            name="chevron-down"
                            size={20}
                            color="#6b7280"
                          />
                        </Pressable>
                      </View>
                    )}

                    {node.data.serviceId &&
                      (node.data.actionId || node.data.reactionId) && (
                        <View style={styles.parametersSection}>
                          <Text style={styles.sectionTitle}>Parameters</Text>
                          {inputKeys.length === 0 ? (
                            <Text style={styles.noParamsText}>
                              No parameters required
                            </Text>
                          ) : (
                            inputKeys.map((key) => {
                              const type = (
                                inputDefinition[key] || "string"
                              ).toLowerCase();
                              const params = node.data.params || {};
                              const value = params[key];

                              if (type === "boolean") {
                                return (
                                  <View key={key} style={styles.paramRow}>
                                    <Text style={styles.paramLabel}>{key}</Text>
                                    <Switch
                                      value={Boolean(value)}
                                      onValueChange={(val) => {
                                        handleUpdateNode(node.id, {
                                          params: { ...params, [key]: val },
                                        });
                                      }}
                                      trackColor={{
                                        false: "#d1d5db",
                                        true: "#8b5cf6",
                                      }}
                                      thumbColor="#fff"
                                    />
                                  </View>
                                );
                              }

                              return (
                                <View key={key} style={styles.field}>
                                  <Text style={styles.paramLabel}>{key}</Text>
                                  <TextInput
                                    style={styles.input}
                                    value={String(value ?? "")}
                                    onChangeText={(text) => {
                                      handleUpdateNode(node.id, {
                                        params: {
                                          ...params,
                                          [key]:
                                            type === "number" ? text : text,
                                        },
                                      });
                                    }}
                                    placeholder={`Enter ${key}`}
                                    placeholderTextColor="#9ca3af"
                                    keyboardType={
                                      type === "number" ? "numeric" : "default"
                                    }
                                  />
                                </View>
                              );
                            })
                          )}
                        </View>
                      )}

                    <View style={styles.parametersSection}>
                      <Text style={styles.sectionTitle}>
                        Next Nodes (What happens after?)
                      </Text>
                      <Pressable
                        style={styles.selectButton}
                        onPress={() => openPicker("next", node.id)}
                      >
                        <Text style={styles.selectButtonText}>
                          {node.data.next && node.data.next.length > 0
                            ? `${node.data.next.length} node(s) selected`
                            : "Select next nodes"}
                        </Text>
                        <Feather
                          name="chevron-down"
                          size={20}
                          color="#6b7280"
                        />
                      </Pressable>
                    </View>

                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => handleDeleteNode(node.id)}
                    >
                      <Feather name="trash-2" size={16} color="#ef4444" />
                      <Text style={styles.deleteButtonText}>Delete Node</Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.addButton, styles.addButtonAction]}
          onPress={() => handleAddNode("action")}
        >
          <Feather name="zap" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Trigger</Text>
        </Pressable>
        <Pressable
          style={[styles.addButton, styles.addButtonReaction]}
          onPress={() => handleAddNode("reaction")}
        >
          <Feather name="play-circle" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Action</Text>
        </Pressable>
      </View>

      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerMode === "service" && "Select Service"}
                {pickerMode === "action" && "Select Action"}
                {pickerMode === "reaction" && "Select Reaction"}
                {pickerMode === "next" && "Select Next Nodes"}
              </Text>
              <Pressable onPress={closePicker}>
                <Feather name="x" size={24} color="#6b7280" />
              </Pressable>
            </View>
            {renderPickerContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  saveButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 70,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  nameInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
  },
  nodeCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  nodeCardAction: {
    borderColor: "#8b5cf6",
  },
  nodeCardReaction: {
    borderColor: "#10b981",
  },
  nodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  nodeIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  nodeIconAction: {
    backgroundColor: "#8b5cf6",
  },
  nodeIconReaction: {
    backgroundColor: "#10b981",
  },
  nodeInfo: {
    flex: 1,
  },
  nodeType: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  nodeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  nodeService: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  nodeContent: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    padding: 16,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: "#111827",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 12,
  },
  selectButtonText: {
    fontSize: 14,
    color: "#111827",
  },
  selectButtonTextPlaceholder: {
    color: "#9ca3af",
  },
  parametersSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  noParamsText: {
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
  },
  paramRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  paramLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 6,
    backgroundColor: "#fef2f2",
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fff",
    padding: 16,
    gap: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 6,
  },
  addButtonAction: {
    backgroundColor: "#8b5cf6",
  },
  addButtonReaction: {
    backgroundColor: "#10b981",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  pickerScroll: {
    maxHeight: 500,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerOptionSelected: {
    backgroundColor: "#f3e8ff",
  },
  pickerOptionText: {
    fontSize: 16,
    color: "#111827",
  },
  pickerOptionTextSelected: {
    color: "#8b5cf6",
    fontWeight: "600",
  },
  pickerOptionDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  emptyPickerText: {
    padding: 24,
    textAlign: "center",
    fontSize: 14,
    color: "#6b7280",
    fontStyle: "italic",
  },
});
