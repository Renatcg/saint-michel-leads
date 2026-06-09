ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'BROKER';
UPDATE "User" SET "role" = 'BROKER' WHERE "role" = 'VIEWER';

ALTER TABLE "Lead" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "lastInboundAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "lastOutboundAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "lastHandledAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "assignmentStatus" TEXT NOT NULL DEFAULT 'UNASSIGNED';

CREATE TABLE "AttendanceSchedule" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startUserId" TEXT,
    "rotationIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceScheduleAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceScheduleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadAssignmentLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignmentLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceSchedule_date_key" ON "AttendanceSchedule"("date");
CREATE INDEX "AttendanceSchedule_active_idx" ON "AttendanceSchedule"("active");
CREATE UNIQUE INDEX "AttendanceScheduleAssignment_scheduleId_userId_key" ON "AttendanceScheduleAssignment"("scheduleId", "userId");
CREATE INDEX "AttendanceScheduleAssignment_userId_idx" ON "AttendanceScheduleAssignment"("userId");
CREATE INDEX "LeadAssignmentLog_leadId_createdAt_idx" ON "LeadAssignmentLog"("leadId", "createdAt");
CREATE INDEX "LeadAssignmentLog_toUserId_idx" ON "LeadAssignmentLog"("toUserId");
CREATE INDEX "Lead_assignedToUserId_idx" ON "Lead"("assignedToUserId");
CREATE INDEX "Lead_assignmentStatus_idx" ON "Lead"("assignmentStatus");
CREATE INDEX "Lead_lastInboundAt_idx" ON "Lead"("lastInboundAt");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleAssignment" ADD CONSTRAINT "AttendanceScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AttendanceSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceScheduleAssignment" ADD CONSTRAINT "AttendanceScheduleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignmentLog" ADD CONSTRAINT "LeadAssignmentLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignmentLog" ADD CONSTRAINT "LeadAssignmentLog_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadAssignmentLog" ADD CONSTRAINT "LeadAssignmentLog_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadAssignmentLog" ADD CONSTRAINT "LeadAssignmentLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
