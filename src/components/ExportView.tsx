import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Download, ImagePlus, Palette, Printer, Share2 } from "lucide-react";
import ModeToggle from "./ModeToggle.tsx";
import { toCanvas } from "html-to-image";
import type { Entry } from "../lib/types.ts";
import { DEVICE_GROUPS, DEVICES, deviceSize, type DevicePreset } from "../data/devices.ts";
import { DEFAULT_GRADIENT, DEFAULT_THEME, fontFamily, hasBackdrop, hexToRgb, loadFont, resolveTheme, type ThemeSettings } from "../lib/theme.ts";
import { useAppDark } from "../lib/useAppDark.ts";
import BackgroundLayer from "./BackgroundLayer.tsx";
import { activePlan, usePlanner } from "../store/usePlanner.ts";
import { useAcademic } from "../lib/useAcademic.ts";
import { buildPlanIcs, saveCalendarFile } from "../lib/icsFile.ts";
import TimetableView from "./TimetableView.tsx";
import DesignDrawer from "./DesignDrawer.tsx";
import { inputCls } from "./ui.tsx";

type WallpaperMode = "lock" | "home" | "none";

/** Reserved fractions of canvas height per wallpaper mode (top / bottom). */
const RESERVE: Record<WallpaperMode, { top: number; bottom: number }> = {
  lock: { top: 0.26, bottom: 0.1 },
  home: { top: 0.04, bottom: 0.14 },
  none: { top: 0, bottom: 0 },
};

/** Scale factor so text/lines size with the canvas, not a fixed px. */
function uiScaleFor(w: number, h: number): number {
  return Math.min(2.6, Math.max(0.7, Math.sqrt((w * h) / (1600 * 900))));
}

