/*
  Warnings:

  - The `position` column on the `WorkflowNode` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropIndex
DROP INDEX "public"."WorkflowNode_workflowId_position_idx";

-- AlterTable
ALTER TABLE "WorkflowNode" ADD COLUMN     "label" TEXT,
DROP COLUMN "position",
ADD COLUMN     "position" JSONB;
