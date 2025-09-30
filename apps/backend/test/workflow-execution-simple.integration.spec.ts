import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma.service';
import { ConfigModule } from '@nestjs/config';

describe('Workflow Execution Simple Integration', () => {
  let prisma: PrismaService;
  let testUserId: number;
  let workflowId: string;
  let runId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [PrismaService],
    }).compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    const testUser = await prisma.user.create({
      data: {
        email: 'test-simple@example.com',
        name: 'Test Simple User',
        passwordHash: 'test-password-hash',
      },
    });
    testUserId = testUser.id;

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
  });

  async function cleanupTestData() {
    try {
      await prisma.workflowRunLog.deleteMany({
        where: {
          run: {
            workflow: {
              name: { contains: 'Simple Test' },
            },
          },
        },
      });
      await prisma.workflowRun.deleteMany({
        where: {
          workflow: {
            name: { contains: 'Simple Test' },
          },
        },
      });
      await prisma.workflowNode.deleteMany({
        where: {
          workflow: {
            name: { contains: 'Simple Test' },
          },
        },
      });
      await prisma.workflow.deleteMany({
        where: {
          name: { contains: 'Simple Test' },
        },
      });
    } catch (error) {}
  }

  describe('Database Models Validation', () => {
    let localWorkflowId: string;
    let localRunId: string;

    beforeEach(async () => {
      const workflow = await prisma.workflow.create({
        data: {
          id: `simple-test-workflow-${Date.now()}`,
          name: 'Simple Test Workflow',
          active: false,
          userId: testUserId,
        },
      });
      localWorkflowId = workflow.id;
    });

    afterEach(async () => {
      await prisma.workflowRunLog
        .deleteMany({
          where: {
            run: {
              workflowId: localWorkflowId,
            },
          },
        })
        .catch(() => {});
      await prisma.workflowRun
        .deleteMany({
          where: { workflowId: localWorkflowId },
        })
        .catch(() => {});
      await prisma.workflow
        .delete({
          where: { id: localWorkflowId },
        })
        .catch(() => {});
    });

    it('should create WorkflowRun and WorkflowRunLog models', async () => {
      const workflowRun = await prisma.workflowRun.create({
        data: {
          id: `simple-test-run-${Date.now()}`,
          workflowId: localWorkflowId,
          status: 'running',
          startedAt: new Date(),
        },
      });
      localRunId = workflowRun.id;

      expect(workflowRun.id).toContain('simple-test-run-');
      expect(workflowRun.workflowId).toBe(localWorkflowId);
      expect(workflowRun.status).toBe('running');
      expect(workflowRun.startedAt).toBeInstanceOf(Date);

      const workflowRunLog = await prisma.workflowRunLog.create({
        data: {
          id: `simple-test-log-${Date.now()}`,
          runId: localRunId,
          nodeId: 'test-node',
          level: 'info',
          message: 'Test log message',
          timestamp: new Date(),
        },
      });

      expect(workflowRunLog.id).toContain('simple-test-log-');
      expect(workflowRunLog.runId).toBe(localRunId);
      expect(workflowRunLog.message).toBe('Test log message');
      expect(workflowRunLog.level).toBe('info');
    });

    it('should query runs by workflow with relations', async () => {
      const testRun = await prisma.workflowRun.create({
        data: {
          id: `query-test-run-${Date.now()}`,
          workflowId: localWorkflowId,
          status: 'running',
          startedAt: new Date(),
        },
      });

      await prisma.workflowRunLog.create({
        data: {
          id: `query-test-log-${Date.now()}`,
          runId: testRun.id,
          nodeId: 'test-node',
          level: 'info',
          message: 'Test log message',
          timestamp: new Date(),
        },
      });

      const runsWithLogs = await prisma.workflowRun.findMany({
        where: { workflowId: localWorkflowId },
        include: {
          logs: true,
          workflow: true,
        },
        orderBy: { startedAt: 'desc' },
      });

      expect(runsWithLogs.length).toBeGreaterThan(0);

      const run = runsWithLogs[0];
      expect(run?.workflow.id).toBe(localWorkflowId);
      expect(Array.isArray(run?.logs)).toBe(true);
      expect(run?.logs.length).toBeGreaterThan(0);
      expect(run?.logs[0]?.message).toBe('Test log message');
    });

    it('should query logs by run', async () => {
      const testRun = await prisma.workflowRun.create({
        data: {
          id: `logs-test-run-${Date.now()}`,
          workflowId: localWorkflowId,
          status: 'running',
          startedAt: new Date(),
        },
      });

      await prisma.workflowRunLog.create({
        data: {
          id: `logs-test-log-${Date.now()}`,
          runId: testRun.id,
          nodeId: 'test-node',
          level: 'info',
          message: 'Test log message',
          timestamp: new Date(),
        },
      });

      const logs = await prisma.workflowRunLog.findMany({
        where: { runId: testRun.id },
        include: { run: true },
        orderBy: { timestamp: 'asc' },
      });

      expect(logs.length).toBeGreaterThan(0);

      const log = logs[0];
      expect(log?.runId).toBe(testRun.id);
      expect(log?.run.workflowId).toBe(localWorkflowId);
      expect(log?.message).toBe('Test log message');
    });

    it('should update workflow run status', async () => {
      const testRun = await prisma.workflowRun.create({
        data: {
          id: `update-test-run-${Date.now()}`,
          workflowId: localWorkflowId,
          status: 'running',
          startedAt: new Date(),
        },
      });

      const updatedRun = await prisma.workflowRun.update({
        where: { id: testRun.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      expect(updatedRun.status).toBe('completed');
      expect(updatedRun.completedAt).toBeInstanceOf(Date);
    });

    it('should query runs by status efficiently', async () => {
      const start = Date.now();

      const completedRuns = await prisma.workflowRun.findMany({
        where: { status: 'completed' },
        take: 10,
      });

      const end = Date.now();
      const queryTime = end - start;

      expect(queryTime).toBeLessThan(100);
      expect(Array.isArray(completedRuns)).toBe(true);

      if (completedRuns.length > 0) {
        expect(completedRuns[0]?.status).toBe('completed');
      }
    });

    it('should handle workflow relations correctly', async () => {
      const testRun = await prisma.workflowRun.create({
        data: {
          id: `relations-test-run-${Date.now()}`,
          workflowId: localWorkflowId,
          status: 'running',
          startedAt: new Date(),
        },
      });

      await prisma.workflowRunLog.create({
        data: {
          id: `relations-test-log-${Date.now()}`,
          runId: testRun.id,
          nodeId: 'test-node',
          level: 'info',
          message: 'Test log message',
          timestamp: new Date(),
        },
      });

      const workflowWithRuns = await prisma.workflow.findUnique({
        where: { id: localWorkflowId },
        include: {
          runs: {
            include: { logs: true },
            orderBy: { startedAt: 'desc' },
          },
        },
      });

      expect(workflowWithRuns).toBeTruthy();
      expect(workflowWithRuns?.runs.length).toBeGreaterThan(0);

      const run = workflowWithRuns?.runs[0];
      expect(run?.id).toBe(testRun.id);
      expect(run?.logs.length).toBeGreaterThan(0);
    });

    it('should handle cascading deletes properly', async () => {
      const cascadeUser = await prisma.user.create({
        data: {
          email: `cascade-test-${Date.now()}@example.com`,
          name: 'Cascade Test User',
          passwordHash: 'test-password-hash',
        },
      });

      const cascadeWorkflow = await prisma.workflow.create({
        data: {
          id: 'cascade-test-workflow',
          name: 'Cascade Test Workflow',
          active: false,
          userId: cascadeUser.id,
        },
      });

      const testRun = await prisma.workflowRun.create({
        data: {
          id: 'cascade-test-run',
          workflowId: cascadeWorkflow.id,
          status: 'running',
          startedAt: new Date(),
        },
      });

      await prisma.workflowRunLog.create({
        data: {
          id: 'cascade-test-log',
          runId: testRun.id,
          nodeId: 'test-node',
          level: 'info',
          message: 'Cascade test log',
          timestamp: new Date(),
        },
      });

      await prisma.workflow.delete({
        where: { id: cascadeWorkflow.id },
      });

      const remainingRuns = await prisma.workflowRun.findMany({
        where: { workflowId: cascadeWorkflow.id },
      });

      const remainingLogs = await prisma.workflowRunLog.findMany({
        where: {
          id: 'cascade-test-log',
        },
      });

      expect(remainingRuns).toHaveLength(0);
      expect(remainingLogs).toHaveLength(0);
    });
  });

  describe('Database Performance', () => {
    it('should efficiently query runs by workflow with limit', async () => {
      const workflows = await prisma.workflow.findFirst();
      if (!workflows) {
        return;
      }

      const start = Date.now();

      const recentRuns = await prisma.workflowRun.findMany({
        take: 5,
        orderBy: { startedAt: 'desc' },
        include: { workflow: true },
      });

      const end = Date.now();
      const queryTime = end - start;

      expect(queryTime).toBeLessThan(100);
      expect(Array.isArray(recentRuns)).toBe(true);
    });

    it('should efficiently query by status with indexes', async () => {
      const start = Date.now();

      const runningRuns = await prisma.workflowRun.findMany({
        where: { status: 'running' },
        take: 10,
      });

      const end = Date.now();
      const queryTime = end - start;

      expect(queryTime).toBeLessThan(100);
      expect(Array.isArray(runningRuns)).toBe(true);
    });
  });
});
