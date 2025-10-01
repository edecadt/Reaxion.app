import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function WorkflowsList() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mes workflows</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Liste</Text>
        <Text style={styles.cardText}>
          La liste de vos workflows apparaîtra ici.
        </Text>
      </View>

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
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
