import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { setAuthToken, setUser } from "./auth";
import { tryGetApiUrl } from "./api-config";

WebBrowser.maybeCompleteAuthSession();

export function useOAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const openOAuth = async (provider: "google" | "github") => {
    if (loading) return;

    const baseUrl = tryGetApiUrl();
    if (!baseUrl) {
      Alert.alert(
        "Serveur requis",
        "Configurez l'adresse du serveur dans les paramètres avant de vous connecter.",
      );
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `reaxion://auth/callback`;
      const normalizedBase = baseUrl.replace(/\/+$/, "");
      const authUrl = `${normalizedBase}/auth/${provider}?redirect_uri=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
      );

      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get("token");

        if (token) {
          await handleOAuthSuccess(token);
        } else {
          Alert.alert("Error", "No token received from authentication");
        }
      } else if (result.type === "cancel") {
      }
    } catch (err) {
      console.error("OAuth error:", err);
      Alert.alert("Error", `Failed to sign in with ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSuccess = async (token: string) => {
    try {
      await setAuthToken(token);

      const payload = JSON.parse(atob(token.split(".")[1]));
      await setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name || null,
      });

      router.replace("/");
    } catch (err) {
      console.error("Failed to process OAuth token:", err);
      Alert.alert("Error", "Failed to complete authentication");
    }
  };

  const signInWithGoogle = () => openOAuth("google");
  const signInWithGitHub = () => openOAuth("github");

  return {
    signInWithGoogle,
    signInWithGitHub,
    googleLoading: loading,
    githubLoading: loading,
  };
}
