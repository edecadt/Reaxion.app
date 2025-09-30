import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Workflow, Node as WorkflowNode } from '../types/workflow.types';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowRunService } from './workflow-run.service';

@Injectable()
export class WorkflowEngineService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private isSchedulerActive = true;

  constructor(
    private readonly repository: WorkflowRepository,
    private readonly runService: WorkflowRunService,
  ) {}

  async onModuleInit() {
    this.logger.log('WorkflowEngine initialized');
    await this.createSampleWorkflow();
  }

  @Interval(5000)
  async handleScheduledWorkflows(): Promise<void> {
    if (!this.isSchedulerActive) {
      return;
    }

    try {
      const activeWorkflows = this.repository.getActiveWorkflows();
      this.logger.debug(`Checking ${activeWorkflows.length} active workflows`);

      for (const workflow of activeWorkflows) {
        await this.processWorkflow(workflow);
      }

      if (Math.random() < 0.1) {
        this.repository.cleanupOldRuns();
      }
    } catch (error) {
      this.logger.error('Error in scheduled workflow processing:', error);
    }
  }

  private async processWorkflow(workflow: Workflow): Promise<void> {
    try {
      const triggerNodes = workflow.nodes.filter((node) => node.actionId);

      if (triggerNodes.length === 0) {
        return;
      }

      const runningRuns = this.repository
        .getRunningRuns()
        .filter((run) => run.workflowId === workflow.id);

      if (runningRuns.length > 0) {
        this.logger.debug(`Workflow ${workflow.id} already running, skipping`);
        return;
      }

      let triggeredData: Record<string, unknown> | null = null;
      let triggerNode: WorkflowNode | undefined = undefined;

      for (const node of triggerNodes) {
        const result = await this.runService.checkTrigger(workflow, node);
        if (result) {
          triggeredData = result;
          triggerNode = node;
          break;
        }
      }

      if (!triggeredData || !triggerNode) {
        this.logger.debug(`No triggers ready for workflow ${workflow.id}`);
        return;
      }

      const runId = this.runService.startWorkflowRun(
        workflow,
        triggerNode,
        triggeredData,
      );
      this.logger.log(
        `Started workflow run: ${runId} for workflow: ${workflow.name}`,
      );
    } catch (error) {
      this.logger.error(`Error processing workflow ${workflow.id}:`, error);
    }
  }

  async createWorkflow(workflow: Workflow): Promise<void> {
    await this.repository.createWorkflow(workflow);
    this.logger.log(`Created workflow: ${workflow.name} (${workflow.id})`);
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.repository.getWorkflow(id);
  }

  getAllWorkflows(): Workflow[] {
    return this.repository.getAllWorkflows();
  }

  async updateWorkflow(
    id: string,
    updates: Partial<Workflow>,
  ): Promise<boolean> {
    const success = await this.repository.updateWorkflow(id, updates);
    if (success) {
      this.logger.log(`Updated workflow: ${id}`);
    }
    return success;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const success = await this.repository.deleteWorkflow(id);
    if (success) {
      this.logger.log(`Deleted workflow: ${id}`);
    }
    return success;
  }

  async activateWorkflow(id: string): Promise<boolean> {
    return await this.updateWorkflow(id, { active: true });
  }

  async deactivateWorkflow(id: string): Promise<boolean> {
    return await this.updateWorkflow(id, { active: false });
  }

  pauseScheduler(): void {
    this.isSchedulerActive = false;
    this.logger.log('Workflow scheduler paused');
  }

  resumeScheduler(): void {
    this.isSchedulerActive = true;
    this.logger.log('Workflow scheduler resumed');
  }

  isSchedulerRunning(): boolean {
    return this.isSchedulerActive;
  }

  executeWorkflow(id: string): string {
    const workflow = this.repository.getWorkflow(id);
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`);
    }

    const runId = this.runService.startWorkflowRun(workflow);
    this.logger.log(
      `Manually started workflow run: ${runId} for workflow: ${workflow.name}`,
    );
    return runId;
  }

  getWorkflowRuns(workflowId?: string) {
    if (workflowId) {
      return this.repository.getRunsByWorkflow(workflowId);
    }
    return this.repository.getAllRuns();
  }

  getRunStatus(runId: string) {
    return this.runService.getRunStatus(runId);
  }

  getRunLogs(runId: string) {
    return this.runService.getRunLogs(runId);
  }

  private async createSampleWorkflow(): Promise<void> {
    const simpleWorkflow: Workflow = {
      id: 'simple-timer-log',
      name: 'Simple Timer → Log',
      active: false,
      nodes: [
        {
          id: 'timer-trigger',
          serviceId: 'timer',
          actionId: 'cron',
          params: {
            expression: '*/60 * * * * *',
          },
          next: 'log-reaction',
        },
        {
          id: 'log-reaction',
          serviceId: 'timer',
          reactionId: 'log',
          params: {
            message: '🎯 Simple workflow completed!',
            level: 'info',
          },
        },
      ],
    };

    const complexWorkflow: Workflow = {
      id: 'complex-parallel-workflow',
      name: 'Complex Parallel Workflow',
      active: false,
      nodes: [
        {
          id: 'timer-start',
          serviceId: 'timer',
          actionId: 'cron',
          params: {
            expression: '*/20 * * * * *',
          },
          next: ['log-branch-1', 'log-branch-2', 'wait-branch'],
        },
        {
          id: 'log-branch-1',
          serviceId: 'timer',
          reactionId: 'log',
          params: {
            message: '🚀 Branch 1: Processing data...',
            level: 'info',
          },
          next: 'final-log',
        },
        {
          id: 'log-branch-2',
          serviceId: 'timer',
          reactionId: 'log',
          params: {
            message: '📊 Branch 2: Analyzing results...',
            level: 'info',
          },
          next: 'final-log',
        },
        {
          id: 'wait-branch',
          serviceId: 'timer',
          reactionId: 'wait',
          params: {
            seconds: 10,
          },
          next: 'final-log',
        },
        {
          id: 'final-log',
          serviceId: 'timer',
          reactionId: 'log',
          params: {
            message: '✅ All parallel branches completed!',
            level: 'info',
          },
        },
      ],
    };

    const webhookTestWorkflow: Workflow = {
      id: 'webhook-test-workflow',
      name: 'Webhook Test → Log',
      active: true,
      webhookToken: 'test-token-123',
      userId: 'test-user',
      nodes: [
        {
          id: 'webhook-trigger',
          serviceId: 'test-webhook',
          actionId: 'on-test-webhook',
          params: {},
          next: 'log-webhook',
        },
        {
          id: 'log-webhook',
          serviceId: 'timer',
          reactionId: 'log',
          params: {
            message: '🎉 Webhook received and workflow triggered!',
            level: 'info',
          },
        },
      ],
    };

    this.createWorkflow(simpleWorkflow);
    this.createWorkflow(complexWorkflow);
    this.createWorkflow(webhookTestWorkflow);
  }
}
