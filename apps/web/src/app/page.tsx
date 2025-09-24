"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { API_URL } from "../lib/api";

type AboutPayload = {
  client: { host: string };
  server: {
    current_time: number;
    services: Array<{
      name: string;
      actions: Array<{ name: string; description: string }>;
      reactions: Array<{ name: string; description: string }>;
    }>;
  };
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>(
    "Use the inspector below to check the backend status.",
  );
  const [user, setUser] = useState<{
    email: string;
    name?: string | null;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const quickActions = useMemo(
    () => [
      {
        title: "Explore services",
        description:
          "Discover available actions and reactions from your connected apps.",
      },
      {
        title: "Build an automation",
        description:
          "Combine triggers and reactions in a few clicks to automate workflows.",
      },
      {
        title: "Track activity",
        description:
          "Monitor recent runs and keep an eye on what’s happening in real time.",
      },
    ],
    [],
  );

  const fetchAbout = async () => {
    setIsLoading(true);
    setResponse("Loading…");

    try {
      const res = await fetch(`${API_URL}/about.json`);

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data: AboutPayload = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResponse(`Request failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background))] to-[hsl(var(--secondary))/60] p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <Badge variant="outline">Automation hub</Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                {user
                  ? `Welcome back, ${user.name || user.email}`
                  : "Automate your world"}
              </h1>
              <p className="max-w-xl text-base text-[hsl(var(--muted-foreground))]">
                Connect services, listen for triggers, and launch powerful
                reactions without leaving this dashboard.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={fetchAbout} disabled={isLoading}>
                {isLoading ? "Checking backend…" : "Check backend health"}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.assign("/auth/register")}
              >
                Invite teammates
              </Button>
            </div>
          </div>
          <Card className="md:w-80">
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>
                Status of your current workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-dashed border-[hsl(var(--border))] p-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Account
                  </p>
                  <p className="text-sm font-medium">
                    {user ? user.email : "Guest"}
                  </p>
                </div>
                <Badge>{user ? "Connected" : "Offline"}</Badge>
              </div>
              <p className="rounded-md bg-[hsl(var(--muted))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
                API endpoint:
                <br />
                <span className="font-mono text-[hsl(var(--foreground))]">
                  {API_URL}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {quickActions.map((action) => (
          <Card key={action.title} className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {action.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{action.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Backend inspector</CardTitle>
          <CardDescription>
            Inspect the raw payload returned by `/about.json`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-[hsl(var(--foreground))]/95 p-4 text-sm text-white">
            {response}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
