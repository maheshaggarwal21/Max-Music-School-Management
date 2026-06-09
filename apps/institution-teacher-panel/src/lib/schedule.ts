// Pure helpers for turning BatchRow dayPattern/timeSlot labels into
// "today's classes", "next class", and weekly counts. No mock data here —
// these work identically against real API rows.

import type { BatchRow } from "./types";

const DAY_TOKENS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Parse a dayPattern label ("Mon · Wed · Fri", "Tue-Thu", …) into JS weekday numbers (0=Sun). */
export function parseDays(label: string | null | undefined): number[] {
  if (!label) return [];
  const found = label.toLowerCase().match(/sun|mon|tue|wed|thu|fri|sat/g) ?? [];
  const set = new Set<number>();
  for (const t of found) set.add(DAY_TOKENS.indexOf(t as (typeof DAY_TOKENS)[number]));
  return [...set].sort((a, b) => a - b);
}

/** Parse the START time of a timeSlot label ("5:00 PM – 6:00 PM") into minutes since midnight. */
export function parseStartMinutes(label: string | null | undefined): number {
  if (!label) return 24 * 60; // unknown → sort last
  const m = label.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return 24 * 60;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3]?.toLowerCase();
  if (mer === "pm" && h !== 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return h * 60 + min;
}

/** Does this batch meet on the given date? */
export function batchMeetsOn(batch: BatchRow, date: Date): boolean {
  return parseDays(batch.dayPattern?.label).includes(date.getDay());
}

/** Batches meeting on a date, ordered by start time. */
export function classesOn(batches: BatchRow[], date: Date): BatchRow[] {
  return batches
    .filter((b) => b.status === "active" || b.status === "setting")
    .filter((b) => batchMeetsOn(b, date))
    .sort(
      (a, b) =>
        parseStartMinutes(a.timeSlot?.label) - parseStartMinutes(b.timeSlot?.label)
    );
}

/** Total class occurrences per week across my active batches. */
export function classesPerWeek(batches: BatchRow[]): number {
  return batches
    .filter((b) => b.status === "active" || b.status === "setting")
    .reduce((sum, b) => sum + parseDays(b.dayPattern?.label).length, 0);
}

export interface NextClass {
  batch: BatchRow;
  date: Date;
  isToday: boolean;
  startMinutes: number;
}

/** The next upcoming class within the next 7 days (today's later classes first). */
export function nextClass(batches: BatchRow[], now: Date): NextClass | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const todays = classesOn(batches, d);
    for (const b of todays) {
      const start = parseStartMinutes(b.timeSlot?.label);
      if (offset === 0 && start < nowMin) continue; // already finished/started today
      return { batch: b, date: d, isToday: offset === 0, startMinutes: start };
    }
  }
  return null;
}

/** yyyy-mm-dd for a local Date. */
export function toIsoDate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const WEEKDAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function weekdayLabel(d: Date): string {
  return WEEKDAY_LABELS[d.getDay()];
}
