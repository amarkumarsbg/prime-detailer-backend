/** Period presets for party ledger (ported from frontend report-period-presets). */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function parseCustomPeriod(period: string): { start: string; end: string } | null {
  if (!period.startsWith("custom:")) return null;
  const parts = period.split(":");
  if (parts.length !== 3) return null;
  const [, start, end] = parts;
  if (!start || !end || start > end) return null;
  return { start, end };
}

export function dateInPreset(iso: string, preset: string): boolean {
  const custom = parseCustomPeriod(preset);
  if (custom) {
    const day = iso.slice(0, 10);
    return day >= custom.start && day <= custom.end;
  }
  if (preset === "custom") return true;

  const t = new Date(iso).getTime();
  const now = new Date();
  const today = startOfDay(now);

  if (preset === "today") {
    return t >= today.getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return t >= startOfDay(y).getTime() && t <= endOfDay(y).getTime();
  }
  if (preset === "week") {
    const wd = today.getDay();
    const mon = new Date(today);
    mon.setDate(mon.getDate() - (wd === 0 ? 6 : wd - 1));
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return t >= startOfDay(mon).getTime() && t <= endOfDay(sun).getTime();
  }
  if (preset === "lastWeek") {
    const wd = today.getDay();
    const thisMon = new Date(today);
    thisMon.setDate(thisMon.getDate() - (wd === 0 ? 6 : wd - 1));
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastSun.getDate() + 6);
    return t >= startOfDay(lastMon).getTime() && t <= endOfDay(lastSun).getTime();
  }
  if (preset === "last7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevMonth") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "last30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const first = new Date(now.getFullYear(), q * 3, 1);
    const last = new Date(now.getFullYear(), q * 3 + 3, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevQuarter") {
    const q = Math.floor(now.getMonth() / 3) - 1;
    const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const qq = ((q % 4) + 4) % 4;
    const first = new Date(y, qq * 3, 1);
    const last = new Date(y, qq * 3 + 3, 0);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "fy") {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const first = new Date(y, 3, 1);
    const last = new Date(y + 1, 2, 31);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "prevFy") {
    const y = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
    const first = new Date(y, 3, 1);
    const last = new Date(y + 1, 2, 31);
    return t >= startOfDay(first).getTime() && t <= endOfDay(last).getTime();
  }
  if (preset === "last365") {
    const from = new Date(today);
    from.setDate(from.getDate() - 364);
    return t >= startOfDay(from).getTime() && t <= endOfDay(now).getTime();
  }
  return true;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Inclusive local date bounds for a period preset (or `custom:YYYY-MM-DD:YYYY-MM-DD`). */
export function getPeriodBounds(
  period: string,
  now = new Date()
): { start: Date; end: Date } {
  const custom = parseCustomPeriod(period);
  if (custom) {
    return {
      start: startOfDay(new Date(`${custom.start}T12:00:00`)),
      end: endOfDay(new Date(`${custom.end}T12:00:00`)),
    };
  }

  const today = startOfDay(now);
  const endNow = endOfDay(now);

  if (period === "today") return { start: today, end: endNow };
  if (period === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  }
  if (period === "last365") {
    const from = new Date(today);
    from.setDate(from.getDate() - 364);
    return { start: startOfDay(from), end: endNow };
  }
  if (period === "last30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { start: startOfDay(from), end: endNow };
  }
  if (period === "last7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { start: startOfDay(from), end: endNow };
  }
  if (period === "month") {
    return {
      start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (period === "fy") {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return {
      start: startOfDay(new Date(y, 3, 1)),
      end: endOfDay(new Date(y + 1, 2, 31)),
    };
  }
  // Default: last 365 days
  const from = new Date(today);
  from.setDate(from.getDate() - 364);
  return { start: startOfDay(from), end: endNow };
}

/** MyBillBook-style range: `05/04/2026 - 15/08/2026` */
export function formatPeriodRangeLabel(period: string, now = new Date()): string {
  const { start, end } = getPeriodBounds(period, now);
  const fmt = (d: Date) =>
    `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}
