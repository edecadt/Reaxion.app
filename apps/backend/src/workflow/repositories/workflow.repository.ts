import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  Workflow,
  WorkflowRun,
  WorkflowLog,
  Node,
} from '../types/workflow.types';

const STATIC_WORKFLOWS: Workflow[] = [];

@Injectable()
export class WorkflowRepository implements OnModuleInit {
  private readonly logger = new Logger(WorkflowRepository.name);
  private workflows: Map<string, Workflow> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();
  private logs: Map<string, WorkflowLog[]> = new Map();
  private readonly staticWorkflowIds = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Initializing WorkflowRepository with cache warming...');
    await this.warmCache();
    this.registerStaticWorkflows();
    this.logger.log(`Cache warmed with ${this.workflows.size} workflows`);
  }

  private registerStaticWorkflows(): void {
    for (const workflow of STATIC_WORKFLOWS) {
      if (this.workflows.has(workflow.id)) {
        continue;
      }

      this.logger.debug(
        `Registering static workflow ${workflow.id} (not persisted to DB)`,
      );
      this.workflows.set(workflow.id, workflow);
      this.staticWorkflowIds.add(workflow.id);
    }
  }

  isStaticWorkflow(workflowId: string): boolean {
    return this.staticWorkflowIds.has(workflowId);
  }

  private async warmCache(): Promise<void> {
    try {
      const dbWorkflows = await this.prisma.workflow.findMany({
        include: {
          nodes: {
            orderBy: { position: 'asc' },
          },
        },
      });

      for (const dbWorkflow of dbWorkflows) {
        const workflow = this.mapDbWorkflowToWorkflow(dbWorkflow);
        this.workflows.set(workflow.id, workflow);
      }

      this.logger.debug(
        `Loaded ${dbWorkflows.length} workflows from database into cache`,
      );
    } catch (error) {
      this.logger.error('Failed to warm cache from database:', error);
      throw error;
    }
  }

  private mapDbWorkflowToWorkflow(dbWorkflow: any): Workflow {
    return {
      id: dbWorkflow.id,
      name: dbWorkflow.name,
      active: dbWorkflow.active,
      nodes: dbWorkflow.nodes.map((node: any) => this.mapDbNodeToNode(node)),
      userId: dbWorkflow.userId,
      webhookToken: dbWorkflow.webhookToken,
    };
  }

  private mapDbNodeToNode(dbNode: any): Node {
    return {
      id: dbNode.id,
      serviceId: dbNode.serviceId,
      actionId: dbNode.actionId,
      reactionId: dbNode.reactionId,
      params: dbNode.params as Record<string, unknown>,
      next: dbNode.next as string | string[] | undefined,
      connections: undefined,
    };
  }

  async createWorkflow(workflow: Workflow): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const userId = workflow.userId;
        if (!userId) {
          throw new Error('Workflow must have a userId');
        }

        await tx.workflow.create({
          data: {
            id: workflow.id,
            name: workflow.name,
            active: workflow.active,
            userId: userId,
            webhookToken: workflow.webhookToken,
          },
        });

        if (workflow.nodes.length > 0) {
          const idMap = new Map<string, string>();
          for (const n of workflow.nodes) {
            idMap.set(n.id, `${workflow.id}:${n.id}`);
          }

          const transformNext = (
            next: Node['next'],
          ): string | string[] | undefined => {
            if (!next) return undefined;
            if (typeof next === 'string') return idMap.get(next) ?? next;
            return next.map((id) => idMap.get(id) ?? id);
          };

          const dbNodes = workflow.nodes.map((node, index) => ({
            id: idMap.get(node.id)!,
            workflowId: workflow.id,
            serviceId: node.serviceId,
            actionId: node.actionId,
            reactionId: node.reactionId,
            params: node.params as any,
            next: transformNext(node.next) as any,
            position: index,
          }));

          await tx.workflowNode.createMany({ data: dbNodes });

          const cacheNodes: Node[] = workflow.nodes.map((node) => ({
            id: idMap.get(node.id)!,
            serviceId: node.serviceId,
            actionId: node.actionId,
            reactionId: node.reactionId,
            params: node.params,
            next: transformNext(node.next),
          }));
          this.workflows.set(workflow.id, {
            id: workflow.id,
            name: workflow.name,
            active: workflow.active,
            nodes: cacheNodes,
            userId: workflow.userId,
            webhookToken: workflow.webhookToken,
          });
          return;
        }
      });

      this.workflows.set(workflow.id, workflow);
      this.logger.debug(`Created workflow ${workflow.id} in DB and cache`);
    } catch (error) {
      this.logger.error(`Failed to create workflow ${workflow.id}:`, error);
      throw error;
    }
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  getActiveWorkflows(): Workflow[] {
    return Array.from(this.workflows.values()).filter((w) => w.active);
  }

  async updateWorkflow(
    id: string,
    updates: Partial<Workflow>,
  ): Promise<boolean> {
    const existingWorkflow = this.workflows.get(id);
    if (!existingWorkflow) {
      this.logger.warn(`Cannot update workflow ${id}: not found in cache`);
      return false;
    }

    const previousState = { ...existingWorkflow };

    try {
      await this.prisma.$transaction(async (tx) => {
        if (updates.name !== undefined || updates.active !== undefined) {
          await tx.workflow.update({
            where: { id },
            data: {
              ...(updates.name !== undefined && { name: updates.name }),
              ...(updates.active !== undefined && { active: updates.active }),
            },
          });
        }

        if (updates.nodes !== undefined) {
          await tx.workflowNode.deleteMany({
            where: { workflowId: id },
          });

          if (updates.nodes.length > 0) {
            const idMap = new Map<string, string>();
            for (const n of updates.nodes) {
              idMap.set(n.id, `${id}:${n.id}`);
            }
            const transformNext = (
              next: Node['next'],
            ): string | string[] | undefined => {
              if (!next) return undefined;
              if (typeof next === 'string') return idMap.get(next) ?? next;
              return next.map((nid) => idMap.get(nid) ?? nid);
            };

            const dbNodes = updates.nodes.map((node, index) => ({
              id: idMap.get(node.id)!,
              workflowId: id,
              serviceId: node.serviceId,
              actionId: node.actionId,
              reactionId: node.reactionId,
              params: node.params as any,
              next: transformNext(node.next) as any,
              position: index,
            }));

            await tx.workflowNode.createMany({ data: dbNodes });
          }
        }
      });

      let updatedWorkflow = { ...existingWorkflow, ...updates } as Workflow;
      if (updates.nodes !== undefined) {
        const idMap = new Map<string, string>();
        for (const n of updates.nodes) idMap.set(n.id, `${id}:${n.id}`);
        const transformNext = (
          next: Node['next'],
        ): string | string[] | undefined => {
          if (!next) return undefined;
          if (typeof next === 'string') return idMap.get(next) ?? next;
          return next.map((nid) => idMap.get(nid) ?? nid);
        };
        updatedWorkflow = {
          ...updatedWorkflow,
          nodes: updates.nodes.map((node) => ({
            id: idMap.get(node.id)!,
            serviceId: node.serviceId,
            actionId: node.actionId,
            reactionId: node.reactionId,
            params: node.params,
            next: transformNext(node.next),
          })),
        } as Workflow;
      }
      this.workflows.set(id, updatedWorkflow);
      this.logger.debug(`Updated workflow ${id} in DB and cache`);
      return true;
    } catch (error) {
      this.workflows.set(id, previousState);
      this.logger.error(
        `Failed to update workflow ${id}, cache rolled back:`,
        error,
      );
      throw error;
    }
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const existingWorkflow = this.workflows.get(id);
    if (!existingWorkflow) {
      this.logger.warn(`Cannot delete workflow ${id}: not found in cache`);
      return false;
    }

    const backupWorkflow = { ...existingWorkflow };

    try {
      await this.prisma.workflow.delete({
        where: { id },
      });

      this.workflows.delete(id);
      this.logger.debug(`Deleted workflow ${id} from DB and cache`);
      return true;
    } catch (error) {
      this.workflows.set(id, backupWorkflow);
      this.logger.error(
        `Failed to delete workflow ${id}, cache rolled back:`,
        error,
      );
      throw error;
    }
  }

  createRun(run: WorkflowRun): void {
    this.runs.set(run.id, run);
    this.logs.set(run.id, []);
  }

  getRun(id: string): WorkflowRun | undefined {
    return this.runs.get(id);
  }

  getAllRuns(): WorkflowRun[] {
    return Array.from(this.runs.values());
  }

  getRunsByWorkflow(workflowId: string): WorkflowRun[] {
    return Array.from(this.runs.values()).filter(
      (run) => run.workflowId === workflowId,
    );
  }

  getRunningRuns(): WorkflowRun[] {
    return Array.from(this.runs.values()).filter(
      (run) => run.status === 'running',
    );
  }

  updateRun(id: string, updates: Partial<WorkflowRun>): boolean {
    const run = this.runs.get(id);
    if (!run) return false;

    this.runs.set(id, { ...run, ...updates });
    return true;
  }

  addLog(runId: string, log: WorkflowLog): void {
    const runLogs = this.logs.get(runId) || [];
    runLogs.push(log);
    this.logs.set(runId, runLogs);

    const run = this.runs.get(runId);
    if (run) {
      run.logs.push(log);
    }
  }

  getRunLogs(runId: string): WorkflowLog[] {
    return this.logs.get(runId) || [];
  }

  cleanupOldRuns(): void {
    const workflows = this.getAllWorkflows();

    for (const workflow of workflows) {
      const runs = this.getRunsByWorkflow(workflow.id).sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
      );

      const runsToDelete = runs.slice(100);
      for (const run of runsToDelete) {
        this.runs.delete(run.id);
        this.logs.delete(run.id);
      }
    }
  }
}
