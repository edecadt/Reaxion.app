import { Stack } from "expo-router";

export default function WorkflowsLayout() {
  return (
    <Stack>
      <Stack.Screen name="create" options={{ title: "Créer un workflow" }} />
    </Stack>
  );
}
