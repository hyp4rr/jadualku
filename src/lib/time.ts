import type { Day } from "./types.ts";

const DAY_NAMES: Record<string, Day> = {
  MON: "MON", MONDAY: "MON", ISNIN: "MON",
  TUE: "TUE", TUESDAY: "TUE", SELASA: "TUE",
  WED: "WED", WEDNESDAY: "WED", RABU: "WED",
  THU: "THU", THURSDAY: "THU", KHAMIS: "THU",
  FRI: "FRI", FRIDAY: "FRI", JUMAAT: "FRI", JUMAAH: "FRI",
  SAT: "SAT", SATURDAY: "SAT", SABTU: "SAT",
  SUN: "SUN", SUNDAY: "SUN", AHAD: "SUN",
};

export function dayFromName(name: string): Day | null {
  return DAY_NAMES[name.trim().toUpperCase()] ?? null;
}

/** "9:30 PM" / "13:00 PM" / "09:00" → minutes since midnight. PM adds 12 only when h < 12; 12 AM → 0. */
export function parseClock(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toUpperCase();
  if (min > 59) return null;
  if (ap === "AM" && h === 12) h = 0;
  else if (ap === "PM" && h < 12) h += 12;
  if (h > 23) return null;
  return h * 60 + min;
}

const TIME_RANGE = /(\d{1,2}:\d{2}\s*(?:[AP]M)?)\s*-\s*(\d{1,2}:\d{2}\s*(?:[AP]M)?)/i;

export interface ParsedSlot {
  day: Day;
  start: number;
  end: number;
}

/**
 * Parses iCress / matric day-time strings.
 * Handles "TUESDAY( 09:00 AM-13:00 PM )", "TUESDAY ( 09:00 AM-10:00 AM )",
 * "FRIDAY(08:00AM-10:00AM)", "Monday 08:00-10:00", "MON 0800-1000",
 * and a bare "10:00 AM-12:00 PM" combined with `dayHint` (English or Malay day name).
 * Returns null when nothing parses — never invents a default.
 */
export function parseDayTime(input: string, dayHint?: string): ParsedSlot | null {
  const clean = input.replace(/\s+/g, " ").trim();

  let day: Day | null = null;
  let rest = clean;

  // "DAY( … )" or "DAY ( … )"
  const paren = clean.match(/^([A-Za-z]+)\s*\(([^)]*)\)\s*$/);
  if (paren) {
    day = dayFromName(paren[1]);
    rest = paren[2].trim();
  } else {
    // Leading day name: "Monday 08:00-10:00", "MON 0800-1000"
    const lead = clean.match(/^([A-Za-z]+)\s+(.+)$/);
    if (lead && dayFromName(lead[1])) {
      day = dayFromName(lead[1]);
      rest = lead[2].trim();
    }
  }
  if (!day && dayHint) day = dayFromName(dayHint);
  if (!day) return null;

  // Compact digits: "0800-1000"
  const compact = rest.match(/^(\d{3,4})-(\d{3,4})$/);
  if (compact) {
    const s = compact[1].padStart(4, "0");
    const e = compact[2].padStart(4, "0");
    const start = Number(s.slice(0, 2)) * 60 + Number(s.slice(2));
    const end = Number(e.slice(0, 2)) * 60 + Number(e.slice(2));
    return end > start ? { day, start, end } : null;
  }

  const range = rest.match(TIME_RANGE);
  if (!range) return null;
  const start = parseClock(range[1]);
  const end = parseClock(range[2]);
  if (start === null || end === null || end <= start) return null;
  return { day, start, end };
}

export function fmt24(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function fmt12(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const ap = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mins % 60).padStart(2, "0")} ${ap}`;
}

/** "09:00–13:00" */
export function fmtRange24(start: number, end: number): string {
  return `${fmt24(start)}–${fmt24(end)}`;
}

/** "9:00 AM–1:00 PM" */
export function fmtRange12(start: number, end: number): string {
  return `${fmt12(start)}–${fmt12(end)}`;
}

/** Compact "9:00–13:00" — drops the leading zero on the first hour. */
export function fmtRangeCompact(start: number, end: number): string {
  return `${fmt24(start).replace(/^0/, "")}–${fmt24(end)}`;
}
