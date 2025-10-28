import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import type { Workflow } from "@reaxion/common";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  getWorkflows,
  activateWorkflow,
  deactivateWorkflow,
  deleteWorkflow,
} from "../../src/lib/api";
import { useToast } from "../../src/components/Toast";
import { useAuth } from "../../src/hooks/useAuth";

export default function WorkflowsList() {
  const toast = useToast();
  const { token, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!token) {
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getWorkflows(token);
        setWorkflows(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        setError(msg);
        toast.error(msg);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, toast],
  );

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
        ? await deactivateWorkflow(w.id, token ?? undefined)
        : await activateWorkflow(w.id, token ?? undefined);
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

  const confirmDelete = (workflow: Workflow) => {
    Alert.alert(
      "Supprimer le workflow",
      `Voulez-vous vraiment supprimer "${workflow.name}" ? Cette action est définitive.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => void handleDelete(workflow),
        },
      ],
    );
  };

  const handleDelete = async (workflow: Workflow) => {
    if (!token) {
      toast.error("Authentification requise");
      return;
    }

    setDeletingId(workflow.id);
    try {
      await deleteWorkflow(workflow.id, token);
      setWorkflows((prev) => prev.filter((item) => item.id !== workflow.id));
      toast.success("Workflow supprimé");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de la suppression",
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (authLoading || !token) return;
    void load();
  }, [authLoading, token, load]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Retour à l'accueil"
            hitSlop={8}
          >
            <Feather name="arrow-left" size={20} color="#111827" />
          </Pressable>
          <Pressable
            style={[styles.topLink, styles.logoutLink]}
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
          >
            <Text style={[styles.topLinkText, styles.logoutLinkText]}>
              Logout
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Mes workflows</Text>
          <Text style={styles.heroSubtitle}>
            Suivez, activez et améliorez vos automatisations en un clin d’œil.
          </Text>
          <Link href="/(workflows)/create" asChild>
            <Pressable style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Créer un workflow</Text>
            </Pressable>
          </Link>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#8b5cf6" />
            <Text style={styles.stateText}>Chargement des workflows…</Text>
          </View>
        ) : error ? (
          <View style={[styles.stateCard, styles.errorCard]}>
            <Text style={[styles.stateText, styles.errorText]}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => load()}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : workflows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun workflow pour le moment</Text>
            <Text style={styles.emptyText}>
              Lancez-vous en créant votre premier workflow personnalisé.
            </Text>
            <Link href="/(workflows)/create" asChild>
              <Pressable style={[styles.heroButton, styles.emptyButton]}>
                <Text style={styles.heroButtonText}>Démarrer</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Vos workflows</Text>
            <View style={styles.listCard}>
              {workflows.map((w, index) => {
                const entry = computeEntryNode(w);
                const isLast = index === workflows.length - 1;
                return (
                  <View
                    key={w.id}
                    style={[
                      styles.workflowRow,
                      !isLast && styles.workflowDivider,
                    ]}
                  >
                    <View style={styles.workflowInfo}>
                      <Text style={styles.workflowName}>{w.name}</Text>
                      <Text style={styles.workflowMeta}>
                        Nœuds: {w.nodes?.length ?? 0} • Entrée:{" "}
                        {entry ?? "(introuvable)"}
                      </Text>
                      <Text style={styles.workflowMeta}>ID: {w.id}</Text>
                    </View>
                    <View style={styles.workflowActions}>
                      <View
                        style={[
                          styles.statusBadge,
                          w.active
                            ? styles.statusBadgeOn
                            : styles.statusBadgeOff,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            w.active
                              ? styles.statusBadgeTextOn
                              : styles.statusBadgeTextOff,
                          ]}
                        >
                          {w.active ? "Actif" : "Inactif"}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleActive(w)}
                        disabled={busyId === w.id}
                        style={[
                          styles.workflowButton,
                          busyId === w.id && styles.buttonDisabled,
                        ]}
                      >
                        <Text style={styles.workflowButtonText}>
                          {w.active ? "Désactiver" : "Activer"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmDelete(w)}
                        disabled={deletingId === w.id}
                        style={[
                          styles.workflowDeleteButton,
                          deletingId === w.id && styles.buttonDisabled,
                        ]}
                      >
                        <Text style={styles.workflowDeleteButtonText}>
                          {deletingId === w.id ? "Suppression…" : "Supprimer"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  topLink: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  logoutLink: {
    backgroundColor: "#fee2e2",
  },
  topLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  logoutLinkText: {
    color: "#b91c1c",
  },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 20,
  },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  stateCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  stateText: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  errorCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  errorText: {
    color: "#b91c1c",
  },
  retryButton: {
    backgroundColor: "#b91c1c",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  emptyText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: "#111827",
  },
  listSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  workflowRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  workflowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f4f6",
  },
  workflowInfo: {
    flex: 1,
    gap: 4,
  },
  workflowName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  workflowMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  workflowActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeOn: {
    backgroundColor: "#d1fae5",
  },
  statusBadgeOff: {
    backgroundColor: "#fee2e2",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadgeTextOn: {
    color: "#047857",
  },
  statusBadgeTextOff: {
    color: "#b91c1c",
  },
  workflowButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  workflowButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  workflowDeleteButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  workflowDeleteButtonText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
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
