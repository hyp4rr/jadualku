import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SEMESTERS } from "../data/academicCalendar.ts";
import { parseHolidayIcs } from "../../server/holidays.ts";
import { classOccurrences } from "./academic.ts";
import { buildIcs, foldLine } from "./ics.ts";
import type { Entry } from "./types.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const B64 = SEMESTERS.find((s) => s.group === "B" && s.code === "20264")!;
const holidays = parseHolidayIcs(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../server/fixtures/malaysia-holidays.ics"), "utf8"),
);

const friEntry: Entry = {
  id: "e1",
  subjectCode: "CSC404",
  subjectName: "Programming I, Foundations",
  group: "CS2403A",
  color: "#fff",
  source: "manual",
  sessions: [{ day: "FRI", start: 480, end: 600, room: "DK1, Blok A" }],
};

function eventCount(ics: string) {
  return (ics.match(/BEGIN:VEVENT/g) ?? []).length;
}

describe("foldLine", () => {
  it("folds at 75 octets and never splits a UTF-8 char", () => {
    const long = "SUMMARY:" + "日".repeat(40) + " tail"; // 日 = 3 octets
    const folded = foldLine(long);
    const lines = folded.split("\r\n");
    const enc = new TextEncoder();
    for (const l of lines) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(lines.length).toBeGreaterThan(1);
    expect(folded.replace(/\r\n /g, "")).toBe(long); // unfolds back exactly
  });
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Quiz 1")).toBe("SUMMARY:Quiz 1");
  });
});

describe("buildIcs", () => {
  const occ = classOccurrences([friEntry], B64, holidays, "Selangor");
  const ics = buildIcs({ planId: "p1", occurrences: occ, semester: B64, state: "Selangor", includeClasses: true });

  it("is a CRLF VCALENDAR with VTIMEZONE for Asia/Kuala_Lumpur", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("PRODID:-//JadualKu//EN");
    expect(ics).toContain("TZID:Asia/Kuala_Lumpur");
    expect(ics).toContain("DTSTART;TZID=Asia/Kuala_Lumpur:");
    expect(/\r\n/.test(ics)).toBe(true);
    expect(ics).not.toContain("\n\n");
  });

  it("emits one VEVENT per non-skipped occurrence (13 of 14 Fridays)", () => {
    // B64 Selangor has 14 teaching weeks. The only fixture holiday landing on a
    // Friday teaching day for Selangor is New Year's Day 2027-01-01 (regional,
    // includes Selangor) inside W13 — so 14 − 1 = 13 events.
    expect(occ).toHaveLength(14);
    expect(occ.filter((o) => o.skipped)).toHaveLength(1);
    expect(eventCount(ics)).toBe(13);
    expect(ics).not.toContain("DTSTART;TZID=Asia/Kuala_Lumpur:20270101");
  });

  it("escapes commas/semicolons in SUMMARY and LOCATION", () => {
    expect(ics).toContain("Programming I\\, Foundations");
    expect(ics).toContain("LOCATION:DK1\\, Blok A");
  });

  it("produces stable UIDs", () => {
    const again = buildIcs({ planId: "p1", occurrences: occ, semester: B64, state: "Selangor" });
    expect(again.match(/UID:.+/g)).toEqual(ics.match(/UID:.+/g));
  });

  it("includes assessments and periods when requested", () => {
    const full = buildIcs({
      planId: "p1",
      occurrences: [],
      sows: {
        CSC404: {
          courseCode: "CSC404",
          courseName: "Programming",
          fileName: "s.pdf",
          importedAt: 0,
          weeks: [],
          assessments: [
            { name: "Quiz 1", kind: "quiz", weight: 10, week: 4 },
            { name: "Final Examination", kind: "exam", weight: 40 },
          ],
          warnings: [],
        },
      },
      semester: B64,
      state: "Selangor",
      includeClasses: false,
      includeAssessments: true,
      includePeriods: true,
    });
    // quiz on week-4 Monday (2026-10-19), exam mapped to exam period start, plus 7 period events
    expect(full).toContain("DTSTART;VALUE=DATE:20261019");
    expect(full).toContain("SUMMARY:CSC404 Quiz 1 (week 4) (10%)");
    expect(full).toContain("see official exam timetable");
    expect(full).toContain("SUMMARY:Mid-Semester Break / Special Break");
    expect(eventCount(full)).toBe(2 + B64.periods.length);
  });
});

describe("calendar-app compatibility", () => {
  const sem = SEMESTERS.find((s) => s.group === "B" && s.code === "20264")!;
  const ics = buildIcs({
    planId: "p",
    occurrences: [
      {
        date: "2026-10-02",
        entry: { id: "e", subjectCode: "MAT406", subjectName: "Math", group: "A", color: "#fff", source: "manual", sessions: [] },
        session: { day: "FRI", start: 480, end: 600, room: "DK1" },
      },
    ],
    semester: sem,
    state: "Selangor",
    reminderMinutes: 15,
    calendarName: "JadualKu - Plan, 1",
  });

  it("names the calendar and pins the timezone", () => {
    expect(ics).toContain("X-WR-CALNAME:JadualKu - Plan\\, 1\r\n");
    expect(ics).toContain("X-WR-TIMEZONE:Asia/Kuala_Lumpur\r\n");
  });

  it("adds a display alarm only to timed events, and the usual status fields", () => {
    expect(ics).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nTRIGGER:-PT15M\r\nEND:VALARM");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("SEQUENCE:0");
  });

  it("omits alarms when no reminder is requested", () => {
    const none = buildIcs({ planId: "p", occurrences: [], semester: sem, state: "Selangor", includeClasses: true });
    expect(none).not.toContain("VALARM");
  });
});
