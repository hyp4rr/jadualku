import { describe, expect, it } from "vitest";
import type { Plan } from "./types.ts";
import { decodeBackup, decodePlan, encodeBackup, encodePlan, validatePayload } from "./share.ts";
import { DEFAULT_THEME } from "./theme.ts";

const plan: Plan = {
  id: "p1",
  name: "Sem 20264",
  createdAt: 1,
  updatedAt: 2,
  entries: [
    {
      id: "e1",
      subjectCode: "AAA400",
      subjectName: "Tamadun",
      group: "BE2431A",
      campus: "A",
      sessions: [{ day: "TUE", start: 9 * 60, end: 13 * 60, room: "AP1134" }],
      color: "#2563eb",
      lecturer: "Dr. X",
      credits: 3,
      source: "icress",
    },
  ],
};

describe("share encode/decode", () => {
  it("round-trips a plan through deflate+base64url", async () => {
    const payload = await encodePlan(plan, DEFAULT_THEME);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = await decodePlan(payload);
    expect(back.name).toBe("Sem 20264");
    expect(back.entries).toHaveLength(1);
    expect(back.entries[0].code).toBe("AAA400");
    expect(back.entries[0].sessions[0]).toMatchObject({ d: "TUE", s: 540, e: 780, r: "AP1134" });
    expect(back.theme?.presetId).toBe(DEFAULT_THEME.presetId);
  });

  it("rejects garbage and malformed payloads", async () => {
    await expect(decodePlan("!!!not-base64")).rejects.toThrow();
    await expect(decodePlan("eJyrVkrLz1eyUkpKLFKqBQAdegQ4")).rejects.toThrow(); // {"v":2} wrong version
    // oversized payload string rejected early (>200KB encoded)
    await expect(decodePlan("A".repeat(201 * 1024))).rejects.toThrow();
  });

  it("rejects decoded payloads over 200KB", async () => {
    const huge = { v: 1, name: "x", entries: [] as unknown[], pad: "x".repeat(250 * 1024) };
    const bytes = new TextEncoder().encode(JSON.stringify(huge));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const packed = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    for (const b of packed) bin += String.fromCharCode(b);
    const b64 = btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    await expect(decodePlan(b64)).rejects.toThrow(/large/i);
  });

  it("validatePayload rejects bad days, times and shapes", () => {
    const base = { v: 1, name: "p", entries: [{ code: "AAA400", group: "A", sessions: [{ d: "MON", s: 60, e: 120 }] }] };
    expect(() => validatePayload(base)).not.toThrow();
    expect(() => validatePayload({ ...base, entries: [{ ...base.entries[0], sessions: [{ d: "XX", s: 60, e: 120 }] }] })).toThrow(/day/i);
    expect(() => validatePayload({ ...base, entries: [{ ...base.entries[0], sessions: [{ d: "MON", s: "nine", e: 120 }] }] })).toThrow(/numeric/i);
    expect(() => validatePayload({ ...base, entries: [{ ...base.entries[0], sessions: [{ d: "MON", s: 120, e: 60 }] }] })).toThrow(/range/i);
    expect(() => validatePayload({ ...base, entries: [{ ...base.entries[0], sessions: [{ d: "MON", s: -5, e: 60 }] }] })).toThrow(/range/i);
    expect(() => validatePayload(null)).toThrow();
    expect(() => validatePayload([1, 2])).toThrow();
    expect(() => validatePayload({ v: 1, name: "p", entries: [{ code: "AAA400", group: "A", sessions: [] }] })).toThrow();
  });
});

describe("backup encode/decode", () => {
  let id = 0;
  const newId = () => `id${id++}`;

  it("round-trips plans and themes", () => {
    const json = encodeBackup({ plans: [plan], theme: DEFAULT_THEME });
    const back = decodeBackup(json, newId);
    expect(back.plans).toHaveLength(1);
    expect(back.plans[0].entries[0].subjectCode).toBe("AAA400");
    expect(back.plans[0].entries[0].sessions[0].day).toBe("TUE");
    expect(back.theme?.presetId).toBe(DEFAULT_THEME.presetId);
    // fresh ids assigned
    expect(back.plans[0].id).not.toBe("p1");
  });

  it("rejects non-backup JSON", () => {
    expect(() => decodeBackup('{"hello":1}', newId)).toThrow(/backup/i);
    expect(() => decodeBackup("not json", newId)).toThrow();
    expect(() =>
      decodeBackup(JSON.stringify({ v: 1, plans: [{ name: "x", entries: [{ subjectCode: "A", group: "g", sessions: [{ day: "XX", start: 1, end: 2 }] }] }] }), newId),
    ).toThrow();
  });
});
