// Theme system: presets, self-hosted lazy fonts, and contrast helpers.
// The timetable grid/agenda take a ThemeSettings prop so exports and compare
// can render any theme without touching the store.

export type BlockStyle = "solid" | "soft" | "outline" | "gradient" | "glass";
export type Layout = "grid" | "agenda";
export type Orientation = "days-columns" | "days-rows";
export type TimeFormat = "12h" | "24h";
export type WeekendMode = "auto" | "always" | "never";

export type FontId =
  | "jakarta"
  | "inter"
  | "outfit"
  | "spaceGrotesk"
  | "nunito"
  | "fraunces"
  | "jetbrains"
  | "caveat"
  | "dmSans";

export interface ThemeShow {
  code: boolean;
  name: boolean;
  group: boolean;
  room: boolean;
  time: boolean;
  lecturer: boolean;
}

export interface ThemeSettings {
  presetId: string;
  background: string;
  surface: string;
  gridLine: string;
  headerBg: string;
  headerText: string;
  text: string;
  mutedText: string;
  accent: string;
  /** Subject block colour cycle; per-entry Entry.color still overrides. */
  palette: string[];
  blockStyle: BlockStyle;
  /** Corner radius 0–20 px. */
  radius: number;
  font: FontId;
  /** 0.8–1.4 */
  fontScale: number;
  show: ThemeShow;
  timeFormat: TimeFormat;
  /** "grid" = weekly grid, "agenda" = per-day card list (great for phones). */
  layout: Layout;
  /** grid only: days as columns (classic) or rows. */
  orientation: Orientation;
  weekend: WeekendMode;
  title: string;
  subtitle: string;
  showTitle: boolean;
  /** dataURL, downscaled client-side to ≤1600px JPEG before storing. */
  backgroundImage?: string;
  /** 0–0.9 darkening overlay over the background image. */
  backgroundDim: number;

  // ---- Optional extras (all default sensibly when absent, so old saved themes keep working) ----
  /** "theme" = colours as authored; dark/light force a variant; "app" follows the app's dark/light toggle. */
  mode?: ThemeMode;
  bgKind?: BgKind;
  bgGradient?: { from: string; to: string; angle: number };
  bgFit?: BgFit;
  /** Focal point 0–100 (%). */
  bgX?: number;
  bgY?: number;
  /** 1–3 */
  bgZoom?: number;
  /** 0–24 px at 1600px canvas width. */
  bgBlur?: number;
  /** Colour of the dim overlay (default black). */
  bgTint?: string;
  bgPattern?: BgPattern;
  /** Exports: draw the backdrop across the whole canvas (incl. wallpaper safe zones) or only behind the timetable. */
  bgScope?: "canvas" | "view";
  /** Opacity of the frosted panel behind the grid when a backdrop is active (0–1). */
  panelOpacity?: number;
  /** Frosted-glass blur of that panel in px. */
  panelBlur?: number;
  /** Measured average luminance of the uploaded image (0–1), used for automatic text contrast. */
  bgLum?: number;
  /** Auto-pick readable text colours over the backdrop (default on). */
  autoText?: boolean;
}

export type ThemeMode = "theme" | "dark" | "light" | "app";
export type BgKind = "color" | "gradient" | "image";
export type BgFit = "cover" | "contain" | "stretch" | "tile";
export type BgPattern = "none" | "dots" | "grid" | "lines";

// ---- Fonts (lazy) ----
// Only the UI fonts are bundled; the rest load on demand via dynamic import().

export interface FontDef {
  id: FontId;
  label: string;
  family: string;
  load: () => Promise<unknown>;
}

