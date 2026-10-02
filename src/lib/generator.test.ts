import { describe, expect, it } from "vitest";
import { generate, type GenSubject } from "./generator.ts";
import type { Session } from "./types.ts";

const ses = (day: Session["day"], start: number, end: number): Session => ({ day, start, end, room: "" });

const subject = (code: string, groups: { g: string; s: Session[]; p?: string }[], locked?: string): GenSubject => ({
  code,
  groups: groups.map((x) => ({ group: x.g, sessions: x.s, program: x.p })),
  lockedGroup: locked,
});

describe("generate", () => {
  it("finds the only valid combination", () => {
    // A1 clashes with both B groups; A2 is adjacent to B1 but overlaps B2.
    const res = generate([
      subject("A", [
        { g: "A1", s: [ses("MON", 480, 720)] },
        { g: "A2", s: [ses("MON", 720, 840)] },
      ]),
      subject("B", [
        { g: "B1", s: [ses("MON", 480, 720)] },
        { g: "B2", s: [ses("MON", 540, 780)] },
      ]),
    ]);
    expect(res.combos).toHaveLength(1);
    expect(res.combos[0].picks.map((p) => `${p.subject}:${p.group}`).sort()).toEqual(["A:A2", "B:B1"]);
    expect(res.blocker).toBeUndefined();
  });

  it("respects freeDays and noClassBefore", () => {
    const res = generate(
      [
        subject("X", [
          { g: "Xsat", s: [ses("SAT", 480, 600)] },
          { g: "Xfri-early", s: [ses("FRI", 420, 540)] },
          { g: "Xfri-late", s: [ses("FRI", 600, 720)] },
        ]),
      ],
      { freeDays: ["SAT"], noClassBefore: 480 },
    );
    expect(res.combos).toHaveLength(1);
    expect(res.combos[0].picks[0].group).toBe("Xfri-late");
  });

  it("respects locked groups", () => {
    const res = generate(
      [
        subject("A", [
          { g: "A1", s: [ses("MON", 480, 600)] },
          { g: "A2", s: [ses("MON", 600, 720)] },
        ], "A2"),
      ],
      {},
    );
    expect(res.combos).toHaveLength(1);
    expect(res.combos[0].picks[0].group).toBe("A2");
  });

  it("filters by programme substring", () => {
    const res = generate(
      [
        subject("A", [
          { g: "A1", s: [ses("MON", 480, 600)], p: "CS240" },
          { g: "A2", s: [ses("MON", 480, 600)], p: "BA110" },
        ]),
      ],
      { programme: "cs240" },
    );
    expect(res.combos).toHaveLength(1);
    expect(res.combos[0].picks[0].group).toBe("A1");
  });

  it("ranks compact by fewest days, then fewest gap minutes", () => {
    // Two valid ways: 1 day with a 2h gap, or spread over 2 days.
    const res = generate(
      [
        subject("A", [
          { g: "A1", s: [ses("MON", 480, 540)] },
          { g: "A2", s: [ses("TUE", 480, 540)] },
        ]),
        subject("B", [
          { g: "B1", s: [ses("MON", 660, 720)] },
        ]),
      ],
      {},
      "compact",
    );
    expect(res.combos.length).toBe(2);
    // A1+B1 = 1 day, 120min gap beats A2+B1 = 2 days, 0 gap.
    expect(res.combos[0].picks.map((p) => p.group).sort()).toEqual(["A1", "B1"]);
    expect(res.combos[0].stats.days).toBe(1);
    expect(res.combos[0].stats.gapMinutes).toBe(120);
  });

  it("reports the subject pair that blocks the most when impossible", () => {
    const res = generate([
      subject("A", [
        { g: "A1", s: [ses("MON", 480, 600)] },
        { g: "A2", s: [ses("MON", 540, 660)] },
      ]),
      subject("B", [
        { g: "B1", s: [ses("MON", 480, 660)] },
        { g: "B2", s: [ses("MON", 480, 660)] },
      ]),
      subject("C", [{ g: "C1", s: [ses("WED", 480, 540)] }]),
    ]);
    expect(res.combos).toHaveLength(0);
    expect(res.blocker).toMatchObject({ a: "A", b: "B" });
    expect(res.blocker!.clashes).toBe(4);
  });

  it("stops at the 5000-combo cap and still returns ranked results", () => {
    // 14 non-clashing slots x 5 subjects → ~537k valid combos, capped at 5000.
    const slots: Session[] = [];
    for (const day of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const) {
      slots.push(ses(day, 480, 780), ses(day, 780, 1080));
    }
    const subjects = [0, 1, 2, 3, 4].map((i) =>
      subject(
        `S${i}`,
        slots.map((s, j) => ({ g: `G${j}`, s: [s] })),
      ),
    );
    const res = generate(subjects, {}, "compact", 20);
    expect(res.capped).toBe(true);
    expect(res.combos).toHaveLength(20);
    // Results are ranked: day counts are non-decreasing and stats are sane.
    for (const c of res.combos) {
      expect(c.stats.days).toBeGreaterThanOrEqual(1);
      expect(c.stats.gapMinutes).toBeGreaterThanOrEqual(0);
      expect(c.stats.latest).toBeGreaterThan(c.stats.earliest);
    }
    expect(res.combos[0].stats.days).toBeLessThanOrEqual(res.combos[19].stats.days);
  });
});
