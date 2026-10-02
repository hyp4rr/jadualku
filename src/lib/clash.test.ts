import { describe, expect, it } from "vitest";
import { clashesFor, clashedSessionKeys, findClashes, type ClashEntry } from "./clash.ts";
import type { Session } from "./types.ts";

const ses = (day: Session["day"], start: number, end: number): Session => ({ day, start, end, room: "" });

const entry = (id: string, sessions: Session[], hidden = false): ClashEntry => ({
  id,
  subjectCode: id.toUpperCase(),
  group: `${id.toUpperCase()}1`,
  sessions,
  hidden,
});

describe("findClashes", () => {
  it("reports overlapping sessions from different entries with the overlap window", () => {
    const clashes = findClashes([
      entry("a", [ses("TUE", 600, 720)]),
      entry("b", [ses("TUE", 660, 780)]),
    ]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ day: "TUE", start: 660, end: 720 });
  });

  it("adjacent sessions are not a clash", () => {
    expect(
      findClashes([entry("a", [ses("TUE", 600, 660)]), entry("b", [ses("TUE", 660, 720)])]),
    ).toHaveLength(0);
  });

  it("sessions inside the same entry never clash with each other", () => {
    expect(
      findClashes([entry("a", [ses("TUE", 600, 720), ses("TUE", 660, 780)])]),
    ).toHaveLength(0);
  });

  it("hidden entries are excluded", () => {
    expect(
      findClashes([
        entry("a", [ses("TUE", 600, 720)]),
        entry("b", [ses("TUE", 660, 780)], true),
      ]),
    ).toHaveLength(0);
  });

  it("different days never clash", () => {
    expect(
      findClashes([entry("a", [ses("TUE", 600, 720)]), entry("b", [ses("WED", 660, 780)])]),
    ).toHaveLength(0);
  });
});

describe("clashesFor", () => {
  it("finds collisions between a candidate and existing entries, honoring ignoreEntryId", () => {
    const entries = [entry("a", [ses("MON", 480, 600)]), entry("b", [ses("MON", 540, 660)])];
    const found = clashesFor(entries, [ses("MON", 570, 630)], "a");
    expect(found).toHaveLength(1);
    expect(found[0].entry.id).toBe("b");
    expect(found[0]).toMatchObject({ start: 570, end: 630 });
  });
});

describe("clashedSessionKeys", () => {
  it("marks every session involved in a clash", () => {
    const keys = clashedSessionKeys([
      entry("a", [ses("TUE", 600, 720)]),
      entry("b", [ses("TUE", 660, 780), ses("WED", 480, 540)]),
    ]);
    expect(keys.has("a:0")).toBe(true);
    expect(keys.has("b:0")).toBe(true);
    expect(keys.has("b:1")).toBe(false);
  });
});
