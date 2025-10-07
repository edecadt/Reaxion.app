import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { getAuthToken, getUser, clearAuth } from "../lib/auth";

export function useAuth(options?: { redirectTo?: string; required?: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    id: number;
    email: string;
    name?: string | null;
  } | null>(null);

  const redirectTo = options?.redirectTo ?? "/auth/login";
  const required = options?.required ?? true;

  useEffect(() => {
    let mounted = true;

    const loadAuth = async () => {
      const rawToken = await getAuthToken();
      const rawUser = await getUser();

      if (!mounted) return;

      if (!rawToken) {
        setToken(null);
        setUser(null);
        setLoading(false);
        if (required) {
          router.replace(redirectTo as any);
        }
        return;
      }

      setToken(rawToken);
      setUser(rawUser);
      setLoading(false);
    };

    loadAuth();

    return () => {
      mounted = false;
    };
  }, [router, redirectTo, required]);

  const logout = async () => {
    await clearAuth();
    setToken(null);
    setUser(null);
    router.replace("/auth/login" as any);
  };

  return {
    token,
    user,
    loading,
    isAuthenticated: !!token,
    logout,
  };
}
