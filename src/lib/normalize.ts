import type { Day, Session } from "./types.ts";
import { DAYS } from "./types.ts";
import { parseDayTime } from "./time.ts";

/** One raw iCress group-table row (what /api/groups returns). */
export interface RawRow {
  day_time: string;
  group: string;
  mode: string;
  status: string;
  room: string;
  program: string;
  faculty: string;
}

export interface GroupBlock {
  group: string;
  sessions: Session[];
  programs: string[];
  mode: string;
  status: string;
  faculty: string;
}

const DAY_ORDER = new Map<Day, number>(DAYS.map((d, i) => [d, i]));

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const t = v.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * Groups raw iCress rows by group code and merges each (group, day) into sessions.
 * Only strictly overlapping or identical intervals merge — touching intervals
 * (a.end === b.start) stay separate. Rooms merge as unique " / "-joined values.
 */
export function toSessions(rows: RawRow[]): GroupBlock[] {
  const byGroup = new Map<string, RawRow[]>();
  for (const row of rows) {
    const g = row.group.trim();
    if (!g) continue;
    const list = byGroup.get(g) ?? [];
    list.push(row);
    byGroup.set(g, list);
  }

  const out: GroupBlock[] = [];
  for (const [group, groupRows] of byGroup) {
    // Collect intervals per day.
    const perDay = new Map<Day, { start: number; end: number; room: string }[]>();
    for (const row of groupRows) {
      const slot = parseDayTime(row.day_time);
      if (!slot) continue;
      const list = perDay.get(slot.day) ?? [];
      list.push({ start: slot.start, end: slot.end, room: row.room.trim() });
      perDay.set(slot.day, list);
    }

    const sessions: Session[] = [];
    for (const [day, intervals] of perDay) {
      intervals.sort((a, b) => a.start - b.start || a.end - b.end);
      let cur: { start: number; end: number; rooms: string[] } | null = null;
      const flush = () => {
        if (!cur) return;
        sessions.push({ day, start: cur.start, end: cur.end, room: uniq(cur.rooms).join(" / ") });
        cur = null;
      };
      for (const iv of intervals) {
        if (cur && iv.start < cur.end) {
          // Strictly overlapping (or identical) — merge.
          cur.end = Math.max(cur.end, iv.end);
          cur.rooms.push(iv.room);
        } else {
          flush();
          cur = { start: iv.start, end: iv.end, rooms: [iv.room] };
        }
      }
      flush();
    }

    sessions.sort(
      (a, b) => (DAY_ORDER.get(a.day) ?? 0) - (DAY_ORDER.get(b.day) ?? 0) || a.start - b.start,
    );

    out.push({
      group,
      sessions,
      programs: uniq(groupRows.map((r) => r.program)),
      mode: groupRows.find((r) => r.mode.trim())?.mode.trim() ?? "",
      status: groupRows.find((r) => r.status.trim())?.status.trim() ?? "",
      faculty: groupRows.find((r) => r.faculty.trim())?.faculty.trim() ?? "",
    });
  }

  return out.sort((a, b) => a.group.localeCompare(b.group));
}
