ALTER TABLE "MessageLog" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'OUTBOUND';
ALTER TABLE "MessageLog" ADD COLUMN "readAt" TIMESTAMP(3);

CREATE INDEX "MessageLog_leadId_channel_createdAt_idx" ON "MessageLog"("leadId", "channel", "createdAt");
CREATE INDEX "MessageLog_leadId_direction_readAt_idx" ON "MessageLog"("leadId", "direction", "readAt");
