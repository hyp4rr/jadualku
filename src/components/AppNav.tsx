import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Ellipsis } from "lucide-react";

export interface NavItem<Id extends string = string> {
  id: Id;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** Desktop pill navigation with a sliding active indicator. */
export function SlidingNav<Id extends string>({
  items,
  current,
  onNav,
}: {
  items: readonly NavItem<Id>[];
  current: Id;
  onNav: (id: Id) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const wrap = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current.get(current);
      const box = wrap.current;
      if (!el || !box) return setPos(null);
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      setPos({ x: a.left - b.left, w: a.width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [current, items]);

  return (
    <nav aria-label="Primary" className="surface relative hidden rounded-full p-1 sm:flex">
      <div ref={wrap} className="relative flex items-center">
        {pos && (
          <span
            aria-hidden
            className="absolute top-0 bottom-0 left-0 rounded-full bg-accent/15 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_35%,transparent)] transition-[transform,width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(${pos.x}px)`, width: pos.w }}
          />
        )}
        {items.map((v) => {
          const on = current === v.id;
          return (
            <button
              key={v.id}
              ref={(el) => {
                if (el) refs.current.set(v.id, el);
              }}
              type="button"
              onClick={() => onNav(v.id)}
              aria-current={on ? "page" : undefined}
              className={`relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                on ? "text-accent" : "text-soft hover:text-ink"
              }`}
            >
              <v.icon className="size-3.5" />
              <span className="hidden md:inline">{v.label}</span>
              <span className="sr-only md:hidden">{v.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Phone bottom navigation: four primary views + a "More" sheet trigger. */
export function BottomNav<Id extends string>({
  items,
  current,
  onNav,
  onMore,
  moreActive,
}: {
  items: readonly NavItem<Id>[];
  current: Id;
  onNav: (id: Id) => void;
  onMore: () => void;
  moreActive: boolean;
}) {
  return (
    <nav
      aria-label="Primary"
      className="surface fixed inset-x-2 bottom-2 z-30 grid grid-cols-5 rounded-2xl px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:hidden print:hidden"
    >
      {items.map((v) => {
        const on = current === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onNav(v.id)}
            aria-current={on ? "page" : undefined}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-colors ${
              on ? "bg-accent/15 text-accent" : "text-soft"
            }`}
          >
            <v.icon className="size-[18px]" />
            {v.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-colors ${
          moreActive ? "bg-accent/15 text-accent" : "text-soft"
        }`}
      >
        <Ellipsis className="size-[18px]" />
        More
      </button>
    </nav>
  );
}
