import { describe, expect, it } from "vitest";
import { toSessions, type RawRow } from "./normalize.ts";

const row = (day_time: string, group: string, room = "", extra: Partial<RawRow> = {}): RawRow => ({
  day_time,
  group,
  mode: "Fulltime",
  status: "First Timer",
  room,
  program: "CS240",
  faculty: "CS",
  ...extra,
});

describe("toSessions", () => {
  it("groups rows by group code and merges strictly overlapping intervals", () => {
    const blocks = toSessions([
      row("TUE( 09:00 AM-10:00 AM )", "G1", "R1"),
      row("TUE( 09:00 AM-11:00 AM )", "G1", "R1"),
      row("TUE( 10:00 AM-12:00 PM )", "G1", "R2"),
      row("TUE( 09:00 AM-01:00 PM )", "G1", "R1"),
      row("WED( 08:00 AM-09:00 AM )", "G2", "R9"),
    ]);
    const g1 = blocks.find((b) => b.group === "G1")!;
    expect(g1.sessions).toHaveLength(1);
    expect(g1.sessions[0]).toMatchObject({ day: "TUE", start: 540, end: 780 });
    expect(g1.sessions[0].room).toBe("R1 / R2");
    const g2 = blocks.find((b) => b.group === "G2")!;
    expect(g2.sessions).toHaveLength(1);
  });

  it("keeps touching intervals separate", () => {
    const blocks = toSessions([
      row("MON( 08:00 AM-10:00 AM )", "G1", "R1"),
      row("MON( 10:00 AM-12:00 PM )", "G1", "R1"),
    ]);
    expect(blocks[0].sessions).toHaveLength(2);
    expect(blocks[0].sessions.map((s) => s.start)).toEqual([480, 600]);
  });

  it("joins rooms uniquely in encounter order and keeps programmes/mode/status", () => {
    const blocks = toSessions([
      row("MON( 08:00 AM-10:00 AM )", "G1", "A"),
      row("MON( 09:00 AM-11:00 AM )", "G1", "B"),
      row("MON( 10:00 AM-11:00 AM )", "G1", "A"),
      row("FRI( 08:00 AM-09:00 AM )", "G1", "C", { program: "CS241" }),
    ]);
    const g1 = blocks[0];
    const mon = g1.sessions.find((s) => s.day === "MON")!;
    expect(mon.room).toBe("A / B");
    expect(g1.programs).toEqual(["CS240", "CS241"]);
    expect(g1.mode).toBe("Fulltime");
    expect(g1.status).toBe("First Timer");
  });

  it("drops unparseable rows and empty group codes", () => {
    const blocks = toSessions([row("garbage", "G1"), row("MON( 08:00 AM-09:00 AM )", "  ")]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].sessions).toHaveLength(0);
  });
});
