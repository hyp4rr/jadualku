// ICS (VCALENDAR) generation — pure, no DOM.
import type { Semester } from "../data/academicCalendar.ts";
import { effectiveRange, isoAddDays, teachingWeeks, type ClassOccurrence, type MyState } from "./academic.ts";
import type { SowDoc } from "./sow.ts";

export interface IcsOptions {
  planId: string;
  occurrences: ClassOccurrence[];
  /** SOW docs keyed by course code — included when `includeAssessments`. */
  sows?: Record<string, SowDoc>;
  semester?: Semester;
  state: MyState;
  includeClasses?: boolean;
  includeAssessments?: boolean;
  includePeriods?: boolean;
  /** Minutes before each timed event to pop a reminder (0 / undefined = none). */
  reminderMinutes?: number;
  /** Calendar display name in apps that read X-WR-CALNAME. */
  calendarName?: string;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a line at 75 octets, UTF-8 aware (continuation lines start with a space). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  const limit = () => (out.length === 0 ? 75 : 74); // continuation lines carry a leading space
  for (const ch of line) {
    const w = enc.encode(ch).length;
    if (curLen + w > limit()) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += w;
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

/** fnv-1a for stable UIDs. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const dtLocal = (date: string, minutes: number) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${date.replace(/-/g, "")}T${hh}${mm}00`;
};
const dtDate = (iso: string) => iso.replace(/-/g, "");

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Kuala_Lumpur",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0800",
  "TZOFFSETTO:+0800",
  "TZNAME:MYT",
  "DTSTART:19700101T000000",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildIcs(opts: IcsOptions): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JadualKu//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(opts.calendarName ?? "JadualKu")}`,
    "X-WR-TIMEZONE:Asia/Kuala_Lumpur",
    ...VTIMEZONE,
  ];

  const event = (props: string[]) => {
    const timed = props.some((p) => p.startsWith("DTSTART;TZID"));
    lines.push("BEGIN:VEVENT", `DTSTAMP:${stamp}`, `LAST-MODIFIED:${stamp}`, "SEQUENCE:0", "STATUS:CONFIRMED", ...props);
    if (timed) lines.push("TRANSP:OPAQUE");
    if (timed && opts.reminderMinutes && opts.reminderMinutes > 0) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", `TRIGGER:-PT${Math.round(opts.reminderMinutes)}M`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  };

  if (opts.includeClasses !== false) {
    for (const o of opts.occurrences) {
      if (o.skipped) continue;
      const e = o.entry;
      const summary = `${e.subjectCode} ${e.subjectName}`.trim() + (e.group ? ` (${e.group})` : "");
      event([
        `UID:${hash(`${opts.planId}+${e.subjectCode}+${o.date}+${o.session.start}`)}@jadualku`,
        `SUMMARY:${escapeIcs(summary)}`,
        ...(o.session.room ? [`LOCATION:${escapeIcs(o.session.room)}`] : []),
        `DTSTART;TZID=Asia/Kuala_Lumpur:${dtLocal(o.date, o.session.start)}`,
        `DTEND;TZID=Asia/Kuala_Lumpur:${dtLocal(o.date, o.session.end)}`,
      ]);
    }
  }

  if (opts.includeAssessments && opts.sows && opts.semester) {
    const weeks = teachingWeeks(opts.semester, opts.state);
    for (const [code, sow] of Object.entries(opts.sows)) {
      for (const a of sow.assessments) {
        const label = `${code} ${a.name}`;
        const weight = a.weight !== undefined ? ` (${a.weight}%)` : "";
        if (a.date && a.start !== undefined) {
          event([
            `UID:${hash(`${opts.planId}+sow+${code}+${a.name}`)}@jadualku`,
            `SUMMARY:${escapeIcs(label + weight)}`,
            ...(a.venue ? [`LOCATION:${escapeIcs(a.venue)}`] : []),
            ...(a.note ? [`DESCRIPTION:${escapeIcs(a.note)}`] : []),
            `DTSTART;TZID=Asia/Kuala_Lumpur:${dtLocal(a.date, a.start)}`,
            `DTEND;TZID=Asia/Kuala_Lumpur:${dtLocal(a.date, a.end && a.end > a.start ? a.end : a.start + 120)}`,
          ]);
        } else if (a.date) {
          event([
            `UID:${hash(`${opts.planId}+sow+${code}+${a.name}`)}@jadualku`,
            `SUMMARY:${escapeIcs(label + weight)}`,
            ...(a.venue ? [`LOCATION:${escapeIcs(a.venue)}`] : []),
            ...(a.note ? [`DESCRIPTION:${escapeIcs(a.note)}`] : []),
            `DTSTART;VALUE=DATE:${dtDate(a.date)}`,
            `DTEND;VALUE=DATE:${dtDate(isoAddDays(a.date, 1))}`,
          ]);
        } else {
          const wk = a.week !== undefined ? weeks.find((w) => w.n === a.week) : undefined;
          if (wk) {
            event([
              `UID:${hash(`${opts.planId}+sow+${code}+${a.name}+${wk.start}`)}@jadualku`,
              `SUMMARY:${escapeIcs(`${label} (week ${a.week})${weight}`)}`,
              `DTSTART;VALUE=DATE:${dtDate(wk.start)}`,
              `DTEND;VALUE=DATE:${dtDate(isoAddDays(wk.start, 1))}`,
            ]);
          } else if (a.kind === "exam") {
            const exam = opts.semester.periods.find((p) => p.kind === "exam");
            if (exam) {
              const r = effectiveRange(exam, opts.state);
              event([
                `UID:${hash(`${opts.planId}+sow+${code}+${a.name}+exam`)}@jadualku`,
                `SUMMARY:${escapeIcs(`${label} — see official exam timetable`)}`,
                `DTSTART;VALUE=DATE:${dtDate(r.start)}`,
                `DTEND;VALUE=DATE:${dtDate(isoAddDays(r.start, 1))}`,
              ]);
            }
          }
        }
      }
    }
  }

  if (opts.includePeriods && opts.semester) {
    for (const p of opts.semester.periods) {
      const r = effectiveRange(p, opts.state);
      event([
        `UID:${hash(`${opts.semester.code}+period+${p.kind}+${r.start}`)}@jadualku`,
        `SUMMARY:${escapeIcs(p.label)}`,
        `DTSTART;VALUE=DATE:${dtDate(r.start)}`,
        `DTEND;VALUE=DATE:${dtDate(isoAddDays(r.end, 1))}`,
      ]);
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
