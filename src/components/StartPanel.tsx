import { ArrowRight, FolderSearch, GraduationCap, PenLine, Search, Wand2 } from "lucide-react";

export type StartTab = "browse" | "group" | "matric" | "manual" | "planner";

const OPTIONS: { tab: StartTab; title: string; desc: string; icon: typeof Search; badge?: string; wide?: boolean }[] = [
  {
    tab: "group",
    title: "Type your group code",
    desc: "Enter something like CS2554B and every subject for that group lands on your timetable in one go.",
    icon: FolderSearch,
    badge: "Fastest",
    wide: true,
  },
  { tab: "browse", title: "Browse your campus", desc: "Pick a campus, search a subject, choose a group.", icon: Search },
  { tab: "matric", title: "Import with matric", desc: "Pull the classes you already registered.", icon: GraduationCap },
  { tab: "manual", title: "Add a custom block", desc: "Prayer, club meeting, part-time job, study time.", icon: PenLine },
];

/** First-run onboarding shown when the active plan has no classes. */
export default function StartPanel({ onPick }: { onPick: (tab: StartTab) => void }) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative w-full max-w-2xl">
        <div className="reveal text-center" style={{ ["--i" as string]: 0 }}>
          <span className="eyebrow">Your timetable is empty</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Let&rsquo;s build your <span className="text-gold">semester</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-soft">
            Pick the quickest way to get your classes in. Clashes are flagged the moment they happen, and you can mix methods any time.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o, i) => (
            <button
              key={o.tab}
              type="button"
              onClick={() => onPick(o.tab)}
              style={{ ["--i" as string]: i + 1 }}
              className={`reveal card card-hover group flex gap-4 p-5 text-left ${o.wide ? "sm:col-span-2" : ""} ${
                o.wide ? "border-accent/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_10%,var(--panel)),var(--panel)_60%)]" : ""
              }`}
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
                  o.wide ? "border-accent/40 bg-accent/15 text-accent" : "border-line bg-raised text-soft group-hover:text-accent"
                } transition-colors`}
              >
                <o.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-bold tracking-tight">{o.title}</span>
                  {o.badge && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-on-accent uppercase">{o.badge}</span>}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-soft">{o.desc}</span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-faint transition-all group-hover:translate-x-1 group-hover:text-accent" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPick("planner")}
          style={{ ["--i" as string]: 6 }}
          className="reveal mx-auto mt-6 flex items-center gap-2 rounded-full border border-line bg-panel/70 px-4 py-2 text-xs font-semibold text-soft transition-colors hover:border-accent/50 hover:text-accent"
        >
          <Wand2 className="size-3.5" /> Not sure which groups? Let the auto-planner find clash-free combinations
        </button>
      </div>
    </div>
  );
}
