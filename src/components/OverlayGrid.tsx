import { useMemo } from "react";
import type { Day, Entry } from "../lib/types.ts";
import { DAY_LABEL } from "../lib/types.ts";
import { DEFAULT_THEME, blockColors, textOn, type ThemeSettings } from "../lib/theme.ts";
import { autoRange, daysFor, fmtTime, layoutBlocks, type Block } from "./TimetableGrid.tsx";
import type { FreeWindow } from "../lib/compare.ts";

export interface OverlayGridProps {
  a: Entry[];
  b: Entry[];
  labelA: string;
  labelB: string;
  theme?: ThemeSettings;
  /** Common free windows to shade. */
  freeWindows?: FreeWindow[];
  className?: string;
}

const ONLY_A = "#38bdf8"; // plan A — sky
const ONLY_B = "#fb923c"; // plan B — orange

type DiffKind = "onlyA" | "onlyB" | "identical";

/** identity: same subject, group, day and time (rooms may differ). */
const keyOf = (e: Entry, s: { day: Day; start: number; end: number }) =>
  `${e.subjectCode}|${e.group}|${s.day}|${s.start}|${s.end}`;

/**
 * One grid diffing two plans: sessions unique to A (sky), unique to B
 * (orange), identical in both (plain block colour), plus shaded common free time.
 */
