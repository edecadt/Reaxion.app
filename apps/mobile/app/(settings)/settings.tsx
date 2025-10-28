import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import type {
  AboutService,
  AboutServiceAuth,
  ServiceConnection,
} from "../../src/lib/api";
import {
  getAbout,
  getServiceConnections,
  connectWithApiKey,
  disconnectService,
  initiateOAuth2Connection,
} from "../../src/lib/api";
import { useToast } from "../../src/components/Toast";
import { useAuth } from "../../src/hooks/useAuth";

type ServiceWithConnection = AboutService & {
  connection?: ServiceConnection;
  isConnected: boolean;
};

export default function SettingsPage() {
  const toast = useToast();
  const { token } = useAuth();

  const [services, setServices] = useState<ServiceWithConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);

  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [selectedService, setSelectedService] =
    useState<ServiceWithConnection | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const loadData = useCallback(async (): Promise<
    ServiceWithConnection[] | null
  > => {
    if (!token) {
      setServices([]);
      setLoading(false);
      return null;
    }

    setLoading(true);

    try {
      const [aboutData, connections] = await Promise.all([
        getAbout(token),
        getServiceConnections(token),
      ]);

      const connectionsMap = new Map(
        connections.map((conn) => [conn.serviceId, conn]),
      );

      const servicesWithConnections: ServiceWithConnection[] =
        aboutData.server.services
          .filter((service) => {
            const auth = service.auth as AboutServiceAuth | undefined;
            if (!auth) return false;
            return auth.type !== "none";
          })
          .map((service) => {
            const serviceKey = service.id || service.name;
            const connection = connectionsMap.get(serviceKey);
            return {
              ...service,
              connection,
              isConnected: !!connection,
            };
          });

      setServices(servicesWithConnections);
      return servicesWithConnections;
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : "Failed to load services",
        "error",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const startOAuthConnection = useCallback(
    async (service: ServiceWithConnection) => {
      if (!token) {
        toast.show("Authentication required to connect services", "error");
        return;
      }

      const serviceId = service.id || service.name;
      setBusyServiceId(serviceId);

      try {
        const response = await initiateOAuth2Connection(serviceId, token);
        const authorizationUrl = response?.authorizationUrl;

        if (!authorizationUrl) {
          throw new Error("Missing authorization URL from server");
        }

        toast.show(
          `Complete the ${service.name} authorization in the browser, then return here.`,
          "info",
          3500,
        );

        const result = await WebBrowser.openBrowserAsync(authorizationUrl);

        const updatedServices = await loadData();
        const updatedService = updatedServices?.find(
          (item) => (item.id || item.name) === serviceId,
        );

        if (updatedService?.isConnected) {
          toast.show(`Connected to ${service.name}`, "success");
        } else if (result.type !== "cancel") {
          toast.show(
            `Unable to confirm ${service.name} connection. You can refresh or try again if needed.`,
            "info",
          );
        }
      } catch (error) {
        toast.show(
          error instanceof Error
            ? error.message
            : "Failed to start OAuth2 connection",
          "error",
        );
      } finally {
        setBusyServiceId(null);
      }
    },
    [token, loadData, toast],
  );

  const handleConnect = useCallback(
    (service: ServiceWithConnection) => {
      const auth = service.auth as AboutServiceAuth | undefined;
      if (!auth) return;

      if (auth.type === "api_key") {
        setSelectedService(service);
        setApiKeyInput("");
        setApiKeyModalVisible(true);
      } else if (auth.type === "oauth2") {
        void startOAuthConnection(service);
      }
    },
    [startOAuthConnection],
  );

  const handleApiKeySubmit = useCallback(async () => {
    if (!token || !selectedService || !apiKeyInput.trim()) {
      toast.show("Please enter an API key", "error");
      return;
    }

    const serviceId = selectedService.id || selectedService.name;
    setBusyServiceId(serviceId);

    try {
      await connectWithApiKey(serviceId, apiKeyInput.trim(), token);
      toast.show(
        `Successfully connected to ${selectedService.name}!`,
        "success",
      );
      setApiKeyModalVisible(false);
      setApiKeyInput("");
      setSelectedService(null);
      await loadData();
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : "Failed to connect service",
        "error",
      );
    } finally {
      setBusyServiceId(null);
    }
  }, [token, selectedService, apiKeyInput, loadData, toast]);

  const handleDisconnect = useCallback(
    async (service: ServiceWithConnection) => {
      if (!token) return;

      const serviceId = service.id || service.name;

      Alert.alert(
        "Disconnect Service",
        `Are you sure you want to disconnect ${service.name}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: async () => {
              setBusyServiceId(serviceId);
              try {
                await disconnectService(serviceId, token);
                toast.show(`Disconnected from ${service.name}`, "success");
                await loadData();
              } catch (error) {
                toast.show(
                  error instanceof Error
                    ? error.message
                    : "Failed to disconnect service",
                  "error",
                );
              } finally {
                setBusyServiceId(null);
              }
            },
          },
        ],
      );
    },
    [token, loadData, toast],
  );

  if (loading) {
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Service Connections</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No connectable services found</Text>
          </View>
        ) : (
          services.map((service) => {
            const serviceId = service.id || service.name;
            const isBusy = busyServiceId === serviceId;
            const auth = service.auth as AboutServiceAuth | undefined;

            return (
              <View key={serviceId} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    {auth && (
                      <Text style={styles.authType}>
                        {auth.type === "api_key" ? "API Key" : "OAuth2"}
                      </Text>
                    )}
                    {auth?.type === "api_key" && auth.description && (
                      <Text style={styles.authDescription}>
                        {auth.description}
                      </Text>
                    )}
                  </View>
                  {service.isConnected ? (
                    <View style={styles.connectedBadge}>
                      <Feather name="check-circle" size={16} color="#10b981" />
                      <Text style={styles.connectedText}>Connected</Text>
                    </View>
                  ) : (
                    <View style={styles.disconnectedBadge}>
                      <Feather name="x-circle" size={16} color="#6b7280" />
                      <Text style={styles.disconnectedText}>Not connected</Text>
                    </View>
                  )}
                </View>

                <View style={styles.serviceActions}>
                  {service.isConnected ? (
                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.disconnectButton,
                        isBusy && styles.disabledButton,
                      ]}
                      onPress={() => handleDisconnect(service)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <>
                          <Feather name="log-out" size={16} color="#ef4444" />
                          <Text style={styles.disconnectButtonText}>
                            Disconnect
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.actionButton,
                        styles.connectButton,
                        isBusy && styles.disabledButton,
                      ]}
                      onPress={() => handleConnect(service)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="log-in" size={16} color="#fff" />
                          <Text style={styles.connectButtonText}>Connect</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={apiKeyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setApiKeyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Connect {selectedService?.name}
              </Text>
              <Pressable
                onPress={() => {
                  setApiKeyModalVisible(false);
                  setApiKeyInput("");
                }}
              >
                <Feather name="x" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              {selectedService?.auth &&
                (selectedService.auth as AboutServiceAuth).type === "api_key" &&
                (selectedService.auth as AboutServiceAuth).description && (
                  <Text style={styles.modalDescription}>
                    {(selectedService.auth as AboutServiceAuth).description}
                  </Text>
                )}

              <Text style={styles.inputLabel}>API Key</Text>
              <TextInput
                style={styles.apiKeyInput}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder="Enter your API key"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable
                style={[
                  styles.submitButton,
                  (!apiKeyInput.trim() || busyServiceId) &&
                    styles.disabledButton,
                ]}
                onPress={handleApiKeySubmit}
                disabled={!apiKeyInput.trim() || !!busyServiceId}
              >
                {busyServiceId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Connect</Text>
                )}
              </Pressable>
            </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  scrollView: {
    flex: 1,
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
  serviceCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  authType: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  authDescription: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#d1fae5",
    borderRadius: 4,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#10b981",
  },
  disconnectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
  },
  disconnectedText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
  },
  serviceActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  connectButton: {
    backgroundColor: "#8b5cf6",
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  disconnectButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    maxHeight: "80%",
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
  modalBody: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  apiKeyInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: "#8b5cf6",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
