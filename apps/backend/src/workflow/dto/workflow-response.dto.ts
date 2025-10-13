import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateNodeDto } from './create-workflow.dto';

export class WorkflowNodeDto extends CreateNodeDto {}

export class WorkflowResponseDto {
  @ApiProperty({ description: 'Workflow identifier', example: 'daily-report' })
  id!: string;

  @ApiProperty({
    description: 'Human readable name displayed in the UI',
    example: 'Daily Reporting Workflow',
  })
  name!: string;

  @ApiProperty({
    description: 'Indicates whether the workflow is currently enabled',
    example: true,
  })
  active!: boolean;

  @ApiProperty({
    description: 'Graph nodes that compose the workflow automation',
    type: () => [WorkflowNodeDto],
  })
  nodes!: WorkflowNodeDto[];

  @ApiPropertyOptional({
    description:
      'Token associated to webhook-triggered workflows. Present only if a webhook node exists.',
    example: 'abc123token',
    nullable: true,
  })
  webhookToken?: string;

  @ApiPropertyOptional({
    description: 'Owner identifier when available',
    example: 42,
    nullable: true,
  })
  userId?: number;
}

export class WorkflowLogDto {
  @ApiProperty({ description: 'Log identifier', example: 'log-123' })
  id!: string;

  @ApiProperty({
    description: 'Identifier of the workflow run that produced the log',
    example: 'run-uuid',
  })
  runId!: string;

  @ApiProperty({
    description: 'Node identifier that generated the log entry',
    example: 'log-node',
  })
  nodeId!: string;

  @ApiProperty({
    description: 'Severity level of the log entry',
    enum: ['info', 'warn', 'error'],
    example: 'info',
  })
  level!: 'info' | 'warn' | 'error';

  @ApiProperty({
    description: 'Human readable message describing the log',
    example: 'Started workflow run for "Daily Reporting Workflow"',
  })
  message!: string;

  @ApiProperty({
    description: 'Timestamp of the log entry',
    type: String,
    format: 'date-time',
  })
  timestamp!: Date;

  @ApiPropertyOptional({
    description: 'Additional contextual data associated to the log entry',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  data?: Record<string, unknown>;
}

export class WorkflowRunDto {
  @ApiProperty({
    description: 'Unique identifier for the workflow run',
    example: 'run-3a5c4d',
  })
  id!: string;

  @ApiProperty({
    description: 'Identifier of the workflow that generated this run',
    example: 'daily-report',
  })
  workflowId!: string;

  @ApiProperty({
    description: 'Current run status',
    enum: ['running', 'completed', 'failed'],
    example: 'running',
  })
  status!: 'running' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Date when the run started',
    type: String,
    format: 'date-time',
  })
  startedAt!: Date;

  @ApiPropertyOptional({
    description: 'Date when the run finished, if applicable',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  completedAt?: Date;

  @ApiPropertyOptional({
    description: 'Identifier of the node currently being executed',
    example: 'log-node',
    nullable: true,
  })
  currentNodeId?: string;

  @ApiPropertyOptional({
    description: 'Error message in case of a failed run',
    example: 'Node "send-email" failed: SMTP rejected message',
    nullable: true,
  })
  error?: string;

  @ApiProperty({
    description: 'Logs generated during the run lifecycle',
    type: () => [WorkflowLogDto],
  })
  logs!: WorkflowLogDto[];
}

export class WorkflowExecutionResponseDto {
  @ApiProperty({
    description: 'Identifier of the workflow run that was started',
    example: 'run-3a5c4d',
  })
  runId!: string;
}
