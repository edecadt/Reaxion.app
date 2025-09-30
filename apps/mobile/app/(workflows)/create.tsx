import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
  Pressable,
  Alert,
} from "react-native";
import { useWorkflowBuilder } from "./builder/use-workflow-builder";
import {
  getAbout,
  type AboutService,
  createWorkflow,
  activateWorkflow,
  deactivateWorkflow,
  executeWorkflow,
} from "../lib/api";
import { tryGetApiUrl } from "../lib/api-config";
import type { CreateWorkflowDto, Workflow } from "@reaxion/common";

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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<Workflow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

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

  const existingIds = useMemo(
    () => new Set(state.nodes.map((n) => n.id)),
    [state.nodes],
  );

  const referencedIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of state.nodes) {
      const next = n.next;
      if (typeof next === "string") set.add(next);
      else if (Array.isArray(next)) next.forEach((id) => set.add(id));
    }
    return set;
  }, [state.nodes]);

  const entryIds = useMemo(
    () => state.nodes.map((n) => n.id).filter((id) => !referencedIds.has(id)),
    [state.nodes, referencedIds],
  );

  const invalidNextByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of state.nodes) {
      const next = n.next;
      const arr = Array.isArray(next) ? next : next ? [next] : [];
      const invalid = arr.filter((id) => !existingIds.has(id));
      if (invalid.length > 0) map.set(n.id, invalid);
    }
    return map;
  }, [state.nodes, existingIds]);

  const selfLoopIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of state.nodes) {
      const next = n.next;
      if (typeof next === "string") {
        if (next === n.id) set.add(n.id);
      } else if (Array.isArray(next)) {
        if (next.includes(n.id)) set.add(n.id);
      }
    }
    return set;
  }, [state.nodes]);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!state.id.trim()) errs.push("Identifiant manquant");
    if (!isNameValid) errs.push("Le nom est obligatoire");
    if (state.nodes.length === 0) errs.push("Ajoutez au moins un nœud");

    const ids = state.nodes.map((n) => n.id);
    const dupIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (dupIds.length > 0)
      errs.push(
        `Identifiants de nœuds en double: ${Array.from(new Set(dupIds)).join(", ")}`,
      );

    for (const n of state.nodes) {
      if (!n.serviceId) errs.push(`Nœud ${n.id}: service requis`);
      const hasAction = !!n.actionId;
      const hasReaction = !!n.reactionId;
      if (hasAction === hasReaction)
        errs.push(`Nœud ${n.id}: choisissez action OU réaction`);
      if (n.params === null || typeof n.params !== "object")
        errs.push(`Nœud ${n.id}: params doit être un objet`);

      if (n.serviceId === "timer" && n.actionId === "cron") {
        const expr = String((n.params as any)?.expression ?? "").trim();
        if (!(expr.length > 0 && expr.split(/\s+/).length === 6)) {
          errs.push(`Nœud ${n.id}: expression cron (6 champs) requise`);
        }
      }
      if (n.serviceId === "timer" && n.reactionId === "log") {
        const msg = String((n.params as any)?.message ?? "").trim();
        const lvl = String((n.params as any)?.level ?? "");
        if (msg.length === 0) errs.push(`Nœud ${n.id}: message requis`);
        if (!["info", "warn", "error"].includes(lvl))
          errs.push(`Nœud ${n.id}: niveau invalide (info|warn|error)`);
      }
      if (n.serviceId === "timer" && n.reactionId === "wait") {
        const raw = String((n.params as any)?.seconds ?? "0");
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0)
          errs.push(`Nœud ${n.id}: seconds doit être ≥ 0`);
      }
    }

    if (selfLoopIds.size > 0)
      errs.push(`Boucles vers soi-même: ${Array.from(selfLoopIds).join(", ")}`);
    if (invalidNextByNode.size > 0) {
      const parts: string[] = [];
      invalidNextByNode.forEach((vals, key) =>
        parts.push(`${key}→[${vals.join(", ")}]`),
      );
      errs.push(`Références next invalides: ${parts.join("; ")}`);
    }
    if (state.nodes.length > 0) {
      if (entryIds.length !== 1)
        errs.push("Le graphe doit avoir exactement un nœud d'entrée");
    }

    return errs;
  }, [state, isNameValid, selfLoopIds, invalidNextByNode, entryIds]);

  const isFormValid = validationErrors.length === 0;

  const serialize = useCallback((): CreateWorkflowDto => {
    const nodes = state.nodes.map((n) => {
      let params: Record<string, unknown> = { ...(n.params as any) };
      if (n.serviceId === "timer" && n.reactionId === "wait") {
        const raw = String((params as any)?.seconds ?? "0");
        const num = Number(raw);
        params = { ...params, seconds: Number.isFinite(num) ? num : 0 };
      }
      const next = Array.isArray(n.next)
        ? n.next.length > 0
          ? n.next
          : undefined
        : n.next;
      return {
        id: n.id,
        serviceId: n.serviceId,
        actionId: n.actionId,
        reactionId: n.reactionId,
        params,
        next,
      };
    });
    return {
      id: state.id,
      name: state.name,
      active: state.active,
      nodes,
    };
  }, [state]);

  const handleCreate = useCallback(async () => {
    if (!isFormValid) return;
    setCreating(true);
    setCreateError(null);
    try {
      const dto = serialize();
      const result = await createWorkflow(dto);
      setCreated(result);
      Alert.alert(
        "Workflow créé",
        result.webhookToken
          ? `ID: ${result.id}\nToken webhook: ${result.webhookToken}`
          : `ID: ${result.id}`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      setCreateError(message);
      if (
        message.toLowerCase().includes("already exists") ||
        message.toLowerCase().includes("existe déjà")
      ) {
        const newId = uuidv4();
        actions.setMeta({ id: newId });
        Alert.alert(
          "Identifiant dupliqué",
          `Un nouvel identifiant a été généré: ${newId}. Réessayez.`,
        );
      }
    } finally {
      setCreating(false);
    }
  }, [isFormValid, serialize, actions]);

  const handleToggleActive = useCallback(async () => {
    if (!created) return;
    setActionLoading(true);
    try {
      const updated = created.active
        ? await deactivateWorkflow(created.id)
        : await activateWorkflow(created.id);
      setCreated(updated);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setActionLoading(false);
    }
  }, [created]);

  const handleExecute = useCallback(async () => {
    if (!created) return;
    setActionLoading(true);
    try {
      const { runId } = await executeWorkflow(created.id);
      setLastRunId(runId);
      Alert.alert("Exécution démarrée", `runId: ${runId}`);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setActionLoading(false);
    }
  }, [created]);

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
        disabled={!isFormValid || creating}
        style={[
          styles.primaryButton,
          (!isFormValid || creating) && styles.buttonDisabled,
        ]}
        onPress={handleCreate}
      >
        <Text style={styles.primaryButtonText}>Créer</Text>
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

      {createError && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Erreur</Text>
          <Text style={styles.errorText}>{createError}</Text>
        </View>
      )}

      {created && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workflow créé</Text>
          <Text style={styles.cardText}>ID: {created.id}</Text>
          <Text style={styles.cardText}>Nom: {created.name}</Text>
          <Text style={styles.cardText}>
            Actif: {created.active ? "Oui" : "Non"}
          </Text>
          {(() => {
            const entry = computeEntryNode(created);
            return (
              <Text style={styles.cardText}>
                Nœud d'entrée: {entry ?? "(introuvable)"}
              </Text>
            );
          })()}
          {created.webhookToken && (
            <View style={{ gap: 4 }}>
              <Text style={styles.cardTitle}>Webhook</Text>
              <Text style={styles.cardText} selectable>
                {`${tryGetApiUrl() ?? ""}/webhooks/test-webhook/test/${created.webhookToken}`}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Pressable
              onPress={handleToggleActive}
              disabled={actionLoading}
              style={[
                styles.secondaryButton,
                actionLoading && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {created.active ? "Désactiver" : "Activer"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleExecute}
              disabled={actionLoading}
              style={[
                styles.secondaryButton,
                actionLoading && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Exécuter maintenant
              </Text>
            </Pressable>
            <Pressable
              disabled
              style={[styles.secondaryButton, styles.buttonDisabled]}
            >
              <Text style={styles.secondaryButtonText}>Voir logs</Text>
            </Pressable>
          </View>
          {lastRunId && (
            <Text style={styles.cardText}>Dernier run: {lastRunId}</Text>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Validation</Text>
        {validationErrors.length === 0 ? (
          <Text style={styles.cardText}>Tout est valide</Text>
        ) : (
          <View style={{ gap: 4 }}>
            {validationErrors.map((e, i) => (
              <Text key={i} style={styles.errorText}>
                • {e}
              </Text>
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
        {state.nodes.length > 0 && (
          <View>
            {entryIds.length === 1 ? (
              <Text style={styles.cardText}>Nœud d'entrée: {entryIds[0]}</Text>
            ) : entryIds.length === 0 ? (
              <Text style={styles.errorText}>Aucun nœud d'entrée détecté</Text>
            ) : (
              <Text style={styles.errorText}>
                Plusieurs nœuds d'entrée: {entryIds.join(", ")}
              </Text>
            )}
          </View>
        )}
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
                  <View style={{ gap: 6 }}>
                    <Text style={styles.label}>Chaînage (nœuds suivants)</Text>
                    <View style={styles.chipRow}>
                      {state.nodes
                        .filter((m) => m.id !== n.id)
                        .map((m) => {
                          const current = n.next;
                          const arr = Array.isArray(current)
                            ? current
                            : current
                              ? [current]
                              : [];
                          const active = arr.includes(m.id);
                          return (
                            <Pressable
                              key={m.id}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() => {
                                const nextArr = new Set(arr);
                                if (active) nextArr.delete(m.id);
                                else nextArr.add(m.id);
                                const result = Array.from(nextArr);
                                actions.setNodeNext(
                                  n.id,
                                  result.length === 0 ? undefined : result,
                                );
                              }}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  active && styles.chipTextActive,
                                ]}
                              >
                                {m.id}
                              </Text>
                            </Pressable>
                          );
                        })}
                    </View>
                    {selfLoopIds.has(n.id) && (
                      <Text style={styles.errorText}>
                        Boucle vers soi-même interdite
                      </Text>
                    )}
                    {invalidNextByNode.get(n.id) && (
                      <Text style={styles.errorText}>
                        Références invalides:{" "}
                        {invalidNextByNode.get(n.id)!.join(", ")}
                      </Text>
                    )}
                  </View>
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

function computeEntryNode(w: Workflow): string | null {
  if (!w.nodes || w.nodes.length === 0) return null;
  const referenced = new Set<string>();
  for (const n of w.nodes) {
    const next = (n as any).next as undefined | string | string[];
    if (typeof next === "string") referenced.add(next);
    else if (Array.isArray(next)) next.forEach((id) => referenced.add(id));
  }
  const entry = w.nodes.find((n) => !referenced.has(n.id));
  return entry ? entry.id : null;
}
