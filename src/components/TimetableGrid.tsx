import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Day, Entry, Session } from "../lib/types.ts";
import { DAYS, DAY_LABEL } from "../lib/types.ts";
import { clashedSessionKeys } from "../lib/clash.ts";
import { fmt12, fmt24, fmtRange12, fmtRange24 } from "../lib/time.ts";
import { blockColors, DEFAULT_THEME, type BlockColors, type ThemeSettings } from "../lib/theme.ts";

export interface TimetableGridProps {
  entries: Entry[];
  /** Dashed preview blocks (e.g. hovering a group card). */
  ghost?: Session[] | null;
  /** Entry ids to emphasize (clash-pair highlight from the banner). */
  highlightIds?: string[];
  onBlockClick?: (entry: Entry) => void;
  /** Pixels per hour. */
  hourHeight?: number;
  /** Fixed range override (minutes since midnight). Otherwise auto-fits. */
  rangeStart?: number;
  rangeEnd?: number;
  /** Mini mode for planner thumbnails: no labels/interactions. */
  compact?: boolean;
  /** Stretch rows to fill the container's measured height; scrolls internally if the minimum can't fit. */
  fill?: boolean;
  /** Fit the container exactly — no scrolling and no min-height floor (export canvases). Implies fill. */
  exact?: boolean;
  /** Floor for the per-hour row height in fill mode (default 40, lower for exports). */
  minHourHeight?: number;
  /** Display theme — fully props-driven so exports/compare can render any theme. */
  theme?: ThemeSettings;
  className?: string;
}

export function fmtTime(theme: ThemeSettings, m: number): string {
  return theme.timeFormat === "12h" ? fmt12(m) : fmt24(m);
}

export function fmtTimeRange(theme: ThemeSettings, start: number, end: number): string {
  return theme.timeFormat === "12h" ? fmtRange12(start, end) : fmtRange24(start, end);
}

export interface Block {
  key: string;
  session: Session;
  entry?: Entry;
  ghost?: boolean;
  clashing?: boolean;
  dimmed?: boolean;
  /** Overlap layout: slot index and total slots in its cluster. */
  col: number;
  cols: number;
}

/** Subtle diagonal stripes that sit *behind* the text — clash signal without hurting legibility. */
export function stripeBackground(colors: BlockColors): string {
  return `repeating-linear-gradient(-45deg, transparent 0 6px, color-mix(in oklab, #e5484d 22%, ${colors.effective}) 6px 8px)`;
}

/** Split overlapping blocks within a day into side-by-side columns so every class stays visible. */
export function layoutBlocks(blocks: Omit<Block, "col" | "cols">[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.session.start - b.session.start || b.session.end - a.session.end);
  const out: Block[] = [];
  let cluster: { maxEnd: number; colEnds: number[]; items: Block[] } | null = null;

  const flush = () => {
    if (!cluster) return;
    const cols = cluster.colEnds.length;
    for (const item of cluster.items) out.push({ ...item, cols });
    cluster = null;
  };

  for (const b of sorted) {
    if (!cluster || b.session.start >= cluster.maxEnd) {
      flush();
      cluster = { maxEnd: b.session.end, colEnds: [], items: [] };
    } else {
      cluster.maxEnd = Math.max(cluster.maxEnd, b.session.end);
    }
    let col = cluster.colEnds.findIndex((end) => end <= b.session.start);
    if (col === -1) {
      col = cluster.colEnds.length;
      cluster.colEnds.push(b.session.end);
    } else {
      cluster.colEnds[col] = b.session.end;
    }
    cluster.items.push({ ...b, col, cols: 1 });
  }
  flush();
  return out;
}

/**
 * Shared inner content of a timetable block — honouring theme.show + computed
 * contrast colours. Line 1 is the code (bold), then group, name, time, room,
 * lecturer. Tokens wrap whole (`overflow-wrap:anywhere` only kicks in when a
 * single token can't fit). When the block is short, lower-priority lines are
 * dropped in the order lecturer → room → time → name → group.
 */
