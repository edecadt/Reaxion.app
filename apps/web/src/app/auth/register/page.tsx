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
import { postJson } from "../../../lib/api";

type AuthResponse = {
  token: string;
  user: { id: number; email: string; name?: string | null };
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await postJson<AuthResponse>("/auth/register", {
        name: name.trim() || undefined,
        email,
        password,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/";
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid w-full place-items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Join Reaxion and start connecting services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <Alert>{error}</Alert> : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Automation"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-[hsl(var(--foreground))] underline-offset-4 hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
