/*
  Warnings:

  - A unique constraint covering the columns `[webhookToken]` on the table `Workflow` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."ServiceConnection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Workflow" ADD COLUMN     "webhookToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_webhookToken_key" ON "public"."Workflow"("webhookToken");
