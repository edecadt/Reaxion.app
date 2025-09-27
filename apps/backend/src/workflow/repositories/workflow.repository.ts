import { Injectable } from '@nestjs/common';
import { Workflow, WorkflowRun, WorkflowLog } from '../types/workflow.types';

@Injectable()
export class WorkflowRepository {
  private workflows: Map<string, Workflow> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();
  private logs: Map<string, WorkflowLog[]> = new Map();

  createWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
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

  updateWorkflow(id: string, updates: Partial<Workflow>): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) return false;

    this.workflows.set(id, { ...workflow, ...updates });
    return true;
  }

  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
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
