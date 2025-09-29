import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowRunService } from './services/workflow-run.service';
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowController } from './controllers/workflow.controller';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ScheduleModule.forRoot(), ServicesModule],
  controllers: [WorkflowController],
  providers: [WorkflowRepository, WorkflowRunService, WorkflowEngineService],
  exports: [WorkflowEngineService, WorkflowRunService, WorkflowRepository],
})
export class WorkflowModule {}
