import { useEffect, useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Workflow } from "@reaxion/common";
import {
  getWorkflows,
  activateWorkflow,
  deactivateWorkflow,
  executeWorkflow,
} from "../../src/lib/api";
import { useToast } from "../../src/components/Toast";

export default function WorkflowsList() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getWorkflows();
      setWorkflows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleActive(w: Workflow) {
    setBusyId(w.id);
    try {
      const updated = w.active
        ? await deactivateWorkflow(w.id)
        : await activateWorkflow(w.id);
      setWorkflows((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(updated.active ? "Activé" : "Désactivé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function runNow(w: Workflow) {
    setBusyId(w.id);
    try {
      const { runId } = await executeWorkflow(w.id);
      toast.success(`Exécution démarrée: ${runId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Mes workflows</Text>
      {loading ? (
        <View style={[styles.card, { alignItems: "center", gap: 8 }]}>
          <ActivityIndicator />
          <Text style={styles.cardText}>Chargement…</Text>
        </View>
      ) : error ? (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={[styles.cardText, styles.errorText]}>{error}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => load()}>
            <Text style={styles.secondaryButtonText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : workflows.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aucun workflow</Text>
          <Text style={styles.cardText}>
            Créez votre premier workflow pour l’afficher ici.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vos workflows</Text>
          <View style={{ gap: 8 }}>
            {workflows.map((w) => {
              const entry = computeEntryNode(w);
              return (
                <View key={w.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={styles.itemTitle}>{w.name}</Text>
                      <View
                        style={[
                          styles.badge,
                          w.active ? styles.badgeOn : styles.badgeOff,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            w.active ? styles.badgeTextOn : styles.badgeTextOff,
                          ]}
                        >
                          {w.active ? "Actif" : "Inactif"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemMeta}>ID: {w.id}</Text>
                    <Text style={styles.itemMeta}>
                      Nœuds: {w.nodes?.length ?? 0} • Entrée:{" "}
                      {entry ?? "(introuvable)"}
                    </Text>
                  </View>
                  <View style={styles.actionsCol}>
                    <Pressable
                      onPress={() => toggleActive(w)}
                      disabled={busyId === w.id}
                      style={[
                        styles.secondaryButton,
                        busyId === w.id && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {w.active ? "Désactiver" : "Activer"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => runNow(w)}
                      disabled={busyId === w.id}
                      style={[
                        styles.secondaryButton,
                        busyId === w.id && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Exécuter</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <Link href="/(workflows)/create" asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Créer un workflow</Text>
        </Pressable>
      </Link>
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
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  card: {
    width: "100%",
    maxWidth: 720,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    padding: 16,
    backgroundColor: "#fafafa",
    gap: 6,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  cardText: { fontSize: 14, color: "#374151" },
  errorText: { color: "#b91c1c" },
  itemRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  itemMeta: { fontSize: 12, color: "#6b7280" },
  actionsCol: { gap: 8 },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#111827", fontSize: 14, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeOn: { backgroundColor: "#d1fae5" },
  badgeOff: { backgroundColor: "#fee2e2" },
  badgeTextOn: { color: "#065f46" },
  badgeTextOff: { color: "#991b1b" },
});

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
