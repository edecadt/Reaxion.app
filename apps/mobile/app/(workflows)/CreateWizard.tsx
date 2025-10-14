import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { CreateWorkflowDto, Workflow } from "@reaxion/common";
import {
  activateWorkflow,
  createWorkflow,
  deactivateWorkflow,
  executeWorkflow,
  getAbout,
  type AboutService,
} from "../../src/lib/api";
import { tryGetApiUrl } from "../../src/lib/api-config";
import { useToast } from "../../src/components/Toast";
import { useAuth } from "../../src/hooks/useAuth";
import { useWorkflowBuilder } from "../../src/workflows/use-workflow-builder";

const stepsMeta = [
  {
    id: 1,
    title: "Informations clés",
    description:
      "Posez les bases : donnez un nom clair et choisissez le statut.",
    icon: "edit-3",
  },
  {
    id: 2,
    title: "Construire les blocs",
    description:
      "Ajoutez déclencheurs et réactions inspirés de vos services favoris.",
    icon: "cpu",
  },
  {
    id: 3,
    title: "Chaîner le parcours",
    description:
      "Organisez l’enchaînement de vos nœuds pour raconter le bon scénario.",
    icon: "git-branch",
  },
  {
    id: 4,
    title: "Validation finale",
    description:
      "Relisez, activez et lancez votre workflow en toute confiance.",
    icon: "check-circle",
  },
] as const;

type Step = (typeof stepsMeta)[number]["id"];

