import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowEngineService } from '../services/workflow-engine.service';

@Injectable()
export class WorkflowOwnershipGuard implements CanActivate {
  constructor(private readonly workflowEngineService: WorkflowEngineService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workflowId = request.params.id;

    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!workflowId) {
      return true;
    }

    const workflow = this.workflowEngineService.getWorkflow(workflowId);

    if (!workflow) {
      throw new NotFoundException(`Workflow with id '${workflowId}' not found`);
    }

    if (workflow.userId !== user.sub) {
      throw new ForbiddenException(
        'You do not have permission to access this workflow',
      );
    }

    return true;
  }
}
