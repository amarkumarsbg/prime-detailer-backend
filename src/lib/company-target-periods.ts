/**
 * Deterministic UTC period boundary calculator for Company Target incentives.
 * Supports MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY.
 */

export type PeriodType = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

export interface PeriodBoundary {
  /** ISO date string: first millisecond of the period (UTC midnight). */
  start: Date;
  /** ISO date string: last millisecond of the period (UTC end-of-day). */
  end: Date;
  /** Human-readable label, e.g. "Jan 2026", "Q1 2026", "H1 2026", "2026". */
  label: string;
  /** 1-12 reference month (start month of the period). */
  periodMonth: number;
  /** 4-digit year. */
  periodYear: number;
}

/** Return UTC midnight (start of day) for a given year/month/day. */
function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** Return UTC end-of-day (23:59:59.999) for a given year/month/day. */
function utcEndOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

/** Last day of a given UTC year+month (1-indexed). */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Compute period boundaries for every period in a given year.
 *
 * @param year    Calendar year (e.g. 2026)
 * @param period  MONTHLY | QUARTERLY | HALF_YEARLY | YEARLY
 * @returns Ordered list of period boundaries covering the full year.
 */
export function getPeriodsForYear(year: number, period: PeriodType): PeriodBoundary[] {
  switch (period) {
    case "MONTHLY": {
      return Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const last = lastDayOfMonth(year, month);
        return {
          start: utcDay(year, month, 1),
          end: utcEndOfDay(year, month, last),
          label: `${MONTH_NAMES[i]} ${year}`,
          periodMonth: month,
          periodYear: year,
        };
      });
    }
    case "QUARTERLY": {
      const quarters: [number, number, string][] = [
        [1, 3, "Q1"],
        [4, 6, "Q2"],
        [7, 9, "Q3"],
        [10, 12, "Q4"],
      ];
      return quarters.map(([startMonth, endMonth, label]) => ({
        start: utcDay(year, startMonth, 1),
        end: utcEndOfDay(year, endMonth, lastDayOfMonth(year, endMonth)),
        label: `${label} ${year}`,
        periodMonth: startMonth,
        periodYear: year,
      }));
    }
    case "HALF_YEARLY": {
      return [
        {
          start: utcDay(year, 1, 1),
          end: utcEndOfDay(year, 6, lastDayOfMonth(year, 6)),
          label: `H1 ${year}`,
          periodMonth: 1,
          periodYear: year,
        },
        {
          start: utcDay(year, 7, 1),
          end: utcEndOfDay(year, 12, 31),
          label: `H2 ${year}`,
          periodMonth: 7,
          periodYear: year,
        },
      ];
    }
    case "YEARLY": {
      return [
        {
          start: utcDay(year, 1, 1),
          end: utcEndOfDay(year, 12, 31),
          label: `${year}`,
          periodMonth: 1,
          periodYear: year,
        },
      ];
    }
  }
}

/**
 * Given a reference month (1-12) and year, determine which period it belongs to.
 * Returns the corresponding period boundary.
 */
export function getPeriodForMonth(
  month: number,
  year: number,
  periodType: PeriodType
): PeriodBoundary {
  const all = getPeriodsForYear(year, periodType);
  // Find the period whose start month <= month <= end month
  for (const p of all) {
    const endMonth = new Date(Date.UTC(p.end.getUTCFullYear(), p.end.getUTCMonth(), p.end.getUTCDate())).getUTCMonth() + 1;
    if (p.periodMonth <= month && month <= endMonth) {
      return p;
    }
  }
  // Fallback: last period
  return all[all.length - 1]!;
}
