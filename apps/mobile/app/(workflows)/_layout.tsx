import { Stack } from "expo-router";

export default function WorkflowsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Mes workflows" }} />
      <Stack.Screen name="create" options={{ title: "Créer un workflow" }} />
    </Stack>
  );
}
