import type { Day, Entry, Plan, Session } from "./types.ts";
import { DAYS } from "./types.ts";
import { DEFAULT_THEME, type ThemeSettings } from "./theme.ts";

// Share links: minimal JSON → deflate-raw → base64url in `?s=`.
// CompressionStream/DecompressionStream exist in browsers and Node ≥18.

interface SharedSession {
  d: Day;
  s: number;
  e: number;
  r?: string;
}

interface SharedEntry {
  code: string;
  name?: string;
  group: string;
  campus?: string;
  sessions: SharedSession[];
  lecturer?: string;
  credits?: number;
  notes?: string;
  color?: string;
  hidden?: boolean;
}

export interface SharePayload {
  v: 1;
  name: string;
  entries: SharedEntry[];
  theme?: ThemeSettings;
}

const MAX_DECODED = 200 * 1024;

// ---- base64url (no deps, works in browser and Node) ----
function b64uEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function b64uDecode(s: string): Uint8Array {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pump(bytes: Uint8Array, cs: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = cs.writable.getWriter();
  // Fresh copy → Uint8Array<ArrayBuffer> (lib types want a non-shared buffer).
  // The writer can reject when the stream errors; that failure is already
  // surfaced through the readable side, so swallow it here.
  void writer
    .write(new Uint8Array(bytes))
    .then(() => writer.close())
    .catch(() => {});
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  return pump(bytes, new CompressionStream("deflate-raw"));
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  return pump(bytes, new DecompressionStream("deflate-raw"));
}

// ---- encode ----

export function encodePlan(plan: Plan, theme?: ThemeSettings): Promise<string> {
  const payload: SharePayload = {
    v: 1,
    name: plan.name,
    entries: plan.entries.map((e) => ({
      code: e.subjectCode,
      name: e.subjectName || undefined,
      group: e.group,
      campus: e.campus,
      sessions: e.sessions.map((s) => ({ d: s.day, s: s.start, e: s.end, r: s.room || undefined })),
      lecturer: e.lecturer,
      credits: e.credits,
      notes: e.notes,
      color: e.color,
      hidden: e.hidden || undefined,
    })),
    theme,
  };
  return deflate(new TextEncoder().encode(JSON.stringify(payload))).then(b64uEncode);
}

// ---- strict validation ----

const isStr = (v: unknown, max = 400): v is string => typeof v === "string" && v.length <= max;
const DAY_SET = new Set<string>(DAYS);

function sanitizeSessions(v: unknown): SharedSession[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 30) throw new Error("Invalid sessions");
  return v.map((s) => {
    if (!s || typeof s !== "object") throw new Error("Invalid session");
    const o = s as Record<string, unknown>;
    if (typeof o.d !== "string" || !DAY_SET.has(o.d)) throw new Error("Unknown day");
    if (typeof o.s !== "number" || typeof o.e !== "number" || !Number.isFinite(o.s) || !Number.isFinite(o.e)) {
      throw new Error("Non-numeric time");
    }
    if (o.s < 0 || o.e > 24 * 60 || o.s >= o.e) throw new Error("Time out of range");
    if (o.r !== undefined && !isStr(o.r, 80)) throw new Error("Invalid room");
    return { d: o.d as Day, s: o.s, e: o.e, r: o.r as string | undefined };
  });
}

