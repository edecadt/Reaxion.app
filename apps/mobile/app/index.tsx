import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";

const resolveApiBaseUrl = () => {
  const candidates = [
    Constants.expoConfig?.extra?.apiUrl,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.EXPO_PUBLIC_API_URL,
    "http://localhost:8080",
  ];

  const url = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
  );

  return url.replace(/\/$/, "");
};

const API_BASE_URL = resolveApiBaseUrl();

const ABOUT_ENDPOINT = "/about.json";

export default function Index() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);

  const targetUrl = useMemo(() => `${API_BASE_URL}${ABOUT_ENDPOINT}`, []);

  const fetchAbout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const json = await response.json();
      setPayload(JSON.stringify(json, null, 2));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unknown error";
      setError(message);
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [targetUrl]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>About endpoint tester</Text>
      <Text style={styles.description}>
        Press the button to fetch {ABOUT_ENDPOINT} from {targetUrl}.
      </Text>
      <Button
        title={isLoading ? "Fetching..." : "Fetch /about.json"}
        onPress={fetchAbout}
        disabled={isLoading}
      />
      {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {payload ? (
        <ScrollView style={styles.resultContainer}>
          <Text style={styles.resultText}>{payload}</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: 24,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 16,
  },
  error: {
    marginTop: 16,
    color: "#c00",
    fontWeight: "500",
  },
  resultContainer: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    maxHeight: 240,
  },
  resultText: {
    fontFamily: "monospace",
  },
});
