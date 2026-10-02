import { describe, expect, it } from "vitest";
import { applyBackdrop, backdropKind, DEFAULT_THEME, hasBackdrop, luminance, PRESETS, resolveTheme, type ThemeSettings } from "./theme.ts";
import { sanitizeTheme } from "./share.ts";

const paper = PRESETS.find((p) => p.id === "paper")!.settings;
const withBg = (over: Partial<ThemeSettings>): ThemeSettings => ({ ...DEFAULT_THEME, ...over });

describe("resolveTheme (dark / light mode)", () => {
  it("leaves the theme untouched in 'theme' mode", () => {
    expect(resolveTheme(DEFAULT_THEME, false)).toBe(DEFAULT_THEME);
  });

  it("forces light on a dark preset and dark on a light preset", () => {
    const light = resolveTheme({ ...DEFAULT_THEME, mode: "light" }, true);
    expect(luminance(light.background)).toBeGreaterThan(0.5);
    expect(luminance(light.text)).toBeLessThan(0.2);
    const dark = resolveTheme({ ...paper, mode: "dark" }, false);
    expect(luminance(dark.background)).toBeLessThan(0.1);
    expect(luminance(dark.text)).toBeGreaterThan(0.5);
  });

  it("keeps the accent and palette when swapping", () => {
    const light = resolveTheme({ ...DEFAULT_THEME, mode: "light" }, true);
    expect(light.accent).toBe(DEFAULT_THEME.accent);
    expect(light.palette).toEqual(DEFAULT_THEME.palette);
  });

  it("'app' follows the app's dark switch and is a no-op when already matching", () => {
    expect(luminance(resolveTheme({ ...DEFAULT_THEME, mode: "app" }, false).background)).toBeGreaterThan(0.5);
    const same = { ...DEFAULT_THEME, mode: "app" as const };
    expect(resolveTheme(same, true)).toBe(same);
  });
});

describe("backdrop", () => {
  it("only counts an image as a backdrop when one is present", () => {
    expect(backdropKind(withBg({ bgKind: "image" }))).toBe("color");
    expect(backdropKind(withBg({ bgKind: "image", backgroundImage: "data:image/jpeg;base64,AAAA" }))).toBe("image");
    expect(backdropKind(withBg({ backgroundImage: "data:image/jpeg;base64,AAAA" }))).toBe("image");
    expect(hasBackdrop(DEFAULT_THEME)).toBe(false);
    expect(hasBackdrop(withBg({ bgPattern: "dots" }))).toBe(true);
  });

  it("returns null without a backdrop", () => {
    expect(applyBackdrop(DEFAULT_THEME)).toBeNull();
  });

  it("flips text to light over a dark photo even for a light theme", () => {
    const bd = applyBackdrop({ ...paper, bgKind: "image", backgroundImage: "data:image/jpeg;base64,AAAA", bgLum: 0.05, panelOpacity: 0, backgroundDim: 0.3 })!;
    expect(bd.grid.text).toBe("#f5f7fb");
    expect(bd.titleColor).toBe("#f5f7fb");
    expect(bd.grid.background).toBe("transparent");
  });

  it("uses dark text over a bright gradient and respects autoText=false", () => {
    const bright = { ...DEFAULT_THEME, bgKind: "gradient" as const, bgGradient: { from: "#fef3c7", to: "#fdba74", angle: 90 }, panelOpacity: 0 };
    expect(applyBackdrop(bright)!.grid.text).toBe("#14161c");
    expect(applyBackdrop({ ...bright, autoText: false })!.grid.text).toBe(DEFAULT_THEME.text);
  });

  it("an opaque panel keeps the theme's own text colours", () => {
    const bd = applyBackdrop({ ...DEFAULT_THEME, bgKind: "gradient", bgGradient: { from: "#fef3c7", to: "#fdba74", angle: 90 }, panelOpacity: 1 })!;
    expect(bd.grid.text).toBe(DEFAULT_THEME.text);
  });
});

describe("sanitizeTheme backdrop fields", () => {
  it("keeps valid values and drops invalid ones", () => {
    const t = sanitizeTheme({
      ...DEFAULT_THEME,
      mode: "dark",
      bgKind: "gradient",
      bgGradient: { from: "#112233", to: "#445566", angle: 999 },
      bgFit: "nonsense",
      bgZoom: 9,
      bgBlur: -4,
      bgPattern: "grid",
      panelOpacity: 0.4,
    });
    expect(t.mode).toBe("dark");
    expect(t.bgGradient).toEqual({ from: "#112233", to: "#445566", angle: 360 });
    expect(t.bgFit).toBeUndefined();
    expect(t.bgZoom).toBe(3);
    expect(t.bgBlur).toBe(0);
    expect(t.bgPattern).toBe("grid");
    expect(t.panelOpacity).toBe(0.4);
  });

  it("old themes without the new fields still load", () => {
    const t = sanitizeTheme({ ...DEFAULT_THEME });
    expect(t.mode).toBeUndefined();
    expect(t.background).toBe(DEFAULT_THEME.background);
  });
});
