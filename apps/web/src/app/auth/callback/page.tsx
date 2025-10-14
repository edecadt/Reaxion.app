"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { setAuthToken, setUser } from "../../../lib/auth";

function AuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    const mobileRedirect = searchParams.get("mobile_redirect");

    console.log("OAuth callback - token:", token ? "present" : "missing");
    console.log("OAuth callback - mobile_redirect:", mobileRedirect);

    // If this is a mobile OAuth callback, redirect to mobile app immediately
    if (token && mobileRedirect) {
      console.log("Redirecting to mobile app:", mobileRedirect);
      const redirectUrl = `${mobileRedirect}?token=${token}`;

      // Redirect to mobile app
      window.location.href = redirectUrl;

      // Try to close the window after a short delay (for mobile browsers)
      setTimeout(() => {
        window.close();
      }, 500);

      return;
    }

    // Normal web flow
    if (token) {
      setAuthToken(token);

      // Decode JWT to extract user info (simple base64 decode)
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({
          id: payload.sub,
          email: payload.email,
          name: payload.name || null,
        });
      } catch (err) {
        console.error("Failed to decode token:", err);
      }

      router.replace("/");
    } else {
      router.replace("/auth/login?error=oauth_failed");
    }
  }, [searchParams, router]);

  return (
    <div className="grid w-full h-screen place-items-center">
      <div className="text-center space-y-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="grid w-full h-screen place-items-center">
          <div className="text-center space-y-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <AuthCallback />
    </Suspense>
  );
}
