import type { Day, Entry, Session } from "./types.ts";
import { DAYS } from "./types.ts";
import { findClashes } from "./clash.ts";

export interface PlanStats {
  subjects: number;
  credits: number;
  contactMinutes: number;
  campusDays: number;
  freeWeekdays: number; // MON–FRI days with no class
  earliest: number; // minutes; 0 when empty
  latest: number;
  gapMinutes: number;
  clashes: number;
  /** Busiest day's span (latest end − earliest start) in minutes. */
  longestDay: number;
}

export function planStats(entries: Entry[]): PlanStats {
  const visible = entries.filter((e) => !e.hidden);
  const usedDays = new Set<Day>();
  const byDay = new Map<Day, Session[]>();
  let earliest = Infinity;
  let latest = 0;
  let contact = 0;
  for (const e of visible) {
    for (const s of e.sessions) {
      usedDays.add(s.day);
      (byDay.get(s.day) ?? byDay.set(s.day, []).get(s.day)!).push(s);
      earliest = Math.min(earliest, s.start);
      latest = Math.max(latest, s.end);
      contact += s.end - s.start;
    }
  }
  let gap = 0;
  let longestDay = 0;
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start - b.start);
    longestDay = Math.max(longestDay, list[list.length - 1].end - list[0].start);
    for (let i = 1; i < list.length; i++) {
      const g = list[i].start - list[i - 1].end;
      if (g > 0) gap += g;
    }
  }
  return {
    subjects: new Set(visible.map((e) => e.subjectCode)).size,
    credits: visible.reduce((s, e) => s + (e.credits ?? 0), 0),
    contactMinutes: contact,
    campusDays: usedDays.size,
    freeWeekdays: ["MON", "TUE", "WED", "THU", "FRI"].filter((d) => !usedDays.has(d as Day)).length,
    earliest: earliest === Infinity ? 0 : earliest,
    latest,
    gapMinutes: gap,
    clashes: findClashes(visible).length,
    longestDay,
  };
}

export interface FreeWindow {
  day: Day;
  start: number;
  end: number;
}

/**
 * Windows where *every* plan is free, within [from,to] on the given days.
 * Only spans of at least `minMinutes` are returned.
 */
export function commonFreeSlots(
  plans: Entry[][],
  { from = 8 * 60, to = 18 * 60, days = DAYS }: { from?: number; to?: number; days?: Day[] } = {},
  minMinutes = 30,
): FreeWindow[] {
  const out: FreeWindow[] = [];
  for (const day of days) {
    // Busy intervals = union of all plans' sessions on this day, clamped to the window.
    const busy = plans
      .flatMap((entries) => entries.filter((e) => !e.hidden).flatMap((e) => e.sessions))
      .filter((s) => s.day === day)
      .map((s) => ({ start: Math.max(s.start, from), end: Math.min(s.end, to) }))
      .filter((s) => s.end > s.start)
      .sort((a, b) => a.start - b.start);

    let cursor = from;
    for (const b of busy) {
      if (b.start > cursor && b.start - cursor >= minMinutes) {
        out.push({ day, start: cursor, end: b.start });
      }
      cursor = Math.max(cursor, b.end);
    }
    if (to - cursor >= minMinutes) out.push({ day, start: cursor, end: to });
  }
  return out;
}

export interface PlanDiff {
  onlyA: string[];
  onlyB: string[];
  sameSubjectDifferentGroup: { code: string; aGroup: string; bGroup: string }[];
  /** Same subject, same group, identical sessions. */
  identical: string[];
}

export function diffPlans(a: Entry[], b: Entry[]): PlanDiff {
  const byCode = (entries: Entry[]) => {
    const m = new Map<string, Entry>();
    for (const e of entries) m.set(e.subjectCode, m.get(e.subjectCode) ?? e);
    return m;
  };
  const A = byCode(a);
  const B = byCode(b);
  const diff: PlanDiff = { onlyA: [], onlyB: [], sameSubjectDifferentGroup: [], identical: [] };

  for (const [code, ea] of A) {
    const eb = B.get(code);
    if (!eb) diff.onlyA.push(code);
    else if (eb.group !== ea.group) diff.sameSubjectDifferentGroup.push({ code, aGroup: ea.group, bGroup: eb.group });
    else if (sameSessions(ea.sessions, eb.sessions)) diff.identical.push(code);
  }
  for (const code of B.keys()) if (!A.has(code)) diff.onlyB.push(code);
  return diff;
}

function sameSessions(a: Session[], b: Session[]): boolean {
  if (a.length !== b.length) return false;
  const norm = (s: Session[]) =>
    [...s].map((x) => `${x.day}:${x.start}:${x.end}`).sort().join("|");
  return norm(a) === norm(b);
}
