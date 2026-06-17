ALTER TABLE "IntegrationSettings" ADD COLUMN "whatsappProvider" TEXT NOT NULL DEFAULT 'EVOLUTION';
ALTER TABLE "IntegrationSettings" ADD COLUMN "captureEvolution" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "IntegrationSettings" ADD COLUMN "captureWuz" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IntegrationSettings" ADD COLUMN "wuzApiUrl" TEXT;
ALTER TABLE "IntegrationSettings" ADD COLUMN "wuzApiToken" TEXT;
ALTER TABLE "IntegrationSettings" ADD COLUMN "wuzInstanceName" TEXT;