export default function OverlayGrid({ a, b, labelA, labelB, theme = DEFAULT_THEME, freeWindows = [], className = "" }: OverlayGridProps) {
  const va = useMemo(() => a.filter((e) => !e.hidden), [a]);
  const vb = useMemo(() => b.filter((e) => !e.hidden), [b]);
  const both = useMemo(() => [...va, ...vb], [va, vb]);
  const days = useMemo(() => daysFor(theme, both), [theme, both]);
  const range = useMemo(() => autoRange(both), [both]);

  const keysB = useMemo(() => {
    const m = new Set<string>();
    for (const e of vb) for (const s of e.sessions) m.add(keyOf(e, s));
    return m;
  }, [vb]);
  const keysA = useMemo(() => {
    const m = new Set<string>();
    for (const e of va) for (const s of e.sessions) m.add(keyOf(e, s));
    return m;
  }, [va]);

  const hourHeight = 52;
  const bodyHeight = ((range.end - range.start) / 60) * hourHeight;
  const top = (m: number) => ((m - range.start) / 60) * hourHeight;
  const hours: number[] = [];
  for (let t = range.start; t <= range.end; t += 60) hours.push(t);

  const blocksByDay = useMemo(() => {
    const map = new Map<Day, { block: Block; kind: DiffKind; plan: "a" | "b" }[]>();
    for (const d of days) {
      const rawA: Omit<Block, "col" | "cols">[] = [];
      const rawB: Omit<Block, "col" | "cols">[] = [];
      va.forEach((e) => e.sessions.forEach((s, i) => s.day === d && rawA.push({ key: `a:${e.id}:${i}`, session: s, entry: e })));
      vb.forEach((e) => e.sessions.forEach((s, i) => s.day === d && rawB.push({ key: `b:${e.id}:${i}`, session: s, entry: e })));
      const laidA = layoutBlocks(rawA);
      const laidB = layoutBlocks(rawB);
      map.set(d, [
        ...laidA.map((block) => ({ block, plan: "a" as const, kind: (keysB.has(keyOf(block.entry!, block.session)) ? "identical" : "onlyA") as DiffKind })),
        ...laidB.map((block) => ({ block, plan: "b" as const, kind: (keysA.has(keyOf(block.entry!, block.session)) ? "identical" : "onlyB") as DiffKind })),
      ]);
    }
    return map;
  }, [days, va, vb, keysA, keysB]);

  const freeByDay = useMemo(() => {
    const m = new Map<Day, FreeWindow[]>();
    for (const w of freeWindows) m.set(w.day, [...(m.get(w.day) ?? []), w]);
    return m;
  }, [freeWindows]);

  return (
    <div className={`flex flex-col ${className}`} style={{ background: theme.background, color: theme.text }}>
      <div className="flex" style={{ borderBottom: `1px solid ${theme.gridLine}`, background: theme.headerBg }}>
        <div className="w-12 shrink-0" />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}>
          {days.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold" style={{ color: theme.headerText, borderLeft: `1px solid ${theme.gridLine}` }}>
              {DAY_LABEL[d]}
            </div>
          ))}
        </div>
      </div>
      <div className="flex" style={{ height: bodyHeight }}>
        <div className="relative w-12 shrink-0">
          {hours.map((t) => (
            <div key={t} className="absolute -translate-y-1/2 font-mono" style={{ top: top(t), right: 8, fontSize: 10 * theme.fontScale, color: theme.mutedText }}>
              {fmtTime(theme, t)}
            </div>
          ))}
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))`, borderLeft: `1px solid ${theme.gridLine}` }}>
          {days.map((d) => (
            <div key={d} className="relative" style={{ borderLeft: `1px solid ${theme.gridLine}` }}>
              {hours.slice(1).map((t) => (
                <div key={t} className="absolute right-0 left-0" style={{ top: top(t), borderTop: `1px solid ${theme.gridLine}`, opacity: 0.6 }} />
              ))}
              {(freeByDay.get(d) ?? []).map((w) => (
                <div
                  key={`${w.start}-${w.end}`}
                  className="absolute right-0 left-0"
                  style={{ top: top(w.start), height: top(w.end) - top(w.start), background: "rgba(74,222,128,0.10)", borderTop: "1px dashed rgba(74,222,128,0.5)", borderBottom: "1px dashed rgba(74,222,128,0.5)" }}
                />
              ))}
              {(blocksByDay.get(d) ?? []).map(({ block: blk, kind }) => {
                const e = blk.entry!;
                const h = Math.max(10, ((blk.session.end - blk.session.start) / 60) * hourHeight - 3);
                const y = top(blk.session.start) + 1;
                const width = `calc(${100 / blk.cols}% - 2px)`;
                const left = `calc(${(blk.col * 100) / blk.cols}% + 1px)`;
                // Diff styling: onlyA sky / onlyB orange / identical = subject colour (dimmed).
                const color = kind === "onlyA" ? ONLY_A : kind === "onlyB" ? ONLY_B : e.color;
                const colors = blockColors(theme, color);
                const small = h < 34;
                return (
                  <div
                    key={blk.key}
                    title={`${kind === "onlyA" ? `${labelA} only` : kind === "onlyB" ? `${labelB} only` : "both plans"} — ${e.subjectCode} ${e.group} · ${fmtTime(theme, blk.session.start)}–${fmtTime(theme, blk.session.end)}`}
                    className="absolute overflow-hidden text-left"
                    style={{
                      top: y,
                      height: h,
                      left,
                      width,
                      borderRadius: theme.radius,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderLeft: `3px solid ${color}`,
                      opacity: kind === "identical" ? 0.55 : 1,
                      outline: kind === "identical" ? undefined : `2px solid ${color}55`,
                    }}
                  >
                    <div className="relative z-10 flex h-full flex-col px-1.5 py-0.5" style={{ fontSize: 10 * theme.fontScale }}>
                      <div className="flex items-center gap-1 font-semibold" style={{ color: textOn(colors.effective) }}>
                        <span className="leading-tight break-all">{e.subjectCode}</span>
                      </div>
                      {!small && (
                        <div style={{ color: textOn(colors.effective), opacity: 0.75, fontSize: "0.85em" }}>
                          {e.group} · {fmtTime(theme, blk.session.start)}–{fmtTime(theme, blk.session.end)}
                        </div>
                      )}
                      {!small && (
                        <div className="font-bold uppercase" style={{ color: textOn(colors.effective), opacity: 0.6, fontSize: "0.7em" }}>
                          {kind === "onlyA" ? labelA : kind === "onlyB" ? labelB : "both"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[11px]" style={{ borderTop: `1px solid ${theme.gridLine}`, color: theme.mutedText }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: ONLY_A }} /> only {labelA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: ONLY_B }} /> only {labelB}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm opacity-50" style={{ background: theme.accent }} /> in both
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "rgba(74,222,128,0.18)" }} /> everyone free
        </span>
      </div>
    </div>
  );
}
