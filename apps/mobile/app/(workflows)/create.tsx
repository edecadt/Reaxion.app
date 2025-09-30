import { useEffect, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
  Pressable,
} from "react-native";
import { useWorkflowBuilder } from "./builder/use-workflow-builder";

export default function CreateWorkflowScreen() {
  const { state, actions } = useWorkflowBuilder();

  useEffect(() => {
    return () => {
      actions.reset();
    };
  }, [actions]);

  useEffect(() => {
    if (!state.id) {
      const id = uuidv4();
      actions.setMeta({ id });
    }
  }, [state.id, actions]);

  const isNameValid = useMemo(() => state.name.trim().length > 0, [state.name]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Créer un workflow</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Nom</Text>
        <TextInput
          value={state.name}
          onChangeText={(t) => actions.setMeta({ name: t })}
          placeholder="Mon workflow"
          style={[styles.input, !isNameValid && styles.inputError]}
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="done"
        />
        {!isNameValid && (
          <Text style={styles.errorText}>Le nom est obligatoire</Text>
        )}
      </View>

      <View style={styles.formGroupRow}>
        <Text style={styles.label}>Actif</Text>
        <Switch
          value={state.active}
          onValueChange={(v) => actions.setMeta({ active: v })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Identifiant</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyText}>{state.id}</Text>
        </View>
      </View>

      <Pressable
        disabled={!isNameValid}
        style={[styles.primaryButton, !isNameValid && styles.buttonDisabled]}
        onPress={() => {}}
      >
        <Text style={styles.primaryButtonText}>Suivant</Text>
      </Pressable>
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
  formGroup: {
    width: "100%",
    maxWidth: 520,
    gap: 6,
  },
  formGroupRow: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
    color: "#374151",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
  },
  readonlyField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
  },
  readonlyText: {
    fontSize: 16,
    color: "#374151",
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#111827",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
