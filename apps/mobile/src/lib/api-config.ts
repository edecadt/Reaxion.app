import Constants from "expo-constants";
import { getRuntimeApiUrl } from "./runtime-config";

export function getApiUrl(): string {
  const runtimeUrl = getRuntimeApiUrl();
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || "";

  const extra = (Constants?.expoConfig?.extra ??
    (Constants as any)?.manifest?.extra) as { apiUrl?: unknown } | undefined;

  const fromConfig = (extra?.apiUrl as string | undefined) ?? "";

  const url = (runtimeUrl || fromEnv || fromConfig || "").trim();

  if (!url) {
    throw new Error(
      "API base URL not configured. Configure it in the mobile app settings or set EXPO_PUBLIC_API_URL in apps/mobile/.env.",
    );
  }
  return url;
}

export function isApiConfigured(): boolean {
  try {
    void getApiUrl();
    return true;
  } catch {
    return false;
  }
}

export function tryGetApiUrl(): string | null {
  try {
    return getApiUrl();
  } catch {
    return null;
  }
}
