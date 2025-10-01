import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

type ToastKind = "success" | "error" | "info";

type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextType = {
  show: (message: string, kind?: ToastKind, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [anim] = useState(new Animated.Value(0));

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info", durationMs = 2500) => {
      const id = Date.now();
      setItems((prev) => [...prev, { id, kind, message }]);

      Animated.timing(anim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(anim, {
            toValue: 0,
            duration: 150,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }).start(() => remove(id));
        }, durationMs);
      });
    },
    [anim, remove],
  );

  const value = useMemo<ToastContextType>(
    () => ({
      show,
      success: (m, d) => show(m, "success", d),
      error: (m, d) => show(m, "error", d),
    }),
    [show],
  );

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const opacity = anim;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.root}>
        {items.map((t) => (
          <Animated.View
            key={t.id}
            style={[
              styles.toast,
              t.kind === "success" && styles.success,
              t.kind === "error" && styles.error,
              { opacity, transform: [{ translateY }] },
            ]}
          >
            <Text style={styles.text}>{t.message}</Text>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toast: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#111827",
    minWidth: 200,
  },
  text: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
  success: {
    backgroundColor: "#059669",
  },
  error: {
    backgroundColor: "#b91c1c",
  },
});