export default function CreateWorkflowWizard() {
  const toast = useToast();
  const { token } = useAuth();
  const { state, actions } = useWorkflowBuilder();

  const [step, setStep] = useState<Step>(1);
  const currentMeta = stepsMeta.find((item) => item.id === step)!;

  useEffect(() => () => actions.reset(), [actions]);
  useEffect(() => {
    if (!state.id) actions.setMeta({ id: uuidv4() });
  }, [state.id, actions]);

  const isNameValid = useMemo(() => state.name.trim().length > 0, [state.name]);

  const [services, setServices] = useState<AboutService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setServicesError(null);
    try {
      const about = await getAbout(token ?? undefined);
      setServices(about.server.services);
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingServices(false);
    }
  }, [token]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const existingIds = useMemo(
    () => new Set(state.nodes.map((n) => n.id)),
    [state.nodes],
  );

  const referencedIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of state.nodes) {
      const next = n.next;
      if (typeof next === "string") set.add(next);
      else if (Array.isArray(next)) next.forEach((id) => set.add(id));
    }
    return set;
  }, [state.nodes]);

  const entryIds = useMemo(
    () => state.nodes.map((n) => n.id).filter((id) => !referencedIds.has(id)),
    [state.nodes, referencedIds],
  );

  const invalidNextByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of state.nodes) {
      const arr = Array.isArray(n.next) ? n.next : n.next ? [n.next] : [];
      const invalid = arr.filter((id) => !existingIds.has(id));
      if (invalid.length > 0) map.set(n.id, invalid);
    }
    return map;
  }, [state.nodes, existingIds]);

  const selfLoopIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of state.nodes) {
      const next = n.next;
      if (typeof next === "string") {
        if (next === n.id) set.add(n.id);
      } else if (Array.isArray(next)) {
        if (next.includes(n.id)) set.add(n.id);
      }
    }
    return set;
  }, [state.nodes]);

  const nodeSetupErrors = useMemo(() => {
    const errs: string[] = [];
    if (!state.id.trim()) errs.push("Identifiant manquant");
    if (!isNameValid) errs.push("Le nom est obligatoire");
    if (state.nodes.length === 0) errs.push("Ajoutez au moins un nœud");
    const ids = state.nodes.map((n) => n.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length)
      errs.push(`Nœuds en double: ${Array.from(new Set(dup)).join(", ")}`);
    for (const n of state.nodes) {
      if (!n.serviceId) errs.push(`Nœud ${n.id}: service requis`);
      const hasAction = !!n.actionId;
      const hasReaction = !!n.reactionId;
      if (hasAction === hasReaction)
        errs.push(`Nœud ${n.id}: choisissez action OU réaction`);
      if (n.serviceId === "timer" && n.actionId === "cron") {
        const expr = String((n.params as any)?.expression ?? "").trim();
        if (!(expr && expr.split(/\s+/).length === 6))
          errs.push(`Nœud ${n.id}: cron invalide (6 champs)`);
      }
      if (n.serviceId === "timer" && n.reactionId === "log") {
        const msg = String((n.params as any)?.message ?? "").trim();
        const lvl = String((n.params as any)?.level ?? "");
        if (!msg) errs.push(`Nœud ${n.id}: message requis`);
        if (!["info", "warn", "error"].includes(lvl))
          errs.push(`Nœud ${n.id}: niveau invalide`);
      }
      if (n.serviceId === "timer" && n.reactionId === "wait") {
        const num = Number(String((n.params as any)?.seconds ?? "0"));
        if (!Number.isFinite(num) || num < 0)
          errs.push(`Nœud ${n.id}: seconds ≥ 0`);
      }
    }
    return errs;
  }, [state, isNameValid]);

  const validationErrors = useMemo(() => {
    const errs = [...nodeSetupErrors];
    if (selfLoopIds.size)
      errs.push(`Boucles: ${Array.from(selfLoopIds).join(", ")}`);
    if (invalidNextByNode.size) {
      const parts: string[] = [];
      invalidNextByNode.forEach((vals, key) =>
        parts.push(`${key}→[${vals.join(", ")}]`),
      );
      errs.push(`Références invalides: ${parts.join("; ")}`);
    }
    if (state.nodes.length > 0 && entryIds.length !== 1)
      errs.push("Le graphe doit avoir exactement un nœud d'entrée");
    return errs;
  }, [
    nodeSetupErrors,
    selfLoopIds,
    invalidNextByNode,
    entryIds,
    state.nodes.length,
  ]);

  const stepValidity: boolean[] = useMemo(
    () => [
      isNameValid,
      nodeSetupErrors.length === 0,
      nodeSetupErrors.length === 0 &&
        selfLoopIds.size === 0 &&
        invalidNextByNode.size === 0 &&
        entryIds.length === 1,
      validationErrors.length === 0,
    ],
    [
      isNameValid,
      nodeSetupErrors.length,
      selfLoopIds.size,
      invalidNextByNode.size,
      entryIds.length,
      validationErrors.length,
    ],
  );

  const isFormValid = validationErrors.length === 0;

  const [nodeTypes, setNodeTypes] = useState<
    Record<string, "action" | "reaction">
  >({});

  const nextNodeId = useCallback(() => {
    const ids = new Set(state.nodes.map((n) => n.id));
    let i = 1;
    while (ids.has(`node-${i}`)) i++;
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
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    },
    [actions],
  );

  const serialize = useCallback((): CreateWorkflowDto => {
    const nodes = state.nodes.map((n) => {
      let params: Record<string, unknown> = { ...(n.params as any) };
      if (n.serviceId === "timer" && n.reactionId === "wait") {
        const num = Number(String((params as any)?.seconds ?? "0"));
        params = { ...params, seconds: Number.isFinite(num) ? num : 0 };
      }
      const next = Array.isArray(n.next)
        ? n.next.length
          ? n.next
          : undefined
        : n.next;
      return {
        id: n.id,
        serviceId: n.serviceId,
        actionId: n.actionId,
        reactionId: n.reactionId,
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

  const handleCreate = useCallback(async () => {
    if (!isFormValid) return;
    setCreating(true);
    setCreateError(null);
    try {
      const dto = serialize();
      const result = await createWorkflow(dto, token ?? undefined);
      setCreated(result);
      toast.success("Workflow créé");
      setStep(4);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      setCreateError(message);
      toast.error("Échec de la création du workflow");
      if (
        message.toLowerCase().includes("already exists") ||
        message.toLowerCase().includes("existe déjà")
      ) {
        const newId = uuidv4();
        actions.setMeta({ id: newId });
        toast.show("Nouvel identifiant généré. Réessayez.");
      }
    } finally {
      setCreating(false);
    }
  }, [isFormValid, serialize, actions, toast, token]);

  const handleToggleActive = useCallback(async () => {
    if (!created) return;
    setActionLoading(true);
    try {
      const updated = created.active
        ? await deactivateWorkflow(created.id, token ?? undefined)
        : await activateWorkflow(created.id, token ?? undefined);
      setCreated(updated);
      toast.success(updated.active ? "Workflow activé" : "Workflow désactivé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setActionLoading(false);
    }
  }, [created, toast, token]);

  const handleExecute = useCallback(async () => {
    if (!created) return;
    setActionLoading(true);
    try {
      const { runId } = await executeWorkflow(created.id, token ?? undefined);
      setLastRunId(runId);
      toast.success("Exécution démarrée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setActionLoading(false);
    }
  }, [created, toast, token]);

  const goPrev = useCallback(() => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  }, []);

  const goNext = useCallback(() => {
    setStep((prev) => {
      const index = stepsMeta.findIndex((item) => item.id === prev);
      if (index === -1) return prev;
      if (prev === 1 && !stepValidity[0]) return prev;
      if (prev === 2 && !stepValidity[1]) return prev;
      if (prev === 3 && !stepValidity[2]) return prev;
      if (index < stepsMeta.length - 1) return stepsMeta[index + 1].id as Step;
      return prev;
    });
  }, [stepValidity]);

  const canReachStep = useCallback(
    (target: Step) => {
      if (target <= step) return true;
      if (target === 2) return stepValidity[0];
      if (target === 3) return stepValidity[0] && stepValidity[1];
      if (target === 4)
        return stepValidity[0] && stepValidity[1] && stepValidity[2];
      return false;
    },
    [step, stepValidity],
  );

  const triggerNodes = state.nodes.filter(
    (n) =>
      (nodeTypes[n.id] ??
        (n.actionId ? "action" : n.reactionId ? "reaction" : "action")) ===
      "action",
  );
  const reactionNodes = state.nodes.filter(
    (n) =>
      (nodeTypes[n.id] ??
        (n.actionId ? "action" : n.reactionId ? "reaction" : "reaction")) ===
      "reaction",
  );

  const progress = step / stepsMeta.length;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.stepHeader}>
            <View style={styles.stepIconCircle}>
              <Feather name={currentMeta.icon} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.stepCount}>
                Étape {step} sur {stepsMeta.length}
              </Text>
              <Text style={styles.heading}>{currentMeta.title}</Text>
              <Text style={styles.subheading}>{currentMeta.description}</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>

          <View style={styles.stepPills}>
            {stepsMeta.map((item, index) => {
              const isActive = item.id === step;
              const isComplete = stepValidity[index] && item.id !== step;
              const disabled = !canReachStep(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (!disabled) setStep(item.id);
                  }}
                  disabled={disabled}
                  style={[
                    styles.stepPill,
                    isActive && styles.stepPillActive,
                    isComplete && styles.stepPillDone,
                    disabled && styles.stepPillDisabled,
                  ]}
                >
                  <Feather
                    name={
                      isComplete
                        ? "check"
                        : item.icon === "git-branch"
                          ? "git-branch"
                          : (item.icon as FeatherIcon)
                    }
                    size={14}
                    color={
                      isActive || isComplete
                        ? "#fff"
                        : disabled
                          ? "#9ca3af"
                          : "#4b5563"
                    }
                  />
                  <Text
                    style={[
                      styles.stepPillText,
                      (isActive || isComplete) && styles.stepPillTextActive,
                      disabled && styles.stepPillTextDisabled,
                    ]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sections}>
            {step === 1 && (
              <View style={styles.card}>
                <SectionHeader
                  icon="edit-3"
                  title="Nom et visibilité"
                  subtitle="Un nom clair aide toute l’équipe à reconnaître rapidement ce workflow."
                />

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Nom du workflow</Text>
                  <TextInput
                    value={state.name}
                    onChangeText={(text) => actions.setMeta({ name: text })}
                    placeholder="Ex: Leads entrants"
                    style={[styles.input, !isNameValid && styles.inputError]}
                    autoCapitalize="sentences"
                    autoCorrect
                  />
                  {!isNameValid && (
                    <Text style={styles.errorText}>
                      Le nom est obligatoire.
                    </Text>
                  )}
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Activer dès la création</Text>
                    <Text style={styles.helperText}>
                      Vous pourrez changer ce statut à tout moment.
                    </Text>
                  </View>
                  <Switch
                    value={state.active}
                    onValueChange={(value) =>
                      actions.setMeta({ active: value })
                    }
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Identifiant technique</Text>
                  <View style={styles.readonlyField}>
                    <Text style={styles.readonlyText}>{state.id || "—"}</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Automatiquement généré pour lier ce workflow aux
                    intégrations.
                  </Text>
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={{ gap: 18 }}>
                <View style={styles.card}>
                  <SectionHeader
                    icon="grid"
                    title="Catalogue des services"
                    subtitle="Choisissez les services qui feront vibrer vos automatisations."
                  />
                  {loadingServices ? (
                    <View style={styles.inlineRow}>
                      <ActivityIndicator />
                      <Text style={styles.cardText}>Chargement…</Text>
                    </View>
                  ) : servicesError ? (
                    <View style={{ gap: 8 }}>
                      <Text style={[styles.cardText, styles.errorText]}>
                        {servicesError}
                      </Text>
                      <SecondaryButton
                        label="Réessayer"
                        onPress={loadServices}
                      />
                    </View>
                  ) : services.length === 0 ? (
                    <View style={{ gap: 8 }}>
                      <Text style={styles.cardText}>
                        Aucun service disponible pour le moment.
                      </Text>
                      <SecondaryButton
                        label="Recharger"
                        onPress={loadServices}
                      />
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.serviceCarousel}
                    >
                      {services.map((service) => (
                        <View key={service.name} style={styles.serviceBadge}>
                          <Text style={styles.serviceName}>{service.name}</Text>
                          <Text style={styles.serviceMeta}>
                            {service.actions.length} actions ·{" "}
                            {service.reactions.length} réactions
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={styles.inlineRowWrap}>
                  <SecondaryButton
                    icon="zap"
                    label="Ajouter un déclencheur"
                    onPress={addTriggerNode}
                  />
                  <SecondaryButton
                    icon="star"
                    label="Ajouter une réaction"
                    onPress={addReactionNode}
                  />
                </View>

                <NodeSection
                  title="Déclencheurs"
                  emptyCta="Ajoutez un déclencheur pour initier votre workflow."
                  nodes={triggerNodes}
                  services={services.filter((s) => s.actions.length > 0)}
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
                  kind="action"
                  showActions
                />

                <NodeSection
                  title="Réactions"
                  emptyCta="Ajoutez une réaction pour prolonger l'expérience."
                  nodes={reactionNodes}
                  services={services.filter((s) => s.reactions.length > 0)}
                  onRemove={removeNode}
                  onSelectService={(nodeId, serviceId) =>
                    actions.updateNode(nodeId, {
                      serviceId,
                      reactionId: undefined,
                      actionId: undefined,
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
                  kind="reaction"
                  showReactions
                />
              </View>
            )}

            {step === 3 && (
              <View style={{ gap: 18 }}>
                <View style={styles.card}>
                  <SectionHeader
                    icon="git-merge"
                    title="Définissez la progression"
                    subtitle="Reliez les nœuds dans l’ordre exact où l’action doit se dérouler."
                  />
                  <Text style={styles.helperText}>
                    Sélectionnez les prochains nœuds pour chaque bloc. Un seul
                    point d’entrée est nécessaire pour lancer le flux.
                  </Text>
                </View>

                <NodeSection
                  title="Enchaînement des nœuds"
                  emptyCta="Ajoutez des déclencheurs et réactions pour définir un parcours."
                  nodes={state.nodes}
                  services={services}
                  onRemove={removeNode}
                  onSelectService={(nodeId, serviceId) =>
                    actions.updateNode(nodeId, {
                      serviceId,
                    })
                  }
                  onSelectAction={(nodeId, actionId) =>
                    actions.updateNode(nodeId, { actionId })
                  }
                  onSelectReaction={(nodeId, reactionId) =>
                    actions.updateNode(nodeId, { reactionId })
                  }
                  onSetParams={(nodeId, params) =>
                    actions.setNodeParams(nodeId, params)
                  }
                  kind="neutral"
                  showActions
                  showReactions
                  showChain
                  allNodes={state.nodes}
                  selfLoopIds={selfLoopIds}
                  invalidNextByNode={invalidNextByNode}
                  setNext={(nodeId, next) => actions.setNodeNext(nodeId, next)}
                />
              </View>
            )}

            {step === 4 && (
              <View style={{ gap: 18 }}>
                <View style={styles.card}>
                  <SectionHeader
                    icon="check-circle"
                    title="Checklist finale"
                    subtitle="Une dernière relecture avant de célébrer."
                  />
                  {validationErrors.length === 0 ? (
                    <View style={styles.successBadge}>
                      <Feather name="check-circle" size={18} color="#047857" />
                      <Text style={styles.successText}>
                        Tout est prêt. Votre workflow est parfaitement valide.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {validationErrors.map((error) => (
                        <View key={error} style={styles.errorItem}>
                          <Feather
                            name="alert-triangle"
                            size={16}
                            color="#b45309"
                          />
                          <Text style={styles.errorItemText}>{error}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {createError && (
                  <View style={styles.card}>
                    <SectionHeader
                      icon="alert-triangle"
                      title="Erreur lors de la création"
                      subtitle="Corrigez l’élément signalé puis réessayez."
                    />
                    <Text style={styles.errorText}>{createError}</Text>
                  </View>
                )}

                {created && (
                  <View style={styles.card}>
                    <SectionHeader
                      icon="star"
                      title="Workflow publié"
                      subtitle="Le tour est joué. Pilotez vos prochaines actions depuis ici."
                    />
                    <View style={styles.summaryRow}>
                      <Text style={styles.label}>Identifiant</Text>
                      <Text style={styles.summaryValue}>{created.id}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.label}>Nom</Text>
                      <Text style={styles.summaryValue}>{created.name}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.label}>Statut</Text>
                      <Text style={styles.summaryValue}>
                        {created.active ? "Actif" : "Inactif"}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.label}>Nœud d&apos;entrée</Text>
                      <Text style={styles.summaryValue}>
                        {computeEntryNode(created) ?? "(introuvable)"}
                      </Text>
                    </View>
                    {created.webhookToken && (
                      <View style={styles.webhookBox}>
                        <Text style={styles.webhookLabel}>Webhook</Text>
                        <Text style={styles.webhookValue} selectable>
                          {`${tryGetApiUrl() ?? ""}/webhooks/test-webhook/test/${created.webhookToken}`}
                        </Text>
                      </View>
                    )}
                    <View style={styles.inlineRowWrap}>
                      <SecondaryButton
                        label={created.active ? "Désactiver" : "Activer"}
                        icon={created.active ? "pause" : "play"}
                        onPress={handleToggleActive}
                        disabled={actionLoading}
                      />
                      <SecondaryButton
                        label="Exécuter maintenant"
                        icon="play-circle"
                        onPress={handleExecute}
                        disabled={actionLoading}
                      />
                    </View>
                    {lastRunId && (
                      <Text style={styles.helperText}>
                        Dernière exécution : {lastRunId}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <SecondaryButton
            label="Retour"
            icon="arrow-left"
            onPress={goPrev}
            disabled={step === 1}
          />
          {step < 4 ? (
            <PrimaryButton
              label="Continuer"
              onPress={goNext}
              disabled={
                (step === 1 && !stepValidity[0]) ||
                (step === 2 && !stepValidity[1]) ||
                (step === 3 && !stepValidity[2])
              }
            />
          ) : (
            <PrimaryButton
              label={creating ? "Création…" : "Créer le workflow"}
              onPress={handleCreate}
              disabled={!isFormValid || creating}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

type FeatherIcon = ComponentProps<typeof Feather>["name"];

function SectionHeader(props: {
  icon: FeatherIcon;
  title: string;
  subtitle?: string;
}) {
  const { icon, title, subtitle } = props;
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Feather name={icon} size={16} color="#111827" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { label, onPress, disabled } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: FeatherIcon;
}) {
  const { label, onPress, disabled, icon } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={16}
          color={disabled ? "#9ca3af" : "#111827"}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

type WorkflowNode = ReturnType<
  typeof useWorkflowBuilder
>["state"]["nodes"][number];

function NodeSection(props: {
  title: string;
  emptyCta: string;
  nodes: WorkflowNode[];
  services: AboutService[];
  onRemove: (id: string) => void;
  onSelectService: (nodeId: string, serviceId: string) => void;
  onSelectAction?: (nodeId: string, actionId: string) => void;
  onSelectReaction?: (nodeId: string, reactionId: string) => void;
  onSetParams: (nodeId: string, params: Record<string, unknown>) => void;
  showActions?: boolean;
  showReactions?: boolean;
  showChain?: boolean;
  kind: "action" | "reaction" | "neutral";
  allNodes?: WorkflowNode[];
  selfLoopIds?: Set<string>;
  invalidNextByNode?: Map<string, string[]>;
  setNext?: (nodeId: string, next?: string | string[]) => void;
}) {
  const {
    title,
    emptyCta,
    nodes,
    services,
    onRemove,
    onSelectService,
    onSelectAction,
    onSelectReaction,
    onSetParams,
    showActions,
    showReactions,
    showChain,
    kind,
    allNodes,
    selfLoopIds,
    invalidNextByNode,
    setNext,
  } = props;

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {nodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="map" size={16} color="#6b7280" />
          <Text style={styles.helperText}>{emptyCta}</Text>
        </View>
      ) : (
        nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            services={services}
            onRemove={onRemove}
            onSelectService={onSelectService}
            onSelectAction={onSelectAction}
            onSelectReaction={onSelectReaction}
            onSetParams={onSetParams}
            showActions={showActions}
            showReactions={showReactions}
            showChain={showChain}
            kind={kind}
            allNodes={allNodes}
            selfLoopIds={selfLoopIds}
            invalidNextByNode={invalidNextByNode}
            setNext={setNext}
          />
        ))
      )}
    </View>
  );
}

function NodeCard(props: {
  node: WorkflowNode;
  services: AboutService[];
  onRemove: (id: string) => void;
  onSelectService: (nodeId: string, serviceId: string) => void;
  onSelectAction?: (nodeId: string, actionId: string) => void;
  onSelectReaction?: (nodeId: string, reactionId: string) => void;
  onSetParams: (nodeId: string, params: Record<string, unknown>) => void;
  showActions?: boolean;
  showReactions?: boolean;
  showChain?: boolean;
  kind: "action" | "reaction" | "neutral";
  allNodes?: WorkflowNode[];
  selfLoopIds?: Set<string>;
  invalidNextByNode?: Map<string, string[]>;
  setNext?: (nodeId: string, next?: string | string[]) => void;
}) {
  const {
    node,
    services,
    onRemove,
    onSelectService,
    onSelectAction,
    onSelectReaction,
    onSetParams,
    showActions,
    showReactions,
    showChain,
    kind,
    allNodes,
    selfLoopIds,
    invalidNextByNode,
    setNext,
  } = props;

  const serviceIdOf = (service: AboutService) =>
    service.id || toId(service.name);
  const actionIdOf = (serviceId: string, a: { id?: string; name: string }) =>
    a.id || knownActionIdFor(serviceId, a.name);
  const reactionIdOf = (serviceId: string, r: { id?: string; name: string }) =>
    r.id || knownReactionIdFor(serviceId, r.name);

  const selectedService = node.serviceId
    ? services.find((service) => serviceIdOf(service) === node.serviceId)
    : undefined;
  const actionsList = selectedService?.actions ?? [];
  const reactionsList = selectedService?.reactions ?? [];

  const renderField = (key: string, type: string) => {
    const current = (node.params as Record<string, unknown>)[key];
    switch (type) {
      case "number":
        return (
          <View key={key} style={styles.fieldGroup}>
            <Text style={styles.label}>{key}</Text>
            <TextInput
              value={String((current as number | string | undefined) ?? "")}
              onChangeText={(t) =>
                onSetParams(node.id, {
                  ...node.params,
                  [key]: t.replace(/[^0-9.-]/g, ""),
                })
              }
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        );
      case "boolean":
        return (
          <View key={key} style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{key}</Text>
            </View>
            <Switch
              value={Boolean(current)}
              onValueChange={(value) =>
                onSetParams(node.id, { ...node.params, [key]: value })
              }
            />
          </View>
        );
      case "string":
      default:
        return (
          <View key={key} style={styles.fieldGroup}>
            <Text style={styles.label}>{key}</Text>
            <TextInput
              value={String((current as string | undefined) ?? "")}
              onChangeText={(text) =>
                onSetParams(node.id, { ...node.params, [key]: text })
              }
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        );
    }
  };

  const chainOptions = (allNodes ?? []).filter((n) => n.id !== node.id);
  const nextArray = Array.isArray(node.next)
    ? node.next
    : typeof node.next === "string"
      ? [node.next]
      : [];

  const nextSet = new Set(nextArray);

  const badgeStyles =
    kind === "action"
      ? styles.triggerBadge
      : kind === "reaction"
        ? styles.reactionBadge
        : styles.neutralBadge;

  return (
    <View style={styles.nodeCard}>
      <View style={styles.nodeHeader}>
        <View style={[styles.nodeBadge, badgeStyles]}>
          <Feather
            name={
              kind === "action"
                ? "zap"
                : kind === "reaction"
                  ? "star"
                  : "shuffle"
            }
            size={14}
            color="#fff"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nodeTitle}>
            {kind === "action"
              ? "Déclencheur"
              : kind === "reaction"
                ? "Réaction"
                : "Nœud"}
          </Text>
          <Text style={styles.nodeSubtitle}>{node.id}</Text>
        </View>
        <Pressable onPress={() => onRemove(node.id)} style={styles.iconButton}>
          <Feather name="trash-2" size={16} color="#ef4444" />
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Service</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {services.map((service) => {
            const serviceId = serviceIdOf(service);
            const active = serviceId === node.serviceId;
            return (
              <Pressable
                key={service.name}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onSelectService(node.id, serviceId)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {service.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {selectedService && (
        <View style={{ gap: 12 }}>
          {showActions && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Déclencheur</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {actionsList.map((action) => {
                  const actionId = actionIdOf(node.serviceId || "", action);
                  const active = node.actionId === actionId;
                  return (
                    <Pressable
                      key={action.id || action.name}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        onSelectAction && onSelectAction(node.id, actionId)
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {action.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {showReactions && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Réaction</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {reactionsList.map((reaction) => {
                  const reactionId = reactionIdOf(
                    node.serviceId || "",
                    reaction,
                  );
                  const active = node.reactionId === reactionId;
                  return (
                    <Pressable
                      key={reaction.id || reaction.name}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        onSelectReaction &&
                        onSelectReaction(node.id, reactionId)
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {reaction.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Paramètres</Text>
            {(() => {
              const def =
                (showActions
                  ? actionsList.find(
                      (action) =>
                        actionIdOf(node.serviceId || "", action) ===
                        node.actionId,
                    )
                  : undefined) ||
                (showReactions
                  ? reactionsList.find(
                      (reaction) =>
                        reactionIdOf(node.serviceId || "", reaction) ===
                        node.reactionId,
                    )
                  : undefined);
              const input = (def?.input || {}) as Record<string, string>;
              const keys = Object.keys(input);
              if (!def || keys.length === 0) {
                return (
                  <Text style={styles.helperText}>
                    Aucun paramètre requis pour cette sélection.
                  </Text>
                );
              }
              return (
                <View style={{ gap: 12 }}>
                  {keys.map((k) => renderField(k, input[k]))}
                </View>
              );
            })()}
          </View>
        </View>
      )}

      {showChain && setNext && (
        <View style={{ gap: 12 }}>
          <View>
            <Text style={styles.label}>Prochain(s) nœud(s)</Text>
            <Text style={styles.helperText}>
              Touchez pour ajouter ou retirer les destinations depuis ce nœud.
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {chainOptions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.helperText}>
                  Ajoutez au moins un autre nœud.
                </Text>
              </View>
            ) : (
              chainOptions.map((candidate) => {
                const active = nextSet.has(candidate.id);
                return (
                  <Pressable
                    key={candidate.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      const updated = new Set(nextSet);
                      if (active) updated.delete(candidate.id);
                      else updated.add(candidate.id);
                      const result = Array.from(updated);
                      setNext(
                        node.id,
                        result.length === 0 ? undefined : result,
                      );
                    }}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {candidate.id}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <SecondaryButton
            label="Aucune destination"
            icon="x-circle"
            onPress={() => setNext(node.id, undefined)}
          />
          {selfLoopIds?.has(node.id) && (
            <View style={styles.errorItem}>
              <Feather name="alert-triangle" size={16} color="#b45309" />
              <Text style={styles.errorItemText}>
                Boucle vers soi-même interdite
              </Text>
            </View>
          )}
          {invalidNextByNode?.get(node.id) && (
            <View style={styles.errorItem}>
              <Feather name="alert-triangle" size={16} color="#b45309" />
              <Text style={styles.errorItemText}>
                Références invalides:{" "}
                {invalidNextByNode.get(node.id)!.join(", ")}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 160,
    gap: 24,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  stepIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCount: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subheading: {
    fontSize: 14,
    color: "#4b5563",
  },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  stepPills: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e5e7eb",
    gap: 6,
  },
  stepPillActive: {
    backgroundColor: "#111827",
  },
  stepPillDone: {
    backgroundColor: "#10b981",
  },
  stepPillDisabled: {
    backgroundColor: "#e5e7eb",
    opacity: 0.6,
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  stepPillTextActive: {
    color: "#fff",
  },
  stepPillTextDisabled: {
    color: "#9ca3af",
  },
  sections: {
    marginTop: 24,
    gap: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    color: "#6b7280",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#f9fafb",
  },
  inputError: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  readonlyField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  readonlyText: {
    fontSize: 16,
    color: "#1f2937",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  serviceCarousel: {
    gap: 12,
    paddingVertical: 4,
  },
  serviceBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#111827",
  },
  serviceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f9fafb",
  },
  serviceMeta: {
    fontSize: 11,
    color: "#9ca3af",
  },
  nodeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: "#111827",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  nodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nodeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerBadge: {
    backgroundColor: "#0ea5e9",
  },
  reactionBadge: {
    backgroundColor: "#8b5cf6",
  },
  neutralBadge: {
    backgroundColor: "#111827",
  },
  nodeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  nodeSubtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  iconButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  chipActive: {
    backgroundColor: "#111827",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  chipTextActive: {
    color: "#fff",
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
  },
  successText: {
    fontSize: 14,
    color: "#047857",
    fontWeight: "600",
  },
  errorItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fffbeb",
  },
  errorItemText: {
    fontSize: 13,
    color: "#b45309",
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  webhookBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    gap: 6,
  },
  webhookLabel: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
  },
  webhookValue: {
    fontSize: 13,
    color: "#14532d",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#111827",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function knownActionIdFor(serviceId: string, displayName: string): string {
  const name = displayName.toLowerCase();
  if (serviceId === "timer") {
    if (name.includes("cron")) return "cron";
  }
  if (serviceId === "test-webhook") {
    if (name.includes("webhook")) return "on-test-webhook";
  }
  return toId(displayName);
}

function knownReactionIdFor(serviceId: string, displayName: string): string {
  const name = displayName.toLowerCase();
  if (serviceId === "timer") {
    if (name.includes("log")) return "log";
    if (name.includes("wait")) return "wait";
  }
  return toId(displayName);
}

function computeEntryNode(w: Workflow): string | null {
  if (!w.nodes || w.nodes.length === 0) return null;
  const referenced = new Set<string>();
  for (const n of w.nodes) {
    const next = (n as any).next as undefined | string | string[];
    if (typeof next === "string") referenced.add(next);
    else if (Array.isArray(next)) next.forEach((id) => referenced.add(id));
  }
  const entry = w.nodes.find((n) => !referenced.has(n.id));
  return entry ? entry.id : null;
}
