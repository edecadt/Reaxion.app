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
import { isApiConfigured } from "../src/lib/api-config";
import { useAuth } from "../src/hooks/useAuth";
import { useApiConfig } from "../src/hooks/useApiConfig";

export default function Home() {
  const apiOk = isApiConfigured();
  const { isAuthenticated, user, loading, logout } = useAuth({
    required: false,
  });
  const { apiUrl } = useApiConfig();

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
            Définissez l&apos;adresse du serveur Reaxion depuis les paramètres.
            Vous pouvez utiliser une adresse locale (ex:
            http://192.168.0.10:8080).
          </Text>
          <Link href="/(settings)/server-config" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkButtonText}>
                Configurer l&apos;adresse
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : null}
      {apiOk && apiUrl ? (
        <View style={styles.infoTextWrapper}>
          <Text style={styles.infoText}>
            Serveur actuel : <Text style={styles.infoTextStrong}>{apiUrl}</Text>
          </Text>
        </View>
      ) : null}

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
      <Link href="/(settings)/server-config" asChild>
        <Pressable style={styles.linkButton}>
          <Text style={styles.linkButtonText}>
            Changer d&apos;adresse serveur
          </Text>
        </Pressable>
      </Link>
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
  infoTextWrapper: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#ecfeff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#bae6fd",
    width: "100%",
    maxWidth: 520,
  },
  infoText: {
    fontSize: 14,
    color: "#0f172a",
  },
  infoTextStrong: {
    fontWeight: "600",
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
  linkButton: {
    marginTop: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: "100%",
    maxWidth: 300,
  },
  linkButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
});
