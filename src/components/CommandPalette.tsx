import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { CornerDownLeft, Search } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: ComponentType<{ className?: string }>;
  hint?: string;
  keywords?: string;
  run: () => void;
}

const score = (c: Command, q: string): number => {
  const hay = `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase();
  const label = c.label.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.includes(q)) return 2;
  if (hay.includes(q)) return 1;
  // loose subsequence match ("grp" -> "group code")
  let i = 0;
  for (const ch of hay) if (ch === q[i]) i++;
  return i === q.length ? 0.5 : 0;
};

export default function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return commands;
    return commands
      .map((c) => ({ c, s: score(c, t) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c?: Command) => {
    if (!c) return;
    onClose();
    // let the palette unmount before the action opens another dialog
    setTimeout(c.run, 0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="anim-fade fixed inset-0 z-[80] flex items-start justify-center bg-black/55 px-3 pt-[12vh] backdrop-blur-[3px]" role="dialog" aria-modal aria-label="Command palette" onMouseDown={onClose}>
      <div className="anim-sheet surface flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="size-4 shrink-0 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to a page or action…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded
            aria-controls="cmd-list"
            style={{ outline: "none" }}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none focus-visible:outline-none placeholder:text-faint"
          />
          <span className="kbd">esc</span>
        </div>
        <ul id="cmd-list" ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-faint">Nothing matches &ldquo;{q}&rdquo;.</li>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup && !q ? c.group : null;
            lastGroup = c.group;
            const on = i === active;
            return (
              <li key={c.id} role="presentation">
                {header && <div className="eyebrow px-3 pt-3 pb-1">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-i={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${on ? "bg-accent/12 text-ink" : "text-soft"}`}
                >
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${on ? "border-accent/40 bg-accent/15 text-accent" : "border-line bg-raised text-faint"}`}>
                    <c.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{c.label}</span>
                    {c.hint && <span className="block truncate text-xs text-faint">{c.hint}</span>}
                  </span>
                  {q && <span className="shrink-0 text-[10px] font-semibold tracking-wide text-faint uppercase">{c.group}</span>}
                  {on && <CornerDownLeft className="size-3.5 shrink-0 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-faint">
          <span className="flex items-center gap-1">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span className="flex items-center gap-1">
            <span className="kbd">↵</span> select
          </span>
        </div>
      </div>
    </div>
  );
}