export const FONTS: FontDef[] = [
  {
    id: "jakarta",
    label: "Plus Jakarta Sans",
    family: '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif',
    load: () => import("@fontsource-variable/plus-jakarta-sans/index.css"),
  },
  {
    id: "inter",
    label: "Inter",
    family: '"Inter Variable", Inter, system-ui, sans-serif',
    load: () => import("@fontsource-variable/inter/index.css"),
  },
  {
    id: "outfit",
    label: "Outfit",
    family: '"Outfit Variable", Outfit, system-ui, sans-serif',
    load: () => import("@fontsource-variable/outfit/index.css"),
  },
  {
    id: "spaceGrotesk",
    label: "Space Grotesk",
    family: '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif',
    load: () => import("@fontsource-variable/space-grotesk/index.css"),
  },
  {
    id: "nunito",
    label: "Nunito",
    family: '"Nunito Variable", Nunito, system-ui, sans-serif',
    load: () => import("@fontsource-variable/nunito/index.css"),
  },
  {
    id: "fraunces",
    label: "Fraunces",
    family: '"Fraunces Variable", Fraunces, Georgia, serif',
    load: () => import("@fontsource-variable/fraunces/index.css"),
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    family: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
    load: () => import("@fontsource-variable/jetbrains-mono/index.css"),
  },
  {
    id: "caveat",
    label: "Caveat",
    family: '"Caveat Variable", Caveat, cursive',
    load: () => import("@fontsource-variable/caveat/index.css"),
  },
  {
    id: "dmSans",
    label: "DM Sans",
    family: '"DM Sans Variable", "DM Sans", system-ui, sans-serif',
    load: () => import("@fontsource-variable/dm-sans/index.css"),
  },
];

const loadedFonts = new Set<FontId>();

export async function loadFont(id: FontId): Promise<void> {
  if (loadedFonts.has(id)) return;
  const def = FONTS.find((f) => f.id === id) ?? FONTS[0];
  await def.load();
  loadedFonts.add(def.id);
}

export function fontFamily(id: FontId): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).family;
}

