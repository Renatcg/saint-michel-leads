import { getPrisma } from "@/lib/prisma";

const TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_STALE_MINUTES = 30;

type ScheduleWithAssignments = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  active: boolean;
  startUserId: string | null;
  rotationIndex: number;
  assignments: Array<{
    userId: string;
    order: number;
    active: boolean;
    user: {
      id: string;
      active: boolean;
      role: string;
    };
  }>;
};

export async function assignLeadByRotation(leadId: string, now = new Date()) {
  const prisma = getPrisma();
  const schedule = await getActiveSchedule(now);

  if (!schedule || !isWithinSchedule(now, schedule.startTime, schedule.endTime)) {
    return null;
  }

  const brokerIds = getOrderedActiveBrokerIds(schedule);

  if (brokerIds.length === 0) {
    return null;
  }

  const nextIndex = schedule.rotationIndex % brokerIds.length;
  const nextUserId = brokerIds[nextIndex];
  const nextRotationIndex = (nextIndex + 1) % brokerIds.length;

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        assignedToUserId: nextUserId,
        assignedAt: now,
        assignmentStatus: "ASSIGNED",
      },
    });

    await tx.attendanceSchedule.update({
      where: { id: schedule.id },
      data: { rotationIndex: nextRotationIndex },
    });

    await tx.leadAssignmentLog.create({
      data: {
        leadId,
        toUserId: nextUserId,
        reason: "rotation",
      },
    });
  });

  return nextUserId;
}

export async function reassignStaleLeads(now = new Date()) {
  const prisma = getPrisma();
  const schedule = await getActiveSchedule(now);

  if (!schedule || !isWithinSchedule(now, schedule.startTime, schedule.endTime)) {
    return { checked: 0, reassigned: 0, reason: "outside_schedule" };
  }

  const brokerIds = getOrderedActiveBrokerIds(schedule);

  if (brokerIds.length < 2) {
    return { checked: 0, reassigned: 0, reason: "not_enough_brokers" };
  }

  const staleBefore = new Date(now.getTime() - DEFAULT_STALE_MINUTES * 60 * 1000);
  const staleLeads = await prisma.lead.findMany({
    where: {
      assignedToUserId: { not: null },
      assignedAt: { lte: staleBefore },
      OR: [
        { lastHandledAt: null },
        { lastHandledAt: { lt: staleBefore } },
      ],
    },
    select: {
      id: true,
      assignedToUserId: true,
    },
    take: 100,
  });
  let reassigned = 0;

  for (const lead of staleLeads) {
    const currentIndex = brokerIds.indexOf(lead.assignedToUserId ?? "");

    if (currentIndex === -1) {
      continue;
    }

    const nextUserId = brokerIds[(currentIndex + 1) % brokerIds.length];

    if (!nextUserId || nextUserId === lead.assignedToUserId) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          assignedToUserId: nextUserId,
          assignedAt: now,
          assignmentStatus: "REASSIGNED",
        },
      });

      await tx.leadAssignmentLog.create({
        data: {
          leadId: lead.id,
          fromUserId: lead.assignedToUserId,
          toUserId: nextUserId,
          reason: "timeout",
        },
      });
    });
    reassigned += 1;
  }

  return {
    checked: staleLeads.length,
    reassigned,
  };
}

export async function getActiveSchedule(now = new Date()) {
  const prisma = getPrisma();
  const date = dateKeyToUtcDate(getDateKeyInTimeZone(now));

  return prisma.attendanceSchedule.findUnique({
    where: { date },
    include: {
      assignments: {
        orderBy: { order: "asc" },
        include: {
          user: {
            select: {
              id: true,
              active: true,
              role: true,
            },
          },
        },
      },
    },
  }) as Promise<ScheduleWithAssignments | null>;
}

export function getDateKeyInTimeZone(date: Date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function dateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function getOrderedActiveBrokerIds(schedule: ScheduleWithAssignments) {
  if (!schedule.active) {
    return [];
  }

  const brokerIds = schedule.assignments
    .filter((assignment) => assignment.active && assignment.user.active && (assignment.user.role === "BROKER" || assignment.user.role === "VIEWER"))
    .sort((left, right) => left.order - right.order)
    .map((assignment) => assignment.userId);

  if (!schedule.startUserId || !brokerIds.includes(schedule.startUserId)) {
    return brokerIds;
  }

  const startIndex = brokerIds.indexOf(schedule.startUserId);

  return [...brokerIds.slice(startIndex), ...brokerIds.slice(0, startIndex)];
}

function isWithinSchedule(date: Date, startTime: string, endTime: string) {
  const currentMinutes = getMinutesInTimeZone(date);
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getMinutesInTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return Number(values.hour) * 60 + Number(values.minute);
}

function parseTimeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");

  return Number(hours) * 60 + Number(minutes);
}
