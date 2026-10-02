import { describe, expect, it } from "vitest";
import type { Day, Entry, Session } from "./types.ts";
import { commonFreeSlots, diffPlans, planStats } from "./compare.ts";

let n = 0;
function entry(code: string, group: string, sessions: Session[], credits = 3): Entry {
  return {
    id: `${code}-${group}-${n++}`,
    subjectCode: code,
    subjectName: code,
    group,
    sessions,
    color: "#2563eb",
    credits,
    source: "manual",
  };
}
const S = (day: Day, start: number, end: number): Session => ({ day, start, end, room: "" });

describe("planStats", () => {
  it("counts subjects, credits, contact time and campus days", () => {
    const entries = [
      entry("AAA400", "A", [S("MON", 9 * 60, 11 * 60), S("WED", 14 * 60, 16 * 60)]),
      entry("MAT406", "B", [S("MON", 13 * 60, 14 * 60)], 4),
    ];
    const st = planStats(entries);
    expect(st.subjects).toBe(2);
    expect(st.credits).toBe(7);
    expect(st.contactMinutes).toBe(5 * 60);
    expect(st.campusDays).toBe(2);
    expect(st.freeWeekdays).toBe(3);
    expect(st.earliest).toBe(9 * 60);
    expect(st.latest).toBe(16 * 60);
    expect(st.gapMinutes).toBe(120); // MON 11:00→13:00
    expect(st.clashes).toBe(0);
  });

  it("counts overlapping sessions as clashes and ignores hidden entries", () => {
    const entries = [
      entry("A", "1", [S("TUE", 9 * 60, 11 * 60)]),
      entry("B", "1", [S("TUE", 10 * 60, 12 * 60)]),
      { ...entry("C", "1", [S("THU", 8 * 60, 10 * 60)]), hidden: true },
    ];
    const st = planStats(entries);
    expect(st.clashes).toBe(1);
    expect(st.subjects).toBe(2);
  });

  it("adjacent sessions produce no gap and no clash", () => {
    const st = planStats([entry("A", "1", [S("MON", 8 * 60, 10 * 60)]), entry("B", "1", [S("MON", 10 * 60, 12 * 60)])]);
    expect(st.gapMinutes).toBe(0);
    expect(st.clashes).toBe(0);
  });
});

describe("commonFree", () => {
  const opts = { from: 8 * 60, to: 18 * 60, days: ["MON" as Day, "WED" as Day] };

  it("returns windows all plans share, ≥30 min", () => {
    const a = [entry("A", "1", [S("MON", 9 * 60, 11 * 60)])];
    const b = [entry("B", "1", [S("MON", 10 * 60, 12 * 60)])];
    // union busy 9–12 → free 8–9 (60m) and 12–18 (360m)
    const free = commonFreeSlots([a, b], opts);
    const mon = free.filter((w) => w.day === "MON");
    expect(mon).toEqual([
      { day: "MON", start: 8 * 60, end: 9 * 60 },
      { day: "MON", start: 12 * 60, end: 18 * 60 },
    ]);
  });

  it("adjacent classes across different plans create no false gap", () => {
    const a = [entry("A", "1", [S("MON", 8 * 60, 10 * 60)])];
    const b = [entry("B", "1", [S("MON", 10 * 60, 12 * 60)])];
    const free = commonFreeSlots([a, b], opts).filter((w) => w.day === "MON");
    expect(free).toEqual([{ day: "MON", start: 12 * 60, end: 18 * 60 }]);
  });

  it("back-to-back coverage leaves nothing", () => {
    const a = [entry("A", "1", [S("MON", 8 * 60, 13 * 60)])];
    const b = [entry("B", "1", [S("MON", 13 * 60, 18 * 60)])];
    const free = commonFreeSlots([a, b], opts).filter((w) => w.day === "MON");
    expect(free).toEqual([]);
  });

  it("drops windows shorter than the minimum length", () => {
    const a = [entry("A", "1", [S("MON", 8 * 60, 8 * 60 + 20)])];
    const b = [entry("B", "1", [S("MON", 8 * 60 + 45, 18 * 60)])];
    const free = commonFreeSlots([a, b], opts, 30).filter((w) => w.day === "MON");
    // 8:20–8:45 is only 25 min — excluded at min 30
    expect(free).toEqual([]);
    // but visible when the minimum drops to 20
    expect(commonFreeSlots([a, b], opts, 20).filter((w) => w.day === "MON")).toEqual([
      { day: "MON", start: 8 * 60 + 20, end: 8 * 60 + 45 },
    ]);
  });

  it("only reports the requested days (weekend exclusion)", () => {
    const a = [entry("A", "1", [S("SAT", 9 * 60, 10 * 60)])];
    const weekdays = commonFreeSlots([a, a], { from: 8 * 60, to: 12 * 60, days: ["MON", "TUE", "WED", "THU", "FRI"] });
    expect(weekdays.every((w) => w.day !== "SAT" && w.day !== "SUN")).toBe(true);
    const inclSat = commonFreeSlots([a, a], { from: 8 * 60, to: 12 * 60, days: ["SAT"] });
    expect(inclSat).toEqual([
      { day: "SAT", start: 8 * 60, end: 9 * 60 },
      { day: "SAT", start: 10 * 60, end: 12 * 60 },
    ]);
  });
});

describe("diffPlans", () => {
  it("partitions subjects into onlyA / onlyB / different group / identical", () => {
    const a = [
      entry("AAA400", "A", [S("MON", 9 * 60, 11 * 60)]),
      entry("MAT406", "A", [S("TUE", 9 * 60, 11 * 60)]),
      entry("SAME01", "X", [S("FRI", 8 * 60, 10 * 60)]),
    ];
    const b = [
      entry("MAT406", "B", [S("TUE", 13 * 60, 15 * 60)]),
      entry("SAME01", "X", [S("FRI", 8 * 60, 10 * 60)]),
      entry("NEW999", "A", [S("WED", 9 * 60, 10 * 60)]),
    ];
    const d = diffPlans(a, b);
    expect(d.onlyA).toEqual(["AAA400"]);
    expect(d.onlyB).toEqual(["NEW999"]);
    expect(d.sameSubjectDifferentGroup).toEqual([{ code: "MAT406", aGroup: "A", bGroup: "B" }]);
    expect(d.identical).toEqual(["SAME01"]);
  });
});
