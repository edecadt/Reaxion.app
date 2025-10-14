import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { setAuthToken, setUser } from "./auth";

// Necessary for closing the browser after OAuth redirect
WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080";

export function useOAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const openOAuth = async (provider: "google" | "github") => {
    if (loading) return;

    setLoading(true);
    try {
      const redirectUrl = `reaxion://auth/callback`;
      const authUrl = `${API_URL}/auth/${provider}?redirect_uri=${encodeURIComponent(redirectUrl)}`;

      console.log("OAuth URL:", authUrl);
      console.log("Redirect URL:", redirectUrl);

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
      );

      console.log("OAuth result:", result);

      if (result.type === "success" && result.url) {
        // Extract token from redirect URL
        const url = new URL(result.url);
        const token = url.searchParams.get("token");

        if (token) {
          await handleOAuthSuccess(token);
        } else {
          Alert.alert("Error", "No token received from authentication");
        }
      } else if (result.type === "cancel") {
        // User cancelled, do nothing
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
      // Save token
      await setAuthToken(token);

      // Decode JWT to extract user info
      const payload = JSON.parse(atob(token.split(".")[1]));
      await setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name || null,
      });

      // Redirect to home
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
