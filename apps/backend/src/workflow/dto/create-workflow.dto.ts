import {
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NodeConnectionsDto {
  @ApiPropertyOptional({
    description: 'Nodes to execute when this node succeeds',
    type: [String],
    example: ['next-node'],
  })
  success?: string[];

  @ApiPropertyOptional({
    description: 'Nodes to execute when this node fails',
    type: [String],
    example: ['error-handler'],
  })
  error?: string[];

  @ApiPropertyOptional({
    description: 'Nodes to execute regardless of success or failure',
    type: [String],
    example: ['always-node'],
  })
  always?: string[];
}

export class CreateNodeDto {
  @ApiProperty({
    description: 'Unique identifier for the node within the workflow',
    example: 'trigger-node',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Identifier of the service providing the action/reaction',
    example: 'timer',
  })
  @IsString()
  serviceId!: string;

  @ApiPropertyOptional({
    description: 'Identifier of the trigger action associated to this node',
    example: 'cron',
  })
  @IsOptional()
  @IsString()
  actionId?: string;

  @ApiPropertyOptional({
    description: 'Identifier of the reaction executed by this node',
    example: 'send-email',
  })
  @IsOptional()
  @IsString()
  reactionId?: string;

  @ApiProperty({
    description: 'Free-form parameters passed to the action or reaction',
    type: 'object',
    additionalProperties: true,
    example: { expression: '*/5 * * * * *' },
  })
  @IsObject()
  params!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Identifier(s) of the next node(s) that should run after this node',
    oneOf: [
      { type: 'string', example: 'log-node' },
      { type: 'array', items: { type: 'string' }, example: ['a', 'b'] },
    ],
  })
  @IsOptional()
  next?: string | string[];

  @ApiPropertyOptional({
    description:
      'Conditional connections describing the next node(s) depending on execution outcome',
    type: () => NodeConnectionsDto,
  })
  @IsOptional()
  connections?: NodeConnectionsDto;
}

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'Unique identifier for the workflow',
    example: 'daily-report',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Human readable name',
    example: 'Daily Reporting Workflow',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Indicates whether the workflow is enabled',
    example: true,
  })
  @IsBoolean()
  active!: boolean;

  @ApiProperty({
    description: 'Ordered list of nodes forming the workflow execution graph',
    type: () => [CreateNodeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNodeDto)
  nodes!: CreateNodeDto[];
}
