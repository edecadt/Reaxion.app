"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { clearAuth, getUser } from "../lib/auth";

type User = { id: number; email: string; name?: string | null };

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const logout = () => {
    clearAuth();
    setUser(null);
    window.location.href = "/auth/login";
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/60">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-semibold text-[hsl(var(--foreground))]"
          >
            Reaxion.app
          </Link>
          <Link
            href="/workflows"
            className={cn(
              "hidden text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))] md:inline-flex",
            )}
          >
            Mes workflows
          </Link>
          <Link
            href="/workflows/builder"
            className={cn(
              "hidden text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))] md:inline-flex",
            )}
          >
            Créer un workflow
          </Link>
          {user && (
            <Link
              href="/settings"
              className={cn(
                "hidden text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))] md:inline-flex",
              )}
            >
              Connexions
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-[hsl(var(--muted-foreground))] sm:inline">
                {user.name || user.email}
              </span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))]",
                )}
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-md bg-[hsl(var(--primary))] px-3 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-sm transition hover:bg-[hsl(var(--primary))]/90",
                )}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
