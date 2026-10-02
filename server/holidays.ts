import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MY_STATES, type Holiday, type MyState } from "../src/lib/academic.ts";

export const HOLIDAY_ICS_URL =
  "https://calendar.google.com/calendar/ical/en.malaysia%23holiday%40group.v.calendar.google.com/public/basic.ics";

const STATE_SET = new Set<string>(MY_STATES);

function unescapeIcs(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Unfold continuation lines (RFC 5545: a line starting with space/tab continues the previous). */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const l of raw) {
    if ((l.startsWith(" ") || l.startsWith("\t")) && lines.length) lines[lines.length - 1] += l.slice(1);
    else lines.push(l);
  }
  return lines;
}

function parseDate(v: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function cleanName(summary: string): { name: string; tentative: boolean } {
  const tentative = /\(tentative\)/i.test(summary);
  const name = summary
    .replace(/\s*\(regional holiday\)/gi, "")
    .replace(/\s*\(tentative\)/gi, "")
    .trim();
  return { name, tentative };
}

/** "Public holiday in A, B, …\nDate is tentative…" → state list. */
function parseStates(description: string): "all" | MyState[] {
  const desc = unescapeIcs(description).split("\n")[0].trim();
  if (!/^public holiday\b/i.test(desc)) return "all";
  const m = /^public holiday in (.+)$/i.exec(desc);
  if (!m) return "all";
  const states = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is MyState => STATE_SET.has(s));
  return states.length ? states : "all";
}

/** Parse the Malaysia public-holiday ICS into Holiday records (multi-day events expanded; observances dropped). */
export function parseHolidayIcs(text: string): Holiday[] {
  const lines = unfold(text);
  const out: Holiday[] = [];
  let cur: { dtstart?: string; dtend?: string; summary?: string; description?: string } | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur?.dtstart && cur.summary) {
        const desc = cur.description ?? "";
        // Drop observances (e.g. Valentine's Day, Christmas Eve).
        if (!/^observance/i.test(unescapeIcs(desc).trimStart())) {
          const start = parseDate(cur.dtstart);
          const endExclusive = cur.dtend ? parseDate(cur.dtend) : null;
          const { name, tentative } = cleanName(cur.summary);
          const states = parseStates(desc);
          const days = start && endExclusive ? Math.max(1, Math.round((Date.parse(`${endExclusive}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)) : 1;
          if (start) {
            for (let i = 0; i < days; i++) {
              const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
              out.push({ date, name, states, tentative });
            }
          }
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const prop = key.split(";")[0].toUpperCase();
    if (prop === "DTSTART") cur.dtstart = value;
    else if (prop === "DTEND") cur.dtend = value;
    else if (prop === "SUMMARY") cur.summary = unescapeIcs(value);
    else if (prop === "DESCRIPTION") cur.description = value;
  }
  return out;
}

interface Cache {
  at: number;
  holidays: Holiday[];
  source: "live" | "snapshot";
}
let cache: Cache | null = null;
const TTL = 12 * 60 * 60 * 1000;

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "malaysia-holidays.ics");

async function loadSnapshot(): Promise<Holiday[]> {
  try {
    return parseHolidayIcs(await readFile(FIXTURE, "utf8"));
  } catch {
    try {
      const fallback = join(process.cwd(), "server", "fixtures", "malaysia-holidays.ics");
      return parseHolidayIcs(await readFile(fallback, "utf8"));
    } catch {
      return [];
    }
  }
}

/** GET /api/holidays — live Google ICS with 12h cache; falls back to the bundled snapshot. */
export async function handleHolidays(): Promise<{ source: "live" | "snapshot"; fetchedAt: number; holidays: Holiday[] }> {
  if (cache && Date.now() - cache.at < TTL) {
    return { source: cache.source, fetchedAt: cache.at, holidays: cache.holidays };
  }
  try {
    const res = await fetch(HOLIDAY_ICS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`holiday feed ${res.status}`);
    const holidays = parseHolidayIcs(await res.text());
    if (!holidays.length) throw new Error("holiday feed parsed empty");
    cache = { at: Date.now(), holidays, source: "live" };
  } catch {
    const holidays = await loadSnapshot();
    cache = { at: Date.now(), holidays, source: "snapshot" };
  }
  return { source: cache.source, fetchedAt: cache.at, holidays: cache.holidays };
}
