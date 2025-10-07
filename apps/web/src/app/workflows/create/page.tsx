"use client";

import type { CreateWorkflowDto, Workflow } from "@reaxion/common";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";
import {
  activateWorkflow,
  API_URL,
  createWorkflow,
  deactivateWorkflow,
  executeWorkflow,
  getAbout,
  type AboutService,
} from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { useWorkflowBuilder } from "../../../workflows/use-workflow-builder";
import {
  computeEntryNode,
  knownActionIdFor,
  knownReactionIdFor,
  toId,
} from "../../../workflows/utils";
import { getAuthToken } from "../../../lib/auth";

const LEVELS: Array<{ id: string; label: string }> = [
  { id: "info", label: "info" },
  { id: "warn", label: "warn" },
  { id: "error", label: "error" },
];

type Step = 1 | 2 | 3 | 4;

type NodeType = "action" | "reaction";

type NodeInfo = ReturnType<typeof useWorkflowBuilder>["state"]["nodes"][number];

type NodeSectionProps = {
  title: string;
  nodes: NodeInfo[];
  services: AboutService[];
  onRemove: (id: string) => void;
  onSelectService: (nodeId: string, serviceId: string) => void;
  onSelectAction?: (nodeId: string, actionId: string) => void;
  onSelectReaction?: (nodeId: string, reactionId: string) => void;
  onSetParams: (nodeId: string, params: Record<string, unknown>) => void;
  showActions: boolean;
  showReactions: boolean;
};

