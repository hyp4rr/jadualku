import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FolderSearch,
  GraduationCap,
  HelpCircle,
  Layers,
  LayoutGrid,
  Palette,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { usePlanner, activePlan } from "../store/usePlanner.ts";
import { useAcademic } from "../lib/useAcademic.ts";
import { weekInfo } from "../lib/academic.ts";

export default function HomeView() {
  const plan = usePlanner(activePlan);
  const ac = useAcademic();
  const [activeStep, setActiveStep] = useState(0);

  const weekNo = ac.semester ? weekInfo(ac.semester, ac.today, ac.state).week : null;

  const goTo = (view: string, tab?: string) => {
    location.hash = `#/${view}`;
    if (tab) {
      window.dispatchEvent(new CustomEvent("jadualku:tab", { detail: tab }));
    }
  };

  const steps = [
    {
      step: "01",
      title: "Add Courses & Class Groups",
      desc: "Pick from 4 quick and easy ways to add your courses into the timetable:",
      bullets: [
        {
          tag: "Most Popular",
          tagCls: "bg-accent/15 text-accent",
          name: "By Group Code",
          text: "Type in your group code like RCS2404A, CS1102A, or BA243 to add all of your semester classes in a single click!",
        },
        {
          tag: "Official iCress",
          tagCls: "bg-blue-500/15 text-blue-400",
          name: "Browse Campus & Faculty",
          text: "Select your UiTM campus (Shah Alam, Puncak Alam, Machang, Samarahan, etc.) to browse and add courses individually.",
        },
        {
          tag: "UiTM Link",
          tagCls: "bg-purple-500/15 text-purple-400",
          name: "Import via Student ID",
          text: "Enter your UiTM student matric number to automatically pull your registered course timetable from the student portal.",
        },
        {
          tag: "Flexible",
          tagCls: "bg-emerald-500/15 text-emerald-400",
          name: "Custom Manual Blocks",
          text: "Add personal commitments such as Friday prayers, society meetings, sports, part-time jobs, or study sessions.",
        },
      ],
      action: { label: "Add Classes Now", onClick: () => goTo("timetable", "group") },
    },
    {
      step: "02",
      title: "Instant Clash Detection & Group Swapping",
      desc: "Never worry about overlapping classes. JadualKu continuously monitors your schedule:",
      bullets: [
        {
          tag: "Automatic",
          tagCls: "bg-red-500/15 text-red-400",
          name: "Smart Clash Alerts",
          text: "If two classes collide at the same time, clear warning banners and diagonal stripe patterns highlight the conflict immediately.",
        },
        {
          tag: "Quick",
          tagCls: "bg-accent/15 text-accent",
          name: "1-Click Group Swap",
          text: "Click any conflicting block to inspect alternative groups and change your time slot in seconds.",
        },
        {
          tag: "Auto-Planner",
          tagCls: "bg-amber-500/15 text-amber-400",
          name: "Clash-Free Schedule Generator",
          text: "Add all desired courses to your Basket, click Generate, and let the algorithm discover every clash-free schedule combination!",
        },
      ],
      action: { label: "Try Auto-Planner", onClick: () => goTo("timetable", "planner") },
    },
    {
      step: "03",
      title: "Themes, Custom Wallpapers & Live Preview",
      desc: "Make your timetable aesthetically pleasing and tailored to your personal taste:",
      bullets: [
        {
          tag: "Presets",
          tagCls: "bg-accent/15 text-accent",
          name: "Handcrafted Color Themes",
          text: "Select from curated presets: UiTM Purple & Gold, Midnight Dark, Paper Minimal, Matcha Strawberry, Sunset, Lavender, and Pastel.",
        },
        {
          tag: "Custom",
          tagCls: "bg-pink-500/15 text-pink-400",
          name: "Upload Your Own Wallpaper",
          text: "Upload your favorite anime art, pet photo, landscape, or aesthetic background wallpaper directly from your device.",
        },
        {
          tag: "Live Preview",
          tagCls: "bg-emerald-500/15 text-emerald-400",
          name: "Real-Time Side Preview",
          text: "Adjust frosted glass panel opacity, blur, dim, and typography while watching the live timetable preview update beside your controls!",
        },
      ],
      action: {
        label: "Customize Design",
        onClick: () => {
          goTo("timetable");
          window.dispatchEvent(new CustomEvent("jadualku:design"));
        },
      },
    },
    {
      step: "04",
      title: "Export to Phone Wallpapers & Calendar Sync",
      desc: "Take your timetable with you everywhere without needing to reopen the browser:",
      bullets: [
        {
          tag: "Wallpaper",
          tagCls: "bg-purple-500/15 text-purple-400",
          name: "Lockscreen Wallpapers",
          text: "Tailored to your iPhone or Android model with dedicated clock and widget safe zones so nothing gets obstructed.",
        },
        {
          tag: "Images & PDF",
          tagCls: "bg-blue-500/15 text-blue-400",
          name: "High-Res PNG & PDF",
          text: "Export crisp, print-ready files to print or share with classmates in WhatsApp and Telegram groups.",
        },
        {
          tag: "Calendar",
          tagCls: "bg-amber-500/15 text-amber-400",
          name: "Sync to Google & Apple Calendar",
          text: "Download standard .ics calendar files that automatically add recurring weekly lectures to your calendar app.",
        },
      ],
      action: { label: "Go to Export", onClick: () => goTo("export") },
    },
  ];

  const faqs = [
    {
      q: "How do I upload a custom image background / wallpaper?",
      a: "Click the 'Customize' button (palette icon) in the top-right header. In the 'Background' section, switch to 'Image' and choose a photo from your device. You can adjust the focal point, zoom, blur, dim level, and frosted glass opacity with live preview.",
    },
    {
      q: "Is my personal timetable data stored on any external server?",
      a: "No! JadualKu is 100% client-side and offline-first. All your timetables, custom themes, and uploaded wallpapers remain securely in your device's browser memory (localStorage). Nothing is uploaded to any private database.",
    },
    {
      q: "Can I create multiple timetable plans (e.g. Plan A vs Plan B)?",
      a: "Yes! Click the plan dropdown in the header (e.g. 'My timetable') and choose 'New plan' or 'Duplicate'. You can save multiple timetable drafts to prepare for course registration (add/drop) periods.",
    },
    {
      q: "Why is a specific group code missing from the search?",
      a: "Data is queried live from UiTM's official iCress timetable servers. If your faculty has not published the timetable for the new session or code yet, you can use the 'Manual' tab to quickly add your class slots.",
    },
    {
      q: "Does JadualKu work on smartphones (iPhone / Android)?",
      a: "Yes! JadualKu is fully responsive with an Agenda card layout tailored for mobile touch screens and specialized phone lockscreen wallpaper exports.",
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-bg text-ink">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-line bg-panel/40 px-4 py-12 sm:px-6 lg:py-16">
        <div className="absolute inset-0 pointer-events-none opacity-20 [background:radial-gradient(circle_at_50%_0%,var(--accent)_0%,transparent_60%)]" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-soft shadow-sm">
            <span className="flex size-2 rounded-full bg-good animate-pulse" />
            <span>UiTM Session {ac.semester?.session ?? "20264"}</span>
            {weekNo ? <span>· Week {weekNo}</span> : null}
          </div>

          {/* Main Title */}
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-ink">
            Fastest &amp; Easiest <br className="hidden sm:inline" />
            <span className="text-accent">UiTM Timetable Planner</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-soft sm:text-base">
            Build clean, clash-free UiTM schedules in seconds. Search by group code, customize themes and wallpapers
            with live preview, and export high-resolution phone wallpapers tailored for your lockscreen.
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goTo("timetable")}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-on-accent shadow-md shadow-accent/20 transition-all hover:brightness-110 active:scale-95"
            >
              <LayoutGrid className="size-4" />
              <span>Build Timetable Now</span>
              <ArrowRight className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                document.getElementById("guide-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-5 py-3 text-sm font-bold text-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <BookOpen className="size-4" />
              <span>User Guide &amp; Tutorial</span>
            </button>
          </div>

          {/* Plan status indicator */}
          {plan.entries.length > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-good/40 bg-good/10 px-3 py-1.5 text-xs font-semibold text-good">
              <CheckCircle2 className="size-4" />
              <span>You have {plan.entries.length} active classes in your schedule ({plan.name}).</span>
              <button
                type="button"
                onClick={() => goTo("timetable")}
                className="underline hover:text-ink font-bold ml-1"
              >
                View Timetable →
              </button>
            </div>
          )}

          {/* Quick Shortcuts Grid */}
          <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-left">
            <button
              type="button"
              onClick={() => goTo("timetable", "group")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <FolderSearch className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">By Group Code</div>
              <div className="text-[11px] text-faint">RCS2404A, BA243, etc.</div>
            </button>

            <button
              type="button"
              onClick={() => goTo("timetable", "matric")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <GraduationCap className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">Import via Matric</div>
              <div className="text-[11px] text-faint">Pull registered courses</div>
            </button>

            <button
              type="button"
              onClick={() => goTo("timetable", "planner")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <Wand2 className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">Auto-Planner</div>
              <div className="text-[11px] text-faint">Generate clash-free plans</div>
            </button>

            <button
              type="button"
              onClick={() => goTo("calendar")}
              className="group flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-accent hover:bg-raised"
            >
              <div className="flex items-center justify-between text-accent">
                <CalendarRange className="size-5" />
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="text-xs font-bold text-ink">Academic Calendar</div>
              <div className="text-[11px] text-faint">Lecture weeks &amp; holidays</div>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Badges Bar */}
      <section className="border-b border-line bg-panel/70 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-around gap-4 text-xs font-semibold text-soft">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            <span>Fast &amp; Direct from iCress</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-good" />
            <span>100% Private, No Login Required</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-accent" />
            <span>Phone Lockscreen Wallpapers</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-amber-400" />
            <span>Offline-Ready (Client-Side)</span>
          </div>
        </div>
      </section>

      {/* Interactive Step-by-Step Guide */}
      <section id="guide-section" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-ink">
            How to Use JadualKu: Step-by-Step Guide
          </h2>
          <p className="mt-2 text-sm text-soft">
            Follow these 4 simple steps to build and customize your dream semester timetable.
          </p>
        </div>

        {/* Step selector tabs */}
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((s, idx) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                activeStep === idx
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-line bg-panel text-soft hover:bg-raised"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold ${activeStep === idx ? "text-accent" : "text-faint"}`}>
                  Step {s.step}
                </span>
                {activeStep === idx && <span className="size-1.5 rounded-full bg-accent" />}
              </div>
              <span className={`text-xs font-bold truncate ${activeStep === idx ? "text-ink" : "text-soft"}`}>
                {s.title}
              </span>
            </button>
          ))}
        </div>

        {/* Active Step Card */}
        <div className="mt-4 rounded-2xl border border-line bg-panel p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <span className="inline-block text-xs font-extrabold uppercase tracking-wider text-accent">
                Step {steps[activeStep].step}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-ink mt-0.5">
                {steps[activeStep].title}
              </h3>
              <p className="text-xs sm:text-sm text-soft mt-1">
                {steps[activeStep].desc}
              </p>
            </div>
            <button
              type="button"
              onClick={steps[activeStep].action.onClick}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-on-accent transition-transform hover:scale-102 active:scale-98"
            >
              <span>{steps[activeStep].action.label}</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {steps[activeStep].bullets.map((b) => (
              <div key={b.name} className="flex flex-col gap-1 rounded-xl border border-line bg-paper/50 p-3.5">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${b.tagCls}`}>
                    {b.tag}
                  </span>
                  <span className="text-xs font-bold text-ink">{b.name}</span>
                </div>
                <p className="text-xs leading-relaxed text-soft mt-1">{b.text}</p>
              </div>
            ))}
          </div>

          {/* Navigation between steps */}
          <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs font-semibold">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
              className="rounded-lg border border-line px-3 py-1.5 text-soft hover:bg-raised disabled:opacity-30"
            >
              ← Previous Step
            </button>
            <span className="text-faint">{activeStep + 1} of {steps.length}</span>
            <button
              type="button"
              disabled={activeStep === steps.length - 1}
              onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
              className="rounded-lg border border-line px-3 py-1.5 text-soft hover:bg-raised disabled:opacity-30"
            >
              Next Step →
            </button>
          </div>
        </div>
      </section>

      {/* Key Highlights Grid */}
      <section className="border-t border-line bg-panel/30 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-ink">
              Core JadualKu Highlights
            </h2>
            <p className="mt-2 text-sm text-soft">
              Every tool UiTM students need for a hassle-free semester plan.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col rounded-2xl border border-line bg-panel p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Palette className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">Limitless Customization</h3>
              <p className="mt-1 text-xs leading-relaxed text-soft">
                Choose vibrant presets or minimal styles, select custom variable fonts (Plus Jakarta Sans, Inter, JetBrains Mono, etc.),
                and upload your own wallpapers with live real-time preview.
              </p>
            </div>

            <div className="flex flex-col rounded-2xl border border-line bg-panel p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                <CalendarDays className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">Today Dashboard View</h3>
              <p className="mt-1 text-xs leading-relaxed text-soft">
                Check current and upcoming classes, lecture hall and lab locations, lecturer names, countdown timers,
                and state-specific campus public holidays.
              </p>
            </div>

            <div className="flex flex-col rounded-2xl border border-line bg-panel p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Phone className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">Phone Lockscreen Wallpapers</h3>
              <p className="mt-1 text-xs leading-relaxed text-soft">
                Generate high-resolution wallpapers tailored to your exact phone screen with custom safe zones that stay clear of clock and lockscreen widgets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-ink">
            Frequently Asked Questions (FAQ)
          </h2>
          <p className="mt-2 text-sm text-soft">
            Common questions answered for UiTM students.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-line bg-panel p-4 text-left">
              <h4 className="text-xs sm:text-sm font-bold text-ink flex items-center gap-2">
                <HelpCircle className="size-4 shrink-0 text-accent" />
                <span>{f.q}</span>
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-soft pl-6">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="border-t border-line bg-panel/80 px-4 py-12 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <Sparkles className="mx-auto size-8 text-accent mb-3" />
          <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">
            Ready to Organize Your Semester Timetable?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-soft">
            Get started right now for free with zero registration. Save time and plan your UiTM schedule like a pro!
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goTo("timetable")}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-on-accent shadow-lg shadow-accent/20 transition-all hover:brightness-110 active:scale-95"
            >
              <span>Build My Timetable Now 🚀</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
