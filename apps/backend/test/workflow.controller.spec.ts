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
    it('crée un workflow quand l’ID est libre', () => {
      service.getWorkflow.mockReturnValue(undefined);

      const dto = { id: 'w1', name: 'New', active: true, nodes: [] };
      const result = controller.createWorkflow(dto);

      expect(service.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
      expect(result.id).toBe('w1');
    });

    it('lève une BadRequest si l’ID existe déjà', () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);

      expect(() =>
        controller.createWorkflow({
          id: 'w1',
          name: 'New',
          active: true,
          nodes: [],
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('getAllWorkflows', () => {
    it('retourne tous les workflows', () => {
      service.getAllWorkflows.mockReturnValue([mockWorkflow]);

      const res = controller.getAllWorkflows();
      expect(res).toEqual([mockWorkflow]);
    });

    it('filtre par active=true', () => {
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
    it('retourne le workflow si trouvé', () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      const res = controller.getWorkflowById('w1');
      expect(res).toEqual(mockWorkflow);
    });

    it('lève NotFound si inexistant', () => {
      service.getWorkflow.mockReturnValue(undefined);
      expect(() => controller.getWorkflowById('w404')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateWorkflow', () => {
    it('met à jour et renvoie le workflow', () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.updateWorkflow.mockReturnValue(true);

      const res = controller.updateWorkflow('w1', { name: 'Updated' });
      expect(service.updateWorkflow).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ name: 'Updated' }),
      );
      expect(res).toEqual(mockWorkflow);
    });

    it('lève NotFound si inexistant', () => {
      service.getWorkflow.mockReturnValue(undefined);
      expect(() => controller.updateWorkflow('w404', { name: 'X' })).toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteWorkflow', () => {
    it('supprime le workflow', () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.deleteWorkflow.mockReturnValue(true);

      expect(() => controller.deleteWorkflow('w1')).not.toThrow();
      expect(service.deleteWorkflow).toHaveBeenCalledWith('w1');
    });

    it('lève NotFound si inexistant', () => {
      service.getWorkflow.mockReturnValue(undefined);
      expect(() => controller.deleteWorkflow('w404')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate/deactivate', () => {
    it('active un workflow', () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.activateWorkflow.mockReturnValue(true);

      const res = controller.activateWorkflow('w1');
      expect(service.activateWorkflow).toHaveBeenCalledWith('w1');
      expect(res).toEqual(mockWorkflow);
    });

    it('désactive un workflow', () => {
      service.getWorkflow.mockReturnValue(mockWorkflow);
      service.deactivateWorkflow.mockReturnValue(true);

      const res = controller.deactivateWorkflow('w1');
      expect(service.deactivateWorkflow).toHaveBeenCalledWith('w1');
      expect(res).toEqual(mockWorkflow);
    });
  });

  describe('executeWorkflow', () => {
    it('retourne un runId', () => {
      service.executeWorkflow.mockReturnValue('run-123');
      const res = controller.executeWorkflow('w1');
      expect(res).toEqual({ runId: 'run-123' });
    });

    it('lève NotFound si le service signale une erreur de type "not found"', () => {
      service.executeWorkflow.mockImplementation(() => {
        throw new Error('not found');
      });
      expect(() => controller.executeWorkflow('w404')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('getWorkflowRuns', () => {
    it('retourne la liste des runs', () => {
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
