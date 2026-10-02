import { describe, expect, it } from "vitest";
import { SEMESTERS } from "../data/academicCalendar.ts";
import type { Entry } from "./types.ts";
import {
  classOccurrences,
  effectiveRange,
  isoAddDays,
  isoWeekday,
  periodAt,
  teachingWeeks,
  weekInfo,
  type Holiday,
} from "./academic.ts";

const B64 = SEMESTERS.find((s) => s.group === "B" && s.code === "20264")!;
const B72 = SEMESTERS.find((s) => s.group === "B" && s.code === "20272")!;

describe("date helpers", () => {
  it("isoWeekday: 2026-09-28 is a Monday", () => {
    expect(isoWeekday("2026-09-28")).toBe(0);
    expect(isoWeekday("2026-10-04")).toBe(6);
  });
  it("isoAddDays crosses year boundary", () => {
    expect(isoAddDays("2026-12-31", 3)).toBe("2027-01-03");
  });
});

describe("effectiveRange", () => {
  it("uses kkt range for Kedah, default for Selangor", () => {
    const p = B64.periods[0];
    expect(effectiveRange(p, "Selangor")).toEqual({ start: "2026-09-28", end: "2026-12-20" });
    expect(effectiveRange(p, "Kedah")).toEqual({ start: "2026-09-27", end: "2026-12-19" });
  });
});

describe("periodAt", () => {
  it("resolves overlaps by priority (exam beats the overlapping semester break)", () => {
    // Semester break is published from 2027-02-05 but exams run to 02-07.
    expect(periodAt(B64, "2027-02-06", "Selangor")?.kind).toBe("exam");
    expect(periodAt(B64, "2027-02-10", "Selangor")?.kind).toBe("break");
  });
  it("eet beats revision when they share a week", () => {
    expect(periodAt(B64, "2027-01-12", "Selangor")?.kind).toBe("eet");
  });
  it("returns the plain kind otherwise", () => {
    expect(periodAt(B64, "2026-10-01", "Selangor")?.kind).toBe("lecture");
  });
});

describe("teachingWeeks", () => {
  it("Group B 20264 (Selangor): 14 weeks, break skipped, year boundary", () => {
    const weeks = teachingWeeks(B64, "Selangor");
    expect(weeks).toHaveLength(14);
    expect(weeks[0]).toEqual({ n: 1, start: "2026-09-28", end: "2026-10-04", kind: "lecture" });
    expect(weeks[11]).toMatchObject({ n: 12, start: "2026-12-14", end: "2026-12-20" });
    // 21–27 Dec break skipped, not numbered
    expect(weeks[12]).toMatchObject({ n: 13, start: "2026-12-28", end: "2027-01-03" });
    expect(weeks[13]).toMatchObject({ n: 14, start: "2027-01-04", end: "2027-01-10" });
  });

  it("Group B 20272 (Selangor): 14 weeks including online period", () => {
    const weeks = teachingWeeks(B72, "Selangor");
    expect(weeks).toHaveLength(14);
    expect(weeks[0].start).toBe("2027-03-15");
    const online = weeks.filter((w) => w.kind === "online");
    expect(online.length).toBe(2);
    expect(weeks[13]).toMatchObject({ n: 14, start: "2027-06-21", end: "2027-06-27" });
  });

  it("KKT states use Sunday-based weeks", () => {
    const weeks = teachingWeeks(B64, "Kelantan");
    // kkt lecture starts 2026-09-27 (a Sunday)
    expect(weeks[0].start).toBe("2026-09-27");
    expect(weeks[0].end).toBe("2026-10-03");
  });
});

describe("weekInfo", () => {
  it("reports week number, period, daysToExam, nextBreak", () => {
    const info = weekInfo(B64, "2026-09-30", "Selangor");
    expect(info.week).toBe(1);
    expect(info.period?.kind).toBe("lecture");
    expect(info.daysToExam).toBeGreaterThan(80);
    expect(info.nextBreak?.label).toContain("Mid-Semester");
    const inBreak = weekInfo(B64, "2026-12-25", "Selangor");
    expect(inBreak.period?.kind).toBe("break");
    expect(inBreak.week).toBeUndefined();
  });
});

describe("classOccurrences", () => {
  const entry = (day: "MON" | "FRI"): Entry => ({
    id: "e1",
    subjectCode: "MAT406",
    subjectName: "Math",
    group: "CS2403A",
    color: "#fff",
    source: "manual",
    sessions: [{ day, start: 480, end: 600, room: "DK1" }],
  });

  const christmas: Holiday = { date: "2026-12-25", name: "Christmas Day", states: "all" };
  const sarawakDay: Holiday = { date: "2026-10-05", name: "Regional", states: ["Sarawak"] };

  it("counts one weekly session across the semester, flags holiday dates", () => {
    // B64 has 14 teaching weeks; Fri 2026-12-25 falls in the break week (not a
    // teaching week anyway) — so all 14 Fridays occur, none skipped.
    const fri = classOccurrences([entry("FRI")], B64, [christmas], "Selangor");
    expect(fri).toHaveLength(14);
    expect(fri.every((o) => !o.skipped)).toBe(true);
    expect(fri[0].date).toBe("2026-10-02");
  });

  it("marks a weekday holiday as skipped with its name", () => {
    const mon = classOccurrences([entry("MON")], B64, [{ date: "2026-10-05", name: "Fake Day", states: "all" }], "Selangor");
    const hit = mon.find((o) => o.date === "2026-10-05");
    expect(hit?.skipped).toBe(true);
    expect(hit?.holidayName).toBe("Fake Day");
    expect(mon).toHaveLength(14);
  });

  it("holidays for other states do not skip", () => {
    const mon = classOccurrences([entry("MON")], B64, [sarawakDay], "Selangor");
    expect(mon.find((o) => o.date === "2026-10-05")?.skipped).toBe(false);
    expect(classOccurrences([entry("MON")], B64, [sarawakDay], "Sarawak").find((o) => o.date === "2026-10-05")?.skipped).toBe(true);
  });
});