export function BlockInner({
  entry,
  session,
  colors,
  theme,
  small,
  compact,
  clashing,
  height,
}: {
  entry: Entry;
  session: Session;
  colors: BlockColors;
  theme: ThemeSettings;
  small: boolean;
  compact: boolean;
  clashing?: boolean;
  /** Rendered block height in px — used to drop lines that wouldn't fit. */
  height?: number;
}) {
  const show = theme.show;
  const scale = compact ? 0.62 : small ? 0.8 : 1;
  const base = scale * theme.fontScale * 12;

  const tokenStyle: React.CSSProperties = { overflowWrap: "anywhere", whiteSpace: "normal" };

  if (compact) {
    return (
      <div className="relative z-10 flex h-full min-w-0 flex-col overflow-hidden px-1 py-0.5" style={{ fontSize: `${base}px` }}>
        {show.code && (
          <div className="leading-tight font-semibold" style={{ color: colors.fg, ...tokenStyle }}>
            {entry.subjectCode}
          </div>
        )}
      </div>
    );
  }

  const lineH = base * 1.3;
  const padY = small ? 4 : 8;
  const fitLines = height !== undefined ? Math.floor((height - padY) / lineH) : Infinity;
  const codeFits = fitLines >= 1;
  // Lower number = dropped first.
  const candidates = [
    { key: "group", prio: 4, on: show.group },
    { key: "name", prio: 3, on: show.name && !!entry.subjectName },
    { key: "time", prio: 2, on: show.time },
    { key: "room", prio: 1, on: show.room && !!session.room },
    { key: "lecturer", prio: 0, on: show.lecturer && !!entry.lecturer },
  ];
  const kept = new Set(
    candidates
      .filter((c) => c.on)
      .sort((a, b) => b.prio - a.prio)
      .slice(0, Math.max(0, fitLines - 1))
      .map((c) => c.key),
  );

  const line = (key: string, node: React.ReactNode, style: React.CSSProperties) =>
    kept.has(key) ? (
      <div className="leading-tight" style={{ ...tokenStyle, ...style }}>
        {node}
      </div>
    ) : null;

  return (
    <div className={`relative z-10 flex h-full min-w-0 flex-col overflow-hidden px-1.5 ${small ? "py-0.5" : "py-1"}`} style={{ fontSize: `${base}px` }}>
      {show.code && codeFits && (
        <div className="flex items-start gap-1 font-semibold leading-tight" style={{ color: colors.fg, fontSize: small ? "0.92em" : "1em" }}>
          {clashing && <AlertTriangle style={{ width: "0.85em", height: "0.85em", marginTop: "0.12em" }} className="shrink-0" />}
          <span style={tokenStyle}>{entry.subjectCode}</span>
        </div>
      )}
      {line("group", entry.group, { color: colors.fg, opacity: 0.88, fontSize: "0.86em", fontWeight: 600 })}
      {line("name", entry.subjectName, { color: colors.fg, opacity: 0.9, fontSize: "0.82em" })}
      {line("time", fmtTimeRange(theme, session.start, session.end), { color: colors.muted, opacity: 0.85, fontSize: "0.82em" })}
      {line("room", session.room, { color: colors.muted, opacity: 0.78, fontSize: "0.78em" })}
      {line("lecturer", entry.lecturer, { color: colors.muted, opacity: 0.7, fontSize: "0.74em" })}
    </div>
  );
}

/** Resolves the set of days to display honouring the theme's weekend mode. */
export function daysFor(theme: ThemeSettings, visible: Entry[], ghost?: Session[] | null): Day[] {
  const used = new Set<Day>();
  for (const e of visible) for (const s of e.sessions) used.add(s.day);
  for (const s of ghost ?? []) used.add(s.day);
  if (theme.weekend === "always") return [...DAYS];
  if (theme.weekend === "never") return DAYS.filter((d) => d !== "SAT" && d !== "SUN");
  return DAYS.filter((d) => (d !== "SAT" && d !== "SUN") || used.has(d));
}

