import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowRunService } from './services/workflow-run.service';
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowController } from './controllers/workflow.controller';
import { ServicesModule } from '../services/services.module';
import { ServiceAuthModule } from '../service-auth/service-auth.module';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkflowOwnershipGuard } from './guards/workflow-ownership.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServicesModule,
    ServiceAuthModule,
    ConfigModule,
  ],
  controllers: [WorkflowController],
  providers: [
    PrismaService,
    WorkflowRepository,
    WorkflowRunService,
    WorkflowEngineService,
    JwtAuthGuard,
    WorkflowOwnershipGuard,
  ],
  exports: [WorkflowEngineService, WorkflowRunService, WorkflowRepository],
})
export class WorkflowModule {}
