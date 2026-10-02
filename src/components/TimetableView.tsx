import type { Entry, Session } from "../lib/types.ts";
import { applyBackdrop, DEFAULT_THEME, fontFamily, resolveTheme, type ThemeSettings } from "../lib/theme.ts";
import { useAppDark } from "../lib/useAppDark.ts";
import TimetableGrid from "./TimetableGrid.tsx";
import RotatedGrid from "./RotatedGrid.tsx";
import AgendaView from "./AgendaView.tsx";
import BackgroundLayer from "./BackgroundLayer.tsx";

export interface TimetableViewProps {
  entries: Entry[];
  theme?: ThemeSettings;
  ghost?: Session[] | null;
  highlightIds?: string[];
  onBlockClick?: (entry: Entry) => void;
  /** Force a layout instead of theme.layout. */
  layout?: "grid" | "agenda";
  /** Fill the container height instead of natural content height (exports). */
  fill?: boolean;
  /** Fit the container exactly — nothing may scroll (export canvases). Implies fill. */
  exact?: boolean;
  /** Floor for per-hour row height in fill mode (editor 40, exports lower). */
  minHourHeight?: number;
  /** Title used when theme.showTitle is on but theme.title is empty. */
  titleFallback?: string;
  /**
   * Multiplier applied on top of theme.fontScale and structural sizes so the
   * same component renders correctly on a 440px phone canvas or a 3840px 4K one.
   */
  uiScale?: number;
  /** "external": the parent already painted the backdrop (export canvas), so only layout/contrast adapt. */
  backdrop?: "own" | "external";
  className?: string;
}

/**
 * Theme-framed timetable: backdrop (image / gradient / pattern) + title bar +
 * frosted panel + grid/agenda selected by theme.layout. Honours theme.mode
 * (dark / light / follow the app) and picks readable text over backdrops.
 */
export default function TimetableView({
  entries,
  theme: themeProp = DEFAULT_THEME,
  ghost,
  highlightIds,
  onBlockClick,
  layout,
  fill,
  exact,
  minHourHeight,
  titleFallback,
  uiScale = 1,
  backdrop = "own",
  className = "",
}: TimetableViewProps) {
  const appDark = useAppDark();
  const theme = resolveTheme(themeProp, appDark);
  const bd = applyBackdrop(theme);
  const base = bd ? bd.grid : theme;
  const scaled: ThemeSettings = uiScale === 1 ? base : { ...base, fontScale: base.fontScale * uiScale, radius: base.radius * uiScale };
  const mode = layout ?? theme.layout;
  const title = theme.title || titleFallback || "";
  const titleColor = bd ? bd.titleColor : theme.text;
  const titleMuted = bd ? bd.titleMuted : theme.mutedText;
  const panel = bd && mode !== "agenda";
  const gap = 10 * scaled.fontScale;

  return (
    <div
      className={`relative flex flex-col overflow-hidden ${className}`}
      style={{
        background: bd ? "transparent" : theme.background,
        color: theme.text,
        fontFamily: fontFamily(theme.font),
        fontSize: 13 * scaled.fontScale,
        height: fill ? "100%" : undefined,
      }}
    >
      {bd && backdrop === "own" && <BackgroundLayer theme={theme} scale={uiScale} />}
      {theme.showTitle && title && (
        <div
          className="relative z-10 shrink-0 text-center"
          style={{
            color: titleColor,
            padding: `${10 * scaled.fontScale}px ${12 * scaled.fontScale}px`,
            textShadow: bd && titleColor.startsWith("#f") ? "0 1px 10px rgba(0,0,0,0.45)" : undefined,
          }}
        >
          <div className="font-extrabold tracking-tight" style={{ fontSize: 20 * scaled.fontScale }}>
            {title}
          </div>
          {theme.subtitle && <div style={{ color: titleMuted, fontSize: 11 * scaled.fontScale }}>{theme.subtitle}</div>}
        </div>
      )}
      <div
        className={`relative z-10 ${fill ? "min-h-0 flex-1" : ""} ${panel ? "overflow-hidden" : ""}`}
        data-export-content
        style={
          panel
            ? {
                margin: `0 ${gap}px ${gap}px`,
                background: bd.panelBg,
                backdropFilter: bd.panelBlur ? `blur(${bd.panelBlur * uiScale}px)` : undefined,
                WebkitBackdropFilter: bd.panelBlur ? `blur(${bd.panelBlur * uiScale}px)` : undefined,
                border: `1px solid ${bd.panelBorder}`,
                borderRadius: scaled.radius + 6 * uiScale,
              }
            : undefined
        }
      >
        {mode === "agenda" ? (
          <AgendaView
            entries={entries}
            theme={scaled}
            ghost={ghost}
            onEntryClick={onBlockClick}
            fill={fill}
            className={fill ? `h-full p-3 ${exact ? "overflow-hidden" : "overflow-y-auto"}` : "p-3"}
          />
        ) : theme.orientation === "days-rows" ? (
          <RotatedGrid entries={entries} theme={scaled} ghost={ghost} onBlockClick={onBlockClick} fill={fill} exact={exact} className="h-full" />
        ) : (
          <TimetableGrid
            entries={entries}
            theme={scaled}
            ghost={ghost}
            highlightIds={highlightIds}
            onBlockClick={onBlockClick}
            hourHeight={52 * uiScale}
            fill={fill}
            exact={exact}
            minHourHeight={minHourHeight}
            className={fill ? "h-full" : undefined}
          />
        )}
      </div>
    </div>
  );
}
