CREATE TABLE "public"."ServiceConnection" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "serviceId" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "apiKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceConnection_userId_serviceId_key" ON "public"."ServiceConnection"("userId", "serviceId");
CREATE INDEX "ServiceConnection_userId_idx" ON "public"."ServiceConnection"("userId");
CREATE INDEX "ServiceConnection_serviceId_idx" ON "public"."ServiceConnection"("serviceId");

ALTER TABLE "public"."ServiceConnection"
ADD CONSTRAINT "ServiceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
