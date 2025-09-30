ALTER TABLE "public"."User" ALTER COLUMN "passwordHash" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE "public"."Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."WorkflowNode" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "actionId" TEXT,
    "reactionId" TEXT,
    "params" JSONB NOT NULL DEFAULT '{}',
    "next" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Workflow_userId_idx" ON "public"."Workflow"("userId");

CREATE INDEX "WorkflowNode_workflowId_idx" ON "public"."WorkflowNode"("workflowId");

CREATE INDEX "WorkflowNode_workflowId_position_idx" ON "public"."WorkflowNode"("workflowId", "position");

ALTER TABLE "public"."Workflow" ADD CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
