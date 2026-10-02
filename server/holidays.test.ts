import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHolidayIcs } from "./holidays.ts";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "malaysia-holidays.ics");
const holidays = parseHolidayIcs(readFileSync(FIXTURE, "utf8"));

const on = (date: string) => holidays.filter((h) => h.date === date);

describe("parseHolidayIcs (fixture)", () => {
  it("parses a useful number of events", () => {
    expect(holidays.length).toBeGreaterThan(200);
  });

  it("Christmas Day 2026-12-25 is national", () => {
    const x = on("2026-12-25").find((h) => h.name === "Christmas Day");
    expect(x).toBeDefined();
    expect(x!.states).toBe("all");
  });

  it("Isra and Mi'raj 2027-01-06 is regional (Kedah, Negeri Sembilan, Perlis, Terengganu) and tentative", () => {
    const h = on("2027-01-06").find((x) => x.name === "Isra and Mi'raj");
    expect(h).toBeDefined();
    expect(h!.states).toEqual(["Kedah", "Negeri Sembilan", "Perlis", "Terengganu"]);
    expect(h!.tentative).toBe(true);
  });

  it("Christmas Eve 2026-12-24 is absent (observance)", () => {
    expect(on("2026-12-24").find((h) => h.name === "Christmas Eve")).toBeUndefined();
  });

  it("Diwali 2026-11-08 is regional and excludes Sarawak", () => {
    const h = on("2026-11-08").find((x) => x.name === "Diwali");
    expect(h).toBeDefined();
    expect(h!.states).not.toBe("all");
    expect((h!.states as string[]).includes("Selangor")).toBe(true);
    expect((h!.states as string[]).includes("Sarawak")).toBe(false);
  });

  it("names are cleaned of markers", () => {
    expect(holidays.every((h) => !/\(regional holiday\)|\(tentative\)/i.test(h.name))).toBe(true);
  });
});
