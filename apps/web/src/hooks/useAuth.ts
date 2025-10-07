import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    if (typeof window === "undefined") return;

    const rawToken = getAuthToken();
    const rawUser = getUser();

    if (!rawToken) {
      setToken(null);
      setUser(null);
      setLoading(false);
      if (required) {
        router.push(redirectTo);
      }
      return;
    }

    setToken(rawToken);
    setUser(rawUser);
    setLoading(false);
  }, [router, redirectTo, required]);

  const logout = () => {
    clearAuth();
    setToken(null);
    setUser(null);
    router.push("/auth/login");
  };

  return {
    token,
    user,
    loading,
    isAuthenticated: !!token,
    logout,
  };
}
