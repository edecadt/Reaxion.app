import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma.service';
import { WorkflowController } from '../src/workflow/controllers/workflow.controller';
import { WorkflowEngineService } from '../src/workflow/services/workflow-engine.service';
import { WorkflowRunService } from '../src/workflow/services/workflow-run.service';
import { WorkflowRepository } from '../src/workflow/repositories/workflow.repository';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import type { Workflow } from '../src/workflow/types/workflow.types';

describe('Workflow Execution Management Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let workflowId: string;
  let runId: string;
  let testUserId: number;

  const testWorkflow: Omit<Workflow, 'id'> = {
    name: 'Test Execution Workflow',
    active: false,
    nodes: [
      {
        id: 'test-node-1',
        serviceId: 'test',
        reactionId: 'log',
        params: { message: 'Test execution' },
      },
    ],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        ScheduleModule.forRoot(),
      ],
      controllers: [WorkflowController],
      providers: [
        PrismaService,
        WorkflowEngineService,
        {
          provide: WorkflowRunService,
          useValue: {
            checkTrigger: jest.fn().mockResolvedValue(false),
            startWorkflowRun: jest.fn().mockReturnValue('test-run-id'),
            getWorkflowRuns: jest.fn().mockResolvedValue([]),
            getAllRuns: jest.fn().mockResolvedValue([]),
            getRunStatus: jest.fn().mockResolvedValue(null),
            getRunLogs: jest.fn().mockResolvedValue([]),
          },
        } as any,
        {
          provide: WorkflowRepository,
          useValue: {
            onModuleInit: jest.fn().mockResolvedValue(undefined),
            getWorkflow: jest.fn(),
            getAllWorkflows: jest.fn().mockReturnValue([]),
            createWorkflow: jest.fn().mockResolvedValue(undefined),
            updateWorkflow: jest.fn().mockResolvedValue(true),
            deleteWorkflow: jest.fn().mockResolvedValue(true),
            getActiveWorkflows: jest.fn().mockReturnValue([]),
            cleanupOldRuns: jest.fn(),
          },
        } as any,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    try {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-integration@example.com',
          name: 'Test Integration User',
          passwordHash: 'test-password-hash',
        },
      });
      testUserId = testUser.id;
    } catch (error) {
      const existingUser = await prisma.user.findUnique({
        where: { email: 'test-integration@example.com' },
      });
      if (existingUser) {
        testUserId = existingUser.id;
      } else {
        const fallbackUser = await prisma.user.create({
          data: {
            email: `test-integration-${Date.now()}@example.com`,
            name: 'Test Integration User',
            passwordHash: 'test-password-hash',
          },
        });
        testUserId = fallbackUser.id;
      }
    }

    await app.init();

    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.user
      .delete({
        where: { id: testUserId },
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  async function cleanupTestData() {
    try {
      await prisma.workflowRunLog.deleteMany({
        where: {
          run: {
            workflow: {
              name: { contains: 'Test Execution' },
            },
          },
        },
      });
      await prisma.workflowRun.deleteMany({
        where: {
          workflow: {
            name: { contains: 'Test Execution' },
          },
        },
      });
      await prisma.workflowNode.deleteMany({
        where: {
          workflow: {
            name: { contains: 'Test Execution' },
          },
        },
      });
      await prisma.workflow.deleteMany({
        where: {
          name: { contains: 'Test Execution' },
        },
      });
    } catch (error) {}
  }

  describe('Workflow CRUD Operations', () => {
    it('should create a workflow', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows')
        .send({
          id: 'test-integration-workflow',
          ...testWorkflow,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'test-integration-workflow',
        name: 'Test Execution Workflow',
        active: false,
      });

      workflowId = response.body.id;
    });

    it('should get all workflows', async () => {
      const response = await request(app.getHttpServer())
        .get('/workflows')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get workflow by id', async () => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue({
        id: workflowId,
        ...testWorkflow,
      });

      const response = await request(app.getHttpServer())
        .get(`/workflows/${workflowId}`)
        .expect(200);

      expect(response.body.id).toBe(workflowId);
    });

    it('should return 404 for non-existent workflow', async () => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue(undefined);

      await request(app.getHttpServer())
        .get('/workflows/non-existent')
        .expect(404);
    });

    it('should update a workflow', async () => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue({
        id: workflowId,
        ...testWorkflow,
      });

      const response = await request(app.getHttpServer())
        .patch(`/workflows/${workflowId}`)
        .send({ name: 'Updated Workflow' })
        .expect(200);

      expect(response.body.id).toBe(workflowId);
    });

    it('should delete a workflow', async () => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue({
        id: workflowId,
        ...testWorkflow,
      });

      await request(app.getHttpServer())
        .delete(`/workflows/${workflowId}`)
        .expect(204);
    });
  });

  describe('Workflow Execution Endpoints', () => {
    beforeEach(() => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue({
        id: workflowId,
        ...testWorkflow,
      });
    });

    it('should execute a workflow', async () => {
      const workflowEngineService = app.get(WorkflowEngineService);
      jest
        .spyOn(workflowEngineService, 'executeWorkflow')
        .mockReturnValue('test-run-123');

      const response = await request(app.getHttpServer())
        .post(`/workflows/${workflowId}/execute`)
        .expect(200);

      expect(response.body).toHaveProperty('runId');
      expect(response.body.runId).toBe('test-run-123');
      runId = response.body.runId;
    });

    it('should get workflow runs', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          workflowId,
          status: 'completed',
          startedAt: new Date(),
          logs: [],
        },
      ];

      const workflowRunService = app.get(WorkflowRunService);
      (workflowRunService.getWorkflowRuns as jest.Mock).mockResolvedValue(
        mockRuns,
      );

      const response = await request(app.getHttpServer())
        .get(`/workflows/${workflowId}/runs`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'run-1',
        workflowId,
        status: 'completed',
        logs: [],
      });
      expect(response.body[0].startedAt).toBeDefined();
    });

    it('should get run details', async () => {
      const mockRun = {
        id: runId,
        workflowId,
        status: 'completed',
        startedAt: new Date(),
        logs: [],
      };

      const workflowRunService = app.get(WorkflowRunService);
      (workflowRunService.getRunStatus as jest.Mock).mockResolvedValue(mockRun);

      const response = await request(app.getHttpServer())
        .get(`/workflows/runs/${runId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: runId,
        workflowId,
        status: 'completed',
        logs: [],
      });
      expect(response.body.startedAt).toBeDefined();
    });

    it('should get run logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          runId,
          nodeId: 'test-node-1',
          level: 'info',
          message: 'Test log',
          timestamp: new Date(),
        },
      ];

      const workflowRunService = app.get(WorkflowRunService);
      (workflowRunService.getRunStatus as jest.Mock).mockResolvedValue({
        id: runId,
        workflowId,
        status: 'completed',
        startedAt: new Date(),
        logs: mockLogs,
      });
      (workflowRunService.getRunLogs as jest.Mock).mockResolvedValue(mockLogs);

      const response = await request(app.getHttpServer())
        .get(`/workflows/runs/${runId}/logs`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'log-1',
        runId,
        nodeId: 'test-node-1',
        level: 'info',
        message: 'Test log',
      });
      expect(response.body[0].timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for workflow execution with non-existent workflow', async () => {
      const workflowEngineService = app.get(WorkflowEngineService);
      jest
        .spyOn(workflowEngineService, 'executeWorkflow')
        .mockImplementation(() => {
          throw new Error('Workflow non-existent-id not found');
        });

      const response = await request(app.getHttpServer())
        .post('/workflows/non-existent-id/execute')
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 404 for non-existent run details', async () => {
      const workflowRunService = app.get(WorkflowRunService);
      (workflowRunService.getRunStatus as jest.Mock).mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/workflows/runs/non-existent-run')
        .expect(404);
    });

    it('should return 404 for non-existent run logs', async () => {
      const workflowRunService = app.get(WorkflowRunService);
      (workflowRunService.getRunStatus as jest.Mock).mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/workflows/runs/non-existent-run/logs')
        .expect(404);
    });

    it('should return 404 for workflow runs with non-existent workflow', async () => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue(undefined);

      await request(app.getHttpServer())
        .get('/workflows/non-existent/runs')
        .expect(404);
    });
  });

  describe('Workflow Activation/Deactivation', () => {
    beforeEach(() => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue({
        id: workflowId,
        ...testWorkflow,
      });
    });

    it('should activate a workflow', async () => {
      const workflowEngineService = app.get(WorkflowEngineService);
      jest
        .spyOn(workflowEngineService, 'activateWorkflow')
        .mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post(`/workflows/${workflowId}/activate`)
        .expect(200);

      expect(response.body.id).toBe(workflowId);
    });

    it('should deactivate a workflow', async () => {
      const workflowEngineService = app.get(WorkflowEngineService);
      jest
        .spyOn(workflowEngineService, 'deactivateWorkflow')
        .mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post(`/workflows/${workflowId}/deactivate`)
        .expect(200);

      expect(response.body.id).toBe(workflowId);
    });

    it('should return 404 when activating non-existent workflow', async () => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue(undefined);

      await request(app.getHttpServer())
        .post('/workflows/non-existent/activate')
        .expect(404);
    });

    it('should return 404 when deactivating non-existent workflow', async () => {
      const workflowRepository = app.get(WorkflowRepository);
      (workflowRepository.getWorkflow as jest.Mock).mockReturnValue(undefined);

      await request(app.getHttpServer())
        .post('/workflows/non-existent/deactivate')
        .expect(404);
    });
  });

  describe('Database Integration', () => {
    it('should verify WorkflowRun model exists in database', async () => {
      const dbTestUser = await prisma.user.create({
        data: {
          email: 'db-test-run@example.com',
          name: 'DB Test Run User',
          passwordHash: 'test-password-hash',
        },
      });

      const testRun = await prisma.workflowRun
        .create({
          data: {
            id: 'integration-test-run',
            workflowId: 'test-workflow-for-run',
            status: 'running',
            startedAt: new Date(),
          },
        })
        .catch(async () => {
          await prisma.workflow.create({
            data: {
              id: 'test-workflow-for-run',
              name: 'Test Workflow for Run',
              active: false,
              userId: dbTestUser.id,
            },
          });

          return await prisma.workflowRun.create({
            data: {
              id: 'integration-test-run',
              workflowId: 'test-workflow-for-run',
              status: 'running',
              startedAt: new Date(),
            },
          });
        });

      expect(testRun.id).toBe('integration-test-run');
      expect(testRun.status).toBe('running');

      await prisma.workflowRun.delete({
        where: { id: 'integration-test-run' },
      });
      await prisma.workflow
        .delete({
          where: { id: 'test-workflow-for-run' },
        })
        .catch(() => {});
      await prisma.user
        .delete({
          where: { id: dbTestUser.id },
        })
        .catch(() => {});
    });

    it('should verify WorkflowRunLog model exists in database', async () => {
      const dbLogTestUser = await prisma.user.create({
        data: {
          email: 'db-test-log@example.com',
          name: 'DB Test Log User',
          passwordHash: 'test-password-hash',
        },
      });

      const workflow = await prisma.workflow.create({
        data: {
          id: 'test-workflow-for-log',
          name: 'Test Workflow for Log',
          active: false,
          userId: dbLogTestUser.id,
        },
      });

      const run = await prisma.workflowRun.create({
        data: {
          id: 'test-run-for-log',
          workflowId: workflow.id,
          status: 'running',
          startedAt: new Date(),
        },
      });

      const testLog = await prisma.workflowRunLog.create({
        data: {
          id: 'integration-test-log',
          runId: run.id,
          nodeId: 'test-node',
          level: 'info',
          message: 'Integration test log',
          timestamp: new Date(),
        },
      });

      expect(testLog.id).toBe('integration-test-log');
      expect(testLog.message).toBe('Integration test log');
      expect(testLog.level).toBe('info');

      await prisma.workflowRunLog
        .delete({
          where: { id: testLog.id },
        })
        .catch(() => {});
      await prisma.workflowRun
        .delete({
          where: { id: run.id },
        })
        .catch(() => {});
      await prisma.workflow
        .delete({
          where: { id: workflow.id },
        })
        .catch(() => {});
      await prisma.user
        .delete({
          where: { id: dbLogTestUser.id },
        })
        .catch(() => {});
    });
  });
});
