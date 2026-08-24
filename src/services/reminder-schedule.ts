/**
 * Reminder schedule helpers (mirrors frontend reminder-schedule.ts for job processing).
 */
export type ReminderFrequency =
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "BIANNUAL"
  | "YEARLY"
  | "CUSTOM";

export type ReminderStatus = "UPCOMING" | "DUE" | "OVERDUE" | "COMPLETED" | "DISMISSED";
export type ReminderKind = "SERVICE" | "PAYMENT";
export type SchedulableReminderFrequency = Exclude<ReminderFrequency, "CUSTOM">;

function parseLocalDay(isoOrDay: string | Date): Date {
  if (isoOrDay instanceof Date) {
    return new Date(isoOrDay.getFullYear(), isoOrDay.getMonth(), isoOrDay.getDate());
  }
  const day = isoOrDay.slice(0, 10);
  const [y, m, d] = day.split("-").map((x) => Number(x));
  if (!y || !m || !d) {
    const fallback = new Date(isoOrDay);
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }
  return new Date(y, m - 1, d);
}

function formatLocalDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addCalendarMonths(d: Date, months: number): Date {
  const day = d.getDate();
  const result = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function nextDueDate(from: Date | string, frequency: ReminderFrequency): string {
  if (frequency === "CUSTOM") {
    throw new Error("nextDueDate does not support CUSTOM");
  }
  const base = parseLocalDay(from);
  let next: Date;
  switch (frequency) {
    case "WEEKLY":
      next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
      break;
    case "MONTHLY":
      next = addCalendarMonths(base, 1);
      break;
    case "QUARTERLY":
      next = addCalendarMonths(base, 3);
      break;
    case "BIANNUAL":
      next = addCalendarMonths(base, 6);
      break;
    case "YEARLY":
      next = addCalendarMonths(base, 12);
      break;
    default:
      next = addCalendarMonths(base, 1);
  }
  return formatLocalDay(next);
}

export function periodKey(from: Date | string, frequency: ReminderFrequency): string {
  if (frequency === "CUSTOM") {
    return `CUSTOM-${formatLocalDay(parseLocalDay(from))}`;
  }
  const d = parseLocalDay(from);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  switch (frequency) {
    case "WEEKLY": {
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }
    case "MONTHLY":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "QUARTERLY": {
      const q = Math.floor((m - 1) / 3) + 1;
      return `${y}-Q${q}`;
    }
    case "BIANNUAL": {
      const h = m <= 6 ? 1 : 2;
      return `${y}-H${h}`;
    }
    case "YEARLY":
      return `${y}`;
    default:
      return `${y}-${String(m).padStart(2, "0")}`;
  }
}

export function computeReminderStatus(
  dueDate: string,
  leadDays: number,
  now: Date = new Date()
): Exclude<ReminderStatus, "COMPLETED" | "DISMISSED"> {
  const due = parseLocalDay(dueDate);
  const today = parseLocalDay(now);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  const lead = Math.max(0, Math.floor(leadDays));
  if (diffDays < -lead) return "OVERDUE";
  if (diffDays <= lead) return "DUE";
  return "UPCOMING";
}

export function normalizeReminderKind(kind: string | undefined | null): ReminderKind {
  return kind === "PAYMENT" ? "PAYMENT" : "SERVICE";
}