const HEX = /^#[0-9a-f]{6}$/i;
const BLOCK_STYLES = new Set(["solid", "soft", "outline", "gradient", "glass"]);
const LAYOUTS = new Set(["grid", "agenda"]);
const ORIENTATIONS = new Set(["days-columns", "days-rows"]);
const FONTS_OK = new Set(["jakarta", "inter", "outfit", "spaceGrotesk", "nunito", "fraunces", "jetbrains", "caveat", "dmSans"]);
const WEEKENDS = new Set(["auto", "always", "never"]);

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function strColor(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

/** Whitelist-validates a theme object into a complete ThemeSettings. */
export function sanitizeTheme(v: unknown): ThemeSettings {
  const base = { ...DEFAULT_THEME, palette: [...DEFAULT_THEME.palette], show: { ...DEFAULT_THEME.show } };
  if (!v || typeof v !== "object") return base;
  const o = v as Record<string, unknown>;
  return {
    ...base,
    presetId: isStr(o.presetId, 60) ? o.presetId : base.presetId,
    background: strColor(o.background, base.background),
    surface: strColor(o.surface, base.surface),
    gridLine: strColor(o.gridLine, base.gridLine),
    headerBg: strColor(o.headerBg, base.headerBg),
    headerText: strColor(o.headerText, base.headerText),
    text: strColor(o.text, base.text),
    mutedText: strColor(o.mutedText, base.mutedText),
    accent: strColor(o.accent, base.accent),
    palette:
      Array.isArray(o.palette) && o.palette.length > 0 && o.palette.length <= 24 && o.palette.every((c) => typeof c === "string" && HEX.test(c))
        ? (o.palette as string[])
        : base.palette,
    blockStyle: typeof o.blockStyle === "string" && BLOCK_STYLES.has(o.blockStyle) ? (o.blockStyle as ThemeSettings["blockStyle"]) : base.blockStyle,
    radius: clamp(o.radius, 0, 20, base.radius),
    font: typeof o.font === "string" && FONTS_OK.has(o.font) ? (o.font as ThemeSettings["font"]) : base.font,
    fontScale: clamp(o.fontScale, 0.8, 1.4, base.fontScale),
    show:
      o.show && typeof o.show === "object"
        ? { ...base.show, ...Object.fromEntries(Object.keys(base.show).map((k) => [k, typeof (o.show as Record<string, unknown>)[k] === "boolean" ? (o.show as Record<string, unknown>)[k] : base.show[k as keyof ThemeSettings["show"]]])) }
        : base.show,
    timeFormat: o.timeFormat === "12h" || o.timeFormat === "24h" ? o.timeFormat : base.timeFormat,
    layout: typeof o.layout === "string" && LAYOUTS.has(o.layout) ? (o.layout as ThemeSettings["layout"]) : base.layout,
    orientation:
      typeof o.orientation === "string" && ORIENTATIONS.has(o.orientation) ? (o.orientation as ThemeSettings["orientation"]) : base.orientation,
    weekend: typeof o.weekend === "string" && WEEKENDS.has(o.weekend) ? (o.weekend as ThemeSettings["weekend"]) : base.weekend,
    title: isStr(o.title, 120) ? o.title : base.title,
    subtitle: isStr(o.subtitle, 160) ? o.subtitle : base.subtitle,
    showTitle: typeof o.showTitle === "boolean" ? o.showTitle : base.showTitle,
    backgroundImage: typeof o.backgroundImage === "string" && o.backgroundImage.startsWith("data:image/") && o.backgroundImage.length < 600_000 ? o.backgroundImage : undefined,
    backgroundDim: clamp(o.backgroundDim, 0, 0.9, base.backgroundDim),
    ...sanitizeBackdrop(o),
  };
}

const ONE_OF = <T extends string>(v: unknown, set: readonly T[]): T | undefined => (typeof v === "string" && (set as readonly string[]).includes(v) ? (v as T) : undefined);

/** Optional dark/light + backdrop fields; invalid values are simply dropped. */
function sanitizeBackdrop(o: Record<string, unknown>): Partial<ThemeSettings> {
  const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined);
  const g = o.bgGradient as Record<string, unknown> | undefined;
  const gradient =
    g && typeof g === "object" && typeof g.from === "string" && HEX.test(g.from) && typeof g.to === "string" && HEX.test(g.to)
      ? { from: g.from, to: g.to, angle: num(g.angle, 0, 360) ?? 135 }
      : undefined;
  return {
    mode: ONE_OF(o.mode, ["theme", "dark", "light", "app"] as const),
    bgKind: ONE_OF(o.bgKind, ["color", "gradient", "image"] as const),
    bgGradient: gradient,
    bgFit: ONE_OF(o.bgFit, ["cover", "contain", "stretch", "tile"] as const),
    bgX: num(o.bgX, 0, 100),
    bgY: num(o.bgY, 0, 100),
    bgZoom: num(o.bgZoom, 1, 3),
    bgBlur: num(o.bgBlur, 0, 24),
    bgTint: typeof o.bgTint === "string" && HEX.test(o.bgTint) ? o.bgTint : undefined,
    bgPattern: ONE_OF(o.bgPattern, ["none", "dots", "grid", "lines"] as const),
    bgScope: ONE_OF(o.bgScope, ["canvas", "view"] as const),
    panelOpacity: num(o.panelOpacity, 0, 1),
    panelBlur: num(o.panelBlur, 0, 24),
    bgLum: num(o.bgLum, 0, 1),
    autoText: typeof o.autoText === "boolean" ? o.autoText : undefined,
  };
}

function sanitizeEntry(v: unknown): SharedEntry {
  if (!v || typeof v !== "object") throw new Error("Invalid entry");
  const o = v as Record<string, unknown>;
  if (!isStr(o.code, 40) || !isStr(o.group, 40)) throw new Error("Invalid entry");
  return {
    code: o.code,
    name: isStr(o.name ?? "", 200) ? (o.name as string) : undefined,
    group: o.group,
    campus: isStr(o.campus ?? "", 12) ? (o.campus as string) : undefined,
    sessions: sanitizeSessions(o.sessions),
    lecturer: isStr(o.lecturer ?? "", 200) ? (o.lecturer as string) : undefined,
    credits: typeof o.credits === "number" && o.credits >= 0 && o.credits <= 40 ? o.credits : undefined,
    notes: isStr(o.notes ?? "", 2000) ? (o.notes as string) : undefined,
    color: typeof o.color === "string" && HEX.test(o.color) ? o.color : undefined,
    hidden: typeof o.hidden === "boolean" ? o.hidden : undefined,
  };
}

export async function decodePlan(payload: string): Promise<SharePayload> {
  if (!payload || payload.length > MAX_DECODED * 2) throw new Error("Payload too large");
  return inflate(b64uDecode(payload)).then((bytes) => {
    if (bytes.length > MAX_DECODED) throw new Error("Payload too large");
    const obj = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return validatePayload(obj);
  });
}

