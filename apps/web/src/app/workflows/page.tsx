"use client";

import type { Workflow } from "@reaxion/common";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  activateWorkflow,
  deactivateWorkflow,
  executeWorkflow,
  getWorkflows,
} from "../../lib/api";
import { cn } from "../../lib/utils";
import { computeEntryNode } from "../../workflows/utils";
import { getAuthToken } from "../../lib/auth";

type LoadState = "idle" | "loading" | "error";

export default function WorkflowsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      const silent = !!opts?.silent;
      if (!silent) setState("loading");
      setError(null);
      try {
        const data = await getWorkflows(token);
        setWorkflows(data);
        setState("idle");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        setState("error");
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) {
      void load();
    }
  }, [token, load]);

  const hasWorkflows = workflows.length > 0;

  const handleToggleActive = useCallback(
    async (workflow: Workflow) => {
      if (!token) return;
      setBusyId(workflow.id);
      try {
        const updated = workflow.active
          ? await deactivateWorkflow(workflow.id, token)
          : await activateWorkflow(workflow.id, token);
        setWorkflows((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        setState("error");
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const handleExecute = useCallback(
    async (workflow: Workflow) => {
      if (!token) return;
      setBusyId(workflow.id);
      try {
        await executeWorkflow(workflow.id, token);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
        setState("error");
      } finally {
        setBusyId(null);
      }
    },
    [token],
  );

  const refreshLabel = useMemo(() => {
    if (state === "loading") return "Actualisation…";
    if (state === "error") return "Réessayer";
    return "Actualiser";
  }, [state]);

  return (
    <div className="space-y-6 pb-16">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Mes workflows</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Visualisez, activez et exécutez vos automatisations existantes.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => load({ silent: false })}
            disabled={state === "loading"}
          >
            {refreshLabel}
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/workflows/create")}
          >
            Créer un workflow
          </Button>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      {state === "loading" && !hasWorkflows ? (
        <Card>
          <CardHeader>
            <CardTitle>Chargement…</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[hsl(var(--muted-foreground))]">
            Récupération de vos workflows en cours.
          </CardContent>
        </Card>
      ) : hasWorkflows ? (
        <Card>
          <CardHeader>
            <CardTitle>Vos workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflows.map((workflow) => {
              const entryId = computeEntryNode(workflow) ?? "(introuvable)";
              const nodesCount = workflow.nodes?.length ?? 0;
              const loadingThis = busyId === workflow.id;
              return (
                <div
                  key={workflow.id}
                  className="flex flex-col gap-4 rounded-md border border-[hsl(var(--border))] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{workflow.name}</h2>
                      <Badge
                        variant="outline"
                        className={cn(
                          workflow.active &&
                            "border-[hsl(var(--primary))] text-[hsl(var(--primary))]",
                        )}
                      >
                        {workflow.active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      ID&nbsp;:<span className="font-mono"> {workflow.id}</span>
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Nœuds&nbsp;: {nodesCount} • Entrée&nbsp;: {entryId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => handleToggleActive(workflow)}
                      disabled={loadingThis}
                    >
                      {workflow.active ? "Désactiver" : "Activer"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleExecute(workflow)}
                      disabled={loadingThis}
                    >
                      Exécuter
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Aucun workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Créez votre premier workflow pour l’afficher ici.
            </p>
            <Button
              variant="secondary"
              onClick={() => router.push("/workflows/create")}
            >
              Créer un workflow
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
