import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL_STORAGE_KEY = "api:url";

let runtimeApiUrl: string | null = null;
let initialized = false;
const listeners = new Set<(url: string | null) => void>();

function notify(): void {
  for (const listener of listeners) {
    listener(runtimeApiUrl);
  }
}

export async function initializeRuntimeConfig(): Promise<void> {
  if (initialized) return;
  const storedUrl = await AsyncStorage.getItem(API_URL_STORAGE_KEY);
  runtimeApiUrl = storedUrl ? storedUrl.trim() : null;
  initialized = true;
  notify();
}

export function isRuntimeConfigReady(): boolean {
  return initialized;
}

export function getRuntimeApiUrl(): string | null {
  return runtimeApiUrl;
}

export function subscribeRuntimeApiUrl(
  listener: (url: string | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function setRuntimeApiUrl(url: string | null): Promise<void> {
  const normalized = url ? url.trim() : null;

  if (!normalized) {
    await AsyncStorage.removeItem(API_URL_STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(API_URL_STORAGE_KEY, normalized);
  }

  runtimeApiUrl = normalized;
  initialized = true;
  notify();
}
