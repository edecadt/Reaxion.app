import { Stack, useRouter } from "expo-router";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Text,
} from "react-native";
import { useAuth } from "../../src/hooks/useAuth";

export default function WorkflowsLayout() {
  const router = useRouter();
  const { loading, logout } = useAuth({
    required: true,
    redirectTo: "/(auth)/login",
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Mes workflows",
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push("/")}>
                <Text style={styles.headerButton}>Home</Text>
              </Pressable>
              <Pressable onPress={logout}>
                <Text style={styles.headerButtonDanger}>Logout</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          title: "Créer un workflow",
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push("/")}>
                <Text style={styles.headerButton}>Home</Text>
              </Pressable>
              <Pressable onPress={logout}>
                <Text style={styles.headerButtonDanger}>Logout</Text>
              </Pressable>
            </View>
          ),
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
    marginRight: 16,
  },
  headerButton: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  headerButtonDanger: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
  },
});
