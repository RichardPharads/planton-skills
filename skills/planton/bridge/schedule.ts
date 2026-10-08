/**
 * When a card in a scheduled workflow is meant to happen, and pure helpers for working out where it stands
 * at a given moment. Times are in the device's local time zone.
 */

/** A card that repeats at a time of day on some days of the week, or happens once at a set moment. */
export type Schedule =
  | {
      kind: "repeat";
      /** Time of day, "HH:MM" in 24-hour time. */
      time: string;
      /** Days of the week it happens, 0 = Sunday … 6 = Saturday. */
      days: number[];
      /** First day it can happen, "YYYY-MM-DD". Until then the card is upcoming. */
      startDate?: string | null;
      /** Last day it can happen, "YYYY-MM-DD". After it, the schedule has ended. */
      endDate?: string | null;
    }
  | { kind: "once"; at: number };

/**
 * Upcoming: its time hasn't come yet. Due: within the window after its time. Missed: the window passed without
 * it being done. Done / skipped: finished for this occurrence.
 */
export type ScheduleState = "upcoming" | "due" | "missed" | "done" | "skipped";

/** How long after its time a scheduled card counts as "due now" before it's missed. */
export const DUE_WINDOW_MS = 2 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const WEEKDAY_NAMES = DAY_NAMES;

/** A local calendar day as "YYYY-MM-DD". */
export function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight at the start of a "YYYY-MM-DD" day. */
export function startOfDateKey(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

type RepeatSchedule = Extract<Schedule, { kind: "repeat" }>;

/** Whether a repeating schedule happens on the local day containing `dayTimestamp`. */
function runsOn(schedule: RepeatSchedule, dayTimestamp: number): boolean {
  const key = dateKey(dayTimestamp);
  if (schedule.startDate && key < schedule.startDate) return false;
  if (schedule.endDate && key > schedule.endDate) return false;
  return schedule.days.includes(new Date(dayTimestamp).getDay());
}

function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/** The moment `time` happens on the local day containing `dayTimestamp`. */
function atTimeOnDay(dayTimestamp: number, time: string): number {
  const { hours, minutes } = parseTime(time);
  const date = new Date(dayTimestamp);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

export type Occurrence = {
  /** Identifies the occurrence: its date for repeating schedules, "once" for one-off ones. */
  key: string;
  start: number;
  end: number;
};

/**
 * The occurrence that "now" belongs to: today's, if the schedule runs today (even before its time), otherwise the
 * most recent day it ran. A card resets at the start of each new occurrence and is done or missed within it.
 */
export function getCurrentOccurrence(schedule: Schedule, now: number): Occurrence | null {
  if (schedule.kind === "once") {
    return { key: "once", start: schedule.at, end: schedule.at + DUE_WINDOW_MS };
  }
  if (schedule.days.length === 0) return null;
  for (let back = 0; back < 7; back += 1) {
    const day = now - back * DAY_MS;
    if (runsOn(schedule, day)) {
      const start = atTimeOnDay(day, schedule.time);
      return { key: dateKey(day), start, end: start + DUE_WINDOW_MS };
    }
  }
  return null;
}

/** The next time the schedule starts after `now`, or null if it never will (a one-off that has passed). */
export function getNextStart(schedule: Schedule, now: number): number | null {
  if (schedule.kind === "once") return schedule.at > now ? schedule.at : null;
  // A schedule that starts on a later date is looked for from that date on.
  const from = schedule.startDate ? Math.max(now, startOfDateKey(schedule.startDate)) : now;
  for (let ahead = 0; ahead <= 7; ahead += 1) {
    const day = from + ahead * DAY_MS;
    if (!runsOn(schedule, day)) continue;
    const start = atTimeOnDay(day, schedule.time);
    if (start > now) return start;
  }
  return null;
}

/**
 * Where a scheduled card stands right now, given whether it's done (or skipped) for its current occurrence.
 * An occurrence that was already over when the card got its schedule (`since`) isn't counted as missed.
 */
export function getScheduleState(
  schedule: Schedule,
  finished: "done" | "skipped" | null,
  now: number,
  since: number | null = null,
): ScheduleState {
  if (finished) return finished;
  const occurrence = getCurrentOccurrence(schedule, now);
  if (!occurrence || now < occurrence.start) return "upcoming";
  if (now < occurrence.end) return "due";
  return since !== null && occurrence.end <= since ? "upcoming" : "missed";
}

/** Whether a schedule will never happen again: a repeating one past its end date, or a one-off whose window has passed. */
export function hasScheduleEnded(schedule: Schedule, now: number): boolean {
  if (schedule.kind === "once") return now >= schedule.at + DUE_WINDOW_MS;
  return !!schedule.endDate && dateKey(now) > schedule.endDate;
}

export const SCHEDULE_STATE_LABELS: Record<ScheduleState, string> = {
  upcoming: "Upcoming",
  due: "Due now",
  missed: "Missed",
  done: "Done",
  skipped: "Skipped",
};

/** "7:30 AM". */
export function formatTimeOfDay(time: string): string {
  const { hours, minutes } = parseTime(time);
  const suffix = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "7:30 AM" from a timestamp. */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return formatTimeOfDay(`${date.getHours()}:${date.getMinutes()}`);
}

/** "Mon–Fri", "Every day", "Weekends", "Mon, Wed, Fri". */
export function formatDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.length === 0) return "No days";
  if (sorted.join() === "1,2,3,4,5") return "Mon–Fri";
  if (sorted.join() === "0,6") return "Weekends";
  return sorted.map((day) => DAY_NAMES[day]).join(", ");
}

