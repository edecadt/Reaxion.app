"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { forgotPassword } from "../../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    console.log("Sending forgot password request for:", email);
    try {
      const result = await forgotPassword(email);
      console.log("Forgot password result:", result);
      setSuccess(true);
      setEmail("");
    } catch (err) {
      console.error("Forgot password error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to send reset email";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid w-full place-items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your
            password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {success ? (
            <Alert variant="success">
              If an account exists with that email, a password reset link has
              been sent. Please check your inbox.
            </Alert>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Remember your password?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-[hsl(var(--foreground))] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
