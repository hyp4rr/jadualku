import type { Day, Session } from "./types.ts";

export interface ClashEntry {
  id: string;
  subjectCode: string;
  group: string;
  sessions: Session[];
  hidden?: boolean;
}

export interface Clash {
  a: { entryId: string; subjectCode: string; group: string; session: Session };
  b: { entryId: string; subjectCode: string; group: string; session: Session };
  day: Day;
  start: number;
  end: number;
}

function overlap(a: Session, b: Session): { start: number; end: number } | null {
  if (a.day !== b.day) return null;
  if (a.start < b.end && b.start < a.end) {
    return { start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) };
  }
  return null;
}

/** Every clashing pair of sessions from *different* visible entries. Adjacent is not a clash. */
export function findClashes(entries: ClashEntry[]): Clash[] {
  const visible = entries.filter((e) => !e.hidden);
  const clashes: Clash[] = [];
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const A = visible[i];
      const B = visible[j];
      for (const sa of A.sessions) {
        for (const sb of B.sessions) {
          const win = overlap(sa, sb);
          if (win) {
            clashes.push({
              a: { entryId: A.id, subjectCode: A.subjectCode, group: A.group, session: sa },
              b: { entryId: B.id, subjectCode: B.subjectCode, group: B.group, session: sb },
              day: sa.day,
              ...win,
            });
          }
        }
      }
    }
  }
  return clashes;
}

export interface CandidateClash {
  entry: ClashEntry;
  session: Session; // the existing entry's session that collides
  candidate: Session;
  day: Day;
  start: number;
  end: number;
}

/** Clashes between a set of candidate sessions (preview/swap) and visible plan entries. */
export function clashesFor(
  entries: ClashEntry[],
  candidateSessions: Session[],
  ignoreEntryId?: string,
): CandidateClash[] {
  const out: CandidateClash[] = [];
  for (const entry of entries) {
    if (entry.hidden || entry.id === ignoreEntryId) continue;
    for (const session of entry.sessions) {
      for (const cand of candidateSessions) {
        const win = overlap(session, cand);
        if (win) {
          out.push({ entry, session, candidate: cand, day: cand.day, ...win });
        }
      }
    }
  }
  return out;
}

/** Set of "entryId:sessionIndex" keys involved in any clash — for grid styling. */
export function clashedSessionKeys(entries: ClashEntry[]): Set<string> {
  const keys = new Set<string>();
  const visible = entries.filter((e) => !e.hidden);
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      visible[i].sessions.forEach((sa, ai) => {
        visible[j].sessions.forEach((sb, bi) => {
          if (overlap(sa, sb)) {
            keys.add(`${visible[i].id}:${ai}`);
            keys.add(`${visible[j].id}:${bi}`);
          }
        });
      });
    }
  }
  return keys;
}
