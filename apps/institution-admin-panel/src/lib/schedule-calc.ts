// Derive "No. of Days" and "No. of Classes" for an enrollment window.
// Used by the request-approval form and student editing: given a validity
// start/end and the batch's (active) day pattern, the number of days is the
// inclusive calendar span and the number of classes is how many dates inside
// the span fall on the pattern's weekdays.

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface ScheduleCalc {
  days: number;
  classes: number;
}

export function calcDaysAndClasses(
  start: string | Date | null,
  end: string | Date | null,
  patternDays: string[] | null | undefined
): ScheduleCalc {
  if (!start || !end) return { days: 0, classes: 0 };
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    return { days: 0, classes: 0 };
  }

  const MS_DAY = 24 * 60 * 60 * 1000;
  const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const days = Math.round((endDay.getTime() - startDay.getTime()) / MS_DAY) + 1;

  const wanted = new Set(patternDays ?? []);
  if (!wanted.size) return { days, classes: 0 };

  let classes = 0;
  // Count per weekday: full weeks + remainder walk (bounded, no 365-iteration loop).
  const fullWeeks = Math.floor(days / 7);
  classes += fullWeeks * wanted.size;
  const remainder = days % 7;
  for (let i = 0; i < remainder; i++) {
    const d = new Date(startDay.getTime() + (fullWeeks * 7 + i) * MS_DAY);
    if (wanted.has(WEEKDAY_KEYS[d.getDay()])) classes++;
  }
  return { days, classes };
}
