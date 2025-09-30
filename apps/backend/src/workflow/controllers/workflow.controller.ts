import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import type { CreateWorkflowDto, UpdateWorkflowDto } from '../dto';
import type { Workflow } from '../types/workflow.types';

@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowEngineService: WorkflowEngineService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWorkflow(
    @Body() createWorkflowDto: CreateWorkflowDto,
  ): Promise<Workflow> {
    const existingWorkflow = this.workflowEngineService.getWorkflow(
      createWorkflowDto.id,
    );
    if (existingWorkflow) {
      throw new BadRequestException(
        `Workflow with id '${createWorkflowDto.id}' already exists`,
      );
    }

    const workflow: Workflow = {
      id: createWorkflowDto.id,
      name: createWorkflowDto.name,
      active: createWorkflowDto.active,
      nodes: createWorkflowDto.nodes.map((node) => ({
        ...node,
        params: node.params || {},
      })),
    };

    await this.workflowEngineService.createWorkflow(workflow);
    return workflow;
  }

  @Get()
  getAllWorkflows(@Query('active') active?: string): Workflow[] {
    const workflows = this.workflowEngineService.getAllWorkflows();

    if (active !== undefined) {
      const isActive = active === 'true';
      return workflows.filter((workflow) => workflow.active === isActive);
    }

    return workflows;
  }

  @Get(':id')
  getWorkflowById(@Param('id') id: string): Workflow {
    const workflow = this.workflowEngineService.getWorkflow(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }
    return workflow;
  }

  @Patch(':id')
  async updateWorkflow(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ): Promise<Workflow> {
    const existingWorkflow = this.workflowEngineService.getWorkflow(id);
    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }

    const updateData: Partial<Workflow> = {};
    if (updateWorkflowDto.id !== undefined)
      updateData.id = updateWorkflowDto.id;
    if (updateWorkflowDto.name !== undefined)
      updateData.name = updateWorkflowDto.name;
    if (updateWorkflowDto.active !== undefined)
      updateData.active = updateWorkflowDto.active;
    if (updateWorkflowDto.nodes !== undefined) {
      updateData.nodes = updateWorkflowDto.nodes.map((node) => ({
        ...node,
        params: node.params || {},
      }));
    }

    const success = await this.workflowEngineService.updateWorkflow(
      id,
      updateData,
    );
    if (!success) {
      throw new BadRequestException(
        `Failed to update workflow with id '${id}'`,
      );
    }

    return this.workflowEngineService.getWorkflow(id)!;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkflow(@Param('id') id: string): Promise<void> {
    const existingWorkflow = this.workflowEngineService.getWorkflow(id);
    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }

    const success = await this.workflowEngineService.deleteWorkflow(id);
    if (!success) {
      throw new BadRequestException(
        `Failed to delete workflow with id '${id}'`,
      );
    }
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activateWorkflow(@Param('id') id: string): Promise<Workflow> {
    const existingWorkflow = this.workflowEngineService.getWorkflow(id);
    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }

    const success = await this.workflowEngineService.activateWorkflow(id);
    if (!success) {
      throw new BadRequestException(
        `Failed to activate workflow with id '${id}'`,
      );
    }

    return this.workflowEngineService.getWorkflow(id)!;
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateWorkflow(@Param('id') id: string): Promise<Workflow> {
    const existingWorkflow = this.workflowEngineService.getWorkflow(id);
    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }

    const success = await this.workflowEngineService.deactivateWorkflow(id);
    if (!success) {
      throw new BadRequestException(
        `Failed to deactivate workflow with id '${id}'`,
      );
    }

    return this.workflowEngineService.getWorkflow(id)!;
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  executeWorkflow(@Param('id') id: string): { runId: string } {
    try {
      const runId = this.workflowEngineService.executeWorkflow(id);
      return { runId };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(`Workflow with id '${id}' not found`);
      }
      throw new BadRequestException(
        `Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Get('runs/:runId/logs')
  async getRunLogs(@Param('runId') runId: string) {
    const run = await this.workflowEngineService.getRunStatus(runId);
    if (!run) {
      throw new NotFoundException(`Workflow run with id '${runId}' not found`);
    }
    return await this.workflowEngineService.getRunLogs(runId);
  }

  @Get('runs/:runId')
  async getRunDetails(@Param('runId') runId: string) {
    const run = await this.workflowEngineService.getRunStatus(runId);
    if (!run) {
      throw new NotFoundException(`Workflow run with id '${runId}' not found`);
    }
    return run;
  }

  @Get(':id/runs')
  async getWorkflowRuns(@Param('id') id: string) {
    const existingWorkflow = this.workflowEngineService.getWorkflow(id);
    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }

    return await this.workflowEngineService.getWorkflowRuns(id);
  }
}
