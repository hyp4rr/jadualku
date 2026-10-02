import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Day, Entry, Session } from "../lib/types.ts";
import { DAY_LABEL } from "../lib/types.ts";
import { clashedSessionKeys } from "../lib/clash.ts";
import { blockColors, DEFAULT_THEME, type ThemeSettings } from "../lib/theme.ts";
import { autoRange, BlockInner, daysFor, fmtTime, layoutBlocks, stripeBackground, type Block } from "./TimetableGrid.tsx";

export interface RotatedGridProps {
  entries: Entry[];
  theme?: ThemeSettings;
  ghost?: Session[] | null;
  onBlockClick?: (entry: Entry) => void;
  /** Stretch rows to fill the container height. */
  fill?: boolean;
  /** Fit exactly — rows shrink to the container instead of overflowing (exports). Implies fill. */
  exact?: boolean;
  className?: string;
}

/** Rotated layout: days as rows, time running left→right. Fits tall/narrow outputs. */
export default function RotatedGrid({ entries, theme = DEFAULT_THEME, ghost, onBlockClick, fill = false, exact = false, className = "" }: RotatedGridProps) {
  const visible = useMemo(() => entries.filter((e) => !e.hidden), [entries]);
  const days = useMemo(() => daysFor(theme, visible, ghost), [theme, visible, ghost]);
  const range = useMemo(() => autoRange(visible, ghost), [visible, ghost]);
  const clashKeys = useMemo(() => clashedSessionKeys(visible), [visible]);

  const byDay = useMemo(() => {
    const map = new Map<Day, Block[]>();
    for (const d of days) {
      const blocks: Omit<Block, "col" | "cols">[] = [];
      visible.forEach((e) =>
        e.sessions.forEach((s, i) => {
          if (s.day === d)
            blocks.push({ key: `${e.id}:${i}`, session: s, entry: e, clashing: clashKeys.has(`${e.id}:${i}`) });
        }),
      );
      ghost?.forEach((s, i) => {
        if (s.day === d) blocks.push({ key: `ghost:${d}:${i}`, session: s, ghost: true });
      });
      map.set(d, layoutBlocks(blocks));
    }
    return map;
  }, [days, visible, ghost, clashKeys]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [availH, setAvailH] = useState(0);
  const [trackW, setTrackW] = useState(0);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    const update = () => {
      if (wrap) setAvailH(wrap.clientHeight);
      if (track) setTrackW(track.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrap) ro.observe(wrap);
    if (track) ro.observe(track);
    return () => ro.disconnect();
  }, []);

  const hours: number[] = [];
  for (let t = range.start; t <= range.end; t += 60) hours.push(t);
  const totalMin = Math.max(60, range.end - range.start);
  const labelW = 44 * theme.fontScale;
  const headerH = 22 * theme.fontScale;
  const ROW_H = 30 * theme.fontScale;
  const ROW_GAP = 3 * theme.fontScale;
  // Horizontal position as a percentage of the timeline area.
  const pct = (m: number) => ((m - range.start) / totalMin) * 100;
  const rowH = fill && availH > 0 && days.length ? Math.max(0, (availH - headerH) / days.length) : 0;

  return (
    <div
      ref={wrapRef}
      className={`flex flex-col ${className}`}
      style={{ background: theme.background, color: theme.text, height: fill ? "100%" : undefined, overflow: fill ? (exact ? "hidden" : "auto") : undefined }}
    >
      {/* hour header — spacer aligns the label track with the day-row tracks below */}
      <div className="flex shrink-0" style={{ height: headerH, borderBottom: `1px solid ${theme.gridLine}`, background: theme.headerBg }}>
        <div className="shrink-0" style={{ width: labelW, borderRight: `1px solid ${theme.gridLine}` }} />
        <div ref={trackRef} className="relative flex-1 overflow-hidden">
          {hours.map((t, i) => (
            <div
              key={t}
              className="absolute font-mono whitespace-nowrap"
              style={{
                left: `${pct(t)}%`,
                // Labels centre on their tick; first/last hug the edges so they never clip outside the header.
                transform: i === 0 ? "translateX(0)" : i === hours.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                fontSize: 9.5 * theme.fontScale,
                color: theme.mutedText,
                top: 3,
              }}
            >
              {fmtTime(theme, t)}
            </div>
          ))}
        </div>
      </div>
      {days.map((d) => {
        const blocks = byDay.get(d) ?? [];
        const rows = blocks.reduce((m, b) => Math.max(m, b.cols), 1);
        const naturalH = rows * (ROW_H + ROW_GAP) + 4;
        const dayH = fill && rowH > 0 ? (exact ? rowH : Math.max(naturalH, rowH)) : naturalH;
        return (
          <div key={d} className="flex shrink-0" style={{ borderBottom: `1px solid ${theme.gridLine}`, height: dayH }}>
            <div
              className="flex shrink-0 items-center justify-center font-semibold"
              style={{ width: labelW, color: theme.headerText, background: theme.headerBg, borderRight: `1px solid ${theme.gridLine}`, fontSize: 11 * theme.fontScale }}
            >
              {DAY_LABEL[d].slice(0, 3)}
            </div>
            <div className="relative flex-1">
              {hours.map((t) => (
                <div key={t} className="absolute top-0 bottom-0" style={{ left: `${pct(t)}%`, borderLeft: `1px solid ${theme.gridLine}`, opacity: 0.5 }} />
              ))}
              {blocks.map((b) => {
                const x = pct(b.session.start);
                const w = Math.max(0, pct(b.session.end) - pct(b.session.start));
                const y = 2 + (b.col / b.cols) * (dayH - 4);
                const h = Math.max(6, (dayH - 4) / b.cols - ROW_GAP);
                if (b.ghost) {
                  return (
                    <div
                      key={b.key}
                      className="ghost-block pointer-events-none absolute rounded-md border-2 border-dashed border-accent"
                      style={{ top: y, height: h, left: `calc(${x}% + 1px)`, width: `calc(${w}% - 2px)` }}
                    />
                  );
                }
                const e = b.entry!;
                const colors = blockColors(theme, e.color);
                // Real rendered width decides the compact layout — fall back to
                // a rough guess until the track has been measured.
                const small = trackW > 0 ? (w / 100) * trackW < 110 : (w / 100) * 400 < 90;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={onBlockClick ? () => onBlockClick(e) : undefined}
                    className={`absolute overflow-hidden text-left ${onBlockClick ? "cursor-pointer" : "cursor-default"}`}
                    style={{
                      top: y,
                      height: h,
                      left: `calc(${x}% + 1px)`,
                      width: `calc(${w}% - 2px)`,
                      borderRadius: theme.radius,
                      background: b.clashing ? `${stripeBackground(colors)}, ${colors.bg}` : colors.bg,
                      border: theme.blockStyle === "outline" ? `1.5px solid ${colors.border}` : `1px solid ${colors.border}`,
                      boxShadow: b.clashing ? "0 0 0 2px #e5484d inset" : undefined,
                    }}
                  >
                    <BlockInner entry={e} session={b.session} colors={colors} theme={theme} small={small} compact={false} clashing={b.clashing} height={h} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
