import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Palette, Plus, Save, Trash2, X } from "lucide-react";
import { usePlanner } from "../store/usePlanner.ts";
import {
  backdropKind,
  DEFAULT_GRADIENT,
  FONTS,
  GRADIENT_PRESETS,
  loadFont,
  luminance,
  PRESETS,
  rgbToHex,
  type BgFit,
  type BgKind,
  type BgPattern,
  type BlockStyle,
  type FontId,
  type ThemeSettings,
} from "../lib/theme.ts";
import { inputCls } from "./ui.tsx";
import ModeToggle from "./ModeToggle.tsx";

function isHeic(file: Blob | File): boolean {
  const name = "name" in file ? (file.name || "").toLowerCase() : "";
  const type = (file.type || "").toLowerCase();
  return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
}

async function convertHeicToJpeg(file: Blob | File): Promise<Blob> {
  const heic2anyModule = await import("heic2any");
  const heic2any = heic2anyModule.default ?? heic2anyModule;
  const res = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.82,
  });
  return Array.isArray(res) ? res[0] : res;
}

/** Downscales an uploaded image to <=1600px and ~<=500KB JPEG for storage, and measures its average luminance. */
async function processImage(file: Blob | File): Promise<{ dataUrl: string; lum: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read that image"));
      i.src = url;
    });
    const maxDim = Math.max(img.width, img.height);
    const scale = maxDim > 1600 ? 1600 / maxDim : 1;
    let w = Math.round(img.width * scale);
    let h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);

    const probe = document.createElement("canvas");
    probe.width = probe.height = 24;
    const pctx = probe.getContext("2d")!;
    pctx.drawImage(img, 0, 0, 24, 24);
    const px = pctx.getImageData(0, 0, 24, 24).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += luminance(rgbToHex([px[i], px[i + 1], px[i + 2]]));
    const lum = sum / (px.length / 4);

    let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    for (const q of [0.7, 0.55, 0.4]) {
      if (dataUrl.length <= 500_000) break;
      dataUrl = canvas.toDataURL("image/jpeg", q);
    }
    // If still too large, downscale canvas dimensions
    while (dataUrl.length > 500_000 && w > 400 && h > 400) {
      w = Math.round(w * 0.75);
      h = Math.round(h * 0.75);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    }
    return { dataUrl, lum };
  } finally {
    URL.revokeObjectURL(url);
  }
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-line pt-3">
      <h4 className="text-[11px] font-bold tracking-wide text-faint uppercase">{title}</h4>
      {children}
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const commit = (v: string) => {
    setHex(v);
    if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v);
  };
  return (
    <label className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#888888"}
        onChange={(e) => {
          setHex(e.target.value);
          onChange(e.target.value);
        }}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0.5"
      />
      <input
        value={hex}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setHex(value)}
        className={`${inputCls} w-24 font-mono text-xs`}
        spellCheck={false}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-soft">{label}</span>
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-soft">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-faint">{fmt ? fmt(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-(--accent)" />
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-lg border border-line p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${value === id ? "bg-accent/15 text-accent" : "text-soft hover:bg-raised"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Colour / gradient / image backdrop with fit, focal point, zoom, blur, dim, frosted panel and pattern controls. */
function BackgroundSection() {
  const theme = usePlanner((s) => s.theme);
  const setTheme = usePlanner((s) => s.setTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const kind: BgKind = theme.bgKind ?? (theme.backgroundImage ? "image" : "color");
  const painted = backdropKind(theme) !== "color" || (theme.bgPattern ?? "none") !== "none";
  const grad = theme.bgGradient ?? DEFAULT_GRADIENT;
  const fit = theme.bgFit ?? "cover";

  const loadFile = async (rawFile: File | Blob | undefined | null) => {
    if (!rawFile) return;
    const name = "name" in rawFile ? rawFile.name : "";
    const isImage = (rawFile.type && rawFile.type.startsWith("image/")) || isHeic(rawFile) || /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(name);
    if (!isImage) return setError("That file isn't an image.");
    setError("");
    setBusy(true);
    try {
      let file: File | Blob = rawFile;
      if (isHeic(rawFile)) {
        file = await convertHeicToJpeg(rawFile);
      }
      const { dataUrl, lum } = await processImage(file);
      setTheme({ backgroundImage: dataUrl, bgLum: lum, bgKind: "image", bgX: 50, bgY: 50, bgZoom: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image");
    } finally {
      setBusy(false);
    }
  };

  // Paste an image straight from the clipboard while the drawer is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) void loadFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickKind = (k: BgKind) => setTheme(k === "gradient" && !theme.bgGradient ? { bgKind: k, bgGradient: DEFAULT_GRADIENT } : { bgKind: k });

  const setFocal = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTheme({ bgX: clamp100(((e.clientX - r.left) / r.width) * 100), bgY: clamp100(((e.clientY - r.top) / r.height) * 100) });
  };

  return (
    <Section title="Background">
      <Segmented<BgKind>
        value={kind}
        options={[
          ["color", "Colour"],
          ["gradient", "Gradient"],
          ["image", "Image"],
        ]}
        onChange={pickKind}
      />

      {kind === "gradient" && (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1.5">
            {GRADIENT_PRESETS.map((g) => (
              <button
                key={g.id}
                type="button"
                title={g.name}
                aria-label={g.name}
                onClick={() => setTheme({ bgKind: "gradient", bgGradient: { from: g.from, to: g.to, angle: grad.angle } })}
                className={`h-9 rounded-lg border transition-transform active:scale-95 ${grad.from === g.from && grad.to === g.to ? "border-accent ring-2 ring-accent/40" : "border-line"}`}
                style={{ background: `linear-gradient(${grad.angle}deg, ${g.from}, ${g.to})` }}
              />
            ))}
          </div>
          <ColorField label="From" value={grad.from} onChange={(v) => setTheme({ bgGradient: { ...grad, from: v } })} />
          <ColorField label="To" value={grad.to} onChange={(v) => setTheme({ bgGradient: { ...grad, to: v } })} />
          <Range label="Angle" value={grad.angle} min={0} max={360} step={5} fmt={(v) => `${v}°`} onChange={(v) => setTheme({ bgGradient: { ...grad, angle: v } })} />
        </div>
      )}

      {kind === "image" && (
        <div className="space-y-2">
          {theme.backgroundImage ? (
            <>
              <div
                className="relative h-28 cursor-crosshair touch-none overflow-hidden rounded-lg border border-line"
                style={{
                  backgroundImage: `url("${theme.backgroundImage}")`,
                  backgroundSize: fit === "stretch" ? "100% 100%" : fit === "tile" ? "64px auto" : fit,
                  backgroundRepeat: fit === "tile" ? "repeat" : "no-repeat",
                  backgroundPosition: `${theme.bgX ?? 50}% ${theme.bgY ?? 50}%`,
                  backgroundColor: theme.background,
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setFocal(e);
                }}
                onPointerMove={(e) => e.buttons && setFocal(e)}
                title="Click or drag to set the focal point"
              >
                <span
                  className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                  style={{ left: `${theme.bgX ?? 50}%`, top: `${theme.bgY ?? 50}%` }}
                />
              </div>
              <p className="text-[11px] text-faint">Click or drag the preview to choose which part of the photo stays in view.</p>
              <Segmented<BgFit>
                value={fit}
                options={[
                  ["cover", "Fill"],
                  ["contain", "Fit"],
                  ["stretch", "Stretch"],
                  ["tile", "Tile"],
                ]}
                onChange={(f) => setTheme({ bgFit: f })}
              />
              <Range label="Zoom" value={theme.bgZoom ?? 1} min={1} max={3} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => setTheme({ bgZoom: v })} />
              <Range label="Blur" value={theme.bgBlur ?? 0} min={0} max={24} step={1} fmt={(v) => `${v}px`} onChange={(v) => setTheme({ bgBlur: v })} />
              <div className="flex gap-1.5">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-soft hover:bg-raised">
                  <ImagePlus className="size-3.5" /> {busy ? "Processing…" : "Replace"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => void loadFile(e.target.files?.[0])}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTheme({ backgroundImage: undefined, bgKind: "color", bgLum: undefined })}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-soft hover:bg-raised hover:text-bad"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </div>
            </>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void loadFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-colors ${dragOver ? "border-accent bg-accent/10" : "border-line"}`}
            >
              <ImagePlus className="size-6 text-faint" />
              <label className="cursor-pointer text-xs font-semibold text-accent underline">
                {busy ? "Processing…" : "Choose a photo"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => void loadFile(e.target.files?.[0])}
                />
              </label>
              <p className="text-[11px] text-faint">or drag one here, or paste with Ctrl+V. It stays on this device.</p>
            </div>
          )}
          {error && <p className="text-xs text-bad">{error}</p>}
        </div>
      )}

      <div>
        <div className="mb-1 text-xs text-soft">Pattern overlay</div>
        <Segmented<BgPattern>
          value={theme.bgPattern ?? "none"}
          options={[
            ["none", "None"],
            ["dots", "Dots"],
            ["grid", "Grid"],
            ["lines", "Lines"],
          ]}
          onChange={(p) => setTheme({ bgPattern: p })}
        />
      </div>

      {painted && (
        <div className="space-y-2 rounded-lg border border-line p-2.5">
          {kind !== "color" && (
            <>
              <Range label="Dim" value={theme.backgroundDim} min={0} max={0.9} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setTheme({ backgroundDim: v })} />
              <ColorField label="Dim colour" value={theme.bgTint ?? "#000000"} onChange={(v) => setTheme({ bgTint: v })} />
            </>
          )}
          <Range label="Panel opacity" value={theme.panelOpacity ?? 0.7} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setTheme({ panelOpacity: v })} />
          <Range label="Panel blur" value={theme.panelBlur ?? 10} min={0} max={24} step={1} fmt={(v) => `${v}px`} onChange={(v) => setTheme({ panelBlur: v })} />
          <label className="flex items-center gap-2 text-xs text-soft">
            <input type="checkbox" checked={theme.autoText !== false} onChange={(e) => setTheme({ autoText: e.target.checked })} className="size-4 accent-(--accent)" />
            Auto-pick readable text colours
          </label>
          <div>
            <div className="mb-1 text-xs text-soft">In exports, paint the background over</div>
            <Segmented<"canvas" | "view">
              value={theme.bgScope ?? "canvas"}
              options={[
                ["canvas", "Whole image"],
                ["view", "Timetable only"],
              ]}
              onChange={(v) => setTheme({ bgScope: v })}
            />
          </div>
        </div>
      )}
    </Section>
  );
}

const BLOCK_STYLES: { id: BlockStyle; label: string }[] = [
  { id: "soft", label: "Soft" },
  { id: "solid", label: "Solid" },
  { id: "outline", label: "Outline" },
  { id: "gradient", label: "Gradient" },
  { id: "glass", label: "Glass" },
];

const SHOW_FIELDS: { key: keyof ThemeSettings["show"]; label: string }[] = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "group", label: "Group" },
  { key: "room", label: "Room" },
  { key: "time", label: "Time" },
  { key: "lecturer", label: "Lecturer" },
];

export default function DesignDrawer({ onClose }: { onClose: () => void }) {
  const theme = usePlanner((s) => s.theme);
  const savedThemes = usePlanner((s) => s.savedThemes);
  const setTheme = usePlanner((s) => s.setTheme);
  const applyPreset = usePlanner((s) => s.applyPreset);
  const recolorFromPalette = usePlanner((s) => s.recolorFromPalette);
  const saveTheme = usePlanner((s) => s.saveTheme);
  const deleteTheme = usePlanner((s) => s.deleteTheme);
  const loadSavedTheme = usePlanner((s) => s.loadSavedTheme);

  const [saveName, setSaveName] = useState("");

  const pickFont = async (id: FontId) => {
    setTheme({ font: id });
    await loadFont(id);
    // Re-set to force a repaint after the face becomes available.
    setTheme({ font: id });
  };

  return (
    <div className="anim-fade fixed inset-0 z-50" role="dialog" aria-label="Design">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-panel absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col lg:max-h-none rounded-t-2xl border-t border-line bg-panel lg:inset-y-0 lg:right-0 lg:left-auto lg:w-96 lg:max-w-[26rem] lg:rounded-none lg:border-t-0 lg:border-l">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Palette className="size-4 text-accent" />
          <h3 className="text-sm font-bold">Design</h3>
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1.5 text-faint hover:bg-raised">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 pb-24 lg:pb-6">
          <section className="space-y-2">
            <h4 className="text-[11px] font-bold tracking-wide text-faint uppercase">Appearance</h4>
            <ModeToggle className="w-full [&>button]:flex-1 [&>button]:justify-center" />
            <p className="text-[11px] text-faint">Dark / Light re-skins the timetable itself. “Auto” follows the app's sun/moon switch.</p>
          </section>

          <Section title="Presets">
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition-colors ${
                    theme.presetId === p.id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                  }`}
                >
                  <span className="flex -space-x-1">
                    {p.settings.palette.slice(0, 3).map((c) => (
                      <span key={c} className="size-3 rounded-full border border-black/20" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={recolorFromPalette}
                className="flex-1 rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-soft hover:bg-raised"
              >
                Recolour subjects
              </button>
              <button
                type="button"
                onClick={() => applyPreset(theme.presetId)}
                className="flex-1 rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-soft hover:bg-raised"
                title="Restore this preset's colours, font and layout (recolours subjects)"
              >
                Reset to preset
              </button>
            </div>
          </Section>

          <BackgroundSection />

          <Section title="My themes">
            <div className="flex gap-1.5">
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Theme name…" className={`${inputCls} flex-1`} />
              <button
                type="button"
                disabled={!saveName.trim()}
                onClick={() => {
                  saveTheme(saveName);
                  setSaveName("");
                }}
                className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-on-accent disabled:opacity-40"
              >
                <Save className="size-3.5" /> Save
              </button>
            </div>
            {savedThemes.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                <button type="button" onClick={() => loadSavedTheme(t.id)} className="flex-1 truncate text-left text-xs font-semibold text-soft hover:text-ink">
                  {t.name}
                </button>
                <button type="button" onClick={() => deleteTheme(t.id)} className="rounded p-1 text-faint hover:text-bad" aria-label={`Delete ${t.name}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </Section>

          <Section title="Colours">
            <ColorField label="Background" value={theme.background} onChange={(v) => setTheme({ background: v })} />
            <ColorField label="Surface" value={theme.surface} onChange={(v) => setTheme({ surface: v })} />
            <ColorField label="Grid lines" value={theme.gridLine} onChange={(v) => setTheme({ gridLine: v })} />
            <ColorField label="Header background" value={theme.headerBg} onChange={(v) => setTheme({ headerBg: v })} />
            <ColorField label="Header text" value={theme.headerText} onChange={(v) => setTheme({ headerText: v })} />
            <ColorField label="Text" value={theme.text} onChange={(v) => setTheme({ text: v })} />
            <ColorField label="Muted text" value={theme.mutedText} onChange={(v) => setTheme({ mutedText: v })} />
            <ColorField label="Accent" value={theme.accent} onChange={(v) => setTheme({ accent: v })} />
          </Section>

          <Section title="Subject palette">
            <div className="flex flex-wrap items-center gap-1.5">
              {theme.palette.map((c, i) => (
                <div key={`${c}-${i}`} className="relative">
                  <input
                    type="color"
                    value={c}
                    onChange={(e) =>
                      setTheme({ palette: theme.palette.map((x, j) => (j === i ? e.target.value : x)) })
                    }
                    className="size-7 cursor-pointer rounded-full border border-line p-0"
                  />
                  {theme.palette.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setTheme({ palette: theme.palette.filter((_, j) => j !== i) })}
                      className="absolute -top-1 -right-1 rounded-full bg-panel p-px text-faint shadow hover:text-bad"
                      aria-label={`Remove colour ${i + 1}`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
              {theme.palette.length < 16 && (
                <button
                  type="button"
                  onClick={() => setTheme({ palette: [...theme.palette, "#8a92a3"] })}
                  className="flex size-7 items-center justify-center rounded-full border border-dashed border-line text-faint hover:text-ink"
                  aria-label="Add colour"
                >
                  <Plus className="size-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-faint">New subjects cycle through these colours. Use “Recolour subjects” to apply to the current plan.</p>
          </Section>

          <Section title="Blocks">
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_STYLES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setTheme({ blockStyle: b.id })}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    theme.blockStyle === b.id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                  }`}
                >
                  {theme.blockStyle === b.id && <Check className="size-3" />}
                  {b.label}
                </button>
              ))}
            </div>
            <label className="block text-xs text-soft">
              Corner radius · {theme.radius}px
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={theme.radius}
                onChange={(e) => setTheme({ radius: Number(e.target.value) })}
                className="mt-1 w-full accent-(--accent)"
              />
            </label>
          </Section>

          <Section title="Typography">
            <select
              value={theme.font}
              onChange={(e) => void pickFont(e.target.value as FontId)}
              className={inputCls}
            >
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <label className="block text-xs text-soft">
              Size · {theme.fontScale.toFixed(2)}×
              <input
                type="range"
                min={0.8}
                max={1.4}
                step={0.05}
                value={theme.fontScale}
                onChange={(e) => setTheme({ fontScale: Number(e.target.value) })}
                className="mt-1 w-full accent-(--accent)"
              />
            </label>
          </Section>

          <Section title="Show on blocks">
            <div className="grid grid-cols-3 gap-1.5">
              {SHOW_FIELDS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTheme({ show: { [f.key]: !theme.show[f.key] } })}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                    theme.show[f.key] ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Layout">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["grid", "Grid"],
                  ["agenda", "Agenda"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme({ layout: id })}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                    theme.layout === id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["days-columns", "Days → columns"],
                  ["days-rows", "Days → rows"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={theme.layout === "agenda"}
                  onClick={() => setTheme({ orientation: id })}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                    theme.orientation === id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-soft">
                Time format
                <select
                  value={theme.timeFormat}
                  onChange={(e) => setTheme({ timeFormat: e.target.value as "12h" | "24h" })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="24h">24-hour</option>
                  <option value="12h">12-hour</option>
                </select>
              </label>
              <label className="block text-xs text-soft">
                Weekends
                <select
                  value={theme.weekend}
                  onChange={(e) => setTheme({ weekend: e.target.value as ThemeSettings["weekend"] })}
                  className={`${inputCls} mt-1`}
                >
                  <option value="auto">Auto</option>
                  <option value="always">Always show</option>
                  <option value="never">Hide</option>
                </select>
              </label>
            </div>
          </Section>

          <Section title="Title">
            <label className="flex items-center gap-2 text-xs text-soft">
              <input
                type="checkbox"
                checked={theme.showTitle}
                onChange={(e) => setTheme({ showTitle: e.target.checked })}
                className="size-4 accent-(--accent)"
              />
              Show title on the timetable
            </label>
            <input value={theme.title} onChange={(e) => setTheme({ title: e.target.value })} placeholder="e.g. Semester 20264" className={inputCls} />
            <input value={theme.subtitle} onChange={(e) => setTheme({ subtitle: e.target.value })} placeholder="Subtitle (optional)" className={inputCls} />
          </Section>

        </div>
      </div>
    </div>
  );
}
