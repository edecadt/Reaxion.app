import Constants from "expo-constants";

/**
 * Reads the API base URL from Expo public env or app config.
 * Throws if not configured to prevent accidental network calls.
 */
export function getApiUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || "";

  const extra = (Constants?.expoConfig?.extra ??
    (Constants as any)?.manifest?.extra) as { apiUrl?: unknown } | undefined;

  const fromConfig = (extra?.apiUrl as string | undefined) ?? "";

  const url = (fromEnv || fromConfig || "").trim();

  if (!url) {
    throw new Error(
      "API base URL not configured. Set EXPO_PUBLIC_API_URL in apps/mobile/.env",
    );
  }
  return url;
}

/** Returns true if an API base URL is available. */
export function isApiConfigured(): boolean {
  try {
    void getApiUrl();
    return true;
  } catch {
    return false;
  }
}

/** Safe getter: returns null instead of throwing when not configured. */
export function tryGetApiUrl(): string | null {
  try {
    return getApiUrl();
  } catch {
    return null;
  }
}
