import { describe, expect, it } from "vitest";
import { fmt12, fmt24, fmtRangeCompact, parseDayTime } from "./time.ts";

describe("parseDayTime", () => {
  it("parses iCress formats", () => {
    expect(parseDayTime("TUESDAY( 09:00 AM-13:00 PM )")).toEqual({ day: "TUE", start: 540, end: 780 });
    expect(parseDayTime("FRIDAY(08:00AM-10:00AM)")).toEqual({ day: "FRI", start: 480, end: 600 });
    expect(parseDayTime("TUESDAY ( 09:00 AM-10:00 AM )")).toEqual({ day: "TUE", start: 540, end: 600 });
    expect(parseDayTime("Monday 08:00-10:00")).toEqual({ day: "MON", start: 480, end: 600 });
    expect(parseDayTime("MON 0800-1000")).toEqual({ day: "MON", start: 480, end: 600 });
  });

  it("parses the matric feed's bare range with a day hint (English or Malay)", () => {
    expect(parseDayTime("10:00 AM-12:00 PM", "Friday")).toEqual({ day: "FRI", start: 600, end: 720 });
    expect(parseDayTime("10:00 AM-12:00 PM", "SELASA")).toEqual({ day: "TUE", start: 600, end: 720 });
    expect(parseDayTime("JUMAAT( 02:00 PM-04:00 PM )")).toEqual({ day: "FRI", start: 840, end: 960 });
  });

  it("applies the PM rule: add 12 only when h < 12", () => {
    expect(parseDayTime("TUE( 13:00 PM-15:00 PM )")).toEqual({ day: "TUE", start: 780, end: 900 });
    expect(parseDayTime("TUE( 12:00 PM-01:00 PM )")).toEqual({ day: "TUE", start: 720, end: 780 });
    expect(parseDayTime("TUE( 12:30 AM-02:00 AM )")).toEqual({ day: "TUE", start: 30, end: 120 });
    expect(parseDayTime("TUE( 12:00 AM-12:59 AM )")).toEqual({ day: "TUE", start: 0, end: 59 });
  });

  it("returns null for garbage instead of inventing a default", () => {
    expect(parseDayTime("hello")).toBeNull();
    expect(parseDayTime("TUESDAY( bananas )")).toBeNull();
    expect(parseDayTime("")).toBeNull();
    expect(parseDayTime("TUE( 10:00 AM-09:00 AM )")).toBeNull();
    expect(parseDayTime("99:99 AM", "MON")).toBeNull();
  });
});

describe("formatters", () => {
  it("formats 12h and 24h", () => {
    expect(fmt24(0)).toBe("00:00");
    expect(fmt24(780)).toBe("13:00");
    expect(fmt12(0)).toBe("12:00 AM");
    expect(fmt12(540)).toBe("9:00 AM");
    expect(fmt12(720)).toBe("12:00 PM");
    expect(fmt12(780)).toBe("1:00 PM");
    expect(fmtRangeCompact(540, 780)).toBe("9:00–13:00");
  });
});
