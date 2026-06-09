import { redirect } from "next/navigation";
import { AdminScheduleMock } from "@/components/admin-schedule-mock";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const { response } = await requireAdminUser(["ADMIN", "MANAGER", "SUPERVISOR"]);

  if (response) {
    redirect("/admin");
  }
  const prisma = getPrisma();
  const [brokers, schedules, assignmentLogs] = await Promise.all([
    prisma.user.findMany({
      where: {
        active: true,
        role: { in: ["BROKER", "VIEWER"] },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.attendanceSchedule.findMany({
      include: {
        assignments: {
          orderBy: { order: "asc" },
          select: {
            userId: true,
            order: true,
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.leadAssignmentLog.findMany({
      where: {
        toUserId: { not: null },
      },
      include: {
        lead: {
          select: {
            createdAt: true,
            logs: {
              where: {
                channel: "WHATSAPP",
              },
              select: {
                direction: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  return (
    <AdminShell fullBleed>
      <AdminScheduleMock
        brokers={brokers}
        initialStats={buildScheduleStats(assignmentLogs)}
        initialScales={Object.fromEntries(
          schedules.map((schedule) => [
            schedule.date.toISOString().slice(0, 10),
            {
              brokerIds: schedule.assignments.map((assignment) => assignment.userId),
              startBrokerId: schedule.startUserId ?? schedule.assignments[0]?.userId ?? "",
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              active: schedule.active,
            },
          ]),
        )}
      />
    </AdminShell>
  );
}

function buildScheduleStats(
  assignmentLogs: Array<{
    leadId: string;
    toUserId: string | null;
    createdAt: Date;
    lead: {
      createdAt: Date;
      logs: Array<{
        direction: string;
        createdAt: Date;
      }>;
    };
  }>,
) {
  const stats: Record<string, Record<string, { forwarded: number; answered: number; sameDayReplies: number }>> = {};
  const seenAnswered = new Set<string>();
  const seenSameDayReply = new Set<string>();

  assignmentLogs.forEach((assignment) => {
    if (!assignment.toUserId) {
      return;
    }

    const dayKey = assignment.createdAt.toISOString().slice(0, 10);
    stats[dayKey] ??= {};
    stats[dayKey][assignment.toUserId] ??= { forwarded: 0, answered: 0, sameDayReplies: 0 };
    stats[dayKey][assignment.toUserId].forwarded += 1;

    const answeredKey = `${dayKey}:${assignment.toUserId}:${assignment.leadId}:answered`;
    const sameDayReplyKey = `${dayKey}:${assignment.toUserId}:${assignment.leadId}:same-day`;
    const hasOutboundSameDay = assignment.lead.logs.some((log) => log.direction === "OUTBOUND" && log.createdAt.toISOString().slice(0, 10) === dayKey);
    const enteredSameDay = assignment.lead.createdAt.toISOString().slice(0, 10) === dayKey;
    const hasInboundSameDay = assignment.lead.logs.some((log) => log.direction === "INBOUND" && log.createdAt.toISOString().slice(0, 10) === dayKey);

    if (hasOutboundSameDay && !seenAnswered.has(answeredKey)) {
      stats[dayKey][assignment.toUserId].answered += 1;
      seenAnswered.add(answeredKey);
    }

    if (enteredSameDay && hasInboundSameDay && !seenSameDayReply.has(sameDayReplyKey)) {
      stats[dayKey][assignment.toUserId].sameDayReplies += 1;
      seenSameDayReply.add(sameDayReplyKey);
    }
  });

  return stats;
}
