import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useToast } from "../../src/components/Toast";
import { useApiConfig } from "../../src/hooks/useApiConfig";

function normalizeUrl(url: string): string {
  return url.replace(/\s+/g, "").replace(/\/+$/, "");
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ServerConfigScreen() {
  const router = useRouter();
  const toast = useToast();
  const { apiUrl, setApiUrl, clearApiUrl } = useApiConfig();

  const initialValue = useMemo(() => apiUrl ?? "", [apiUrl]);
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setValue(initialValue);
    }
  }, [initialValue, dirty]);

  const handleSave = useCallback(async () => {
    const trimmed = value.trim();
    const normalized = normalizeUrl(trimmed);

    if (!normalized) {
      toast.show(
        "Renseignez l'adresse du serveur (ex: http://192.168.1.20:8080)",
        "error",
      );
      return;
    }

    if (!isValidUrl(normalized)) {
      toast.show(
        "Adresse invalide. Utilisez un schéma http:// ou https://",
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      await setApiUrl(normalized);
      toast.show("Adresse du serveur enregistrée.", "success");
      setDirty(false);
      router.back();
    } catch (error) {
      toast.show(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer l'adresse",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [router, setApiUrl, toast, value]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      await clearApiUrl();
      toast.show(
        "Configuration supprimée. L'application utilisera la valeur par défaut.",
        "info",
      );
      setDirty(false);
      setValue("");
    } catch (error) {
      toast.show(
        error instanceof Error
          ? error.message
          : "Erreur lors de la réinitialisation",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [clearApiUrl, toast]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Retour"
            >
              <Feather name="chevron-left" size={24} color="#111827" />
            </Pressable>
            <Text style={styles.title}>Adresse du serveur</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>API Server URL</Text>
            <Text style={styles.cardDescription}>
              Saisissez l&apos;adresse du serveur Reaxion à utiliser. Exemple :
              http://192.168.0.10:8080.
            </Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://..."
              keyboardType={Platform.OS === "ios" ? "url" : "default"}
              enterKeyHint="done"
              value={value}
              onChangeText={(text) => {
                setDirty(true);
                setValue(text);
              }}
            />

            <Pressable
              style={[
                styles.primaryButton,
                saving ? styles.buttonDisabled : null,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Enregistrement..." : "Sauvegarder"}
              </Text>
            </Pressable>

            {apiUrl ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={handleReset}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>
                  Réinitialiser la configuration
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.helperCard}>
            <Feather name="info" size={20} color="#1f2937" />
            <Text style={styles.helperText}>
              Cette valeur est stockée sur l&apos;appareil. Vous pouvez la
              modifier à tout moment si le serveur change de réseau.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  cardDescription: {
    fontSize: 14,
    color: "#4b5563",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#fff",
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  helperCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#e0f2fe",
    borderRadius: 10,
    padding: 12,
    alignItems: "flex-start",
  },
  helperText: {
    flex: 1,
    color: "#1f2937",
    fontSize: 14,
  },
});
