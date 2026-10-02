import { describe, expect, it } from "vitest";
import { DEVICES, deviceById, deviceSize } from "./devices.ts";

describe("device table", () => {
  it("every preset has positive dimensions and dpr", () => {
    for (const d of DEVICES) {
      expect(d.w, d.id).toBeGreaterThan(0);
      expect(d.h, d.id).toBeGreaterThan(0);
      expect(d.dpr, d.id).toBeGreaterThan(0);
    }
  });

  it("landscape swaps w/h for rotatable devices", () => {
    const ipad = deviceById("ipad-pro-13")!;
    expect(ipad.canRotate).toBe(true);
    expect(deviceSize(ipad, false)).toEqual({ w: 2064, h: 2752 });
    expect(deviceSize(ipad, true)).toEqual({ w: 2752, h: 2064 });
    // non-rotatable devices ignore the flag
    const pc = deviceById("pc-fhd")!;
    expect(deviceSize(pc, true)).toEqual({ w: 1920, h: 1080 });
    // phones rotate too
    expect(deviceSize(deviceById("iphone-16-pro-max")!, true)).toEqual({ w: 2868, h: 1320 });
  });

  it("contains the required exact sizes", () => {
    expect(deviceById("iphone-16-pro-max")).toMatchObject({ w: 1320, h: 2868, dpr: 3 });
    expect(deviceById("pc-fhd")).toMatchObject({ w: 1920, h: 1080, dpr: 1 });
    expect(deviceById("a4-portrait")).toMatchObject({ w: 2480, h: 3508 });
  });
});
