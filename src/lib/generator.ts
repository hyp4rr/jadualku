import type { Day, Session } from "./types.ts";

export interface GenGroup {
  group: string;
  sessions: Session[];
  program?: string;
}

export interface GenSubject {
  code: string;
  name?: string;
  groups: GenGroup[];
  /** When set, only this group code is considered. */
  lockedGroup?: string;
}

export interface GenConstraints {
  /** Minutes since midnight — no session may start before this. */
  noClassBefore?: number;
  /** Minutes since midnight — no session may end after this. */
  noClassAfter?: number;
  freeDays?: Day[];
  /** Substring filter on the group's programme list. */
  programme?: string;
}

export type RankPreset = "compact" | "lateStart" | "earlyFinish" | "fewGaps";

export interface ComboStats {
  days: number;
  gapMinutes: number;
  earliest: number;
  latest: number;
}

export interface ComboPick {
  subject: string;
  subjectName?: string;
  group: string;
  sessions: Session[];
}

export interface Combo {
  picks: ComboPick[];
  stats: ComboStats;
}

export interface GenResult {
  combos: Combo[];
  /** Present when no valid combo exists: the subject pair whose candidates clash most. */
  blocker?: { a: string; b: string; clashes: number };
  /** True when the valid-combo cap was hit before exhausting the search. */
  capped: boolean;
}

const MAX_COMBOS = 5000;
const MAX_NODES = 300_000;

function compatible(a: Session[], b: Session[]): boolean {
  for (const sa of a) {
    for (const sb of b) {
      if (sa.day === sb.day && sa.start < sb.end && sb.start < sa.end) return false;
    }
  }
  return true;
}

function statsOf(sessions: Session[]): ComboStats {
  const byDay = new Map<Day, Session[]>();
  let earliest = Infinity;
  let latest = 0;
  for (const s of sessions) {
    const list = byDay.get(s.day) ?? [];
    list.push(s);
    byDay.set(s.day, list);
    if (s.start < earliest) earliest = s.start;
    if (s.end > latest) latest = s.end;
  }
  let gap = 0;
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const g = list[i].start - list[i - 1].end;
      if (g > 0) gap += g;
    }
  }
  return { days: byDay.size, gapMinutes: gap, earliest: earliest === Infinity ? 0 : earliest, latest };
}

function comparator(preset: RankPreset) {
  return (a: Combo, b: Combo): number => {
    const A = a.stats;
    const B = b.stats;
    switch (preset) {
      case "compact":
        return A.days - B.days || A.gapMinutes - B.gapMinutes || A.earliest - B.earliest || A.latest - B.latest;
      case "lateStart":
        return B.earliest - A.earliest || A.gapMinutes - B.gapMinutes || A.days - B.days || A.latest - B.latest;
      case "earlyFinish":
        return A.latest - B.latest || A.gapMinutes - B.gapMinutes || A.days - B.days || A.earliest - B.earliest;
      case "fewGaps":
        return A.gapMinutes - B.gapMinutes || A.days - B.days || A.earliest - B.earliest || A.latest - B.latest;
    }
  };
}

function filterGroups(subject: GenSubject, c: GenConstraints): GenGroup[] {
  return subject.groups.filter((g) => {
    if (subject.lockedGroup && g.group !== subject.lockedGroup) return false;
    if (c.programme && !(g.program ?? "").toUpperCase().includes(c.programme.toUpperCase())) return false;
    for (const s of g.sessions) {
      if (c.freeDays?.includes(s.day)) return false;
      if (c.noClassBefore !== undefined && s.start < c.noClassBefore) return false;
      if (c.noClassAfter !== undefined && s.end > c.noClassAfter) return false;
    }
    return true;
  });
}

/**
 * Auto-planner: backtracking with clash pruning, subjects tried fewest-candidates-first.
 * Collects at most MAX_COMBOS valid combos, then ranks them by the preset.
 */
export function generate(
  subjects: GenSubject[],
  constraints: GenConstraints = {},
  preset: RankPreset = "compact",
  topN = 20,
): GenResult {
  const order = subjects
    .map((s) => ({ subject: s, candidates: filterGroups(s, constraints) }))
    .sort((a, b) => a.candidates.length - b.candidates.length);

  const combos: Combo[] = [];
  let nodes = 0;
  let exhausted = true;

  const pickedSessions: Session[][] = new Array(order.length);
  const picks: ComboPick[] = new Array(order.length);

  function bt(i: number) {
    if (combos.length >= MAX_COMBOS) {
      exhausted = false;
      return;
    }
    if (i >= order.length) {
      combos.push({ picks: picks.slice(), stats: statsOf(pickedSessions.flat()) });
      return;
    }
    const { subject, candidates } = order[i];
    for (const g of candidates) {
      if (++nodes > MAX_NODES) {
        exhausted = false;
        return;
      }
      if (pickedSessions.slice(0, i).every((prev) => compatible(prev, g.sessions))) {
        pickedSessions[i] = g.sessions;
        picks[i] = { subject: subject.code, subjectName: subject.name, group: g.group, sessions: g.sessions };
        bt(i + 1);
        if (!exhausted) return;
      }
    }
  }
  bt(0);

  const ranked = combos.sort(comparator(preset));
  const result: GenResult = { combos: ranked.slice(0, topN), capped: !exhausted };

  if (combos.length === 0 && order.length > 1) {
    result.blocker = worstPair(order.map((o) => ({ code: o.subject.code, groups: o.candidates })));
  }
  return result;
}

/** When nothing works, report the subject pair whose candidate cross-product clashes most. */
function worstPair(subjects: { code: string; groups: GenGroup[] }[]): { a: string; b: string; clashes: number } | undefined {
  let best: { a: string; b: string; clashes: number } | undefined;
  for (let i = 0; i < subjects.length; i++) {
    for (let j = i + 1; j < subjects.length; j++) {
      let clashes = 0;
      for (const ga of subjects[i].groups) {
        for (const gb of subjects[j].groups) {
          if (!compatible(ga.sessions, gb.sessions)) clashes++;
        }
      }
      if (!best || clashes > best.clashes) {
        best = { a: subjects[i].code, b: subjects[j].code, clashes };
      }
    }
  }
  return best;
}
