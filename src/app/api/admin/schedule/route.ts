import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { dateKeyToUtcDate } from "@/lib/lead-routing";
import { getPrisma } from "@/lib/prisma";

const saveScheduleSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  brokerIds: z.array(z.string().trim()).min(1),
  startBrokerId: z.string().trim(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean().default(true),
});

const updateScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["clear", "toggle-active"]),
});

export async function POST(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "SUPERVISOR"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = saveScheduleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const prisma = getPrisma();
  const brokers = await prisma.user.findMany({
    where: {
      id: { in: parsed.data.brokerIds },
      active: true,
      role: { in: ["BROKER", "VIEWER"] },
    },
    select: { id: true },
  });
  const brokerIds = brokers.map((broker) => broker.id);

  if (brokerIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um corretor ativo." }, { status: 400 });
  }

  const startUserId = brokerIds.includes(parsed.data.startBrokerId) ? parsed.data.startBrokerId : brokerIds[0];

  for (const dateKey of parsed.data.dates) {
    const date = dateKeyToUtcDate(dateKey);
    const schedule = await prisma.attendanceSchedule.upsert({
      where: { date },
      create: {
        date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        active: parsed.data.active,
        startUserId,
        rotationIndex: 0,
      },
      update: {
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        active: parsed.data.active,
        startUserId,
      },
    });

    await prisma.attendanceScheduleAssignment.deleteMany({
      where: { scheduleId: schedule.id },
    });
    await prisma.attendanceScheduleAssignment.createMany({
      data: brokerIds.map((brokerId, index) => ({
        scheduleId: schedule.id,
        userId: brokerId,
        order: index,
        active: true,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminUser(["ADMIN", "SUPERVISOR"]);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateScheduleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const prisma = getPrisma();
  const date = dateKeyToUtcDate(parsed.data.date);
  const schedule = await prisma.attendanceSchedule.findUnique({ where: { date } });

  if (parsed.data.action === "clear") {
    if (schedule) {
      await prisma.attendanceSchedule.delete({ where: { id: schedule.id } });
    }

    return NextResponse.json({ ok: true });
  }

  if (schedule) {
    await prisma.attendanceSchedule.update({
      where: { id: schedule.id },
      data: { active: !schedule.active },
    });
  } else {
    await prisma.attendanceSchedule.create({
      data: {
        date,
        startTime: "09:00",
        endTime: "18:00",
        active: false,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
