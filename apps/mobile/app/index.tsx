import { Link } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { isApiConfigured, tryGetApiUrl } from "../src/lib/api-config";
import { useAuth } from "../src/hooks/useAuth";

export default function Home() {
  const apiOk = isApiConfigured();
  const apiUrl = tryGetApiUrl();
  const { isAuthenticated, user, loading, logout } = useAuth({
    required: false,
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to Reaxion</Text>
      {isAuthenticated && user ? (
        <Text style={styles.subtitle}>Hello, {user.name || user.email}!</Text>
      ) : (
        <Text style={styles.subtitle}>Your mobile app is ready.</Text>
      )}

      {!apiOk ? (
        <View style={[styles.card, styles.errorCard]}>
          <Text style={styles.cardTitle}>API non configurée</Text>
          <Text style={styles.cardText}>
            Définissez EXPO_PUBLIC_API_URL dans apps/mobile/.env (ex:
            http://localhost:8080), puis relancez l&apos;app.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>API</Text>
          <Text style={styles.cardText}>Base URL: {apiUrl}</Text>
        </View>
      )}

      {isAuthenticated ? (
        <>
          <Link href="/(workflows)" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Mes workflows</Text>
            </Pressable>
          </Link>
          <Link href="/(workflows)/create" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Créer un workflow</Text>
            </Pressable>
          </Link>
          <Link href="/(settings)/settings" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Service Connections</Text>
            </Pressable>
          </Link>
          <Pressable style={styles.secondaryButton} onPress={logout}>
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/register" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Create account</Text>
            </Pressable>
          </Link>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fff",
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#4b5563",
    marginBottom: 8,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    padding: 16,
    backgroundColor: "#fafafa",
  },
  errorCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
    color: "#111827",
  },
  cardText: {
    fontSize: 14,
    color: "#374151",
  },
  code: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: "100%",
    maxWidth: 300,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: "100%",
    maxWidth: 300,
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
