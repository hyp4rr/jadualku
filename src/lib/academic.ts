import type { CalendarPeriod, DateRange, PeriodKind, Semester } from "../data/academicCalendar.ts";
import { KKT_STATES, SEMESTERS } from "../data/academicCalendar.ts";
import type { Day, Entry, Session } from "./types.ts";
import { DAYS } from "./types.ts";

export const MY_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Malacca",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Labuan",
  "Putrajaya",
] as const;

export type MyState = (typeof MY_STATES)[number];

export interface Holiday {
  /** ISO date. */
  date: string;
  name: string;
  states: "all" | MyState[];
  tentative?: boolean;
}

export interface TeachingWeek {
  n: number;
  start: string; // week boundary (Mon, or Sun for KKT states)
  end: string;
  kind: "lecture" | "online";
}

export interface ClassOccurrence {
  date: string;
  entry: Entry;
  session: Session;
  skipped?: boolean;
  holidayName?: string;
}

// ---------- date-only helpers (UTC-safe, no local-timezone shifting) ----------

/** Parse "YYYY-MM-DD" to a UTC Date. */
function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isoAddDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function isoDiffDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86400000);
}

/** Day-of-week index: 0 = Monday … 6 = Sunday. */
export function isoWeekday(iso: string): number {
  return (toDate(iso).getUTCDay() + 6) % 7;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inRange(iso: string, r: DateRange): boolean {
  return iso >= r.start && iso <= r.end;
}

export const isKkt = (state: MyState): boolean => (KKT_STATES as readonly string[]).includes(state);

/** KKT states use the alternate published ranges when present. */
export function effectiveRange(period: CalendarPeriod, state: MyState): DateRange {
  if (period.kkt && isKkt(state)) return period.kkt;
  return { start: period.start, end: period.end };
}

// ---------- periods ----------

const PERIOD_PRIORITY: PeriodKind[] = ["break", "lecture", "online", "test", "revision", "eet", "exam"];

/** Resolve the effective period on a date — highest priority wins when periods overlap. */
export function periodAt(semester: Semester, date: string, state: MyState): CalendarPeriod | null {
  let best: CalendarPeriod | null = null;
  for (const p of semester.periods) {
    if (!inRange(date, effectiveRange(p, state))) continue;
    if (!best || PERIOD_PRIORITY.indexOf(p.kind) > PERIOD_PRIORITY.indexOf(best.kind)) best = p;
  }
  return best;
}

/** Start of the calendar week containing `iso` — Monday, or Sunday for KKT states. */
function weekStartOf(iso: string, kkt: boolean): string {
  const wd = isoWeekday(iso); // 0=Mon
  const offset = kkt ? (wd + 1) % 7 : wd;
  return isoAddDays(iso, -offset);
}

/**
 * Numbered teaching weeks W1..Wn built from the union of lecture + online
 * periods (effective ranges). Week boundaries are Monday-based (Sunday for KKT
 * states). A week counts when it contains at least one teaching day that is not
 * inside a break; weeks fully in a break are skipped and not numbered.
 */
export function teachingWeeks(semester: Semester, state: MyState): TeachingWeek[] {
  const kkt = isKkt(state);
  const teach = semester.periods.filter((p) => p.kind === "lecture" || p.kind === "online").map((p) => ({ ...effectiveRange(p, state), kind: p.kind as "lecture" | "online" }));
  const breaks = semester.periods.filter((p) => p.kind === "break").map((p) => effectiveRange(p, state));
  if (!teach.length) return [];

  const firstStart = teach.reduce((m, r) => (r.start < m ? r.start : m), teach[0].start);
  const lastEnd = teach.reduce((m, r) => (r.end > m ? r.end : m), teach[0].end);

  const weeks: TeachingWeek[] = [];
  let ws = weekStartOf(firstStart, kkt);
  while (ws <= lastEnd) {
    const we = isoAddDays(ws, 6);
    // First teaching (non-break) day inside this week decides the kind.
    let kind: "lecture" | "online" | null = null;
    for (let i = 0; i < 7; i++) {
      const d = isoAddDays(ws, i);
      const t = teach.find((r) => inRange(d, r));
      if (!t) continue;
      if (breaks.some((b) => inRange(d, b))) continue;
      kind = t.kind;
      break;
    }
    if (kind) weeks.push({ n: weeks.length + 1, start: ws, end: we, kind });
    ws = isoAddDays(ws, 7);
  }
  return weeks;
}

export interface WeekInfo {
  week?: number;
  period: CalendarPeriod | null;
  /** Days until the next/ongoing exam period starts (0 when inside it), null when none. */
  daysToExam: number | null;
  /** The current or next exam period range, if any remains. */
  exam: { start: string; end: string } | null;
  /** The current or next break period, if any remains. */
  nextBreak: { start: string; end: string; label: string } | null;
}

export function weekInfo(semester: Semester, date: string, state: MyState): WeekInfo {
  const period = periodAt(semester, date, state);
  const week = teachingWeeks(semester, state).find((w) => inRange(date, w));
  let daysToExam: number | null = null;
  let exam: WeekInfo["exam"] = null;
  for (const p of semester.periods.filter((p) => p.kind === "exam")) {
    const r = effectiveRange(p, state);
    if (date <= r.end) {
      daysToExam = Math.max(0, isoDiffDays(date, r.start));
      exam = { start: r.start, end: r.end };
      break;
    }
  }
  let nextBreak: WeekInfo["nextBreak"] = null;
  for (const p of semester.periods.filter((p) => p.kind === "break")) {
    const r = effectiveRange(p, state);
    if (date <= r.end) {
      nextBreak = { ...r, label: p.label };
      break;
    }
  }
  return { week: week?.n, period, daysToExam, exam, nextBreak };
}

/** Pick the semester for a calendar key, or "auto" = semester containing today, else the next upcoming. */
export function resolveSemester(key: string, group?: "A" | "B"): Semester | null {
  if (key !== "auto") return SEMESTERS.find((s) => `${s.group}-${s.code}` === key) ?? null;
  const today = todayIso();
  const pool = group ? SEMESTERS.filter((s) => s.group === group) : SEMESTERS;
  const span = (s: Semester) => {
    const ranges = s.periods.map((p) => ({ start: p.start, end: p.end }));
    return {
      start: ranges.reduce((m, r) => (r.start < m ? r.start : m), ranges[0].start),
      end: ranges.reduce((m, r) => (r.end > m ? r.end : m), ranges[0].end),
    };
  };
  for (const s of pool) {
    const r = span(s);
    if (today >= r.start && today <= r.end) return s;
  }
  const upcoming = pool.filter((s) => span(s).start > today).sort((a, b) => (span(a).start < span(b).start ? -1 : 1));
  return upcoming[0] ?? pool[pool.length - 1] ?? null;
}

export function holidayApplies(h: Holiday, state: MyState): boolean {
  return h.states === "all" || h.states.includes(state);
}

/**
 * Concrete dated occurrences of each session on days inside lecture/online
 * periods (effective ranges), excluding break days. Holiday dates applicable to
 * the state are kept but flagged `skipped` with the holiday name.
 */
export function classOccurrences(entries: Entry[], semester: Semester, holidays: Holiday[], state: MyState): ClassOccurrence[] {
  const weeks = teachingWeeks(semester, state);
  const teach = semester.periods.filter((p) => p.kind === "lecture" || p.kind === "online").map((p) => effectiveRange(p, state));
  const breaks = semester.periods.filter((p) => p.kind === "break").map((p) => effectiveRange(p, state));
  const kkt = isKkt(state);
  const out: ClassOccurrence[] = [];

  for (const w of weeks) {
    // In KKT mode the week starts Sunday; map Day → offset from week start.
    for (const e of entries) {
      if (e.hidden) continue;
      for (const s of e.sessions) {
        const dayIdx = DAYS.indexOf(s.day); // 0=Mon
        const offset = kkt ? (dayIdx + 1) % 7 : dayIdx;
        const date = isoAddDays(w.start, offset);
        if (date > w.end) continue;
        if (!teach.some((r) => inRange(date, r))) continue;
        if (breaks.some((b) => inRange(date, b))) continue;
        const hol = holidays.find((h) => h.date === date && holidayApplies(h, state));
        out.push({ date, entry: e, session: s, skipped: !!hol, holidayName: hol?.name });
      }
    }
  }
  return out;
}

/** Format an ISO date as e.g. "Fri 25 Dec". */
export function fmtIso(iso: string): string {
  const d = toDate(iso);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${day} ${d.getUTCDate()} ${mon}`;
}

/** Map a Day code to the ISO weekday index (0=Mon). */
export function dayToIsoWeekday(day: Day): number {
  return DAYS.indexOf(day);
}
