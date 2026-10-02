import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { IdText } from "../lib/api.ts";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
      <div>{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-1 font-semibold underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-soft uppercase">{label}</span>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none";

/** Compact input without w-full — for fixed-width cells inside dense rows/grids. */
export const inputSm =
  "rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export const btnCls =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors";
export const btnPrimary = `${btnCls} bg-accent text-on-accent hover:bg-accent-deep`;
export const btnGhost = `${btnCls} border border-line bg-panel text-ink hover:bg-raised`;
export const btnDanger = `${btnCls} border border-bad/50 text-bad hover:bg-bad/10`;

/** Searchable dropdown for campus / faculty lists. */
export function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  value: string;
  options: IdText[];
  placeholder: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Some API texts already carry the id prefix ("A - UITM KAMPUS…") — don't repeat it.
  const label = (o: IdText) =>
    o.text.toUpperCase().startsWith(`${o.id.toUpperCase()} `) || o.text.toUpperCase().startsWith(`${o.id.toUpperCase()}-`)
      ? o.text
      : `${o.id} — ${o.text}`;

  const filtered = options.filter((o) => `${o.id} ${o.text}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        <span className={selected ? "" : "text-faint"}>{selected ? label(selected) : placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-faint" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="size-4 text-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-raised"
              >
                <span>
                  <span className="font-mono font-semibold">{o.id}</span>{" "}
                  <span className="text-soft">{o.text.toUpperCase().startsWith(`${o.id.toUpperCase()} `) ? o.text.slice(o.id.length).replace(/^\s*-\s*/, "") : o.text}</span>
                </span>
                {o.id === value && <Check className="size-4 text-accent" />}
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-3 text-sm text-faint">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-faint hover:bg-raised hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
