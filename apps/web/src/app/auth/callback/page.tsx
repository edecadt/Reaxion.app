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

    if (token && mobileRedirect) {
      const redirectUrl = `${mobileRedirect}?token=${token}`;

      window.location.href = redirectUrl;

      setTimeout(() => {
        window.close();
      }, 500);

      return;
    }

    if (token) {
      setAuthToken(token);

      try {
        const [, payloadSegment] = token.split(".");

        if (!payloadSegment) {
          throw new Error("Invalid token structure");
        }

        const normalizedPayload = payloadSegment
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const paddedPayload =
          normalizedPayload +
          "=".repeat((4 - (normalizedPayload.length % 4)) % 4);
        const payload = JSON.parse(atob(paddedPayload));
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