async function drawCanvasBackdropImage(
  ctx: CanvasRenderingContext2D,
  theme: ThemeSettings,
  w: number,
  h: number,
  scale: number,
) {
  if (!theme.backgroundImage) return;
  const img = new Image();
  img.src = theme.backgroundImage;
  if (img.decode) {
    try {
      await img.decode();
    } catch {
      // ignore
    }
  } else if (!img.complete) {
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const fit = theme.bgFit ?? "cover";
  const fx = (theme.bgX ?? 50) / 100;
  const fy = (theme.bgY ?? 50) / 100;
  const zoom = theme.bgZoom ?? 1;
  const blur = (theme.bgBlur ?? 0) * scale;
  const dim = theme.backgroundDim ?? 0;
  const [r, g, b] = hexToRgb(theme.bgTint ?? "#000000") ?? [0, 0, 0];

  ctx.save();
  if (blur > 0 && "filter" in ctx) {
    ctx.filter = `blur(${blur}px)`;
  }

  if (fit === "tile") {
    const pat = ctx.createPattern(img, "repeat");
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (fit === "stretch") {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    // cover or contain
    const s = (fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih)) * zoom;
    const dw = iw * s;
    const dh = ih * s;
    const dx = (w - dw) * fx;
    const dy = (h - dh) * fy;
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();

  // Dim overlay
  if (dim > 0) {
    ctx.fillStyle = `rgba(${r},${g},${b},${dim})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawCanvasGradient(
  ctx: CanvasRenderingContext2D,
  theme: ThemeSettings,
  w: number,
  h: number,
) {
  const grad = theme.bgGradient ?? DEFAULT_GRADIENT;
  const rad = ((grad.angle - 90) * Math.PI) / 180;
  const x1 = w / 2 - (Math.cos(rad) * w) / 2;
  const y1 = h / 2 - (Math.sin(rad) * h) / 2;
  const x2 = w / 2 + (Math.cos(rad) * w) / 2;
  const y2 = h / 2 + (Math.sin(rad) * h) / 2;
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, grad.from);
  g.addColorStop(1, grad.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const dim = theme.backgroundDim ?? 0;
  if (dim > 0) {
    const [r, g, b] = hexToRgb(theme.bgTint ?? "#000000") ?? [0, 0, 0];
    ctx.fillStyle = `rgba(${r},${g},${b},${dim})`;
    ctx.fillRect(0, 0, w, h);
  }
}

interface StageProps {
  entries: Entry[];
  theme: ThemeSettings;
  w: number;
  h: number;
  wallpaper: WallpaperMode;
  layout: "grid" | "agenda";
  /** Dashed reserved-zone guides — preview only, never exported. */
  guides?: boolean;
  /** Plan name shown when the theme title is empty/default. */
  titleFallback?: string;
  /** When true, outer container has transparent background for canvas compositing. */
  forExport?: boolean;
}

/** The exact-pixel export surface. */
function ExportStage({ entries, theme, w, h, wallpaper, layout, guides, titleFallback, forExport }: StageProps) {
  const uiScale = uiScaleFor(w, h);
  const appDark = useAppDark();
  const resolved = resolveTheme(theme, appDark);
  const painted = hasBackdrop(resolved);
  const wholeCanvas = (resolved.bgScope ?? "canvas") === "canvas";
  const res = RESERVE[wallpaper];
  const padTop = h * res.top;
  const padBottom = h * res.bottom;
  const padX = Math.max(10, w * 0.025);
  const padY = wallpaper === "none" ? h * 0.03 : 0;
  return (
    <div
      data-export-stage
      className="relative flex flex-col"
      style={{
        width: w,
        height: h,
        background: forExport && painted && wholeCanvas ? "transparent" : resolved.background,
        padding: `${padTop + padY}px ${padX}px ${padBottom + padY}px`,
        boxSizing: "border-box",
        fontFamily: fontFamily(resolved.font),
      }}
    >
      {painted && wholeCanvas && <BackgroundLayer theme={resolved} scale={uiScale} transparentBase={forExport} />}
      {guides && (res.top > 0 || res.bottom > 0) && (
        <>
          {res.top > 0 && (
            <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 border-b-2 border-dashed border-white/50" style={{ height: padTop + padY, background: "rgba(255,255,255,0.05)" }}>
              <span className="absolute right-2 bottom-1 font-semibold text-white/60" style={{ fontSize: 10 * uiScale }}>
                {wallpaper === "lock" ? "clock / lock-screen area" : "status bar"}
              </span>
            </div>
          )}
          {res.bottom > 0 && (
            <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 border-t-2 border-dashed border-white/50" style={{ height: padBottom + padY, background: "rgba(255,255,255,0.05)" }}>
              <span className="absolute top-1 right-2 font-semibold text-white/60" style={{ fontSize: 10 * uiScale }}>
                {wallpaper === "lock" ? "buttons / home indicator" : "dock"}
              </span>
            </div>
          )}
        </>
      )}
      <TimetableView
        entries={entries}
        theme={{ ...resolved, showTitle: true, title: theme.title === DEFAULT_THEME.title ? "" : theme.title }}
        backdrop={wholeCanvas ? "external" : "own"}
        layout={layout}
        fill
        exact
        minHourHeight={12}
        uiScale={uiScale}
        titleFallback={titleFallback}
        className="min-h-0 flex-1"
      />
    </div>
  );
}

export default function ExportView() {
  const theme = usePlanner((s) => s.theme);
  const plan = usePlanner(activePlan);
  const sows = usePlanner((s) => s.sows);
  const ac = useAcademic();
  const appDark = useAppDark();
  const [reminder, setReminder] = useState(0);
  const [icsInclude, setIcsInclude] = useState({ classes: true, assessments: true, periods: false });

  const [deviceId, setDeviceId] = useState("iphone-16-pro-max");
  const [landscape, setLandscape] = useState(false);
  const [wallpaper, setWallpaper] = useState<WallpaperMode>("lock");
  const [guides, setGuides] = useState(true);
  const [custom, setCustom] = useState({ w: 1080, h: 1920 });
  const [layout, setLayout] = useState<"grid" | "agenda">("grid");
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [designOpen, setDesignOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);

  const device: DevicePreset = useMemo(
    () =>
      deviceId === "custom"
        ? { id: "custom", label: "Custom", group: "custom", w: custom.w, h: custom.h, dpr: 1 }
        : DEVICES.find((d) => d.id === deviceId)!,
    [deviceId, custom],
  );
  const size = deviceSize(device, landscape);

  const pickDevice = (id: string) => {
    setDeviceId(id);
    const d = DEVICES.find((x) => x.id === id);
    setLandscape(false);
    // Phones default to lock-screen wallpaper; larger devices to a plain canvas.
    if (d?.group === "iphone" || d?.group === "android") setWallpaper("lock");
    else if (d?.group === "ipad" || d?.group === "androidTablet") setWallpaper("home");
    else setWallpaper("none");
    setLayout("grid");
  };

  const render = async (asJpeg: boolean): Promise<string | null> => {
    setError("");
    await loadFont(theme.font);
    await document.fonts.ready;
    const node = stageRef.current;
    if (!node) throw new Error("Export surface not mounted");

    // Pre-decode background image in browser cache if present
    if (theme.backgroundImage) {
      try {
        const pre = new Image();
        pre.src = theme.backgroundImage;
        if (pre.decode) await pre.decode();
      } catch {
        // ignore
      }
    }

    await new Promise((r) => setTimeout(r, 100));
    const opts = { pixelRatio: 1, canvasWidth: size.w, canvasHeight: size.h, cacheBust: false };

    // Warm-up pass for Safari/WebKit image decoders
    let timetableCanvas: HTMLCanvasElement;
    try {
      await toCanvas(node, opts);
      await new Promise((r) => setTimeout(r, 60));
      timetableCanvas = await toCanvas(node, opts);
    } catch {
      timetableCanvas = await toCanvas(node, opts);
    }

    const resolved = resolveTheme(theme, appDark);
    const painted = hasBackdrop(resolved);
    const wholeCanvas = (resolved.bgScope ?? "canvas") === "canvas";

    if (painted && wholeCanvas) {
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = size.w;
      finalCanvas.height = size.h;
      const ctx = finalCanvas.getContext("2d");
      if (ctx) {
        // 1. Draw solid base background
        ctx.fillStyle = resolved.background;
        ctx.fillRect(0, 0, size.w, size.h);

        // 2. Draw background image / gradient directly on canvas
        if (resolved.backgroundImage) {
          try {
            await drawCanvasBackdropImage(ctx, resolved, size.w, size.h, uiScale);
          } catch (e) {
            console.warn("Direct canvas backdrop draw error:", e);
          }
        } else if (resolved.bgKind === "gradient") {
          drawCanvasGradient(ctx, resolved, size.w, size.h);
        }

        // 3. Draw timetable on top
        ctx.drawImage(timetableCanvas, 0, 0);

        return asJpeg
          ? finalCanvas.toDataURL("image/jpeg", 0.92)
          : finalCanvas.toDataURL("image/png");
      }
    }

    return asJpeg
      ? timetableCanvas.toDataURL("image/jpeg", 0.92)
      : timetableCanvas.toDataURL("image/png");
  };

  const slug = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan";
  const filename = `jadualku-${slug}-${device.id}${landscape && device.canRotate ? "-landscape" : ""}-${size.w}x${size.h}.${format === "jpeg" ? "jpg" : "png"}`;

  const download = async (fmt: "png" | "jpeg") => {
    setBusy(true);
    try {
      const dataUrl = await render(fmt === "jpeg");
      if (!dataUrl) throw new Error("Export produced nothing");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const dataUrl = await render(format === "jpeg");
      if (!dataUrl) throw new Error("Export produced nothing");
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: `image/${format}` });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "JadualUiTMKu timetable" });
      } else {
        setError("Sharing files isn't supported on this device — use Download.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  };

  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const wallpaperEligible = ["iphone", "ipad", "android", "androidTablet", "custom"].includes(device.group);
  const uiScale = uiScaleFor(size.w, size.h);
  // Fit the preview into its column (width) and the viewport (height).
  const previewRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(380);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => setBoxW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const previewScale = Math.min(1, boxW / size.w, (window.innerHeight * 0.72) / size.h);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Controls */}
          <div className="min-w-0 flex-1 space-y-4">
            <section className="rounded-xl border border-line bg-panel p-3">
              <h3 className="mb-2 text-xs font-bold tracking-wide text-faint uppercase">Device template</h3>
              <div className="space-y-2">
                {DEVICE_GROUPS.map((g) => (
                  <div key={g.id}>
                    <div className="mb-1 text-[10px] font-semibold text-faint">{g.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.id === "custom" ? (
                        <button
                          type="button"
                          onClick={() => pickDevice("custom")}
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                            deviceId === "custom" ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                          }`}
                        >
                          Custom size
                        </button>
                      ) : (
                        DEVICES.filter((d) => d.group === g.id).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => pickDevice(d.id)}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              deviceId === d.id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-soft">
                <span className="font-mono font-semibold">
                  {size.w}×{size.h}px
                </span>
                {device.canRotate && (
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={landscape} onChange={(e) => setLandscape(e.target.checked)} className="size-3.5 accent-(--accent)" />
                    Landscape
                  </label>
                )}
              </div>
              {deviceId === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-soft">
                    Width (px)
                    <input type="number" min={100} max={8000} value={custom.w} onChange={(e) => setCustom({ ...custom, w: Number(e.target.value) || 100 })} className={`${inputCls} mt-1`} />
                  </label>
                  <label className="text-xs text-soft">
                    Height (px)
                    <input type="number" min={100} max={8000} value={custom.h} onChange={(e) => setCustom({ ...custom, h: Number(e.target.value) || 100 })} className={`${inputCls} mt-1`} />
                  </label>
                </div>
              )}
            </section>

            <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel p-3">
              <h4 className="text-[11px] font-bold tracking-wide text-faint uppercase">Appearance</h4>
              <ModeToggle />
              <button
                type="button"
                onClick={() => setDesignOpen(true)}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10"
              >
                <ImagePlus className="size-3.5" /> Background &amp; colours
              </button>
            </section>

            <section className="rounded-xl border border-line bg-panel p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h4 className="mb-1.5 text-[11px] font-bold tracking-wide text-faint uppercase">Wallpaper safe areas</h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["lock", "Lock"],
                        ["home", "Home"],
                        ["none", "None"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        disabled={!wallpaperEligible && id !== "none"}
                        onClick={() => setWallpaper(id)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                          wallpaper === id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {wallpaperEligible && wallpaper !== "none" && (
                    <label className="mt-2 flex items-center gap-1.5 text-xs text-soft">
                      <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="size-3.5 accent-(--accent)" />
                      Show safe-area guides (preview only)
                    </label>
                  )}
                </div>
                <div>
                  <h4 className="mb-1.5 text-[11px] font-bold tracking-wide text-faint uppercase">Layout & format</h4>
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
                        onClick={() => setLayout(id)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                          layout === id ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {(["png", "jpeg"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-semibold uppercase ${
                          format === f ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {error && <p className="text-xs text-bad">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void download(format)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-on-accent disabled:opacity-50"
              >
                <Download className="size-4" /> {busy ? "Rendering…" : `Download ${format.toUpperCase()}`}
              </button>
              {canShareFiles && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void share()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-soft hover:bg-raised disabled:opacity-50"
                >
                  <Share2 className="size-4" /> Share
                </button>
              )}
              <button
                type="button"
                onClick={() => setDesignOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-soft hover:bg-raised"
              >
                <Palette className="size-4" /> Customize
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-soft hover:bg-raised"
                title="Print this timetable to A4 / PDF"
              >
                <Printer className="size-4" /> Print / PDF
              </button>
            </div>

            <section className="rounded-xl border border-line bg-panel p-3">
              <h4 className="mb-1.5 text-[11px] font-bold tracking-wide text-faint uppercase">Calendar (.ics)</h4>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
                {(
                  [
                    ["classes", "Classes (every week)"],
                    ["assessments", "SOW assessments"],
                    ["periods", "Academic periods"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={icsInclude[key]}
                      onChange={(e) => setIcsInclude({ ...icsInclude, [key]: e.target.checked })}
                      className="size-3.5 accent-(--accent)"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <label className="mb-2 flex items-center gap-2 text-xs text-soft">
                Reminder
                <select value={reminder} onChange={(e) => setReminder(Number(e.target.value))} className={`${inputCls} w-auto`}>
                  <option value={0}>None</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  const ics = buildPlanIcs({
                    plan,
                    semesterKey: ac.semesterKey,
                    state: ac.state,
                    holidays: ac.holidays,
                    sows,
                    includeClasses: icsInclude.classes,
                    includeAssessments: icsInclude.assessments,
                    includePeriods: icsInclude.periods,
                    reminderMinutes: reminder,
                  });
                  if (ics) void saveCalendarFile(`jadualku-${slug}.ics`, ics);
                  else setError("Nothing to export — check the Calendar view semester selection.");
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-soft hover:bg-raised"
              >
                <CalendarPlus className="size-4" /> Add to calendar (.ics)
              </button>
              <details className="mt-2 text-[11px] text-faint">
                <summary className="cursor-pointer font-semibold text-soft">How to import into your calendar</summary>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li>
                    <b>iPhone / iPad:</b> tap the button, then choose Calendar in the share sheet (or open the downloaded file in Files and tap Add All).
                  </li>
                  <li>
                    <b>Android:</b> tap the button and pick Google Calendar, or open the downloaded .ics file and choose Calendar.
                  </li>
                  <li>
                    <b>Google Calendar (web):</b> Settings, Import &amp; export, Import, then pick the file. Make a new calendar first so you can delete it in one go.
                  </li>
                  <li>
                    <b>Outlook / Apple Calendar (Mac) / others:</b> double-click the file or use File, Import.
                  </li>
                </ul>
              </details>
            </section>
          </div>

          {/* Preview */}
          <div ref={previewRef} className="w-full shrink-0 self-start lg:sticky lg:top-0 lg:w-[420px]">
            <h4 className="mb-1.5 text-[11px] font-bold tracking-wide text-faint uppercase">Preview — {device.label}</h4>
            <div className="mx-auto overflow-hidden rounded-xl border border-line bg-bg shadow-lg" style={{ width: size.w * previewScale, height: size.h * previewScale }}>
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: size.w, height: size.h }}>
                <ExportStage entries={plan.entries} theme={theme} w={size.w} h={size.h} wallpaper={wallpaper} layout={layout} guides={guides} titleFallback={plan.name} />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-faint">Text scales with the canvas ({uiScale.toFixed(2)}×).</p>
          </div>
        </div>
      </div>

      {/* Offscreen capture surface — real output, no guides. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -9999,
          opacity: 0.01,
        }}
        aria-hidden
      >
        <div ref={stageRef} style={{ width: size.w, height: size.h }}>
          <ExportStage
            entries={plan.entries}
            theme={theme}
            w={size.w}
            h={size.h}
            wallpaper={wallpaper}
            layout={layout}
            titleFallback={plan.name}
            forExport
          />
        </div>
      </div>

      {designOpen && <DesignDrawer onClose={() => setDesignOpen(false)} />}
    </div>
  );
}
