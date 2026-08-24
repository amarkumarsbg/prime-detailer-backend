import type { AttendanceStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const LATE_CUTOFF = "09:30";
const HALF_DAY_MAX_MINUTES = 240;

export type AttendanceRecordDTO = {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  branchId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  durationMinutes?: number;
  status: AttendanceStatus;
  qrScanned: boolean;
};

type AttendanceRow = {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: UserRole;
  branchId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  durationMinutes: number | null;
  status: AttendanceStatus;
  qrScanned: boolean;
};

function toDTO(a: AttendanceRow): AttendanceRecordDTO {
  return {
    id: a.id,
    staffId: a.staffId,
    staffName: a.staffName,
    staffRole: a.staffRole,
    branchId: a.branchId,
    date: a.date,
    checkIn: a.checkIn ?? undefined,
    checkOut: a.checkOut ?? undefined,
    durationMinutes: a.durationMinutes ?? undefined,
    status: a.status,
    qrScanned: a.qrScanned,
  };
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function statusForCheckIn(checkIn: string): AttendanceStatus {
  return checkIn > LATE_CUTOFF ? "LATE" : "PRESENT";
}

function statusForCheckOut(checkIn: string, durationMinutes: number): AttendanceStatus {
  if (durationMinutes < HALF_DAY_MAX_MINUTES) return "HALF_DAY";
  if (checkIn > LATE_CUTOFF) return "LATE";
  return "PRESENT";
}

export async function listAttendance(branchId?: string): Promise<AttendanceRecordDTO[]> {
  const rows = await prisma.attendance.findMany({
    where: branchId ? { branchId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function resetAttendance(): Promise<void> {
  await prisma.attendance.deleteMany({});
}

export type PunchResult =
  | { ok: true; kind: "checkIn" | "checkOut"; time: string; record: AttendanceRecordDTO }
  | { ok: false; error: "INACTIVE" | "WRONG_BRANCH" | "STAFF_NOT_FOUND" };

/**
 * Records a check-in or check-out for the staff member. Identity is re-derived
 * from the database by `staffId` (the public client is never trusted for name/role).
 * `date`/`time` are the staff member's local calendar values (yyyy-MM-dd / HH:mm).
 */
export async function punchAttendance(args: {
  staffId: string;
  branchId: string;
  date: string;
  time: string;
}): Promise<PunchResult> {
  const { staffId, branchId, date, time } = args;

  const staff = await prisma.user.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, role: true, branchId: true, isActive: true },
  });
  if (!staff) return { ok: false, error: "STAFF_NOT_FOUND" };
  if (!staff.isActive) return { ok: false, error: "INACTIVE" };
  if (staff.branchId !== branchId) return { ok: false, error: "WRONG_BRANCH" };

  const forDay = await prisma.attendance.findMany({
    where: { staffId, branchId, date },
    orderBy: { createdAt: "desc" },
  });

  const open = forDay.find((r) => r.checkIn != null && r.checkOut == null);
  if (open) {
    const durationMinutes = minutesBetween(open.checkIn!, time);
    const status = statusForCheckOut(open.checkIn!, durationMinutes);
    const updated = await prisma.attendance.update({
      where: { id: open.id },
      data: { checkOut: time, durationMinutes, status, qrScanned: true },
    });
    return { ok: true, kind: "checkOut", time, record: toDTO(updated) };
  }

  const placeholder = forDay.find((r) => r.checkIn == null && r.checkOut == null);
  const checkInStatus = statusForCheckIn(time);
  if (placeholder) {
    const updated = await prisma.attendance.update({
      where: { id: placeholder.id },
      data: {
        checkIn: time,
        checkOut: null,
        durationMinutes: null,
        status: checkInStatus,
        qrScanned: true,
      },
    });
    return { ok: true, kind: "checkIn", time, record: toDTO(updated) };
  }

  const created = await prisma.attendance.create({
    data: {
      staffId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      branchId,
      date,
      checkIn: time,
      status: checkInStatus,
      qrScanned: true,
    },
  });
  return { ok: true, kind: "checkIn", time, record: toDTO(created) };
}