export default function CreateWorkflowPage() {
  const { state, actions } = useWorkflowBuilder();
  const [token, setToken] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);

  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  useEffect(() => () => actions.reset(), [actions]);

  useEffect(() => {
    if (!state.id) {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : createFallbackUuid();
      actions.setMeta({ id });
    }
  }, [state.id, actions]);

  const isNameValid = useMemo(() => state.name.trim().length > 0, [state.name]);

  const [services, setServices] = useState<AboutService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!token) return;
    setLoadingServices(true);
    setServicesError(null);
    try {
      const about = await getAbout(token);
      setServices(about.server.services);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      setServicesError(message);
    } finally {
      setLoadingServices(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadServices();
    }
  }, [token, loadServices]);

  const existingIds = useMemo(
    () => new Set(state.nodes.map((node) => node.id)),
    [state.nodes],
  );

  const referencedIds = useMemo(() => {
    const set = new Set<string>();
    for (const node of state.nodes) {
      const next = node.next;
      if (typeof next === "string") set.add(next);
      if (Array.isArray(next)) next.forEach((id) => set.add(id));
    }
    return set;
  }, [state.nodes]);

  const entryIds = useMemo(
    () =>
      state.nodes.map((node) => node.id).filter((id) => !referencedIds.has(id)),
    [state.nodes, referencedIds],
  );

  const invalidNextByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of state.nodes) {
      const next = node.next;
      const list = Array.isArray(next) ? next : next ? [next] : [];
      const invalid = list.filter((id) => !existingIds.has(id));
      if (invalid.length > 0) map.set(node.id, invalid);
    }
    return map;
  }, [state.nodes, existingIds]);

  const selfLoopIds = useMemo(() => {
    const set = new Set<string>();
    for (const node of state.nodes) {
      const next = node.next;
      if (typeof next === "string" && next === node.id) set.add(node.id);
      if (Array.isArray(next) && next.includes(node.id)) set.add(node.id);
    }
    return set;
  }, [state.nodes]);

  const nodeSetupErrors = useMemo(() => {
    const errors: string[] = [];
    if (!state.id.trim()) errors.push("Identifiant manquant");
    if (!isNameValid) errors.push("Le nom est obligatoire");
    if (state.nodes.length === 0) errors.push("Ajoutez au moins un nœud");

    const ids = state.nodes.map((node) => node.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push(
        `Nœuds en double: ${Array.from(new Set(duplicates)).join(", ")}`,
      );
    }

    for (const node of state.nodes) {
      if (!node.serviceId) errors.push(`Nœud ${node.id}: service requis`);
      const hasAction = Boolean(node.actionId);
      const hasReaction = Boolean(node.reactionId);
      if (hasAction === hasReaction) {
        errors.push(`Nœud ${node.id}: choisissez action OU réaction`);
      }
      if (node.serviceId === "timer" && node.actionId === "cron") {
        const expression = String(
          (node.params as { expression?: string })?.expression ?? "",
        ).trim();
        if (!(expression && expression.split(/\s+/).length === 6)) {
          errors.push(`Nœud ${node.id}: cron invalide (6 champs)`);
        }
      }
      if (node.serviceId === "timer" && node.reactionId === "log") {
        const params = node.params as { message?: string; level?: string };
        if (!params?.message?.trim())
          errors.push(`Nœud ${node.id}: message requis`);
        if (
          !params?.level ||
          !LEVELS.some((level) => level.id === params.level)
        ) {
          errors.push(`Nœud ${node.id}: niveau invalide`);
        }
      }
      if (node.serviceId === "timer" && node.reactionId === "wait") {
        const seconds = Number(
          String((node.params as { seconds?: number })?.seconds ?? "0"),
        );
        if (!Number.isFinite(seconds) || seconds < 0) {
          errors.push(`Nœud ${node.id}: seconds ≥ 0`);
        }
      }
    }
    return errors;
  }, [state, isNameValid]);

  const validationErrors = useMemo(() => {
    const errors = [...nodeSetupErrors];
    if (selfLoopIds.size > 0) {
      errors.push(`Boucles: ${Array.from(selfLoopIds).join(", ")}`);
    }
    if (invalidNextByNode.size > 0) {
      const parts: string[] = [];
      invalidNextByNode.forEach((invalids, key) => {
        parts.push(`${key}→[${invalids.join(", ")}]`);
      });
      errors.push(`Références invalides: ${parts.join("; ")}`);
    }
    if (state.nodes.length > 0 && entryIds.length !== 1) {
      errors.push("Le graphe doit avoir exactement un nœud d&#39;entrée");
    }
    return errors;
  }, [
    nodeSetupErrors,
    selfLoopIds,
    invalidNextByNode,
    entryIds,
    state.nodes.length,
  ]);

  const step1Valid = isNameValid;
  const step2Valid = nodeSetupErrors.length === 0;
  const step3Valid =
    step2Valid &&
    selfLoopIds.size === 0 &&
    invalidNextByNode.size === 0 &&
    entryIds.length === 1;
  const isFormValid = validationErrors.length === 0;

  const [nodeTypes, setNodeTypes] = useState<Record<string, NodeType>>({});

  const nextNodeId = useCallback(() => {
    const ids = new Set(state.nodes.map((node) => node.id));
    let i = 1;
    while (ids.has(`node-${i}`)) i += 1;
    return `node-${i}`;
  }, [state.nodes]);

  const addTriggerNode = useCallback(() => {
    const id = nextNodeId();
    actions.addNode({ id });
    setNodeTypes((prev) => ({ ...prev, [id]: "action" }));
  }, [actions, nextNodeId]);

  const addReactionNode = useCallback(() => {
    const id = nextNodeId();
    actions.addNode({ id });
    setNodeTypes((prev) => ({ ...prev, [id]: "reaction" }));
  }, [actions, nextNodeId]);

  const removeNode = useCallback(
    (id: string) => {
      actions.removeNode(id);
      setNodeTypes((prev) => {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      });
    },
    [actions],
  );

  const triggerNodes = state.nodes.filter(
    (node) =>
      (nodeTypes[node.id] ??
        (node.actionId
          ? "action"
          : node.reactionId
            ? "reaction"
            : "action")) === "action",
  );
  const reactionNodes = state.nodes.filter(
    (node) =>
      (nodeTypes[node.id] ??
        (node.actionId
          ? "action"
          : node.reactionId
            ? "reaction"
            : "reaction")) === "reaction",
  );

  const serialize = useCallback((): CreateWorkflowDto => {
    const nodes = state.nodes.map((node) => {
      let params: Record<string, unknown> = {
        ...(node.params as Record<string, unknown>),
      };
      if (node.serviceId === "timer" && node.reactionId === "wait") {
        const raw = Number(
          String((params as { seconds?: unknown })?.seconds ?? "0"),
        );
        params = { ...params, seconds: Number.isFinite(raw) ? raw : 0 };
      }
      const next = Array.isArray(node.next)
        ? node.next.length > 0
          ? node.next
          : undefined
        : node.next;
      return {
        id: node.id,
        serviceId: node.serviceId,
        actionId: node.actionId,
        reactionId: node.reactionId,
        params,
        next,
      };
    });
    return { id: state.id, name: state.name, active: state.active, nodes };
  }, [state]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<Workflow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!isFormValid || creating || !token) return;
    setCreating(true);
    setCreateError(null);
    setFeedback(null);
    try {
      const dto = serialize();
      const result = await createWorkflow(dto, token);
      setCreated(result);
      setStep(4);
      setFeedback("Workflow créé avec succès");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      setCreateError(message);
      if (
        message.toLowerCase().includes("already exists") ||
        message.toLowerCase().includes("existe déjà")
      ) {
        const newId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : createFallbackUuid();
        actions.setMeta({ id: newId });
        setFeedback("Nouvel identifiant généré. Réessayez.");
      }
    } finally {
      setCreating(false);
    }
  }, [isFormValid, creating, serialize, token, actions]);

  const handleToggleActive = useCallback(async () => {
    if (!created || !token) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const updated = created.active
        ? await deactivateWorkflow(created.id, token)
        : await activateWorkflow(created.id, token);
      setCreated(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      setFeedback(message);
    } finally {
      setActionLoading(false);
    }
  }, [created, token]);

  const handleExecute = useCallback(async () => {
    if (!created || !token) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const { runId } = await executeWorkflow(created.id, token);
      setLastRunId(runId);
      setFeedback("Exécution démarrée");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      setFeedback(message);
    } finally {
      setActionLoading(false);
    }
  }, [created, token]);

  const goPrev = useCallback(
    () => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev)),
    [],
  );
  const goNext = useCallback(() => {
    setStep((prev) => {
      if (prev === 1 && !step1Valid) return prev;
      if (prev === 2 && !step2Valid) return prev;
      if (prev === 3 && !step3Valid) return prev;
      return prev < 4 ? ((prev + 1) as Step) : prev;
    });
  }, [step1Valid, step2Valid, step3Valid]);

  return (
    <div className="space-y-6 pb-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Créer un workflow</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Construisez vos automatisations en quatre étapes: informations, nœuds,
          chaînage et validation.
        </p>
      </header>

      <Stepper
        step={step}
        steps={[
          { index: 1, label: "Infos", valid: step1Valid },
          { index: 2, label: "Nœuds", valid: step2Valid },
          { index: 3, label: "Chaînage", valid: step3Valid },
          { index: 4, label: "Validation", valid: isFormValid },
        ]}
      />

      {step === 1 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom</label>
                <Input
                  value={state.name}
                  onChange={(event) =>
                    actions.setMeta({ name: event.target.value })
                  }
                  placeholder="Mon workflow"
                />
                {!isNameValid && (
                  <p className="text-xs text-red-600">Le nom est obligatoire</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Actif</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Activez pour exécuter le workflow après sa création.
                  </p>
                </div>
                <Switch
                  checked={state.active}
                  onCheckedChange={(checked) =>
                    actions.setMeta({ active: checked })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Identifiant</label>
                <div className="rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm font-mono">
                  {state.id}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Services disponibles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingServices ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Chargement des services…
                </p>
              ) : servicesError ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-600">{servicesError}</p>
                  <Button variant="outline" onClick={loadServices}>
                    Réessayer
                  </Button>
                </div>
              ) : services.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Aucun service disponible pour le moment.
                  </p>
                  <Button variant="outline" onClick={loadServices}>
                    Recharger
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {services.map((service) => (
                    <div
                      key={service.name}
                      className="rounded-md border border-[hsl(var(--border))] p-3"
                    >
                      <p className="text-sm font-medium">{service.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {service.actions.length} actions •{" "}
                        {service.reactions.length} réactions
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Composer les nœuds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={addTriggerNode}>
                  Ajouter un déclencheur
                </Button>
                <Button variant="secondary" onClick={addReactionNode}>
                  Ajouter une réaction
                </Button>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Les déclencheurs initient le workflow, les réactions répondent
                aux événements.
              </p>
            </CardContent>
          </Card>

          <NodeSection
            title="Déclencheurs"
            nodes={triggerNodes}
            services={services}
            onRemove={removeNode}
            onSelectService={(nodeId, serviceId) =>
              actions.updateNode(nodeId, {
                serviceId,
                actionId: undefined,
                reactionId: undefined,
                params: {},
              })
            }
            onSelectAction={(nodeId, actionId) =>
              actions.updateNode(nodeId, {
                actionId,
                reactionId: undefined,
                params: {},
              })
            }
            onSetParams={(nodeId, params) =>
              actions.setNodeParams(nodeId, params)
            }
            showActions
            showReactions={false}
          />

          <NodeSection
            title="Réactions"
            nodes={reactionNodes}
            services={services}
            onRemove={removeNode}
            onSelectService={(nodeId, serviceId) =>
              actions.updateNode(nodeId, {
                serviceId,
                actionId: undefined,
                reactionId: undefined,
                params: {},
              })
            }
            onSelectReaction={(nodeId, reactionId) =>
              actions.updateNode(nodeId, {
                reactionId,
                actionId: undefined,
                params: {},
              })
            }
            onSetParams={(nodeId, params) =>
              actions.setNodeParams(nodeId, params)
            }
            showActions={false}
            showReactions
          />

          {nodeSetupErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Problèmes détectés</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {nodeSetupErrors.map((error) => (
                  <p key={error} className="text-sm text-red-600">
                    • {error}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          {state.nodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Nœud d&#39;entrée détecté</CardTitle>
              </CardHeader>
              <CardContent>
                {entryIds.length === 1 ? (
                  <p className="text-sm">
                    Nœud d&#39;entrée:{" "}
                    <span className="font-mono">{entryIds[0]}</span>
                  </p>
                ) : entryIds.length === 0 ? (
                  <p className="text-sm text-red-600">
                    Aucun nœud d&#39;entrée détecté
                  </p>
                ) : (
                  <p className="text-sm text-red-600">
                    Plusieurs nœuds d&#39;entrée: {entryIds.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {state.nodes.map((node) => {
              const chipIds = state.nodes.filter(
                (other) => other.id !== node.id,
              );
              const selected = Array.isArray(node.next)
                ? node.next
                : node.next
                  ? [node.next]
                  : [];
              return (
                <Card key={node.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="font-mono text-base">{node.id}</span>
                      <Badge variant="outline">
                        {node.actionId
                          ? "Trigger"
                          : node.reactionId
                            ? "Réaction"
                            : "Nœud"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {node.serviceId || "(service non défini)"}
                      {node.actionId
                        ? ` • action:${node.actionId}`
                        : node.reactionId
                          ? ` • reaction:${node.reactionId}`
                          : ""}
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Chaînage</p>
                      <div className="flex flex-wrap gap-2">
                        {chipIds.length === 0 && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            Ajoutez d&#39;autres nœuds pour configurer le
                            chaînage.
                          </p>
                        )}
                        {chipIds.map((other) => {
                          const active = selected.includes(other.id);
                          return (
                            <Chip
                              key={other.id}
                              active={active}
                              onClick={() => {
                                const nextSet = new Set(selected);
                                if (active) nextSet.delete(other.id);
                                else nextSet.add(other.id);
                                const next = Array.from(nextSet);
                                actions.setNodeNext(
                                  node.id,
                                  next.length > 0 ? next : undefined,
                                );
                              }}
                            >
                              {other.id}
                            </Chip>
                          );
                        })}
                      </div>
                    </div>
                    {selfLoopIds.has(node.id) && (
                      <p className="text-xs text-red-600">
                        Boucle vers soi-même interdite
                      </p>
                    )}
                    {invalidNextByNode.get(node.id) && (
                      <p className="text-xs text-red-600">
                        Références invalides:{" "}
                        {invalidNextByNode.get(node.id)!.join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {validationErrors.length === 0 ? (
                <p className="text-sm text-green-600">
                  Tout est valide, vous pouvez créer le workflow.
                </p>
              ) : (
                validationErrors.map((error) => (
                  <p key={error} className="text-sm text-red-600">
                    • {error}
                  </p>
                ))
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleCreate}
            disabled={!isFormValid || creating}
            className="w-full md:w-auto"
          >
            {creating ? "Création en cours…" : "Créer le workflow"}
          </Button>

          {createError && (
            <Card>
              <CardHeader>
                <CardTitle>Erreur lors de la création</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-600">{createError}</p>
              </CardContent>
            </Card>
          )}

          {feedback && (
            <Card>
              <CardHeader>
                <CardTitle>Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{feedback}</p>
              </CardContent>
            </Card>
          )}

          {created && (
            <Card>
              <CardHeader>
                <CardTitle>Workflow créé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium">ID:</span>{" "}
                  <span className="font-mono">{created.id}</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">Nom:</span> {created.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Actif:</span>{" "}
                  {created.active ? "Oui" : "Non"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Nœud d&#39;entrée:</span>{" "}
                  {computeEntryNode(created) ?? "(introuvable)"}
                </p>
                {created.webhookToken && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Webhook test</p>
                    <div className="break-all rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs font-mono">
                      {`${API_URL}/webhooks/test-webhook/test/${created.webhookToken}`}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleToggleActive}
                    disabled={actionLoading}
                  >
                    {created.active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleExecute}
                    disabled={actionLoading}
                  >
                    Exécuter maintenant
                  </Button>
                </div>
                {lastRunId && (
                  <p className="text-sm">
                    <span className="font-medium">Dernier run:</span>{" "}
                    <span className="font-mono">{lastRunId}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-[hsl(var(--border))] pt-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <Button variant="outline" onClick={goPrev} disabled={step === 1}>
            Précédent
          </Button>
          {step < 4 && (
            <Button
              onClick={goNext}
              disabled={
                (step === 1 && !step1Valid) ||
                (step === 2 && !step2Valid) ||
                (step === 3 && !step3Valid)
              }
            >
              Suivant
            </Button>
          )}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Les modifications sont enregistrées localement jusqu&#39;à la
          création.
        </p>
      </div>
    </div>
  );
}

function NodeSection({
  title,
  nodes,
  services,
  onRemove,
  onSelectService,
  onSelectAction,
  onSelectReaction,
  onSetParams,
  showActions,
  showReactions,
}: NodeSectionProps) {
  const serviceIdOf = (service: AboutService) =>
    service.id || toId(service.name);
  const actionIdOf = (
    serviceId: string,
    action: AboutService["actions"][number],
  ) => action.id || knownActionIdFor(serviceId, action.name);
  const reactionIdOf = (
    serviceId: string,
    reaction: AboutService["reactions"][number],
  ) => reaction.id || knownReactionIdFor(serviceId, reaction.name);

  const renderField = (
    node: NodeInfo,
    key: string,
    type: string | undefined,
  ) => {
    const params = (node.params as Record<string, unknown> | undefined) ?? {};
    const current = params[key];
    const normalized = (type || "string").toLowerCase();

    if (normalized === "boolean") {
      return (
        <div key={key} className="flex items-center justify-between">
          <p className="text-sm font-medium">{key}</p>
          <Switch
            checked={Boolean(current)}
            onCheckedChange={(checked) =>
              onSetParams(node.id, { ...params, [key]: checked })
            }
          />
        </div>
      );
    }

    if (normalized === "number") {
      return (
        <div key={key} className="space-y-1">
          <p className="text-sm font-medium">{key}</p>
          <Input
            value={String((current as number | string | undefined) ?? "")}
            onChange={(event) =>
              onSetParams(node.id, {
                ...params,
                [key]: event.target.value.replace(/[^0-9.-]/g, ""),
              })
            }
            inputMode="decimal"
          />
        </div>
      );
    }

    return (
      <div key={key} className="space-y-1">
        <p className="text-sm font-medium">{key}</p>
        <Input
          value={String((current as string | undefined) ?? "")}
          onChange={(event) =>
            onSetParams(node.id, { ...params, [key]: event.target.value })
          }
        />
      </div>
    );
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {nodes.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Aucun nœud
        </p>
      ) : (
        nodes.map((node) => {
          const selectedService = services.find(
            (service) => serviceIdOf(service) === (node.serviceId || ""),
          );
          const actionsList = selectedService?.actions ?? [];
          const reactionsList = selectedService?.reactions ?? [];
          const selectedAction = actionsList.find(
            (action) =>
              actionIdOf(node.serviceId || "", action) === node.actionId,
          );
          const selectedReaction = reactionsList.find(
            (reaction) =>
              reactionIdOf(node.serviceId || "", reaction) === node.reactionId,
          );
          const inputDefinition = (selectedAction?.input ??
            selectedReaction?.input ??
            {}) as Record<string, string>;
          const inputKeys = Object.keys(inputDefinition);

          return (
            <Card key={node.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base">{node.id}</span>
                    <Badge variant="outline">
                      {showActions ? "Trigger" : "Réaction"}
                    </Badge>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemove(node.id)}
                  >
                    Supprimer
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {node.serviceId || "(service non défini)"}
                  {node.actionId
                    ? ` • action:${node.actionId}`
                    : node.reactionId
                      ? ` • reaction:${node.reactionId}`
                      : ""}
                </p>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Service</p>
                  <div className="flex flex-wrap gap-2">
                    {services.map((service) => {
                      const id = serviceIdOf(service);
                      const active = id === node.serviceId;
                      return (
                        <Chip
                          key={service.id ?? service.name}
                          active={active}
                          onClick={() => onSelectService(node.id, id)}
                        >
                          {service.name}
                        </Chip>
                      );
                    })}
                  </div>
                </div>

                {selectedService && (
                  <div className="space-y-4">
                    {showActions && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Triggers</p>
                        <div className="flex flex-wrap gap-2">
                          {actionsList.map((action) => {
                            const actionId = actionIdOf(
                              node.serviceId || "",
                              action,
                            );
                            const active = node.actionId === actionId;
                            return (
                              <Chip
                                key={action.id ?? action.name}
                                active={active}
                                onClick={() =>
                                  onSelectAction?.(node.id, actionId)
                                }
                              >
                                {action.name}
                              </Chip>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {showReactions && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Réactions</p>
                        <div className="flex flex-wrap gap-2">
                          {reactionsList.map((reaction) => {
                            const reactionId = reactionIdOf(
                              node.serviceId || "",
                              reaction,
                            );
                            const active = node.reactionId === reactionId;
                            return (
                              <Chip
                                key={reaction.id ?? reaction.name}
                                active={active}
                                onClick={() =>
                                  onSelectReaction?.(node.id, reactionId)
                                }
                              >
                                {reaction.name}
                              </Chip>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Paramètres</p>
                      {inputKeys.length === 0 ? (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                          Aucun paramètre requis
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {inputKeys.map((key) =>
                            renderField(node, key, inputDefinition[key]),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}

function Stepper({
  step,
  steps,
}: {
  step: Step;
  steps: Array<{ index: Step; label: string; valid: boolean }>;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {steps.map(({ index, label, valid }) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
            step === index
              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              : "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
          )}
        >
          <span className="font-medium">
            {index}. {label}
          </span>
          {valid && <span className="text-xs">✓</span>}
        </div>
      ))}
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition",
        active
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
          : "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))]",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function createFallbackUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
