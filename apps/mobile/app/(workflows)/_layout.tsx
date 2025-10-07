import { Stack } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../../src/hooks/useAuth";

export default function WorkflowsLayout() {
  const { loading } = useAuth({ required: true, redirectTo: "/(auth)/login" });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Mes workflows" }} />
      <Stack.Screen name="create" options={{ title: "Créer un workflow" }} />
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
});
