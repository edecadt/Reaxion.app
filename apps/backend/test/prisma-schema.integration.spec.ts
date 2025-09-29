import { PrismaService } from '../src/prisma.service';

describe('Prisma Schema Integration Tests', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "WorkflowNode", "Workflow", "User" RESTART IDENTITY CASCADE`;
  });

  describe('Database Schema Validation', () => {
    it('should have all required tables', async () => {
      const tables = (await prisma.$queryRaw`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `) as any[];

      const tableNames = tables.map((t: any) => t.table_name);
      expect(tableNames).toContain('User');
      expect(tableNames).toContain('Workflow');
      expect(tableNames).toContain('WorkflowNode');
    });

    it('should have correct User table structure', async () => {
      const columns = (await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'User' AND table_schema = 'public'
        ORDER BY column_name
      `) as any[];

      const columnNames = columns.map((c: any) => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('passwordHash');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });

    it('should have correct Workflow table structure', async () => {
      const columns = (await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'Workflow' AND table_schema = 'public'
        ORDER BY column_name
      `) as any[];

      const columnNames = columns.map((c: any) => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('active');
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });

    it('should have correct WorkflowNode table structure', async () => {
      const columns = (await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'WorkflowNode' AND table_schema = 'public'
        ORDER BY column_name
      `) as any[];

      const columnNames = columns.map((c: any) => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workflowId');
      expect(columnNames).toContain('serviceId');
      expect(columnNames).toContain('actionId');
      expect(columnNames).toContain('reactionId');
      expect(columnNames).toContain('params');
      expect(columnNames).toContain('next');
      expect(columnNames).toContain('position');
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should have foreign key from Workflow to User', async () => {
      const fks = (await prisma.$queryRaw`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'Workflow'
          AND kcu.column_name = 'userId'
      `) as any[];

      expect(fks.length).toBeGreaterThan(0);
      expect(fks[0].foreign_table_name).toBe('User');
    });

    it('should have foreign key from WorkflowNode to Workflow', async () => {
      const fks = (await prisma.$queryRaw`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'WorkflowNode'
          AND kcu.column_name = 'workflowId'
      `) as any[];

      expect(fks.length).toBeGreaterThan(0);
      expect(fks[0].foreign_table_name).toBe('Workflow');
    });
  });

  describe('Indexes', () => {
    it('should have index on Workflow.userId', async () => {
      const indexes = (await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'Workflow' AND indexname LIKE '%userId%'
      `) as any[];

      expect(indexes.length).toBeGreaterThan(0);
    });

    it('should have index on WorkflowNode.workflowId', async () => {
      const indexes = (await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'WorkflowNode' AND indexname LIKE '%workflowId%'
      `) as any[];

      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('Basic CRUD Operations', () => {
    it('should insert and retrieve a complete workflow hierarchy', async () => {
      await prisma.$executeRaw`
        INSERT INTO "User" (email, name, "passwordHash", "createdAt", "updatedAt")
        VALUES ('test@example.com', 'Test User', 'hash123', NOW(), NOW())
      `;

      const user = (await prisma.$queryRaw`
        SELECT id FROM "User" WHERE email = 'test@example.com'
      `) as any[];

      expect(user).toHaveLength(1);
      const userId = user[0].id;

      await prisma.$executeRaw`
        INSERT INTO "Workflow" (id, name, active, "userId", "createdAt", "updatedAt")
        VALUES ('test-workflow', 'Test Workflow', true, ${userId}, NOW(), NOW())
      `;

      await prisma.$executeRaw`
        INSERT INTO "WorkflowNode" (id, "workflowId", "serviceId", "actionId", params, position, "createdAt", "updatedAt")
        VALUES
          ('node-1', 'test-workflow', 'timer', 'cron', '{"expression": "0 9 * * *"}'::jsonb, 0, NOW(), NOW()),
          ('node-2', 'test-workflow', 'email', 'send', '{"to": "admin@example.com"}'::jsonb, 1, NOW(), NOW())
      `;

      const result = (await prisma.$queryRaw`
        SELECT
          u.email,
          w.name as workflow_name,
          w.active,
          wn.id as node_id,
          wn."serviceId",
          wn."actionId",
          wn.params,
          wn.position
        FROM "User" u
        JOIN "Workflow" w ON u.id = w."userId"
        JOIN "WorkflowNode" wn ON w.id = wn."workflowId"
        WHERE u.email = 'test@example.com'
        ORDER BY wn.position
      `) as any[];

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('test@example.com');
      expect(result[0].workflow_name).toBe('Test Workflow');
      expect(result[0].active).toBe(true);
      expect(result[0].serviceId).toBe('timer');
      expect(result[1].serviceId).toBe('email');
    });
  });

  describe('Cascade Delete Verification', () => {
    let userId: number;
    let workflowId: string;

    beforeEach(async () => {
      await prisma.$executeRaw`
        INSERT INTO "User" (email, name, "passwordHash", "createdAt", "updatedAt")
        VALUES ('cascade@example.com', 'Cascade User', 'hash123', NOW(), NOW())
      `;

      const user = (await prisma.$queryRaw`
        SELECT id FROM "User" WHERE email = 'cascade@example.com'
      `) as any[];
      userId = user[0].id;

      workflowId = 'cascade-workflow';
      await prisma.$executeRaw`
        INSERT INTO "Workflow" (id, name, "userId", "createdAt", "updatedAt")
        VALUES (${workflowId}, 'Cascade Test', ${userId}, NOW(), NOW())
      `;

      await prisma.$executeRaw`
        INSERT INTO "WorkflowNode" (id, "workflowId", "serviceId", "createdAt", "updatedAt")
        VALUES ('cascade-node', ${workflowId}, 'test-service', NOW(), NOW())
      `;
    });

    it('should cascade delete workflows when user is deleted', async () => {
      await prisma.$executeRaw`DELETE FROM "User" WHERE id = ${userId}`;

      const workflows = (await prisma.$queryRaw`
        SELECT id FROM "Workflow" WHERE id = ${workflowId}
      `) as any[];

      expect(workflows).toHaveLength(0);
    });

    it('should cascade delete nodes when workflow is deleted', async () => {
      await prisma.$executeRaw`DELETE FROM "Workflow" WHERE id = ${workflowId}`;

      const nodes = (await prisma.$queryRaw`
        SELECT id FROM "WorkflowNode" WHERE "workflowId" = ${workflowId}
      `) as any[];

      expect(nodes).toHaveLength(0);
    });

    it('should cascade delete all when user is deleted', async () => {
      await prisma.$executeRaw`DELETE FROM "User" WHERE id = ${userId}`;

      const workflows =
        (await prisma.$queryRaw`SELECT id FROM "Workflow" WHERE "userId" = ${userId}`) as any[];
      const nodes =
        (await prisma.$queryRaw`SELECT id FROM "WorkflowNode" WHERE "workflowId" = ${workflowId}`) as any[];

      expect(workflows).toHaveLength(0);
      expect(nodes).toHaveLength(0);
    });
  });
});
