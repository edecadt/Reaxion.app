import { useEffect, useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Workflow } from "@reaxion/common";
import { getWorkflows } from "../../src/lib/api";
import { useToast } from "../../src/components/Toast";

export default function WorkflowsList() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkflows();
      setWorkflows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mes workflows</Text>
      {loading ? (
        <View style={[styles.card, { alignItems: "center", gap: 8 }]}>
          <ActivityIndicator />
          <Text style={styles.cardText}>Chargement…</Text>
        </View>
      ) : error ? (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={[styles.cardText, styles.errorText]}>{error}</Text>
          <Pressable style={styles.secondaryButton} onPress={load}>
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
            {workflows.map((w) => (
              <View key={w.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{w.name}</Text>
                  <Text style={styles.itemMeta}>ID: {w.id}</Text>
                </View>
              </View>
            ))}
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
  itemTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  itemMeta: { fontSize: 12, color: "#6b7280" },
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
});
