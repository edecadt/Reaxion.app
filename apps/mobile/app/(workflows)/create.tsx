import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
  Pressable,
} from "react-native";
import { useWorkflowBuilder } from "./builder/use-workflow-builder";
import { getAbout, type AboutService } from "../lib/api";

export default function CreateWorkflowScreen() {
  const { state, actions } = useWorkflowBuilder();

  useEffect(() => {
    return () => {
      actions.reset();
    };
  }, [actions]);

  useEffect(() => {
    if (!state.id) {
      const id = uuidv4();
      actions.setMeta({ id });
    }
  }, [state.id, actions]);

  const isNameValid = useMemo(() => state.name.trim().length > 0, [state.name]);

  const [services, setServices] = useState<AboutService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setServicesError(null);
    try {
      const about = await getAbout();
      setServices(about.server.services);
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Créer un workflow</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Nom</Text>
        <TextInput
          value={state.name}
          onChangeText={(t) => actions.setMeta({ name: t })}
          placeholder="Mon workflow"
          style={[styles.input, !isNameValid && styles.inputError]}
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="done"
        />
        {!isNameValid && (
          <Text style={styles.errorText}>Le nom est obligatoire</Text>
        )}
      </View>

      <View style={styles.formGroupRow}>
        <Text style={styles.label}>Actif</Text>
        <Switch
          value={state.active}
          onValueChange={(v) => actions.setMeta({ active: v })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Identifiant</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyText}>{state.id}</Text>
        </View>
      </View>

      <Pressable
        disabled={!isNameValid}
        style={[styles.primaryButton, !isNameValid && styles.buttonDisabled]}
        onPress={() => {}}
      >
        <Text style={styles.primaryButtonText}>Suivant</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Services</Text>
        {loadingServices ? (
          <Text style={styles.cardText}>Chargement…</Text>
        ) : servicesError ? (
          <View style={{ gap: 8 }}>
            <Text style={[styles.cardText, { color: "#b91c1c" }]}>
              {servicesError}
            </Text>
            <Pressable style={styles.secondaryButton} onPress={loadServices}>
              <Text style={styles.secondaryButtonText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {services.map((s) => (
              <View key={s.name} style={styles.serviceItem}>
                <Text style={styles.serviceName}>{s.name}</Text>
                <Text style={styles.serviceMeta}>
                  {s.actions.length} actions • {s.reactions.length} réactions
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={styles.cardTitle}>Nœuds</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => actions.addNode()}
          >
            <Text style={styles.secondaryButtonText}>Ajouter un nœud</Text>
          </Pressable>
        </View>
        <View style={styles.nodesList}>
          {state.nodes.length === 0 ? (
            <Text style={styles.cardText}>Aucun nœud</Text>
          ) : (
            state.nodes.map((n) => {
              const selectedService = services.find(
                (s) => toId(s.name) === (n.serviceId || ""),
              );
              const actionsList = selectedService?.actions ?? [];
              const reactionsList = selectedService?.reactions ?? [];
              const typeBadge = n.actionId
                ? "Trigger"
                : n.reactionId
                  ? "Réaction"
                  : null;

              return (
                <View key={n.id} style={{ gap: 8 }}>
                  <View style={styles.nodeItem}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.nodeTitle}>{n.id}</Text>
                        {typeBadge && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{typeBadge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.nodeMeta}>
                        {n.serviceId || "(service non défini)"}
                        {n.actionId
                          ? ` • action:${n.actionId}`
                          : n.reactionId
                            ? ` • reaction:${n.reactionId}`
                            : ""}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.dangerButton}
                      onPress={() => actions.removeNode(n.id)}
                    >
                      <Text style={styles.dangerButtonText}>Supprimer</Text>
                    </Pressable>
                  </View>

                  <View>
                    <Text style={styles.label}>Service</Text>
                    <View style={styles.chipRow}>
                      {services.map((s) => {
                        const id = toId(s.name);
                        const active = id === n.serviceId;
                        return (
                          <Pressable
                            key={s.name}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() =>
                              actions.updateNode(n.id, {
                                serviceId: id,
                                actionId: undefined,
                                reactionId: undefined,
                                params: {},
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.chipText,
                                active && styles.chipTextActive,
                              ]}
                            >
                              {s.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {selectedService && (
                    <View style={{ gap: 8 }}>
                      <View>
                        <Text style={styles.label}>Triggers</Text>
                        <View style={styles.chipRow}>
                          {actionsList.map((a) => {
                            const aid = knownActionIdFor(
                              n.serviceId || "",
                              a.name,
                            );
                            const active = n.actionId === aid;
                            return (
                              <Pressable
                                key={a.name}
                                style={[
                                  styles.chip,
                                  active && styles.chipActive,
                                ]}
                                onPress={() =>
                                  actions.updateNode(n.id, {
                                    actionId: aid,
                                    reactionId: undefined,
                                    params: {},
                                  })
                                }
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    active && styles.chipTextActive,
                                  ]}
                                >
                                  {a.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <View>
                        <Text style={styles.label}>Réactions</Text>
                        <View style={styles.chipRow}>
                          {reactionsList.map((r) => {
                            const rid = knownReactionIdFor(
                              n.serviceId || "",
                              r.name,
                            );
                            const active = n.reactionId === rid;
                            return (
                              <Pressable
                                key={r.name}
                                style={[
                                  styles.chip,
                                  active && styles.chipActive,
                                ]}
                                onPress={() =>
                                  actions.updateNode(n.id, {
                                    reactionId: rid,
                                    actionId: undefined,
                                    params: {},
                                  })
                                }
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    active && styles.chipTextActive,
                                  ]}
                                >
                                  {r.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Text style={styles.label}>Paramètres</Text>
                        {n.serviceId === "timer" && n.actionId === "cron" && (
                          <View style={{ gap: 4 }}>
                            <TextInput
                              value={String(
                                (n.params?.expression as string) ?? "",
                              )}
                              onChangeText={(t) =>
                                actions.setNodeParams(n.id, {
                                  ...n.params,
                                  expression: t,
                                })
                              }
                              placeholder="*/20 * * * * *"
                              style={styles.input}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                            <Text style={styles.cardText}>
                              Format: ss mm HH DD MM JJ
                            </Text>
                            {(() => {
                              const expr = String(
                                (n.params?.expression as string) ?? "",
                              ).trim();
                              const valid =
                                expr.length > 0 &&
                                expr.split(/\s+/).length === 6;
                              return !valid ? (
                                <Text style={styles.errorText}>
                                  Expression cron à 6 champs requise
                                </Text>
                              ) : null;
                            })()}
                          </View>
                        )}
                        {n.serviceId === "timer" && n.reactionId === "log" && (
                          <View style={{ gap: 8 }}>
                            <View style={{ gap: 4 }}>
                              <Text style={styles.label}>Message</Text>
                              <TextInput
                                value={String(
                                  (n.params?.message as string) ?? "",
                                )}
                                onChangeText={(t) =>
                                  actions.setNodeParams(n.id, {
                                    ...n.params,
                                    message: t,
                                  })
                                }
                                placeholder="Votre message"
                                style={styles.input}
                              />
                              {(() => {
                                const msg = String(
                                  (n.params?.message as string) ?? "",
                                ).trim();
                                return msg.length === 0 ? (
                                  <Text style={styles.errorText}>
                                    Message requis
                                  </Text>
                                ) : null;
                              })()}
                            </View>
                            <View style={{ gap: 4 }}>
                              <Text style={styles.label}>Niveau</Text>
                              <View style={styles.chipRow}>
                                {["info", "warn", "error"].map((lvl) => {
                                  const active =
                                    (n.params?.level as string) === lvl;
                                  return (
                                    <Pressable
                                      key={lvl}
                                      style={[
                                        styles.chip,
                                        active && styles.chipActive,
                                      ]}
                                      onPress={() =>
                                        actions.setNodeParams(n.id, {
                                          ...n.params,
                                          level: lvl,
                                        })
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.chipText,
                                          active && styles.chipTextActive,
                                        ]}
                                      >
                                        {lvl}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                              {(() => {
                                const lvl = String(
                                  (n.params?.level as string) ?? "",
                                );
                                const ok = ["info", "warn", "error"].includes(
                                  lvl,
                                );
                                return !ok ? (
                                  <Text style={styles.errorText}>
                                    Niveau invalide (info, warn, error)
                                  </Text>
                                ) : null;
                              })()}
                            </View>
                          </View>
                        )}
                        {n.serviceId === "timer" && n.reactionId === "wait" && (
                          <View style={{ gap: 4 }}>
                            <Text style={styles.label}>Secondes</Text>
                            <TextInput
                              value={String(
                                (n.params?.seconds as
                                  | number
                                  | string
                                  | undefined) ?? "0",
                              )}
                              onChangeText={(t) =>
                                actions.setNodeParams(n.id, {
                                  ...n.params,
                                  seconds: t.replace(/[^0-9]/g, ""),
                                })
                              }
                              keyboardType="numeric"
                              style={styles.input}
                            />
                            {(() => {
                              const raw = String(
                                (n.params?.seconds as any) ?? "0",
                              );
                              const num = Number(raw);
                              const ok = Number.isFinite(num) && num >= 0;
                              return !ok ? (
                                <Text style={styles.errorText}>
                                  Entrez un nombre ≥ 0
                                </Text>
                              ) : null;
                            })()}
                          </View>
                        )}
                        {n.serviceId === "test-webhook" &&
                          n.actionId === "on-test-webhook" && (
                            <Text style={styles.cardText}>
                              Aucun paramètre requis
                            </Text>
                          )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  formGroup: {
    width: "100%",
    maxWidth: 520,
    gap: 6,
  },
  formGroupRow: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
    color: "#374151",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
  },
  readonlyField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
  },
  readonlyText: {
    fontSize: 16,
    color: "#374151",
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    padding: 16,
    backgroundColor: "#fafafa",
    marginTop: 8,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  cardText: {
    fontSize: 14,
    color: "#374151",
  },
  servicesList: {
    gap: 8,
  },
  serviceItem: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  serviceName: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  serviceMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  nodesList: {
    gap: 8,
  },
  nodeItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nodeTitle: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  nodeMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  dangerButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dangerButtonText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  chipActive: {
    backgroundColor: "#111827",
  },
  chipText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
  },
  badgeText: { color: "#3730a3", fontSize: 11, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
});

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function knownActionIdFor(serviceId: string, displayName: string): string {
  const name = displayName.toLowerCase();
  if (serviceId === "timer") {
    if (name.includes("cron")) return "cron";
  }
  if (serviceId === "test-webhook") {
    if (name.includes("webhook")) return "on-test-webhook";
  }
  return toId(displayName);
}

function knownReactionIdFor(serviceId: string, displayName: string): string {
  const name = displayName.toLowerCase();
  if (serviceId === "timer") {
    if (name.includes("log")) return "log";
    if (name.includes("wait")) return "wait";
  }
  return toId(displayName);
}
