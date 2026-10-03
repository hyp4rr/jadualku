import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  FolderSearch,
  GraduationCap,
  ImageDown,
  Layers,
  LayoutGrid,
  Palette,
  ShieldCheck,
  Smartphone,
  Timer,
  Wand2,
  Zap,
} from "lucide-react";
import { usePlanner, activePlan } from "../store/usePlanner.ts";
import { useAcademic } from "../lib/useAcademic.ts";
import { weekInfo } from "../lib/academic.ts";

const delay = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;

/** Decorative timetable used in the hero. Illustration only: sample subjects, no real data. */
function HeroPreview({ examDays }: { examDays: number | null }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  // [dayIndex, startHour, hours, code, hue]
  const blocks: [number, number, number, string, string][] = [
    [0, 8, 2, "ITT565", "#f0b429"],
    [0, 14, 2, "MAT423", "#5eead4"],
    [1, 10, 2, "LCC401", "#fb7185"],
    [2, 8, 2, "ITT450", "#93c5fd"],
    [2, 16, 2, "ITT569", "#a3e635"],
    [3, 10, 3, "CTU554", "#fdba74"],
    [4, 14, 2, "TAC451", "#c4b5fd"],
  ];
  const rows = 10; // 8:00 – 18:00
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)] blur-2xl" aria-hidden />
      <div className="surface reveal rounded-3xl p-4 sm:p-5 lg:-rotate-1" style={delay(2)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex gap-1" aria-hidden>
              <i className="size-2.5 rounded-full bg-bad/70" />
              <i className="size-2.5 rounded-full bg-warn/70" />
              <i className="size-2.5 rounded-full bg-good/70" />
            </span>
            <span className="text-[11px] font-semibold text-faint">My timetable</span>
          </div>
          <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold text-soft">Preview</span>
        </div>
        <div className="grid grid-cols-[2rem_repeat(5,minmax(0,1fr))] gap-x-1 text-[10px] text-faint">
          <span />
          {days.map((d) => (
            <span key={d} className="pb-1.5 text-center font-semibold">
              {d}
            </span>
          ))}
        </div>
        <div className="relative grid grid-cols-[2rem_repeat(5,minmax(0,1fr))] gap-x-1">
          <div className="grid" style={{ gridTemplateRows: `repeat(${rows}, 1.65rem)` }}>
            {Array.from({ length: rows }, (_, i) => (
              <span key={i} className="-mt-1.5 font-mono text-[9px] text-faint">
                {String(8 + i).padStart(2, "0")}
              </span>
            ))}
          </div>
          {days.map((d, di) => (
            <div key={d} className="relative border-l border-line/70" style={{ height: `${rows * 1.65}rem` }}>
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-line/40" style={{ top: `${i * 1.65}rem` }} />
              ))}
              {blocks
                .filter((b) => b[0] === di)
                .map(([, h, len, code, hue]) => (
                  <div
                    key={code}
                    className="absolute inset-x-0.5 overflow-hidden rounded-lg px-1.5 py-1 text-[9px] font-bold"
                    style={{
                      top: `${(h - 8) * 1.65 + 0.12}rem`,
                      height: `${len * 1.65 - 0.24}rem`,
                      background: `color-mix(in oklab, ${hue} 24%, var(--panel))`,
                      border: `1px solid color-mix(in oklab, ${hue} 55%, transparent)`,
                      color: "var(--ink)",
                    }}
                  >
                    {code}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="surface float-y absolute -right-2 -bottom-5 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold sm:-right-4" style={delay(0)}>
        <span className="flex size-6 items-center justify-center rounded-full bg-good/15 text-good">
          <Check className="size-3.5" />
        </span>
        No clashes
      </div>
      {examDays !== null && (
        <div className="surface float-y absolute -bottom-5 left-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold sm:-left-4" style={delay(1)}>
          <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Timer className="size-3.5" />
          </span>
          Final exam in {examDays} days
        </div>
      )}
    </div>
  );
}

export default function HomeView() {
  const plan = usePlanner(activePlan);
  const ac = useAcademic();
  const [activeStep, setActiveStep] = useState(0);

  const info = useMemo(() => (ac.semester ? weekInfo(ac.semester, ac.today, ac.state) : null), [ac.semester, ac.today, ac.state]);
  const weekNo = info?.week;

  const goTo = (view: string, tab?: string) => {
    location.hash = `#/${view}`;
    if (tab) window.dispatchEvent(new CustomEvent("jadualku:tab", { detail: tab }));
  };

  const steps = [
    {
      step: "01",
      title: "Add courses & class groups",
      desc: "Pick from 4 quick ways to get your courses into the timetable:",
      bullets: [
        { tag: "Most popular", name: "By group code", text: "Type your group code like RCS2404A, CS1102A or BA243 and add all of your semester classes in a single click." },
        { tag: "Official iCress", name: "Browse campus & faculty", text: "Select your UiTM campus (Shah Alam, Puncak Alam, Machang, Samarahan and more) to browse and add courses one by one." },
        { tag: "UiTM link", name: "Import via student ID", text: "Enter your matric number to pull your registered course timetable from the student portal." },
        { tag: "Flexible", name: "Custom manual blocks", text: "Add Friday prayers, society meetings, sports, part-time work or study sessions." },
      ],
      action: { label: "Add classes now", onClick: () => goTo("timetable", "group") },
    },
    {
      step: "02",
      title: "Instant clash detection & group swapping",
      desc: "Never worry about overlapping classes. The planner watches your schedule continuously:",
      bullets: [
        { tag: "Automatic", name: "Smart clash alerts", text: "If two classes collide, a clear banner and diagonal stripes mark the conflict right away." },
        { tag: "Quick", name: "1-click group swap", text: "Click any conflicting block to inspect other groups and change your time slot in seconds." },
        { tag: "Auto-planner", name: "Clash-free schedule generator", text: "Add subjects to your basket, press Generate, and see every clash-free combination." },
      ],
      action: { label: "Try the auto-planner", onClick: () => goTo("timetable", "planner") },
    },
    {
      step: "03",
      title: "Themes, custom wallpapers & live preview",
      desc: "Make the timetable look like yours:",
      bullets: [
        { tag: "Presets", name: "Handcrafted colour themes", text: "UiTM gold, Midnight, Paper, Matcha Strawberry, Sunset, Lavender, Pastel and more." },
        { tag: "Custom", name: "Upload your own wallpaper", text: "Use a photo, gradient or pattern. Zoom, blur, dim and choose the focal point." },
        { tag: "Live", name: "Real-time preview", text: "Adjust panel opacity, blur and typography while the timetable updates beside the controls." },
      ],
      action: {
        label: "Customize design",
        onClick: () => {
          goTo("timetable");
          window.dispatchEvent(new CustomEvent("jadualku:design"));
        },
      },
    },
    {
      step: "04",
      title: "Export wallpapers & sync your calendar",
      desc: "Take your timetable everywhere without reopening the browser:",
      bullets: [
        { tag: "Wallpaper", name: "Lock-screen wallpapers", text: "Sized for your iPhone, iPad or Android with safe zones that keep the clock and widgets clear." },
        { tag: "Images & PDF", name: "High-res PNG & PDF", text: "Print-ready files you can share with classmates on WhatsApp or Telegram." },
        { tag: "Calendar", name: "Google & Apple Calendar", text: "Download a standard .ics file that adds every weekly lecture to your calendar app." },
      ],
      action: { label: "Go to export", onClick: () => goTo("export") },
    },
  ];

  const faqs = [
    { q: "How do I use my own photo as a background?", a: "Open Customize (the palette icon in the header), find Background, switch to Image and choose a photo. You can adjust the focal point, zoom, blur, dim level and the frosted panel with a live preview." },
    { q: "Is my timetable stored on a server?", a: "No. Plans, themes and uploaded wallpapers stay in your browser's local storage on this device. Nothing is uploaded to a private database." },
    { q: "Can I keep several plans, like Plan A and Plan B?", a: "Yes. Use the plan menu in the header to create, duplicate, rename or delete plans, which is handy for add/drop periods." },
    { q: "Why can't I find a group code?", a: "Class data is read live from UiTM's iCress pages. If your faculty has not published the session yet, add your slots with the Manual tab." },
    { q: "Does it work on phones?", a: "Yes. The layout adapts to touch screens with an agenda view, a bottom navigation bar, and wallpaper exports for iPhone and Android." },
  ];

  const quick = [
    { icon: FolderSearch, title: "By group code", text: "RCS2404A, BA243 and similar", onClick: () => goTo("timetable", "group"), badge: "Fastest" },
    { icon: GraduationCap, title: "Import via matric", text: "Pull registered courses", onClick: () => goTo("timetable", "matric") },
    { icon: Wand2, title: "Auto-planner", text: "Generate clash-free plans", onClick: () => goTo("timetable", "planner") },
    { icon: CalendarRange, title: "Academic calendar", text: "Lecture weeks and holidays", onClick: () => goTo("calendar") },
  ];

  const step = steps[activeStep];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden px-4 pt-10 pb-16 sm:px-6 lg:pt-16 lg:pb-24">
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="reveal inline-flex items-center gap-2 rounded-full border border-line bg-panel/70 px-3 py-1.5 text-xs font-semibold text-soft backdrop-blur" style={delay(0)}>
              <span className="live-dot" />
              <span>Session {ac.semester?.code ?? "20264"}</span>
              {weekNo ? <span className="text-faint">· Week {weekNo}</span> : null}
            </div>
            <h1 className="reveal mt-5 text-[2.6rem] leading-[1.04] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-[4.25rem]" style={delay(1)}>
              Plan your UiTM semester in <span className="text-gold">minutes</span>.
            </h1>
            <p className="reveal mt-5 max-w-xl text-base leading-relaxed text-soft sm:text-lg" style={delay(2)}>
              Type a group code, see every class on a clean timetable, and know about clashes before they happen. Then make it yours and put it on your lock screen.
            </p>
            <div className="reveal mt-8 flex flex-wrap items-center gap-3" style={delay(3)}>
              <button type="button" onClick={() => goTo("timetable")} className="btn-accent group inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold">
                <LayoutGrid className="size-4" />
                {plan.entries.length ? "Open my timetable" : "Build my timetable"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("guide-section")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/70 px-5 py-3.5 text-sm font-bold text-soft backdrop-blur transition-colors hover:border-faint/60 hover:text-ink"
              >
                <BookOpen className="size-4" /> How it works
              </button>
            </div>
            <ul className="reveal mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-soft" style={delay(4)}>
              {[
                [ShieldCheck, "No login, stays on your device"],
                [Zap, "Live from iCress"],
                [Smartphone, "iPhone and Android wallpapers"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Zap;
                return (
                  <li key={label as string} className="flex items-center gap-1.5">
                    <I className="size-4 text-accent" /> {label as string}
                  </li>
                );
              })}
            </ul>
            {plan.entries.length > 0 && (
              <button
                type="button"
                onClick={() => goTo("today")}
                className="reveal mt-6 inline-flex items-center gap-2 rounded-xl border border-good/30 bg-good/10 px-3 py-2 text-xs font-semibold text-good transition-colors hover:bg-good/15"
                style={delay(5)}
              >
                <Check className="size-4" /> {plan.entries.length} classes in &ldquo;{plan.name}&rdquo;. See what&rsquo;s on today
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
          <HeroPreview examDays={info?.daysToExam ?? null} />
        </div>
      </section>

      {/* ------------------------------------------------------ Quick start */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quick.map((q, i) => (
            <button
              key={q.title}
              type="button"
              onClick={q.onClick}
              style={delay(i)}
              className="reveal card card-hover group relative flex items-start gap-3 p-5 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-accent transition-colors group-hover:border-accent/40 group-hover:bg-accent/10">
                <q.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold tracking-tight">{q.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-soft">{q.text}</span>
              </span>
              {q.badge && <span className="absolute top-3 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-on-accent uppercase">{q.badge}</span>}
              <ArrowRight className="absolute right-4 bottom-4 size-4 text-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- Feature bento */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="max-w-xl">
          <span className="eyebrow">Everything in one place</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Built for how UiTM students actually plan.</h2>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-6">
          <div className="card reveal p-6 md:col-span-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-bad/12 text-bad">
              <AlertTriangle className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold tracking-tight">Clashes caught before you commit</h3>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-soft">
              Every group shows Fits or Clashes while you browse. Add one anyway and the overlap is striped, listed with exact times, and ready to swap.
            </p>
          </div>
          <div className="card reveal p-6 md:col-span-2" style={delay(1)}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <Palette className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold tracking-tight">Make it yours</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-soft">Themes, fonts, photo backgrounds, dark and light.</p>
          </div>
          <div className="card reveal p-6 md:col-span-2" style={delay(2)}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <ImageDown className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold tracking-tight">Lock-screen ready</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-soft">Exact sizes for iPhone, iPad and Android, with safe zones.</p>
          </div>
          <div className="card reveal p-6 md:col-span-4" style={delay(3)}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-good/12 text-good">
              <Layers className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold tracking-tight">Exams, topics and holidays together</h3>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-soft">
              Drop in a Scheme of Work PDF or type details yourself. Exam dates, weekly topics and public holidays show up on Today and your calendar export.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Guide */}
      <section id="guide-section" className="mx-auto max-w-6xl scroll-mt-4 px-4 pt-24 sm:px-6">
        <div className="max-w-xl">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Four steps to a finished semester.</h2>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-[18rem_1fr]">
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {steps.map((s, i) => {
              const on = activeStep === i;
              return (
                <li key={s.step} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setActiveStep(i)}
                    aria-current={on ? "step" : undefined}
                    className={`flex w-60 items-start gap-3 rounded-2xl border p-4 text-left transition-all lg:w-full ${
                      on ? "border-accent/50 bg-accent/10" : "border-line bg-panel hover:border-faint/50"
                    }`}
                  >
                    <span className={`font-mono text-sm font-bold ${on ? "text-accent" : "text-faint"}`}>{s.step}</span>
                    <span className={`text-[13px] leading-snug font-semibold ${on ? "text-ink" : "text-soft"}`}>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div key={step.step} className="card anim-sheet p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
              <div className="max-w-lg">
                <h3 className="text-xl font-bold tracking-tight">{step.title}</h3>
                <p className="mt-1 text-sm text-soft">{step.desc}</p>
              </div>
              <button type="button" onClick={step.action.onClick} className="btn-accent inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold">
                {step.action.label} <ArrowRight className="size-3.5" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {step.bullets.map((b) => (
                <div key={b.name} className="rounded-2xl border border-line bg-raised/50 p-4">
                  <span className="rounded-md bg-accent/12 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">{b.tag}</span>
                  <h4 className="mt-2 text-sm font-bold">{b.name}</h4>
                  <p className="mt-1 text-[13px] leading-relaxed text-soft">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- FAQ */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pt-24 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <span className="eyebrow">Questions</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Quick answers.</h2>
          <p className="mt-3 max-w-xs text-sm text-soft">Short and honest. If something is unclear, use the report button in the menu.</p>
        </div>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {faqs.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold transition-colors hover:bg-raised/60">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-[13px] leading-relaxed text-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA */}
      <section className="px-4 pt-24 pb-24 sm:px-6">
        <div className="card relative mx-auto max-w-6xl overflow-hidden px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_50%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent)]" aria-hidden />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Ready for a clash-free semester?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-soft">Free, no sign-up, and it takes about a minute.</p>
            <button type="button" onClick={() => goTo("timetable")} className="btn-accent group mt-7 inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold">
              Build my timetable <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
