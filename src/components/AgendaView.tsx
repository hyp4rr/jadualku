import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Day, Entry, Session } from "../lib/types.ts";
import { DAY_LABEL, DAYS as DAY_ORDER } from "../lib/types.ts";
import { clashedSessionKeys } from "../lib/clash.ts";
import { blockColors, DEFAULT_THEME, hasBackdrop, type ThemeSettings } from "../lib/theme.ts";
import { daysFor, fmtTimeRange } from "./TimetableGrid.tsx";

export interface AgendaViewProps {
  entries: Entry[];
  theme?: ThemeSettings;
  ghost?: Session[] | null;
  onEntryClick?: (entry: Entry) => void;
  compact?: boolean;
  /** Stretch day cards to fill the container height (export canvases). */
  fill?: boolean;
  className?: string;
}

interface Row {
  entry: Entry;
  session: Session;
  key: string;
  clashing: boolean;
}

/** Card-per-day list layout — the default on narrow screens and phone wallpapers. */
export default function AgendaView({ entries, theme = DEFAULT_THEME, ghost, onEntryClick, compact = false, fill = false, className = "" }: AgendaViewProps) {
  const visible = useMemo(() => entries.filter((e) => !e.hidden), [entries]);
  const clashKeys = useMemo(() => clashedSessionKeys(visible), [visible]);

  const days = useMemo(() => {
    const allowed = new Set(daysFor(theme, visible, ghost));
    const withSessions = new Set<Day>();
    for (const e of visible) for (const s of e.sessions) if (allowed.has(s.day)) withSessions.add(s.day);
    return DAY_ORDER.filter((d) => withSessions.has(d));
  }, [theme, visible, ghost]);

  const rowsByDay = useMemo(() => {
    const map = new Map<Day, Row[]>();
    for (const d of days) map.set(d, []);
    visible.forEach((e) =>
      e.sessions.forEach((s, i) => {
        if (map.has(s.day)) map.get(s.day)!.push({ entry: e, session: s, key: `${e.id}:${i}`, clashing: clashKeys.has(`${e.id}:${i}`) });
      }),
    );
    for (const rows of map.values()) rows.sort((a, b) => a.session.start - b.session.start || a.session.end - b.session.end);
    return map;
  }, [days, visible, clashKeys]);

  const empty = !days.length;
  const cardPad = 8 * theme.fontScale;
  const isBackdrop = hasBackdrop(theme);
  const p = Math.min(1, Math.max(0, theme.panelOpacity ?? 0.65));
  return (
    <div
      data-agenda-view
      className={`flex flex-col ${className}`}
      style={{ color: theme.text, gap: cardPad, height: fill ? "100%" : undefined }}
    >
      {empty && (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{
            background: isBackdrop
              ? `color-mix(in oklab, ${theme.surface} ${Math.round(p * 100)}%, transparent)`
              : theme.surface,
            color: theme.mutedText,
            border: `1px solid ${theme.gridLine}`,
            backdropFilter: (theme.panelBlur ?? 10) ? `blur(${theme.panelBlur ?? 10}px)` : undefined,
            WebkitBackdropFilter: (theme.panelBlur ?? 10) ? `blur(${theme.panelBlur ?? 10}px)` : undefined,
          }}
        >
          No classes yet.
        </div>
      )}
      {days.map((d) => (
        <section
          key={d}
          className="flex flex-col overflow-hidden rounded-xl"
          style={{
            background: isBackdrop
              ? `color-mix(in oklab, ${theme.surface} ${Math.round(p * 100)}%, transparent)`
              : theme.surface,
            border: `1px solid ${theme.gridLine}`,
            flex: fill ? "1 1 0" : undefined,
            minHeight: 0,
            backdropFilter: (theme.panelBlur ?? 10) ? `blur(${theme.panelBlur ?? 10}px)` : undefined,
            WebkitBackdropFilter: (theme.panelBlur ?? 10) ? `blur(${theme.panelBlur ?? 10}px)` : undefined,
          }}
        >
          <header
            className="px-3 py-2 font-bold tracking-wide uppercase"
            style={{
              background: isBackdrop
                ? `color-mix(in oklab, ${theme.headerBg} ${Math.round(p * 100)}%, transparent)`
                : theme.headerBg,
              color: theme.headerText,
              borderBottom: `1px solid ${theme.gridLine}`,
              fontSize: 12 * theme.fontScale,
            }}
          >
            {DAY_LABEL[d]}
          </header>
          <ul className={fill ? "flex min-h-0 flex-1 flex-col justify-evenly" : undefined}>
            {(rowsByDay.get(d) ?? []).map((r) => {
              const colors = blockColors(theme, r.entry.color);
              const show = theme.show;
              return (
                <li key={r.key} className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
                  <button
                    type="button"
                    disabled={!onEntryClick}
                    onClick={onEntryClick ? () => onEntryClick(r.entry) : undefined}
                    className={`flex w-full items-stretch gap-3 px-3 py-2.5 text-left ${fill ? "min-h-0 flex-1 items-center" : ""} ${onEntryClick ? "cursor-pointer" : "cursor-default"}`}
                    style={{ borderBottom: `1px solid ${theme.gridLine}` }}
                  >
                    <div className="w-1 shrink-0 rounded-full" style={{ background: r.entry.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {show.code && (
                          <span className="font-semibold" style={{ color: colors.fg === theme.text || theme.blockStyle === "soft" ? theme.text : colors.fg, fontSize: 13 * theme.fontScale }}>
                            {r.entry.subjectCode}
                          </span>
                        )}
                        {show.group && (
                          <span className="font-medium" style={{ color: r.entry.color, fontSize: 11 * theme.fontScale }}>
                            {r.entry.group}
                          </span>
                        )}
                        {r.clashing && (
                          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: "#e5484d22", color: "#e5484d" }}>
                            <AlertTriangle className="size-2.5" /> clash
                          </span>
                        )}
                      </div>
                      {show.name && r.entry.subjectName && (
                        <div className="truncate" style={{ color: theme.mutedText, fontSize: 11 * theme.fontScale }}>
                          {r.entry.subjectName}
                        </div>
                      )}
                      {show.lecturer && r.entry.lecturer && !compact && (
                        <div className="truncate" style={{ color: theme.mutedText, fontSize: 10 * theme.fontScale }}>
                          {r.entry.lecturer}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {show.time && (
                        <div className="font-mono font-medium" style={{ color: theme.text, fontSize: 11 * theme.fontScale }}>
                          {fmtTimeRange(theme, r.session.start, r.session.end)}
                        </div>
                      )}
                      {show.room && r.session.room && (
                        <div style={{ color: theme.mutedText, fontSize: 10 * theme.fontScale }}>{r.session.room}</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
