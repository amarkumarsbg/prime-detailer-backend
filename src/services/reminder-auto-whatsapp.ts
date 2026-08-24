import {
  computeReminderStatus,
  nextDueDate,
  normalizeReminderKind,
  periodKey,
  type ReminderFrequency,
  type ReminderKind,
  type ReminderStatus,
  type SchedulableReminderFrequency,
} from "./reminder-schedule.js";

/** Minimal reminder shape persisted in AppJsonRow `serviceReminders`. */
export type ReminderRecord = {
  id: string;
  kind?: ReminderKind | string;
  vehicleId?: string;
  vehicleRegNumber?: string;
  vehicleMakeModel?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  type?: string;
  frequency: ReminderFrequency | string;
  dueDate: string;
  nextDueDate?: string;
  periodKey?: string;
  status: ReminderStatus | string;
  isHighEndService?: boolean;
  notes?: string;
  whatsappSent?: boolean;
  lastMessageSentAt?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  outstandingAmount?: number;
  partyId?: string;
  [key: string]: unknown;
};

export function alreadySentForCurrentPeriod(r: ReminderRecord): boolean {
  return Boolean(r.lastMessageSentAt || r.whatsappSent);
}

export function paymentOutstandingForReminder(
  r: ReminderRecord,
  getOutstanding?: (invoiceId: string) => number | undefined
): number {
  if (r.invoiceId && getOutstanding) {
    const live = getOutstanding(r.invoiceId);
    if (typeof live === "number" && Number.isFinite(live)) return live;
  }
  return typeof r.outstandingAmount === "number" ? r.outstandingAmount : 0;
}

export function withFreshOpenStatus(
  r: ReminderRecord,
  leadDays: number,
  now: Date = new Date()
): ReminderRecord {
  if (r.status === "COMPLETED" || r.status === "DISMISSED") return r;
  const status = computeReminderStatus(r.dueDate, leadDays, now);
  return { ...r, status };
}

export function selectRemindersForAutoWhatsApp(
  reminders: ReminderRecord[],
  opts: {
    whatsappReminderEnabled: boolean;
    getOutstanding?: (invoiceId: string) => number | undefined;
    leadDays?: number;
    now?: Date;
  }
): ReminderRecord[] {
  if (!opts.whatsappReminderEnabled) return [];
  const leadDays = opts.leadDays ?? 7;
  const now = opts.now ?? new Date();

  return reminders
    .map((r) => withFreshOpenStatus(r, leadDays, now))
    .filter((r) => {
      if (r.status !== "DUE" && r.status !== "OVERDUE") return false;
      if (!String(r.customerPhone ?? "").trim()) return false;
      if (alreadySentForCurrentPeriod(r)) return false;
      const kind = normalizeReminderKind(r.kind);
      if (kind === "PAYMENT") {
        return paymentOutstandingForReminder(r, opts.getOutstanding) > 0.01;
      }
      return true;
    });
}

export function advancePaymentReminderAfterSend(
  reminder: ReminderRecord,
  opts: { leadDays: number; outstanding: number; now?: Date }
): ReminderRecord | null {
  if (normalizeReminderKind(reminder.kind) !== "PAYMENT") return null;
  if (opts.outstanding <= 0.01) return null;

  const frequency: SchedulableReminderFrequency =
    reminder.frequency === "CUSTOM"
      ? "MONTHLY"
      : (reminder.frequency as SchedulableReminderFrequency);

  const newDue = nextDueDate(reminder.dueDate, frequency);
  const pKey = periodKey(newDue, frequency);
  const following = nextDueDate(newDue, frequency);
  const status = computeReminderStatus(newDue, opts.leadDays, opts.now);

  return {
    ...reminder,
    dueDate: newDue,
    nextDueDate: following,
    periodKey: pKey,
    status,
    outstandingAmount: opts.outstanding,
    lastMessageSentAt: undefined,
    whatsappSent: false,
  };
}

export function markReminderSentForPeriod(
  reminder: ReminderRecord,
  sentAtIso: string
): ReminderRecord {
  const freq = reminder.frequency as ReminderFrequency;
  const pKey =
    reminder.periodKey ??
    (freq === "CUSTOM" ? periodKey(reminder.dueDate, "CUSTOM") : periodKey(reminder.dueDate, freq));
  return {
    ...reminder,
    periodKey: pKey,
    whatsappSent: true,
    lastMessageSentAt: sentAtIso,
  };
}
