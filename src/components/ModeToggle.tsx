import { Moon, Palette, Sun, SunMoon } from "lucide-react";
import { usePlanner } from "../store/usePlanner.ts";
import type { ThemeMode } from "../lib/theme.ts";

const OPTIONS: { id: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { id: "theme", label: "Theme", hint: "Use the theme's own colours", icon: Palette },
  { id: "dark", label: "Dark", hint: "Force a dark timetable", icon: Moon },
  { id: "light", label: "Light", hint: "Force a light timetable", icon: Sun },
  { id: "app", label: "Auto", hint: "Match the app's dark / light switch", icon: SunMoon },
];

/** Segmented control for the timetable's own dark / light appearance (independent of the app chrome). */
export default function ModeToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const mode = usePlanner((s) => s.theme.mode ?? "theme");
  const setTheme = usePlanner((s) => s.setTheme);
  return (
    <div role="radiogroup" aria-label="Timetable appearance" className={`inline-flex rounded-lg border border-line bg-panel p-0.5 ${className}`}>
      {OPTIONS.map((o) => {
        const on = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => setTheme({ mode: o.id })}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              on ? "bg-accent/15 text-accent" : "text-soft hover:bg-raised hover:text-ink"
            }`}
          >
            <o.icon className="size-3.5" />
            {!compact && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
