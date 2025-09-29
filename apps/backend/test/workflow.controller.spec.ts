import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from '../src/workflow/controllers/workflow.controller';
import { WorkflowEngineService } from '../src/workflow/services/workflow-engine.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { Workflow } from '../src/workflow/types/workflow.types';

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let service: jest.Mocked<WorkflowEngineService>;

  const mockWorkflow: Workflow = {
    id: 'w1',
    name: 'Test Workflow',
    active: false,
    nodes: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        {
          provide: WorkflowEngineService,
          useValue: {
            getWorkflow: jest.fn(),
            getAllWorkflows: jest.fn(),
            createWorkflow: jest.fn(),
            updateWorkflow: jest.fn(),
            deleteWorkflow: jest.fn(),
            activateWorkflow: jest.fn(),
            deactivateWorkflow: jest.fn(),
            executeWorkflow: jest.fn(),
            getWorkflowRuns: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WorkflowController>(WorkflowController);
    service = module.get(WorkflowEngineService);
  });

  describe('createWorkflow', () => {
    it('creates a workflow when ID is available', async () => {
      service.getWorkflow.mockReturnValue(undefined);
      service.createWorkflow.mockResolvedValue(undefined);

      const dto = { id: 'w1', name: 'New', active: true, nodes: [] };
      const result = await controller.createWorkflow(dto);

      expect(service.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
      expect(result.id).toBe('w1');
    });

    it('throws BadRequest if ID already exists', async () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);

      await expect(
        controller.createWorkflow({
          id: 'w1',
          name: 'New',
          active: true,
          nodes: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllWorkflows', () => {
    it('returns all workflows', () => {
      service.getAllWorkflows.mockReturnValue([mockWorkflow]);

      const res = controller.getAllWorkflows();
      expect(res).toEqual([mockWorkflow]);
    });

    it('filters by active=true', () => {
      service.getAllWorkflows.mockReturnValue([
        { ...mockWorkflow, active: true },
        { ...mockWorkflow, id: 'w2', active: false },
      ]);

      const res = controller.getAllWorkflows('true');
      expect(res).toHaveLength(1);
      expect(res[0]!.active).toBe(true);
    });
  });

  describe('getWorkflowById', () => {
    it('returns workflow if found', () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      const res = controller.getWorkflowById('w1');
      expect(res).toEqual(mockWorkflow);
    });

    it('throws NotFound if non-existent', () => {
      service.getWorkflow.mockReturnValue(undefined);
      expect(() => controller.getWorkflowById('w404')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateWorkflow', () => {
    it('updates and returns workflow', async () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.updateWorkflow.mockResolvedValue(true);

      const res = await controller.updateWorkflow('w1', { name: 'Updated' });
      expect(service.updateWorkflow).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ name: 'Updated' }),
      );
      expect(res).toEqual(mockWorkflow);
    });

    it('throws NotFound if non-existent', async () => {
      service.getWorkflow.mockReturnValue(undefined);
      await expect(
        controller.updateWorkflow('w404', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteWorkflow', () => {
    it('deletes workflow', async () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.deleteWorkflow.mockResolvedValue(true);

      await expect(controller.deleteWorkflow('w1')).resolves.not.toThrow();
      expect(service.deleteWorkflow).toHaveBeenCalledWith('w1');
    });

    it('throws NotFound if non-existent', async () => {
      service.getWorkflow.mockReturnValue(undefined);
      await expect(controller.deleteWorkflow('w404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate/deactivate', () => {
    it('activates workflow', async () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.activateWorkflow.mockResolvedValue(true);

      const res = await controller.activateWorkflow('w1');
      expect(service.activateWorkflow).toHaveBeenCalledWith('w1');
      expect(res).toEqual(mockWorkflow);
    });

    it('deactivates workflow', async () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.deactivateWorkflow.mockResolvedValue(true);

      const res = await controller.deactivateWorkflow('w1');
      expect(service.deactivateWorkflow).toHaveBeenCalledWith('w1');
      expect(res).toEqual(mockWorkflow);
    });
  });

  describe('executeWorkflow', () => {
    it('returns runId', () => {
      service.executeWorkflow.mockReturnValue('run-123');
      const res = controller.executeWorkflow('w1');
      expect(res).toEqual({ runId: 'run-123' });
    });

    it('throws NotFound if service throws not found error', () => {
      service.executeWorkflow.mockImplementation(() => {
        throw new Error('not found');
      });
      expect(() => controller.executeWorkflow('w404')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('getWorkflowRuns', () => {
    it('returns list of runs', () => {
      const mockRun = {
        id: 'r1',
        workflowId: 'w1',
        status: 'completed' as const,
        startedAt: new Date(),
        logs: [],
      };

      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.getWorkflowRuns.mockReturnValue([mockRun]);

      const res = controller.getWorkflowRuns('w1');
      expect(res).toEqual([mockRun]);
    });
  });
});
