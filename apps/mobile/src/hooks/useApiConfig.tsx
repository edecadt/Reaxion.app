import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  getRuntimeApiUrl,
  initializeRuntimeConfig,
  isRuntimeConfigReady,
  setRuntimeApiUrl,
  subscribeRuntimeApiUrl,
} from "../lib/runtime-config";

type ApiConfigContextValue = {
  apiUrl: string | null;
  loading: boolean;
  setApiUrl: (url: string) => Promise<void>;
  clearApiUrl: () => Promise<void>;
};

const ApiConfigContext = createContext<ApiConfigContextValue | undefined>(
  undefined,
);

export function ApiConfigProvider({
  children,
}: PropsWithChildren<Record<string, never>>) {
  const [loading, setLoading] = useState(!isRuntimeConfigReady());
  const [apiUrl, setApiUrlState] = useState<string | null>(
    getRuntimeApiUrl() ?? null,
  );

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!isRuntimeConfigReady()) {
        await initializeRuntimeConfig();
      }
      if (!mounted) return;
      setApiUrlState(getRuntimeApiUrl());
      setLoading(false);
    };

    void initialize();

    const unsubscribe = subscribeRuntimeApiUrl((url) => {
      if (!mounted) return;
      setApiUrlState(url);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setApiUrl = useCallback(async (url: string) => {
    await setRuntimeApiUrl(url);
  }, []);

  const clearApiUrl = useCallback(async () => {
    await setRuntimeApiUrl(null);
  }, []);

  const value = useMemo<ApiConfigContextValue>(
    () => ({
      apiUrl,
      loading,
      setApiUrl,
      clearApiUrl,
    }),
    [apiUrl, loading, setApiUrl, clearApiUrl],
  );

  return (
    <ApiConfigContext.Provider value={value}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : (
        children
      )}
    </ApiConfigContext.Provider>
  );
}

export function useApiConfig(): ApiConfigContextValue {
  const context = useContext(ApiConfigContext);
  if (!context) {
    throw new Error("useApiConfig must be used within an ApiConfigProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