export function validatePayload(obj: unknown): SharePayload {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("Not a plan");
  const o = obj as Record<string, unknown>;
  if (o.v !== 1) throw new Error("Unsupported share version");
  if (!isStr(o.name, 120)) throw new Error("Invalid plan name");
  if (!Array.isArray(o.entries) || o.entries.length > 60) throw new Error("Invalid entries");
  return {
    v: 1,
    name: o.name,
    entries: o.entries.map(sanitizeEntry),
    theme: o.theme === undefined ? undefined : sanitizeTheme(o.theme),
  };
}

/** Converts a decoded share payload into a Plan (fresh id). */
export function payloadToPlan(payload: SharePayload, id: string): Plan {
  const now = Date.now();
  return {
    id,
    name: payload.name || "Shared plan",
    createdAt: now,
    updatedAt: now,
    source: "friend",
    entries: payload.entries.map((e, i) => ({
      id: `${id}-${i}`,
      subjectCode: e.code,
      subjectName: e.name ?? "",
      group: e.group,
      campus: e.campus,
      sessions: e.sessions.map((s): Session => ({ day: s.d, start: s.s, end: s.e, room: s.r ?? "" })),
      color: e.color ?? "#5b9dff",
      lecturer: e.lecturer,
      credits: e.credits,
      notes: e.notes,
      hidden: e.hidden,
      source: "icress",
    })),
  };
}

// ---- Full backup (.json) ----

export interface Backup {
  v: 1;
  exportedAt: number;
  plans: Plan[];
  sharedPlans?: Plan[];
  theme?: ThemeSettings;
  savedThemes?: { id: string; name: string; settings: ThemeSettings }[];
}

const ENTRY_SRC = new Set(["icress", "matric", "manual"]);

function sanitizePlanEntry(v: unknown): Omit<Entry, "id"> {
  if (!v || typeof v !== "object") throw new Error("Invalid entry");
  const o = v as Record<string, unknown>;
  const shared = sanitizeEntry({
    code: o.subjectCode,
    name: o.subjectName,
    group: o.group,
    campus: o.campus,
    lecturer: o.lecturer,
    credits: o.credits,
    notes: o.notes,
    color: o.color,
    hidden: o.hidden,
    sessions: Array.isArray(o.sessions)
      ? o.sessions.map((s) => (s && typeof s === "object" ? { d: (s as Session).day, s: (s as Session).start, e: (s as Session).end, r: (s as Session).room } : s))
      : o.sessions,
  });
  return {
    subjectCode: shared.code,
    subjectName: shared.name ?? "",
    group: shared.group,
    campus: shared.campus,
    sessions: shared.sessions.map((s) => ({ day: s.d, start: s.s, end: s.e, room: s.r ?? "" })),
    lecturer: shared.lecturer,
    credits: shared.credits,
    notes: shared.notes,
    color: shared.color ?? "#5b9dff",
    hidden: shared.hidden,
    source: typeof o.source === "string" && ENTRY_SRC.has(o.source) ? (o.source as Entry["source"]) : "manual",
  };
}

export function encodeBackup(state: { plans: Plan[]; sharedPlans?: Plan[]; theme?: ThemeSettings; savedThemes?: { id: string; name: string; settings: ThemeSettings }[] }): string {
  const backup: Backup = { v: 1, exportedAt: Date.now(), ...state };
  return JSON.stringify(backup, null, 2);
}

/** Strictly validates a backup file's contents. */
export function decodeBackup(text: string, newId: () => string): Backup {
  if (text.length > 5 * 1024 * 1024) throw new Error("Backup too large");
  const obj = JSON.parse(text) as Record<string, unknown>;
  if (!obj || typeof obj !== "object" || obj.v !== 1 || !Array.isArray(obj.plans)) throw new Error("Not a JadualKu backup");
  const plan = (p: unknown): Plan => {
    if (!p || typeof p !== "object") throw new Error("Invalid plan");
    const o = p as Record<string, unknown>;
    if (!isStr(o.name, 120) || !Array.isArray(o.entries) || o.entries.length > 60) throw new Error("Invalid plan");
    return {
      id: newId(),
      name: o.name,
      entries: o.entries.map((e) => ({ ...sanitizePlanEntry(e), id: newId() })),
      createdAt: typeof o.createdAt === "number" ? o.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
  };
  return {
    v: 1,
    exportedAt: typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now(),
    plans: obj.plans.map(plan),
    sharedPlans: Array.isArray(obj.sharedPlans) ? obj.sharedPlans.map(plan) : [],
    theme: obj.theme === undefined ? undefined : sanitizeTheme(obj.theme),
    savedThemes: Array.isArray(obj.savedThemes)
      ? (obj.savedThemes as { id: string; name: string; settings: ThemeSettings }[])
          .filter((t) => t && typeof t === "object" && isStr(t.name, 60))
          .map((t) => ({ id: newId(), name: t.name, settings: sanitizeTheme(t.settings) }))
      : [],
  };
}
