import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  cellText,
  parseFacultyList,
  parseGroupRows,
  parseIdText,
  parseIndex,
} from "./icress.ts";
import { normalizeRegistered } from "./api.ts";
import { toSessions } from "../src/lib/normalize.ts";
import { parseDayTime } from "../src/lib/time.ts";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf-8");

const FINAL_URL = "https://simsweb4.uitm.edu.my/estudent/class_timetable/index_20264.cfm";

describe("parseIndex", () => {
  it("extracts hidden inputs, JS token assignments, ajax + campus URLs, and the session code", async () => {
    const html = await fixture("icress-index.html");
    const scraps = parseIndex(html, FINAL_URL);

    // Hidden inputs (initial values).
    expect(scraps.tokens["captcha_no_type"]).toBe("llIlllIlIIllIlIIIIlllIlIll");

    // JS assignments overwrite the HTML values, mapped id → name.
    expect(scraps.tokens["token1"]).toBe("lIIlllIlIllIllIIIIIlIlllllIlIll");
    expect(scraps.tokens["captcha1"]).toBe("lIIlllIlIllIllIIIIIlIlllllIlIll");
    expect(scraps.tokens["lIIlIlllIlIIllIlIIIIlllIlIllI"]).toBe("lIIlIlllIlIIllIlIIIIlllIlIlllI");

    // Ajax URLs pulled out of the inline scripts.
    expect(scraps.indexResultLocation).toBe(
      "index_20264_result.cfm?id1=607805264262&id2=405202189356&id3=607803301545",
    );
    expect(scraps.campusSelectLocation).toBe("cfc/select.cfc?method=CAM_lII1II11I1lIIII11IIl1I111II");

    expect(scraps.sessionCode).toBe("20264");
    expect(scraps.indexLocation).toBe(FINAL_URL);
  });
});

describe("parseGroupRows", () => {
  it("parses AAA400 rows with clean cell text", async () => {
    const html = await fixture("icress-groups-AAA400.html");
    const rows = parseGroupRows(html);

    expect(rows).toHaveLength(9);

    const a1 = rows[0];
    expect(a1.group).toBe("BE2431A");
    expect(a1.day_time).toBe("TUESDAY ( 09:00 AM-10:00 AM )");
    // The reference produced "Fulltimeand" — tags must become spaces.
    expect(a1.mode).toBe("BOTH - Fulltime and Part-time");
    expect(a1.status).toBe("First Timer and Repeater");
    expect(a1.room).toBe("AP1123");
    expect(a1.program).toBe("BE243,CFAP243");
    expect(a1.faculty).toBe("BE,CF");

    const b = rows.filter((r) => r.group === "BE2431B");
    expect(b).toHaveLength(5);
    expect(b[0].room).toBe("AP1134");
    expect(b[0].mode).toBe("BOTH - Fulltime and Part-time");
  });

  it("parses the 6-column M3 (Kampus Jasin) layout with no program/faculty columns", async () => {
    const html = await fixture("icress-groups-itt569-m3.html");
    const rows = parseGroupRows(html);

    expect(rows).toHaveLength(15);
    const groups = [...new Set(rows.map((r) => r.group))];
    expect(groups).toEqual(
      expect.arrayContaining([
        "M3CS2666A",
        "M3CS2666AB",
        "M3CS2666B",
        "M3CS2666C",
        "M3CS2554A",
        "M3CS2554B",
        "M3CS2554C",
        "M3CS2514A",
      ]),
    );

    const a = rows[0];
    expect(a.group).toBe("M3CS2666A");
    expect(a.day_time).toBe("MONDAY ( 14:00 PM-16:00 PM )");
    expect(a.mode).toBe("BOTH - Fulltime and Part-time");
    expect(a.status).toBe("First Timer and Repeater");

    // This campus table has no ONLY FOR PROGRAM / ONLY FOR FACULTY columns.
    for (const r of rows) {
      expect(r.program).toBe("");
      expect(r.faculty).toBe("");
    }

    // Rooms are still picked up where present.
    expect(rows.find((r) => r.group === "M3CS2554B")!.room).toBe("MAKMAL KOMPUTER 6");
  });

  it("feeds into toSessions: BE2431B Tuesday merges into 09:00–13:00", async () => {
    const html = await fixture("icress-groups-AAA400.html");
    const blocks = toSessions(parseGroupRows(html));

    const b = blocks.find((x) => x.group === "BE2431B");
    expect(b).toBeDefined();
    // Tuesday rows (9-10, 9-11, 9-13, 10-12) collapse into one session.
    const tue = b!.sessions.filter((s) => s.day === "TUE");
    expect(tue).toHaveLength(1);
    expect(tue[0].start).toBe(9 * 60);
    expect(tue[0].end).toBe(13 * 60);
    expect(tue[0].room).toBe("AP1134");
    expect(b!.sessions.find((s) => s.day === "FRI")).toMatchObject({ start: 540, end: 660 });

    const a = blocks.find((x) => x.group === "BE2431A")!;
    expect(a.programs).toEqual(["BE243,CFAP243"]);
    const aTue = a.sessions.find((s) => s.day === "TUE")!;
    expect(aTue.start).toBe(540);
    expect(aTue.end).toBe(720);

    // The merged sessions are real parseable slots.
    for (const s of b!.sessions) expect(s.end).toBeGreaterThan(s.start);
  });
});

