import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  WorkflowRun,
  WorkflowLog,
  Node,
  WorkflowContext,
  NodeExecution,
} from '../types/workflow.types';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { ServiceRegistry } from '../../services/service-registry.service';
import type {
  PluginActionContext,
  PluginReactionContext,
} from '../../services/plugin.types';

@Injectable()
export class WorkflowRunService {
  private readonly logger = new Logger(WorkflowRunService.name);

  constructor(
    private readonly repository: WorkflowRepository,
    private readonly serviceRegistry: ServiceRegistry,
  ) {}

  startWorkflowRun(workflow: Workflow): string {
    const runId = uuidv4();
    const run: WorkflowRun = {
      id: runId,
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date(),
      logs: [],
    };

    this.repository.createRun(run);
    this.addLog(runId, 'info', `Started workflow run for "${workflow.name}"`);

    void this.executeWorkflow(workflow, runId).catch((error) => {
      this.logger.error(`Workflow run ${runId} failed:`, error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.failRun(runId, errorMessage);
    });

    return runId;
  }

  private async executeWorkflow(
    workflow: Workflow,
    runId: string,
  ): Promise<void> {
    if (workflow.nodes.length === 0) {
      this.completeRun(runId);
      return;
    }

    const firstNode = this.findFirstNode(workflow.nodes);
    if (!firstNode) {
      throw new Error('No starting node found in workflow');
    }

    const context: WorkflowContext = {
      runId,
      workflowId: workflow.id,
      nodeId: firstNode.id,
      state: {},
    };

    await this.executeNode(firstNode, context, workflow.nodes);
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

      if (node.next && (output !== null || node.reactionId)) {
        const nextNode = allNodes.find((n) => n.id === node.next);
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
            `Next node "${node.next}" not found`,
          );
          this.completeRun(context.runId);
        }
      } else {
        if (output === null && node.actionId) {
          this.addLog(
            context.runId,
            'info',
            `Action "${node.actionId}" didn't trigger, workflow paused`,
          );
        }
        this.completeRun(context.runId);
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
      throw error;
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
    const actionContext: PluginActionContext = {
      serviceId: node.serviceId,
      actionId: node.actionId!,
      params: node.params,
      userId: 'test-user', // TODO: Get from actual context
      state: context.state,
      logger: this.logger,
    };

    return await handler.detect(node.actionId!, node.params, actionContext);
  }

  private async executeReaction(
    node: Node,
    context: WorkflowContext,
  ): Promise<Record<string, unknown>> {
    const handler = this.serviceRegistry.getHandler(node.serviceId);
    if (!handler) {
      throw new Error(`Service "${node.serviceId}" not found`);
    }
    const reactionContext: PluginReactionContext = {
      serviceId: node.serviceId,
      reactionId: node.reactionId!,
      params: node.params,
      previousOutput: context.previousOutput,
      userId: 'test-user', // TODO: Get from actual context
      state: context.state,
      logger: this.logger,
    };

    return await handler.execute(
      node.reactionId!,
      node.params,
      reactionContext,
    );
  }

  private findFirstNode(nodes: Node[]): Node | undefined {
    const referencedIds = new Set(nodes.map((n) => n.next).filter(Boolean));
    return nodes.find((node) => !referencedIds.has(node.id));
  }

  private completeRun(runId: string): void {
    this.repository.updateRun(runId, {
      status: 'completed',
      completedAt: new Date(),
      currentNodeId: undefined,
    });
    this.addLog(runId, 'info', 'Workflow run completed');
  }

  private failRun(runId: string, error: string): void {
    this.repository.updateRun(runId, {
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

    this.repository.addLog(runId, log);

    if (data && Object.keys(data).length > 0) {
      this.logger.log(
        `[${runId.slice(0, 8)}] ${message} - ${JSON.stringify(data)}`,
      );
    } else {
      this.logger.log(`[${runId.slice(0, 8)}] ${message}`);
    }
  }

  getRunStatus(runId: string): WorkflowRun | undefined {
    return this.repository.getRun(runId);
  }

  getRunLogs(runId: string): WorkflowLog[] {
    return this.repository.getRunLogs(runId);
  }

  getAllRuns(): WorkflowRun[] {
    return this.repository.getAllRuns();
  }

  async checkTrigger(workflow: Workflow, triggerNode: Node): Promise<boolean> {
    try {
      const handler = this.serviceRegistry.getHandler(triggerNode.serviceId);
      if (!handler) {
        return false;
      }

      const stateKey = `${workflow.id}_${triggerNode.id}`;
      const globalState = this.getGlobalState();

      const actionContext: PluginActionContext = {
        serviceId: triggerNode.serviceId,
        actionId: triggerNode.actionId!,
        params: triggerNode.params,
        userId: 'test-user',
        state: globalState[stateKey] || {},
        logger: this.logger,
      };

      const result = await handler.detect(
        triggerNode.actionId!,
        triggerNode.params,
        actionContext,
      );

      globalState[stateKey] = actionContext.state || {};

      return result !== null;
    } catch (error) {
      this.logger.error(
        `Error checking trigger for node ${triggerNode.id}:`,
        error,
      );
      return false;
    }
  }

  private globalState: Record<string, Record<string, unknown>> = {};

  private getGlobalState(): Record<string, Record<string, unknown>> {
    return this.globalState;
  }
}