export function autoRange(visible: Entry[], ghost?: Session[] | null, rangeStart?: number, rangeEnd?: number) {
  if (rangeStart !== undefined && rangeEnd !== undefined) return { start: rangeStart, end: rangeEnd };
  let min = Infinity;
  let max = -Infinity;
  for (const e of visible)
    for (const s of e.sessions) {
      min = Math.min(min, s.start);
      max = Math.max(max, s.end);
    }
  for (const s of ghost ?? []) {
    min = Math.min(min, s.start);
    max = Math.max(max, s.end);
  }
  if (!isFinite(min)) return { start: 8 * 60, end: 18 * 60 };
  return {
    start: Math.max(0, Math.floor(min / 60) * 60),
    end: Math.min(24 * 60, Math.ceil(max / 60) * 60),
  };
}

export default function TimetableGrid({
  entries,
  ghost,
  highlightIds,
  onBlockClick,
  hourHeight = 52,
  rangeStart,
  rangeEnd,
  compact = false,
  fill = false,
  exact = false,
  minHourHeight = 40,
  theme = DEFAULT_THEME,
  className = "",
}: TimetableGridProps) {
  const visible = useMemo(() => entries.filter((e) => !e.hidden), [entries]);
  const days = useMemo(() => daysFor(theme, visible, ghost), [theme, visible, ghost]);
  const range = useMemo(() => autoRange(visible, ghost, rangeStart, rangeEnd), [visible, ghost, rangeStart, rangeEnd]);
  const clashKeys = useMemo(() => clashedSessionKeys(visible), [visible]);

  const blocksByDay = useMemo(() => {
    const map = new Map<Day, Omit<Block, "col" | "cols">[]>();
    for (const d of days) map.set(d, []);
    visible.forEach((e) => {
      e.sessions.forEach((s, i) => {
        map.get(s.day)?.push({
          key: `${e.id}:${i}`,
          session: s,
          entry: e,
          clashing: clashKeys.has(`${e.id}:${i}`),
          dimmed: !!highlightIds?.length && !highlightIds.includes(e.id),
        });
      });
    });
    ghost?.forEach((s, i) => {
      map.get(s.day)?.push({ key: `ghost:${i}`, session: s, ghost: true });
    });
    const laid = new Map<Day, Block[]>();
    for (const [d, blocks] of map) laid.set(d, layoutBlocks(blocks));
    return laid;
  }, [days, visible, ghost, clashKeys, highlightIds]);

  const hours: number[] = [];
  for (let t = range.start; t <= range.end; t += 60) hours.push(t);

  const axisW = compact ? 0 : 48 * theme.fontScale;
  // In fill mode the rows stretch so the grid covers the whole available height.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [availH, setAvailH] = useState(0);
  const [availBodyH, setAvailBodyH] = useState(0);
  useLayoutEffect(() => {
    if (!fill) return;
    // Exact mode measures the body directly so its content always fits without scrolling.
    const el = exact ? bodyRef.current : wrapRef.current;
    if (!el) return;
    const update = () => (exact ? setAvailBodyH(el.clientHeight) : setAvailH(el.clientHeight));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill, exact]);

  const rangeHours = Math.max(1, (range.end - range.start) / 60);
  const headerH = (compact ? 18 : 33) * theme.fontScale;
  // Half the axis label height — keeps the first/last labels fully inside the grid.
  const labelPad = compact ? 0 : 8 * theme.fontScale;
  const hourEff = !fill
    ? hourHeight
    : exact
      ? Math.max(4, (availBodyH - 2 * labelPad - 1) / rangeHours)
      : availH > 0
        ? Math.max(minHourHeight, (availH - headerH - 2 * labelPad) / rangeHours)
        : hourHeight;

  const bodyHeight = 2 * labelPad + rangeHours * hourEff;
  const top = (m: number) => labelPad + ((m - range.start) / 60) * hourEff;

  return (
    <div
      ref={wrapRef}
      data-timetable-grid
      className={`flex flex-col ${className}`}
      style={{ background: theme.background, color: theme.text, height: fill ? "100%" : undefined, overflow: fill ? (exact ? "hidden" : "auto") : undefined }}
    >
      {/* Day header */}
      <div className="sticky top-0 z-20 flex" style={{ borderBottom: `1px solid ${theme.gridLine}`, background: theme.headerBg }}>
        {!compact && <div style={{ width: axisW }} className="shrink-0" />}
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
          {days.map((d) => (
            <div
              key={d}
              className={`text-center font-semibold ${compact ? "py-0.5" : "py-2"}`}
              style={{ color: theme.headerText, borderLeft: `1px solid ${theme.gridLine}`, fontSize: (compact ? 9 : 12) * theme.fontScale }}
            >
              {DAY_LABEL[d]}
            </div>
          ))}
        </div>
      </div>

      {/* Body — exact mode is flex-sized (never scrolls); other modes are fixed-height. */}
      <div ref={bodyRef} className={`flex ${fill && exact ? "min-h-0 flex-1" : "shrink-0"}`} style={{ height: fill && exact ? undefined : bodyHeight }}>
        {!compact && (
          <div className="relative shrink-0" style={{ width: axisW }}>
            {hours.map((t) => (
              <div
                key={t}
                className="absolute -translate-y-1/2 font-mono"
                style={{ top: top(t), right: 8, fontSize: 10 * theme.fontScale, color: theme.mutedText }}
              >
                {fmtTime(theme, t)}
              </div>
            ))}
          </div>
        )}
        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))`, borderLeft: `1px solid ${theme.gridLine}` }}
        >
          {days.map((d) => (
            <div key={d} className="relative" style={{ borderLeft: `1px solid ${theme.gridLine}` }}>
              {/* hour lines */}
              {hours.slice(1).map((t) => (
                <div key={t} className="absolute right-0 left-0" style={{ top: top(t), borderTop: `1px solid ${theme.gridLine}`, opacity: 0.6 }} />
              ))}
              {(blocksByDay.get(d) ?? []).map((b) => {
                const h = Math.max(10, ((b.session.end - b.session.start) / 60) * hourEff - 3);
                const y = top(b.session.start) + 1;
                const width = `calc(${100 / b.cols}% - 2px)`;
                const left = `calc(${(b.col * 100) / b.cols}% + 1px)`;
                if (b.ghost) {
                  return (
                    <div
                      key={b.key}
                      className="ghost-block pointer-events-none absolute rounded-md border-2 border-dashed border-accent"
                      style={{ top: y, height: h, left, width }}
                    />
                  );
                }
                const e = b.entry!;
                const colors = blockColors(theme, e.color);
                const small = h < 34;
                const outline = theme.blockStyle === "outline";
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={onBlockClick ? () => onBlockClick(e) : undefined}
                    title={`${e.subjectCode} ${e.group} · ${fmtTimeRange(theme, b.session.start, b.session.end)}${b.session.room ? ` · ${b.session.room}` : ""}`}
                    className={`absolute overflow-hidden text-left transition-shadow ${
                      b.dimmed ? "opacity-30" : ""
                    } ${onBlockClick ? "cursor-pointer hover:z-10 hover:shadow-lg" : "cursor-default"}`}
                    style={{
                      top: y,
                      height: h,
                      left,
                      width,
                      borderRadius: theme.radius,
                      background: b.clashing ? `${stripeBackground(colors)}, ${colors.bg}` : colors.bg,
                      border: outline ? `1.5px solid ${colors.border}` : `1px solid ${colors.border}`,
                      boxShadow: b.clashing ? "0 0 0 2px #e5484d inset" : undefined,
                    }}
                  >
                    <BlockInner entry={e} session={b.session} colors={colors} theme={theme} small={small} compact={compact} clashing={b.clashing} height={h} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
