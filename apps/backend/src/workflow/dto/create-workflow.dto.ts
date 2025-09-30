import {
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNodeDto {
  @IsString()
  id!: string;

  @IsString()
  serviceId!: string;

  @IsOptional()
  @IsString()
  actionId?: string;

  @IsOptional()
  @IsString()
  reactionId?: string;

  @IsObject()
  params!: Record<string, unknown>;

  @IsOptional()
  next?: string | string[];

  @IsOptional()
  connections?: {
    success?: string[];
    error?: string[];
    always?: string[];
  };
}

export class CreateWorkflowDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsBoolean()
  active!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNodeDto)
  nodes!: CreateNodeDto[];

  @IsOptional()
  @IsString()
  userId?: string;
}