/** "Wed, Sep 17". */
export function formatDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${DAY_NAMES[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "Sep 17". */
function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** " · Sep 16–Oct 15", " · from Sep 16", " · until Oct 15", or "" for a schedule without dates. */
function formatDateRange(schedule: RepeatSchedule): string {
  const start = schedule.startDate ? formatShortDate(startOfDateKey(schedule.startDate)) : null;
  const end = schedule.endDate ? formatShortDate(startOfDateKey(schedule.endDate)) : null;
  if (start && end) return ` · ${start}–${end}`;
  if (start) return ` · from ${start}`;
  return end ? ` · until ${end}` : "";
}

/** "7:30 AM · Mon–Fri", "7:30 AM · Every day · Sep 16–Oct 15", or "Once · Wed, Sep 17 · 7:30 AM". */
export function describeSchedule(schedule: Schedule): string {
  return schedule.kind === "repeat"
    ? `${formatTimeOfDay(schedule.time)} · ${formatDays(schedule.days)}${formatDateRange(schedule)}`
    : `Once · ${formatDay(schedule.at)} · ${formatClock(schedule.at)}`;
}

/** A short "when" for the next start: "7:30 AM" today, "Tomorrow 7:30 AM", "Mon 7:30 AM", or "Oct 15 7:30 AM". */
export function formatWhen(timestamp: number, now: number): string {
  if (dateKey(timestamp) === dateKey(now)) return formatClock(timestamp);
  if (dateKey(timestamp) === dateKey(now + DAY_MS)) return `Tomorrow ${formatClock(timestamp)}`;
  // Beyond the coming week a weekday name is ambiguous, so show the date.
  if (timestamp - now > 6 * DAY_MS) return `${formatShortDate(timestamp)} ${formatClock(timestamp)}`;
  return `${DAY_NAMES[new Date(timestamp).getDay()]} ${formatClock(timestamp)}`;
}

/** Local midnight at the start of the day after the one containing `timestamp`, safe across daylight-saving changes. */
function nextDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

/** Every occurrence that starts after `from` and no later than `to`, soonest first. */
export function getOccurrencesBetween(schedule: Schedule, from: number, to: number): Occurrence[] {
  if (schedule.kind === "once") {
    return schedule.at > from && schedule.at <= to ? [{ key: "once", start: schedule.at, end: schedule.at + DUE_WINDOW_MS }] : [];
  }
  const occurrences: Occurrence[] = [];
  if (schedule.days.length === 0) return occurrences;
  for (let day = startOfDateKey(dateKey(from)); day <= to; day = nextDayStart(day)) {
    if (!runsOn(schedule, day)) continue;
    const start = atTimeOnDay(day, schedule.time);
    if (start > from && start <= to) occurrences.push({ key: dateKey(day), start, end: start + DUE_WINDOW_MS });
  }
  return occurrences;
}
