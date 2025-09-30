import { useEffect } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useWorkflowBuilder } from "./builder/use-workflow-builder";

export default function CreateWorkflowScreen() {
  const { state, actions } = useWorkflowBuilder();

  useEffect(() => {
    return () => {
      actions.reset();
    };
  }, [actions]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Créer un workflow</Text>
      <Text>
        Brouillon: id="{state.id || "(non défini)"}", name="{state.name || ""}",
        active={String(state.active)}, nodes={state.nodes.length}
      </Text>
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
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
});
