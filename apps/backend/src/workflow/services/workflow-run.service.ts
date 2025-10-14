import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  WorkflowRun,
  WorkflowLog,
  Node,
  WorkflowContext,
  NodeExecution,
  ParallelExecution,
} from '../types/workflow.types';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { PrismaService } from '../../prisma.service';
import { ServiceRegistry } from '../../services/service-registry.service';
import { WebhookEventsService } from '../../services/webhook-events.service';
import { ServiceAuthService } from '../../service-auth/service-auth.service';
import type {
  PluginActionContext,
  PluginReactionContext,
} from '../../services/plugin.types';

@Injectable()
export class WorkflowRunService {
  private readonly logger = new Logger(WorkflowRunService.name);

  constructor(
    private readonly repository: WorkflowRepository,
    private readonly prisma: PrismaService,
    private readonly serviceRegistry: ServiceRegistry,
    private readonly webhookEvents: WebhookEventsService,
    private readonly serviceAuthService: ServiceAuthService,
  ) {}

  startWorkflowRun(
    workflow: Workflow,
    triggerNode?: Node,
    triggerData?: Record<string, unknown>,
  ): string {
    const runId = uuidv4();
    const run: WorkflowRun = {
      id: runId,
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date(),
      logs: [],
    };

    void this.createRun(run);
    this.addLog(runId, 'info', `Started workflow run for "${workflow.name}"`);

    void this.executeWorkflow(workflow, runId, triggerNode, triggerData).catch(
      (error) => {
        this.logger.error(`Workflow run ${runId} failed:`, error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.failRun(runId, errorMessage);
      },
    );

    return runId;
  }

  private async executeWorkflow(
    workflow: Workflow,
    runId: string,
    triggerNode?: Node,
    triggerData?: Record<string, unknown>,
  ): Promise<void> {
    if (workflow.nodes.length === 0) {
      this.completeRun(runId);
      return;
    }

    const firstNode = this.findFirstNode(workflow.nodes);
    if (!firstNode) {
      throw new Error('No starting node found in workflow');
    }

    if (triggerNode && triggerData && firstNode.id === triggerNode.id) {
      this.addLog(
        runId,
        'info',
        `Skipping trigger node "${firstNode.id}", starting from next node`,
        { triggerData },
      );

      const nextNodeIds = this.getNextNodeIds(firstNode, true, false);
      if (nextNodeIds.length === 0) {
        this.completeRun(runId);
        return;
      }

      if (nextNodeIds.length === 1) {
        const nextNode = workflow.nodes.find((n) => n.id === nextNodeIds[0]);
        if (nextNode) {
          const context: WorkflowContext = {
            runId,
            workflowId: workflow.id,
            nodeId: nextNode.id,
            state: {},
            previousOutput: triggerData,
          };
          await this.executeNode(nextNode, context, workflow.nodes);
        }
      } else {
        const context: WorkflowContext = {
          runId,
          workflowId: workflow.id,
          nodeId: firstNode.id,
          state: {},
        };
        await this.executeParallelNodes(
          nextNodeIds,
          context,
          workflow.nodes,
          triggerData,
        );
      }
    } else {
      const context: WorkflowContext = {
        runId,
        workflowId: workflow.id,
        nodeId: firstNode.id,
        state: {},
      };

      await this.executeNode(firstNode, context, workflow.nodes);
    }
  }

  private async executeNode(
    node: Node,
    context: WorkflowContext,
    allNodes: Node[],
  ): Promise<void> {
    this.addLog(
      context.runId,
      'info',
      `Executing node "${node.id}" (${node.serviceId})`,
      { nodeId: node.id, serviceId: node.serviceId },
    );

    this.repository.updateRun(context.runId, { currentNodeId: node.id });

    try {
      const execution: NodeExecution = {
        nodeId: node.id,
        input: context.previousOutput,
        executedAt: new Date(),
        success: false,
      };

      let output: Record<string, unknown> | null = null;

      if (node.actionId) {
        output = await this.executeAction(node, context);
      } else if (node.reactionId) {
        output = await this.executeReaction(node, context);
      } else {
        throw new Error(`Node ${node.id} has neither actionId nor reactionId`);
      }

      execution.output = output || undefined;
      execution.success = true;

      this.addLog(
        context.runId,
        'info',
        `Node "${node.id}" completed successfully`,
        { output },
      );

      const nextNodeIds = this.getNextNodeIds(node, output !== null, false);

      if (nextNodeIds.length === 0) {
        if (output === null && node.actionId) {
          this.addLog(
            context.runId,
            'info',
            `Action "${node.actionId}" didn't trigger, workflow paused`,
          );
        }
        this.completeRun(context.runId);
        return;
      }

      if (nextNodeIds.length === 1) {
        const nextNode = allNodes.find((n) => n.id === nextNodeIds[0]);
        if (nextNode) {
          const nextContext: WorkflowContext = {
            ...context,
            nodeId: nextNode.id,
            previousOutput: output || undefined,
          };
          await this.executeNode(nextNode, nextContext, allNodes);
        } else {
          this.addLog(
            context.runId,
            'warn',
            `Next node "${nextNodeIds[0]}" not found`,
          );
          this.completeRun(context.runId);
        }
      } else {
        await this.executeParallelNodes(nextNodeIds, context, allNodes, output);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addLog(
        context.runId,
        'error',
        `Node "${node.id}" failed: ${errorMessage}`,
        { error: errorMessage },
      );

      const nextNodeIds = this.getNextNodeIds(node, false, true);
      if (nextNodeIds.length > 0) {
        if (nextNodeIds.length === 1) {
          const nextNode = allNodes.find((n) => n.id === nextNodeIds[0]);
          if (nextNode) {
            const nextContext: WorkflowContext = {
              ...context,
              nodeId: nextNode.id,
              previousOutput: { error: errorMessage },
            };
            await this.executeNode(nextNode, nextContext, allNodes);
            return;
          }
        } else {
          await this.executeParallelNodes(nextNodeIds, context, allNodes, {
            error: errorMessage,
          });
          return;
        }
      }

      this.failRun(context.runId, errorMessage);
    }
  }

  private async executeAction(
    node: Node,
    context: WorkflowContext,
  ): Promise<Record<string, unknown> | null> {
    const handler = this.serviceRegistry.getHandler(node.serviceId);
    if (!handler) {
      throw new Error(`Service "${node.serviceId}" not found`);
    }

    const workflow = this.repository.getWorkflow(context.workflowId);
    const userId = workflow?.userId || 1;

    const connection = await this.loadServiceConnection(userId, node.serviceId);

    const processedParams = this.substituteVariables(
      node.params,
      context.previousOutput,
    );

    const actionContext: PluginActionContext = {
      serviceId: node.serviceId,
      actionId: node.actionId!,
      params: processedParams,
      userId,
      state: context.state,
      logger: this.logger,
      webhookEvents: this.webhookEvents,
      workflowToken: workflow?.webhookToken,
      connection,
    };

    return await handler.detect(node.actionId!, processedParams, actionContext);
  }

  private async executeReaction(
    node: Node,
    context: WorkflowContext,
  ): Promise<Record<string, unknown>> {
    const handler = this.serviceRegistry.getHandler(node.serviceId);
    if (!handler) {
      throw new Error(`Service "${node.serviceId}" not found`);
    }

    const workflow = this.repository.getWorkflow(context.workflowId);
    const userId = workflow?.userId || 1;

    const connection = await this.loadServiceConnection(userId, node.serviceId);

    const processedParams = this.substituteVariables(
      node.params,
      context.previousOutput,
    );

    const reactionContext: PluginReactionContext = {
      serviceId: node.serviceId,
      reactionId: node.reactionId!,
      params: processedParams,
      previousOutput: context.previousOutput,
      userId,
      state: context.state,
      logger: this.logger,
      connection,
    };

    return await handler.execute(
      node.reactionId!,
      processedParams,
      reactionContext,
    );
  }

  private async loadServiceConnection(
    userId: number,
    serviceId: string,
  ): Promise<PluginActionContext['connection']> {
    try {
      const connection = await this.serviceAuthService.getConnection(
        userId,
        serviceId,
      );

      if (!connection) {
        return undefined;
      }

      const refreshedConnection =
        await this.serviceAuthService.refreshOAuth2TokenIfNeeded(connection);

      return {
        accessToken: refreshedConnection.accessToken ?? undefined,
        refreshToken: refreshedConnection.refreshToken ?? undefined,
        expiresAt: refreshedConnection.expiresAt ?? undefined,
        scopes: refreshedConnection.scopes,
        metadata: refreshedConnection.metadata as Record<string, unknown>,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to load connection for service ${serviceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private findFirstNode(nodes: Node[]): Node | undefined {
    const referencedIds = new Set<string>();

    for (const node of nodes) {
      if (typeof node.next === 'string') {
        referencedIds.add(node.next);
      } else if (Array.isArray(node.next)) {
        node.next.forEach((id) => referencedIds.add(id));
      }

      if (node.connections) {
        const connections = node.connections;
        if (connections.success) {
          connections.success.forEach((id) => referencedIds.add(id));
        }
        if (connections.error) {
          connections.error.forEach((id) => referencedIds.add(id));
        }
        if (connections.always) {
          connections.always.forEach((id) => referencedIds.add(id));
        }
      }
    }

    return nodes.find((node) => !referencedIds.has(node.id));
  }

  private getNextNodeIds(
    node: Node,
    success: boolean,
    hasError: boolean,
  ): string[] {
    const nextIds: string[] = [];

    if (node.connections) {
      const connections = node.connections;
      if (hasError && connections.error) {
        nextIds.push(...connections.error);
      } else if (success && connections.success) {
        nextIds.push(...connections.success);
      }

      if (connections.always) {
        nextIds.push(...connections.always);
      }

      if (nextIds.length > 0) {
        return nextIds;
      }
    }

    if (success || !node.actionId) {
      if (typeof node.next === 'string') {
        nextIds.push(node.next);
      } else if (Array.isArray(node.next)) {
        nextIds.push(...node.next);
      }
    }

    return nextIds;
  }

  private async executeParallelNodes(
    nodeIds: string[],
    context: WorkflowContext,
    allNodes: Node[],
    previousOutput?: Record<string, unknown> | null,
  ): Promise<void> {
    this.addLog(
      context.runId,
      'info',
      `Executing ${nodeIds.length} nodes in parallel: ${nodeIds.join(', ')}`,
    );

    const parallelExecutions: ParallelExecution[] = nodeIds.map((nodeId) => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }

      const nodeContext: WorkflowContext = {
        ...context,
        nodeId,
        previousOutput: previousOutput || undefined,
      };

      return {
        nodeId,
        promise: this.executeSingleNode(node, nodeContext),
        startedAt: new Date(),
      };
    });

    const results = await Promise.allSettled(
      parallelExecutions.map((exec) => exec.promise),
    );

    results.forEach((result, index) => {
      const execution = parallelExecutions[index];
      if (!execution) return;

      const nodeId = execution.nodeId;
      if (result.status === 'fulfilled') {
        this.addLog(
          context.runId,
          'info',
          `Parallel node "${nodeId}" completed successfully`,
          { output: result.value },
        );
      } else {
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        this.addLog(
          context.runId,
          'error',
          `Parallel node "${nodeId}" failed: ${errorMessage}`,
        );
      }
    });

    const commonNextNodes = this.findCommonNextNodes(nodeIds, allNodes);

    if (commonNextNodes.length === 0) {
      this.completeRun(context.runId);
      return;
    }

    const mergedOutput: Record<string, unknown> = {};
    results.forEach((result, index) => {
      const execution = parallelExecutions[index];
      if (!execution) return;

      if (
        result.status === 'fulfilled' &&
        result.value &&
        typeof result.value === 'object'
      ) {
        Object.assign(mergedOutput, result.value);
      }
    });

    if (commonNextNodes.length === 1) {
      const nextNode = allNodes.find((n) => n.id === commonNextNodes[0]);
      if (nextNode) {
        const nextContext: WorkflowContext = {
          ...context,
          nodeId: nextNode.id,
          previousOutput: mergedOutput,
        };
        await this.executeNode(nextNode, nextContext, allNodes);
      }
    } else {
      await this.executeParallelNodes(
        commonNextNodes,
        context,
        allNodes,
        mergedOutput,
      );
    }
  }

  private findCommonNextNodes(nodeIds: string[], allNodes: Node[]): string[] {
    if (nodeIds.length === 0) return [];

    const nextNodeSets = nodeIds.map((nodeId) => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node) return new Set<string>();

      const nextIds = this.getNextNodeIds(node, true, false);
      return new Set(nextIds);
    });

    if (nextNodeSets.length === 0) return [];

    let commonNodes = nextNodeSets[0];
    if (!commonNodes) return [];

    for (let i = 1; i < nextNodeSets.length; i++) {
      const current = nextNodeSets[i];
      if (!current) continue;

      const intersection = new Set<string>();
      for (const nodeId of commonNodes) {
        if (current.has(nodeId)) {
          intersection.add(nodeId);
        }
      }
      commonNodes = intersection;
    }

    return Array.from(commonNodes);
  }

  private async executeSingleNode(
    node: Node,
    context: WorkflowContext,
  ): Promise<Record<string, unknown> | null> {
    this.addLog(
      context.runId,
      'info',
      `Executing parallel node "${node.id}" (${node.serviceId})`,
      { nodeId: node.id, serviceId: node.serviceId },
    );

    if (node.actionId) {
      return await this.executeAction(node, context);
    } else if (node.reactionId) {
      return await this.executeReaction(node, context);
    } else {
      throw new Error(`Node ${node.id} has neither actionId nor reactionId`);
    }
  }

  private async createRun(run: WorkflowRun): Promise<void> {
    const isStatic = this.repository.isStaticWorkflow(run.workflowId);

    if (isStatic) {
      this.repository.createRun(run);
      return;
    }

    try {
      await this.prisma.workflowRun.create({
        data: {
          id: run.id,
          workflowId: run.workflowId,
          status: run.status,
          startedAt: run.startedAt,
        },
      });
      this.repository.createRun(run);
    } catch (error) {
      this.logger.error(`Failed to create workflow run ${run.id}:`, error);
      this.repository.createRun(run);
    }
  }

  private async updateRun(
    runId: string,
    updates: Partial<WorkflowRun>,
  ): Promise<void> {
    const cachedRun = this.repository.getRun(runId);
    const isStatic = cachedRun
      ? this.repository.isStaticWorkflow(cachedRun.workflowId)
      : false;

    if (isStatic) {
      this.repository.updateRun(runId, updates);
      return;
    }

    const buildUpdateData = () => {
      const updateData: any = {};
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.completedAt !== undefined)
        updateData.completedAt = updates.completedAt;
      if (updates.error !== undefined) updateData.error = updates.error;
      return updateData;
    };

    try {
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.prisma.workflowRun.update({
            where: { id: runId },
            data: buildUpdateData(),
          });
          this.repository.updateRun(runId, updates);
          return;
        } catch (err: any) {
          const message: string = err?.message || String(err);
          const code: string | undefined = err?.code;

          if (
            (code === 'P2025' || message.includes('No record was found')) &&
            attempt < maxAttempts
          ) {
            const exists = await this.prisma.workflowRun.findUnique({
              where: { id: runId },
              select: { id: true },
            });
            if (!exists) {
              const cached = this.repository.getRun(runId);
              if (cached) {
                try {
                  await this.prisma.workflowRun.create({
                    data: {
                      id: cached.id,
                      workflowId: cached.workflowId,
                      status: cached.status,
                      startedAt: cached.startedAt,
                      completedAt: cached.completedAt ?? null,
                      error: cached.error ?? null,
                    },
                  });
                } catch {}
              }
            }
            await this.delay(50 * attempt);
            continue;
          }

          throw err;
        }
      }

      this.repository.updateRun(runId, updates);
    } catch (error) {
      this.logger.error(`Failed to update workflow run ${runId}:`, error);
      this.repository.updateRun(runId, updates);
    }
  }

  private completeRun(runId: string): void {
    void this.updateRun(runId, {
      status: 'completed',
      completedAt: new Date(),
      currentNodeId: undefined,
    });
    this.addLog(runId, 'info', 'Workflow run completed');
  }

  private failRun(runId: string, error: string): void {
    void this.updateRun(runId, {
      status: 'failed',
      completedAt: new Date(),
      error,
      currentNodeId: undefined,
    });
    this.addLog(runId, 'error', `Workflow run failed: ${error}`);
  }

  private addLog(
    runId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const log: WorkflowLog = {
      id: uuidv4(),
      runId,
      nodeId: (data?.nodeId as string) || '',
      level,
      message,
      timestamp: new Date(),
      data,
    };

    void this.createLog(log);

    if (data && Object.keys(data).length > 0) {
      this.logger.log(
        `[${runId.slice(0, 8)}] ${message} - ${JSON.stringify(data)}`,
      );
    } else {
      this.logger.log(`[${runId.slice(0, 8)}] ${message}`);
    }
  }

  private async createLog(log: WorkflowLog): Promise<void> {
    const cachedRun = this.repository.getRun(log.runId);
    const isStatic = cachedRun
      ? this.repository.isStaticWorkflow(cachedRun.workflowId)
      : false;

    if (isStatic) {
      this.repository.addLog(log.runId, log);
      return;
    }

    try {
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const exists = await this.prisma.workflowRun.findUnique({
            where: { id: log.runId },
            select: { id: true },
          });
          if (!exists) {
            await this.delay(50 * attempt);
            continue;
          }

          await this.prisma.workflowRunLog.create({
            data: {
              id: log.id,
              runId: log.runId,
              nodeId: log.nodeId || null,
              message: log.message,
              level: log.level,
              timestamp: log.timestamp,
            },
          });
          this.repository.addLog(log.runId, log);
          return;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('P2003') && attempt < maxAttempts) {
            await this.delay(50 * attempt);
            continue;
          }
          throw err;
        }
      }
      this.repository.addLog(log.runId, log);
    } catch (error) {
      this.logger.error(`Failed to create workflow log ${log.id}:`, error);
      this.repository.addLog(log.runId, log);
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getRunStatus(runId: string): Promise<WorkflowRun | null> {
    try {
      const dbRun = await this.prisma.workflowRun.findUnique({
        where: { id: runId },
        include: {
          logs: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      if (!dbRun) {
        return this.repository.getRun(runId) || null;
      }

      return {
        id: dbRun.id,
        workflowId: dbRun.workflowId,
        status: dbRun.status as 'running' | 'completed' | 'failed',
        startedAt: dbRun.startedAt,
        completedAt: dbRun.completedAt || undefined,
        error: dbRun.error || undefined,
        logs: dbRun.logs.map((log) => ({
          id: log.id,
          runId: log.runId,
          nodeId: log.nodeId || '',
          level: log.level as 'info' | 'warn' | 'error',
          message: log.message,
          timestamp: log.timestamp,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get run status for ${runId}:`, error);
      return this.repository.getRun(runId) || null;
    }
  }

  async getRunLogs(runId: string): Promise<WorkflowLog[]> {
    try {
      const logs = await this.prisma.workflowRunLog.findMany({
        where: { runId },
        orderBy: { timestamp: 'asc' },
      });

      return logs.map((log) => ({
        id: log.id,
        runId: log.runId,
        nodeId: log.nodeId || '',
        level: log.level as 'info' | 'warn' | 'error',
        message: log.message,
        timestamp: log.timestamp,
      }));
    } catch (error) {
      this.logger.error(`Failed to get logs for run ${runId}:`, error);
      return this.repository.getRunLogs(runId);
    }
  }

  async getAllRuns(): Promise<WorkflowRun[]> {
    try {
      const dbRuns = await this.prisma.workflowRun.findMany({
        orderBy: { startedAt: 'desc' },
        include: {
          logs: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      return dbRuns.map((run) => ({
        id: run.id,
        workflowId: run.workflowId,
        status: run.status as 'running' | 'completed' | 'failed',
        startedAt: run.startedAt,
        completedAt: run.completedAt || undefined,
        error: run.error || undefined,
        logs: run.logs.map((log) => ({
          id: log.id,
          runId: log.runId,
          nodeId: log.nodeId || '',
          level: log.level as 'info' | 'warn' | 'error',
          message: log.message,
          timestamp: log.timestamp,
        })),
      }));
    } catch (error) {
      this.logger.error('Failed to get all runs:', error);
      return this.repository.getAllRuns();
    }
  }

  async getWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
    try {
      const dbRuns = await this.prisma.workflowRun.findMany({
        where: { workflowId },
        orderBy: { startedAt: 'desc' },
        include: {
          logs: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      return dbRuns.map((run) => ({
        id: run.id,
        workflowId: run.workflowId,
        status: run.status as 'running' | 'completed' | 'failed',
        startedAt: run.startedAt,
        completedAt: run.completedAt || undefined,
        error: run.error || undefined,
        logs: run.logs.map((log) => ({
          id: log.id,
          runId: log.runId,
          nodeId: log.nodeId || '',
          level: log.level as 'info' | 'warn' | 'error',
          message: log.message,
          timestamp: log.timestamp,
        })),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get runs for workflow ${workflowId}:`,
        error,
      );
      return this.repository.getRunsByWorkflow(workflowId);
    }
  }

  async checkTrigger(
    workflow: Workflow,
    triggerNode: Node,
  ): Promise<Record<string, unknown> | null> {
    try {
      const handler = this.serviceRegistry.getHandler(triggerNode.serviceId);
      if (!handler) {
        return null;
      }

      const stateKey = `${workflow.id}_${triggerNode.id}`;
      const globalState = this.getGlobalState();
      const userId = workflow.userId || 1;
      const connection = await this.loadServiceConnection(
        userId,
        triggerNode.serviceId,
      );

      const actionContext: PluginActionContext = {
        serviceId: triggerNode.serviceId,
        actionId: triggerNode.actionId!,
        params: triggerNode.params,
        userId,
        state: globalState[stateKey] || {},
        logger: this.logger,
        webhookEvents: this.webhookEvents,
        workflowToken: workflow.webhookToken,
        connection,
      };

      const result = await handler.detect(
        triggerNode.actionId!,
        triggerNode.params,
        actionContext,
      );

      globalState[stateKey] = actionContext.state || {};

      return result;
    } catch (error) {
      this.logger.error(
        `Error checking trigger for node ${triggerNode.id}:`,
        error,
      );
      return null;
    }
  }

  private globalState: Record<string, Record<string, unknown>> = {};

  private getGlobalState(): Record<string, Record<string, unknown>> {
    return this.globalState;
  }

  private substituteVariables(
    params: Record<string, unknown>,
    previousOutput?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!previousOutput || Object.keys(previousOutput).length === 0) {
      return params;
    }

    const substitute = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
          const trimmedVarName = varName.trim();
          if (
            previousOutput &&
            Object.prototype.hasOwnProperty.call(previousOutput, trimmedVarName)
          ) {
            const replacement = previousOutput[trimmedVarName];
            return replacement !== undefined && replacement !== null
              ? String(replacement)
              : match;
          }
          return match;
        });
      }

      if (Array.isArray(value)) {
        return value.map((item) => substitute(item));
      }

      if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = substitute(val);
        }
        return result;
      }

      return value;
    };

    return substitute(params) as Record<string, unknown>;
  }
}
