import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowRepository } from '../src/workflow/repositories/workflow.repository';
import { PrismaService } from '../src/prisma.service';
import type {
  Workflow,
  WorkflowRun,
} from '../src/workflow/types/workflow.types';

describe('WorkflowRepository', () => {
  let repository: WorkflowRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockWorkflow: Workflow = {
    id: 'w1',
    name: 'Test Workflow',
    active: false,
    nodes: [
      {
        id: 'node-1',
        serviceId: 'timer',
        actionId: 'cron',
        params: { expression: '0 9 * * *' },
        next: 'node-2',
      },
      {
        id: 'node-2',
        serviceId: 'email',
        reactionId: 'send',
        params: { to: 'test@example.com' },
      },
    ],
  };

  const mockDbWorkflow = {
    id: 'w1',
    name: 'Test Workflow',
    active: false,
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    nodes: [
      {
        id: 'node-1',
        workflowId: 'w1',
        serviceId: 'timer',
        actionId: 'cron',
        reactionId: null,
        params: { expression: '0 9 * * *' },
        next: 'node-2',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'node-2',
        workflowId: 'w1',
        serviceId: 'email',
        actionId: null,
        reactionId: 'send',
        params: { to: 'test@example.com' },
        next: null,
        position: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const mockRun: WorkflowRun = {
    id: 'run-1',
    workflowId: 'w1',
    status: 'running',
    startedAt: new Date(),
    logs: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowRepository,
        {
          provide: PrismaService,
          useValue: {
            workflow: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            workflowNode: {
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        } as any,
      ],
    }).compile();

    repository = module.get<WorkflowRepository>(WorkflowRepository);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should warm cache with workflows from database', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        mockDbWorkflow,
      ]);

      await repository.onModuleInit();

      expect(prisma.workflow.findMany).toHaveBeenCalledWith({
        include: {
          nodes: {
            orderBy: { position: 'asc' },
          },
        },
      });

      const cachedWorkflow = repository.getWorkflow('w1');
      expect(cachedWorkflow).toBeDefined();
      expect(cachedWorkflow?.name).toBe('Test Workflow');
      expect(cachedWorkflow?.nodes).toHaveLength(2);
    });

    it('should handle empty database on startup', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([]);

      await repository.onModuleInit();

      expect(prisma.workflow.findMany).toHaveBeenCalled();
      expect(repository.getAllWorkflows()).toHaveLength(0);
    });

    it('should throw error if database fails during warmup', async () => {
      const error = new Error('Database connection failed');
      (prisma.workflow.findMany as jest.Mock).mockRejectedValue(error);

      await expect(repository.onModuleInit()).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('createWorkflow', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });
    });

    it('should create workflow in database and cache', async () => {
      (prisma.workflow.create as jest.Mock).mockResolvedValue(mockDbWorkflow);
      (prisma.workflowNode.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await repository.createWorkflow(mockWorkflow);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: {
          id: 'w1',
          name: 'Test Workflow',
          active: false,
          userId: 1,
        },
      });
      expect(prisma.workflowNode.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'node-1',
            workflowId: 'w1',
            serviceId: 'timer',
            actionId: 'cron',
            position: 0,
          }),
          expect.objectContaining({
            id: 'node-2',
            workflowId: 'w1',
            serviceId: 'email',
            reactionId: 'send',
            position: 1,
          }),
        ]),
      });

      const cachedWorkflow = repository.getWorkflow('w1');
      expect(cachedWorkflow).toEqual(mockWorkflow);
    });

    it('should create workflow without nodes', async () => {
      const workflowWithoutNodes = { ...mockWorkflow, nodes: [] };
      (prisma.workflow.create as jest.Mock).mockResolvedValue(mockDbWorkflow);

      await repository.createWorkflow(workflowWithoutNodes);

      expect(prisma.workflow.create).toHaveBeenCalled();
      expect(prisma.workflowNode.createMany).not.toHaveBeenCalled();
    });

    it('should throw error if database creation fails', async () => {
      const error = new Error('Database error');
      prisma.$transaction.mockRejectedValue(error);

      await expect(repository.createWorkflow(mockWorkflow)).rejects.toThrow(
        'Database error',
      );
      expect(repository.getWorkflow('w1')).toBeUndefined();
    });
  });

  describe('getWorkflow', () => {
    it('should return workflow from cache', () => {
      repository['workflows'].set('w1', mockWorkflow);

      const result = repository.getWorkflow('w1');
      expect(result).toEqual(mockWorkflow);
    });

    it('should return undefined for non-existent workflow', () => {
      const result = repository.getWorkflow('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllWorkflows', () => {
    it('should return all workflows from cache', () => {
      repository['workflows'].set('w1', mockWorkflow);
      repository['workflows'].set('w2', { ...mockWorkflow, id: 'w2' });

      const result = repository.getAllWorkflows();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no workflows', () => {
      const result = repository.getAllWorkflows();
      expect(result).toHaveLength(0);
    });
  });

  describe('getActiveWorkflows', () => {
    it('should return only active workflows', () => {
      repository['workflows'].set('w1', mockWorkflow);
      repository['workflows'].set('w2', {
        ...mockWorkflow,
        id: 'w2',
        active: true,
      });

      const result = repository.getActiveWorkflows();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('w2');
    });
  });

  describe('updateWorkflow', () => {
    beforeEach(() => {
      repository['workflows'].set('w1', mockWorkflow);
      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });
    });

    it('should update workflow in database and cache', async () => {
      const updates = { name: 'Updated Workflow', active: true };
      (prisma.workflow.update as jest.Mock).mockResolvedValue({
        ...mockDbWorkflow,
        ...updates,
      });

      const success = await repository.updateWorkflow('w1', updates);

      expect(success).toBe(true);
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: updates,
      });

      const updatedWorkflow = repository.getWorkflow('w1');
      expect(updatedWorkflow?.name).toBe('Updated Workflow');
      expect(updatedWorkflow?.active).toBe(true);
    });

    it('should update nodes when provided', async () => {
      const newNodes = [
        {
          id: 'new-node',
          serviceId: 'discord',
          reactionId: 'message',
          params: { text: 'Hello' },
        },
      ];
      const updates = { nodes: newNodes };

      (prisma.workflowNode.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });
      (prisma.workflowNode.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const success = await repository.updateWorkflow('w1', updates);

      expect(success).toBe(true);
      expect(prisma.workflowNode.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: 'w1' },
      });
      expect(prisma.workflowNode.createMany).toHaveBeenCalled();

      const updatedWorkflow = repository.getWorkflow('w1');
      expect(updatedWorkflow?.nodes).toEqual(newNodes);
    });

    it('should return false for non-existent workflow', async () => {
      const success = await repository.updateWorkflow('non-existent', {
        name: 'Test',
      });
      expect(success).toBe(false);
    });

    it('should rollback cache on database error', async () => {
      const originalWorkflow = { ...mockWorkflow };
      const error = new Error('Database error');
      prisma.$transaction.mockRejectedValue(error);

      await expect(
        repository.updateWorkflow('w1', { name: 'Failed Update' }),
      ).rejects.toThrow('Database error');

      const workflow = repository.getWorkflow('w1');
      expect(workflow).toEqual(originalWorkflow);
    });
  });

  describe('deleteWorkflow', () => {
    beforeEach(() => {
      repository['workflows'].set('w1', mockWorkflow);
    });

    it('should delete workflow from database and cache', async () => {
      (prisma.workflow.delete as jest.Mock).mockResolvedValue(mockDbWorkflow);

      const success = await repository.deleteWorkflow('w1');

      expect(success).toBe(true);
      expect(prisma.workflow.delete).toHaveBeenCalledWith({
        where: { id: 'w1' },
      });
      expect(repository.getWorkflow('w1')).toBeUndefined();
    });

    it('should return false for non-existent workflow', async () => {
      const success = await repository.deleteWorkflow('non-existent');
      expect(success).toBe(false);
    });

    it('should rollback cache on database error', async () => {
      const error = new Error('Database error');
      (prisma.workflow.delete as jest.Mock).mockRejectedValue(error);

      await expect(repository.deleteWorkflow('w1')).rejects.toThrow(
        'Database error',
      );

      expect(repository.getWorkflow('w1')).toEqual(mockWorkflow);
    });
  });

  describe('run management', () => {
    it('should create and store run', () => {
      repository.createRun(mockRun);

      const retrievedRun = repository.getRun('run-1');
      expect(retrievedRun).toEqual(mockRun);
    });

    it('should return all runs', () => {
      repository.createRun(mockRun);
      repository.createRun({ ...mockRun, id: 'run-2' });

      const runs = repository.getAllRuns();
      expect(runs).toHaveLength(2);
    });

    it('should filter runs by workflow', () => {
      repository.createRun(mockRun);
      repository.createRun({ ...mockRun, id: 'run-2', workflowId: 'w2' });

      const runs = repository.getRunsByWorkflow('w1');
      expect(runs).toHaveLength(1);
      expect(runs[0]!.workflowId).toBe('w1');
    });

    it('should filter running runs', () => {
      repository.createRun(mockRun);
      repository.createRun({
        ...mockRun,
        id: 'run-2',
        status: 'completed',
      });

      const runningRuns = repository.getRunningRuns();
      expect(runningRuns).toHaveLength(1);
      expect(runningRuns[0]!.status).toBe('running');
    });

    it('should update run', () => {
      repository.createRun(mockRun);

      const success = repository.updateRun('run-1', { status: 'completed' });
      expect(success).toBe(true);

      const updatedRun = repository.getRun('run-1');
      expect(updatedRun?.status).toBe('completed');
    });

    it('should return false when updating non-existent run', () => {
      const success = repository.updateRun('non-existent', {
        status: 'completed',
      });
      expect(success).toBe(false);
    });
  });

  describe('log management', () => {
    const mockLog = {
      id: 'log-1',
      runId: 'run-1',
      nodeId: 'test-node',
      level: 'info' as const,
      message: 'Test log',
      timestamp: new Date(),
    };

    beforeEach(() => {
      repository.createRun(mockRun);
    });

    it('should add log to run', () => {
      repository.addLog('run-1', mockLog);

      const logs = repository.getRunLogs('run-1');
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(mockLog);

      const run = repository.getRun('run-1');
      expect(run?.logs).toHaveLength(1);
    });

    it('should return empty array for non-existent run logs', () => {
      const logs = repository.getRunLogs('non-existent');
      expect(logs).toHaveLength(0);
    });
  });

  describe('cleanupOldRuns', () => {
    it('should keep only recent runs per workflow', () => {
      repository['workflows'].set('w1', mockWorkflow);

      const runs = Array.from({ length: 102 }, (_, i) => ({
        ...mockRun,
        id: `run-${i}`,
        startedAt: new Date(Date.now() - i * 1000),
      }));

      runs.forEach((run) => repository.createRun(run));

      repository.cleanupOldRuns();

      const remainingRuns = repository.getRunsByWorkflow('w1');
      expect(remainingRuns).toHaveLength(100);

      const runIds = remainingRuns.map((r) => r.id);
      expect(runIds).toContain('run-0');
      expect(runIds).toContain('run-99');
      expect(runIds).not.toContain('run-101');
    });
  });
});