describe("parseFacultyList", () => {
  it("parses the <br>-separated faculty list", async () => {
    const text = await fixture("icress-faculties.txt");
    const faculties = parseFacultyList(text);
    expect(faculties.length).toBeGreaterThanOrEqual(25);
    expect(faculties).toContainEqual({ id: "CS", text: "FACULTY OF COMPUTER AND MATHEMATICAL SCIENCES" });
    expect(faculties[0]).toEqual({ id: "AA", text: "ARSHAD AYUB GRADUATE BUSINESS SCHOOL" });
  });
});

describe("parseIdText", () => {
  it("handles select2 JSON and <br>-separated text", () => {
    expect(parseIdText('{"results":[{"id":"B","text":"UiTM SHAH ALAM"}]}')).toEqual([
      { id: "B", text: "UiTM SHAH ALAM" },
    ]);
    expect(parseIdText("AA - ARSHAD AYUB<br>CS - COMPUTING")).toEqual([
      { id: "AA", text: "ARSHAD AYUB" },
      { id: "CS", text: "COMPUTING" },
    ]);
  });
});

describe("cellText", () => {
  it("turns tags into spaces and decodes entities", () => {
    expect(cellText("BOTH - Fulltime<br>and Part-time")).toBe("BOTH - Fulltime and Part-time");
    expect(cellText("A&nbsp;&amp;&nbsp;B")).toBe("A & B");
  });
});

describe("normalizeRegistered", () => {
  it("normalizes the matric feed and dedupes rows", () => {
    const feed = {
      a: { hari: "ISNIN", jadual: [
        { masa: "10:00 AM-12:00 PM", courseid: "CSC404", bilik: "DK1", lecturer: "DR A", groups: "CS2403A" },
        { masa: "10:00 AM-12:00 PM", courseid: "CSC404", bilik: "DK1", lecturer: "DR A", groups: "CS2403A" },
      ] },
      b: { hari: "SELASA", jadual: [
        { masa: "08:00 AM-10:00 AM", courseid: "MAT406", bilik: "AP1", lecturer: "", groups: "CS2403A" },
      ] },
    };
    const rows = normalizeRegistered(feed);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      course: "CSC404",
      group: "CS2403A",
      day_time: "ISNIN( 10:00 AM-12:00 PM )",
      room: "DK1",
      lecturer: "DR A",
    });
    // And the normalized day_time parses (Malay day names).
    expect(parseDayTime(rows[0].day_time)).toEqual({ day: "MON", start: 600, end: 720 });
  });
});