// ---- Colour math ----

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** t fraction of `b` blended into `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

/** WCAG relative luminance 0..1 */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

const LIGHT_TEXT = "#f5f7fb";
const DARK_TEXT = "#14161c";

/** Picks a readable text colour for a given background. */
export function textOn(bg: string): string {
  return luminance(bg) > 0.34 ? DARK_TEXT : LIGHT_TEXT;
}

export interface BlockColors {
  /** CSS background value */
  bg: string;
  /** main text colour on the block */
  fg: string;
  /** secondary text colour on the block */
  muted: string;
  /** CSS border value */
  border: string;
  /** effective (flattened) bg hex, used for stripe contrast */
  effective: string;
}

/** Resolves a block's colours for a style × subject colour × theme. */
export function blockColors(theme: ThemeSettings, color: string): BlockColors {
  const surface = theme.surface;
  switch (theme.blockStyle) {
    case "solid": {
      return { bg: color, fg: textOn(color), muted: textOn(color), effective: color, border: color };
    }
    case "gradient": {
      const deep = mixHex(color, "#000000", 0.32);
      const bg = `linear-gradient(160deg, ${color}, ${deep})`;
      const eff = mixHex(color, "#000000", 0.15);
      return { bg, fg: textOn(eff), muted: textOn(eff), effective: eff, border: deep };
    }
    case "glass": {
      const eff = mixHex(surface, color, 0.38);
      return {
        bg: `color-mix(in oklab, ${color} 34%, transparent)`,
        fg: textOn(eff),
        muted: textOn(eff),
        effective: eff,
        border: `color-mix(in oklab, ${color} 65%, transparent)`,
      };
    }
    case "outline": {
      const fg = textOn(surface);
      return { bg: surface, fg, muted: fg, effective: surface, border: color };
    }
    case "soft":
    default: {
      const eff = mixHex(surface, color, 0.22);
      const fg = textOn(eff);
      return { bg: eff, fg, muted: fg, effective: eff, border: `color-mix(in oklab, ${color} 70%, ${eff})` };
    }
  }
}

// ---- Defaults & presets ----

export const DEFAULT_SHOW: ThemeShow = { code: true, name: false, group: true, room: true, time: true, lecturer: false };

type Core = Pick<
  ThemeSettings,
  "background" | "surface" | "gridLine" | "headerBg" | "headerText" | "text" | "mutedText" | "accent" | "palette"
>;

const base: Omit<ThemeSettings, keyof Core | "presetId"> = {
  blockStyle: "soft",
  radius: 8,
  font: "jakarta",
  fontScale: 1,
  show: DEFAULT_SHOW,
  timeFormat: "24h",
  layout: "grid",
  orientation: "days-columns",
  weekend: "auto",
  title: "My Timetable",
  subtitle: "",
  showTitle: false,
  backgroundDim: 0.45,
};

export interface ThemePreset {
  id: string;
  name: string;
  settings: ThemeSettings;
}

function preset(id: string, name: string, over: Partial<ThemeSettings> & Core): ThemePreset {
  return { id, name, settings: { ...base, presetId: id, ...over } };
}

export const PRESETS: ThemePreset[] = [
  preset("midnight", "Midnight", {
    background: "#0b0e14", surface: "#12161f", gridLine: "#262d3a", headerBg: "#12161f", headerText: "#eceff5",
    text: "#eceff5", mutedText: "#a6aebe", accent: "#5b9dff",
    palette: ["#5b9dff", "#4ade80", "#f87171", "#c084fc", "#fbbf24", "#22d3ee", "#f472b6", "#a3e635", "#818cf8", "#fb923c"],
  }),
  preset("paper", "Paper", {
    background: "#eef0f4", surface: "#ffffff", gridLine: "#dde0e8", headerBg: "#f6f7fa", headerText: "#161a24",
    text: "#161a24", mutedText: "#4d5566", accent: "#2563eb",
    palette: ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#d97706", "#0891b2", "#db2777", "#65a30d", "#7c3aed", "#ea580c"],
  }),
  preset("uitm", "UiTM", {
    background: "#1a1030", surface: "#241745", gridLine: "#3a2a63", headerBg: "#241745", headerText: "#f5e9c9",
    text: "#f1e9ff", mutedText: "#b9a8e0", accent: "#f5b83d",
    blockStyle: "gradient",
    palette: ["#f5b83d", "#ffd700", "#9b7bff", "#c084fc", "#e8b4ff", "#ffb347", "#8f6cf0", "#f4d06f", "#b19cd9", "#e5c07b"],
  }),
  preset("matcha-strawberry", "Matcha Strawberry", {
    background: "#f2f5ec", surface: "#fbfcf5", gridLine: "#dde5cf", headerBg: "#eef3e4", headerText: "#3b452c",
    text: "#35402a", mutedText: "#6d7659", accent: "#d65f7f",
    palette: ["#7ba05b", "#d65f7f", "#5e8c61", "#e58aa5", "#96b566", "#c4506f", "#88a86e", "#e89cb1", "#6b8f52", "#d97a92"],
  }),
  preset("ocean", "Ocean", {
    background: "#0d1b2a", surface: "#12263a", gridLine: "#1e3a55", headerBg: "#12263a", headerText: "#cfe8ff",
    text: "#dff0ff", mutedText: "#87a8c4", accent: "#38bdf8",
    palette: ["#38bdf8", "#22d3ee", "#60a5fa", "#34d399", "#818cf8", "#2dd4bf", "#93c5fd", "#67e8f9", "#5eead4", "#7dd3fc"],
  }),
  preset("sunset", "Sunset", {
    background: "#1d1220", surface: "#281830", gridLine: "#402549", headerBg: "#281830", headerText: "#ffd9c4",
    text: "#ffe9dd", mutedText: "#c9a3b8", accent: "#ff8c42",
    blockStyle: "gradient",
    palette: ["#ff8c42", "#ff5e78", "#ffb347", "#f97fb5", "#e06c9f", "#ff9770", "#d9578f", "#ffa552", "#ef6f9c", "#ffc46b"],
  }),
  preset("lavender-dream", "Lavender Dream", {
    background: "#f0edfa", surface: "#faf9ff", gridLine: "#ddd7f2", headerBg: "#ece7f8", headerText: "#413a5e",
    text: "#3a3352", mutedText: "#7a7199", accent: "#8b7cf6",
    radius: 14,
    palette: ["#a78bfa", "#c4b5fd", "#8b7cf6", "#d0a9f5", "#7c6bd9", "#b49af0", "#9578e8", "#c9b8ff", "#a78bfa", "#8f7ae0"],
  }),
  preset("mono", "Mono", {
    background: "#f2f2f0", surface: "#fcfcfa", gridLine: "#d8d8d2", headerBg: "#ecece8", headerText: "#22221f",
    text: "#22221f", mutedText: "#6d6d66", accent: "#22221f",
    blockStyle: "outline", font: "jetbrains", radius: 3,
    palette: ["#22221f", "#4d4d46", "#73736a", "#35352f", "#5f5f57", "#2b2b27", "#83837a", "#41413b", "#6a6a62", "#1d1d1a"],
  }),
  preset("pastel", "Pastel", {
    background: "#f4f2fb", surface: "#ffffff", gridLine: "#e3dff3", headerBg: "#f0edf9", headerText: "#3c3550",
    text: "#3c3550", mutedText: "#7b7494", accent: "#a5b8f3",
    radius: 14,
    palette: ["#a5b8f3", "#f3b8d4", "#b8e3c8", "#f9d9a7", "#c5b8f3", "#a7dce5", "#f3c3b8", "#b8d8f3", "#d4e8b0", "#f0b8c9"],
  }),
  preset("neon", "Neon", {
    background: "#07070d", surface: "#101018", gridLine: "#1f1f2e", headerBg: "#101018", headerText: "#e4e4ff",
    text: "#e8e8ff", mutedText: "#8a8aa8", accent: "#00f5d4",
    blockStyle: "outline", radius: 10, font: "spaceGrotesk",
    palette: ["#00f5d4", "#f15bb5", "#fee440", "#00bbf9", "#9b5de5", "#80ff72", "#ff6d00", "#f72585", "#4cc9f0", "#b8f202"],
  }),
  preset("kopi", "Kopi", {
    background: "#1b1410", surface: "#241b15", gridLine: "#3a2e24", headerBg: "#241b15", headerText: "#e8d9c8",
    text: "#efe4d6", mutedText: "#b39d88", accent: "#d9a05b",
    font: "nunito",
    palette: ["#d9a05b", "#b5773a", "#e0b184", "#9c6b46", "#c98f5f", "#8a5a38", "#e8c79b", "#b98a5e", "#d19a66", "#a67c52"],
  }),
];

export const DEFAULT_THEME: ThemeSettings = PRESETS[0].settings;

// ---- Dark / light resolution ----

const NEUTRALS = {
  dark: { background: "#0b0e14", surface: "#12161f", gridLine: "#262d3a", headerBg: "#12161f", headerText: "#eceff5", text: "#eceff5", mutedText: "#a6aebe" },
  light: { background: "#eef0f4", surface: "#ffffff", gridLine: "#dde0e8", headerBg: "#f6f7fa", headerText: "#161a24", text: "#161a24", mutedText: "#4d5566" },
} as const;

/** Applies theme.mode: swaps in dark/light neutrals (tinted by the accent) when the authored colours are the other kind. */
export function resolveTheme(theme: ThemeSettings, appDark: boolean): ThemeSettings {
  const mode = theme.mode ?? "theme";
  if (mode === "theme") return theme;
  const wantDark = mode === "dark" || (mode === "app" && appDark);
  const isDark = luminance(theme.background) < 0.2;
  if (wantDark === isDark) return theme;
  const n = wantDark ? NEUTRALS.dark : NEUTRALS.light;
  const tint = (c: string, k: number) => mixHex(c, theme.accent, k);
  return {
    ...theme,
    background: tint(n.background, 0.05),
    surface: tint(n.surface, 0.03),
    gridLine: tint(n.gridLine, 0.05),
    headerBg: tint(n.headerBg, 0.03),
    headerText: n.headerText,
    text: n.text,
    mutedText: n.mutedText,
  };
}

// ---- Backdrop (image / gradient / pattern) ----

export const DEFAULT_GRADIENT = { from: "#1e1b4b", to: "#7c3aed", angle: 135 };

export const GRADIENT_PRESETS: { id: string; name: string; from: string; to: string }[] = [
  { id: "dusk", name: "Dusk", from: "#1e1b4b", to: "#7c3aed" },
  { id: "aurora", name: "Aurora", from: "#0f766e", to: "#1d4ed8" },
  { id: "ember", name: "Ember", from: "#7f1d1d", to: "#f97316" },
  { id: "ocean", name: "Deep sea", from: "#082f49", to: "#06b6d4" },
  { id: "forest", name: "Forest", from: "#052e16", to: "#65a30d" },
  { id: "slate", name: "Slate", from: "#0f172a", to: "#475569" },
  { id: "peach", name: "Peach", from: "#fda4af", to: "#fcd34d" },
  { id: "mint", name: "Mint", from: "#a7f3d0", to: "#93c5fd" },
  { id: "rose", name: "Rose", from: "#fbcfe8", to: "#c4b5fd" },
  { id: "sand", name: "Sand", from: "#fef3c7", to: "#fdba74" },
];

export function backdropKind(t: ThemeSettings): BgKind {
  if (t.bgKind === "gradient") return "gradient";
  if (t.bgKind === "image" || (!t.bgKind && t.backgroundImage)) return t.backgroundImage ? "image" : "color";
  return "color";
}

export function hasBackdrop(t: ThemeSettings): boolean {
  return backdropKind(t) !== "color" || (t.bgPattern ?? "none") !== "none";
}

/** Estimated luminance of what is actually painted behind the timetable. */
export function backdropLuminance(t: ThemeSettings): number {
  const kind = backdropKind(t);
  let base: number;
  if (kind === "image") base = t.bgLum ?? 0.25;
  else if (kind === "gradient") {
    const g = t.bgGradient ?? DEFAULT_GRADIENT;
    base = (luminance(g.from) + luminance(g.to)) / 2;
  } else base = luminance(t.background);
  const dim = t.backgroundDim ?? 0;
  return base * (1 - dim) + luminance(t.bgTint ?? "#000000") * dim;
}

export interface BackdropResult {
  /** Theme to hand to the grids: transparent wrapper, translucent header, contrast-corrected text. */
  grid: ThemeSettings;
  titleColor: string;
  titleMuted: string;
  panelBg: string;
  panelBlur: number;
  panelBorder: string;
}

/** Derives everything the timetable needs to sit legibly on top of a backdrop. */
export function applyBackdrop(t: ThemeSettings): BackdropResult | null {
  if (!hasBackdrop(t)) return null;
  const p = Math.min(1, Math.max(0, t.panelOpacity ?? 0.7));
  const backLum = backdropLuminance(t);
  const panelLum = p * luminance(t.surface) + (1 - p) * backLum;
  const auto = t.autoText !== false;
  const lightText = (lum: number) => lum < 0.34;
  let { text, mutedText, headerText, gridLine } = t;
  if (auto && lightText(panelLum) !== luminance(t.text) > 0.34) {
    const light = lightText(panelLum);
    text = light ? "#f5f7fb" : "#14161c";
    mutedText = light ? "#c3cad8" : "#3d4452";
    headerText = text;
    gridLine = light ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.16)";
  }
  const titleLight = lightText(backLum);
  return {
    grid: {
      ...t,
      background: "transparent",
      headerBg: `color-mix(in oklab, ${t.headerBg} ${Math.round(p * 100)}%, transparent)`,
      text,
      mutedText,
      headerText,
      gridLine,
    },
    titleColor: auto ? (titleLight ? "#f5f7fb" : "#14161c") : t.text,
    titleMuted: auto ? (titleLight ? "#d3d9e5" : "#3d4452") : t.mutedText,
    panelBg: `color-mix(in oklab, ${t.surface} ${Math.round(p * 100)}%, transparent)`,
    panelBlur: t.panelBlur ?? 10,
    panelBorder: lightText(panelLum) ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
  };
}

export function getPreset(id: string): ThemePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
