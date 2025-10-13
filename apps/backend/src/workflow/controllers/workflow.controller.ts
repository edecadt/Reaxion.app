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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  WorkflowExecutionResponseDto,
  WorkflowLogDto,
  WorkflowResponseDto,
  WorkflowRunDto,
} from '../dto';
import type { Workflow } from '../types/workflow.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WorkflowOwnershipGuard } from '../guards/workflow-ownership.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Workflows')
@ApiBearerAuth('access-token')
@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowEngineService: WorkflowEngineService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow definition' })
  @ApiBody({ type: CreateWorkflowDto })
  @ApiCreatedResponse({
    description: 'Workflow created successfully',
    type: WorkflowResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'A workflow with the provided identifier already exists',
  })
  async createWorkflow(
    @Body() createWorkflowDto: CreateWorkflowDto,
    @CurrentUser() user: { sub: number; email: string },
  ): Promise<Workflow> {
    const existingWorkflow = this.workflowEngineService.getWorkflow(
      createWorkflowDto.id,
    );
    if (existingWorkflow) {
      throw new BadRequestException(
        `Workflow with id '${createWorkflowDto.id}' already exists`,
      );
    }

    const hasWebhookTrigger = createWorkflowDto.nodes.some(
      (node) => node.actionId && node.serviceId,
    );

    const workflow: Workflow = {
      id: createWorkflowDto.id,
      name: createWorkflowDto.name,
      active: createWorkflowDto.active,
      nodes: createWorkflowDto.nodes.map((node) => ({
        ...node,
        params: node.params || {},
      })),
      webhookToken: hasWebhookTrigger ? this.generateWebhookToken() : undefined,
      userId: user.sub,
    };

    await this.workflowEngineService.createWorkflow(workflow);
    return workflow;
  }

  private generateWebhookToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  @Get()
  @ApiOperation({ summary: 'List workflows for the authenticated user' })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter workflows by their active state',
  })
  @ApiOkResponse({
    description: 'List of workflows accessible by the user',
    type: WorkflowResponseDto,
    isArray: true,
  })
  getAllWorkflows(
    @Query('active') active?: string,
    @CurrentUser() user?: { sub: number; email: string },
  ): Workflow[] {
    const workflows = this.workflowEngineService.getAllWorkflows(user?.sub);

    if (active !== undefined) {
      const isActive = active === 'true';
      return workflows.filter((workflow) => workflow.active === isActive);
    }

    return workflows;
  }

  @Get(':id')
  @UseGuards(WorkflowOwnershipGuard)
  @ApiOperation({ summary: 'Retrieve a workflow by identifier' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the workflow to retrieve',
    example: 'daily-report',
  })
  @ApiOkResponse({
    description: 'Workflow details',
    type: WorkflowResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Workflow not found for the provided identifier',
  })
  getWorkflowById(@Param('id') id: string): Workflow {
    const workflow = this.workflowEngineService.getWorkflow(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }
    return workflow;
  }

  @Patch(':id')
  @UseGuards(WorkflowOwnershipGuard)
  @ApiOperation({ summary: 'Update an existing workflow' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the workflow to update',
    example: 'daily-report',
  })
  @ApiBody({ type: UpdateWorkflowDto })
  @ApiOkResponse({
    description: 'Workflow updated successfully',
    type: WorkflowResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'The workflow could not be updated',
  })
  @ApiNotFoundResponse({
    description: 'Workflow not found for the provided identifier',
  })
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
  @UseGuards(WorkflowOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the workflow to delete',
    example: 'daily-report',
  })
  @ApiNoContentResponse({
    description: 'Workflow deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Workflow not found for the provided identifier',
  })
  @ApiBadRequestResponse({
    description: 'The workflow could not be deleted',
  })
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
  @UseGuards(WorkflowOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a workflow' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the workflow to activate',
    example: 'daily-report',
  })
  @ApiOkResponse({
    description: 'Workflow activated successfully',
    type: WorkflowResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Workflow not found for the provided identifier',
  })
  @ApiBadRequestResponse({
    description: 'The workflow could not be activated',
  })
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
  @UseGuards(WorkflowOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a workflow' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the workflow to deactivate',
    example: 'daily-report',
  })
  @ApiOkResponse({
    description: 'Workflow deactivated successfully',
    type: WorkflowResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Workflow not found for the provided identifier',
  })
  @ApiBadRequestResponse({
    description: 'The workflow could not be deactivated',
  })
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
  @UseGuards(WorkflowOwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a workflow run manually' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the workflow to execute',
    example: 'daily-report',
  })
  @ApiOkResponse({
    description: 'Workflow run started successfully',
    type: WorkflowExecutionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'The workflow could not be executed',
  })
  @ApiNotFoundResponse({
    description: 'Workflow not found for the provided identifier',
  })
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
  @ApiOperation({ summary: 'Retrieve logs produced during a workflow run' })
  @ApiParam({
    name: 'runId',
    description: 'Identifier of the workflow run',
    example: 'run-3a5c4d',
  })
  @ApiOkResponse({
    description: 'Ordered logs for the workflow run',
    type: WorkflowLogDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description: 'Workflow run not found for the provided identifier',
  })
  async getRunLogs(@Param('runId') runId: string) {
    const run = await this.workflowEngineService.getRunStatus(runId);
    if (!run) {
      throw new NotFoundException(`Workflow run with id '${runId}' not found`);
    }
    return await this.workflowEngineService.getRunLogs(runId);
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Retrieve the status of a workflow run' })
  @ApiParam({
    name: 'runId',
    description: 'Identifier of the workflow run',
    example: 'run-3a5c4d',
  })
  @ApiOkResponse({
    description: 'Detailed workflow run information',
    type: WorkflowRunDto,
  })
  @ApiNotFoundResponse({
    description: 'Workflow run not found for the provided identifier',
  })
  async getRunDetails(@Param('runId') runId: string) {
    const run = await this.workflowEngineService.getRunStatus(runId);
    if (!run) {
      throw new NotFoundException(`Workflow run with id '${runId}' not found`);
    }
    return run;
  }

  @Get(':id/runs')
  @UseGuards(WorkflowOwnershipGuard)
  @ApiOperation({ summary: 'List previous workflow runs for a workflow' })
  @ApiParam({
    name: 'id',
    description: 'Identifier of the workflow',
    example: 'daily-report',
  })
  @ApiOkResponse({
    description: 'List of workflow runs',
    type: WorkflowRunDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description: 'Workflow not found for the provided identifier',
  })
  async getWorkflowRuns(@Param('id') id: string) {
    const existingWorkflow = this.workflowEngineService.getWorkflow(id);
    if (!existingWorkflow) {
      throw new NotFoundException(`Workflow with id '${id}' not found`);
    }

    return await this.workflowEngineService.getWorkflowRuns(id);
  }
}
