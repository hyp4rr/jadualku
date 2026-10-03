import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bug,
  CalendarRange,
  Check,
  Clock,
  Coffee,
  Columns3,
  Ellipsis,
  FolderSearch,
  GitCompareArrows,
  GraduationCap,
  Home,
  ImageDown,
  Info,
  LayoutGrid,
  List,
  Moon,
  Palette,
  PenLine,
  Plus,
  Rows3,
  Search,
  Sun,
  SunMoon,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import type { Entry } from "./lib/types.ts";
import { getSession } from "./lib/api.ts";
import { activePlan, usePlanner } from "./store/usePlanner.ts";
import { decodePlan, type SharePayload } from "./lib/share.ts";
import { loadFont } from "./lib/theme.ts";
import { useAcademic } from "./lib/useAcademic.ts";
import { weekInfo } from "./lib/academic.ts";
import { findClashes } from "./lib/clash.ts";
import ClashBanner from "./components/ClashBanner.tsx";
import PlansMenu from "./components/PlansMenu.tsx";
import EntryEditDialog from "./components/EntryEditDialog.tsx";
import DesignDrawer from "./components/DesignDrawer.tsx";
import ShareDialog from "./components/ShareDialog.tsx";
import TimetableView from "./components/TimetableView.tsx";
import ModeToggle from "./components/ModeToggle.tsx";
import { LogoMark, Wordmark } from "./components/Brand.tsx";
import { BottomNav, SlidingNav } from "./components/AppNav.tsx";
import CommandPalette, { type Command } from "./components/CommandPalette.tsx";
import StartPanel from "./components/StartPanel.tsx";
import AboutDialog, { AppFooter, DisclaimerBanner } from "./components/AboutDialog.tsx";
import ReportDialog from "./components/ReportDialog.tsx";
import SupportDialog, { SupportButton } from "./components/SupportDialog.tsx";
import BrowsePanel from "./components/panels/BrowsePanel.tsx";
import GroupCodePanel from "./components/panels/GroupCodePanel.tsx";
import MatricPanel from "./components/panels/MatricPanel.tsx";
import ManualPanel from "./components/panels/ManualPanel.tsx";
import PlannerPanel from "./components/panels/PlannerPanel.tsx";

// Top-level views — lazy so each view is a separate chunk.
const HomeView = lazy(() => import("./components/HomeView.tsx"));
const TodayView = lazy(() => import("./components/TodayView.tsx"));
const CalendarView = lazy(() => import("./components/CalendarView.tsx"));
const SubjectsView = lazy(() => import("./components/SubjectsView.tsx"));
const CompareView = lazy(() => import("./components/CompareView.tsx"));
const ExportView = lazy(() => import("./components/ExportView.tsx"));

const VIEWS = [
  { id: "home", label: "Home", icon: Home, component: HomeView },
  { id: "timetable", label: "Timetable", icon: LayoutGrid, component: null },
  { id: "today", label: "Today", icon: Clock, component: TodayView },
  { id: "calendar", label: "Calendar", icon: CalendarRange, component: CalendarView },
  { id: "subjects", label: "Subjects", icon: BookOpen, component: SubjectsView },
  { id: "compare", label: "Compare", icon: GitCompareArrows, component: CompareView },
  { id: "export", label: "Export", icon: ImageDown, component: ExportView },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];
const VIEW_IDS = new Set<string>(VIEWS.map((v) => v.id));
/** Views pinned to the phone bottom bar; the rest live behind "More". */
const BOTTOM_IDS: ViewId[] = ["home", "timetable", "today", "calendar"];

const TABS = [
  { id: "browse", label: "Add classes", short: "Browse", icon: Search },
  { id: "group", label: "By group code", short: "Group", icon: FolderSearch },
  { id: "matric", label: "From matric", short: "Matric", icon: GraduationCap },
  { id: "manual", label: "Manual", short: "Manual", icon: PenLine },
  { id: "planner", label: "Planner", short: "Planner", icon: Wand2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

function viewFromHash(): ViewId | null {
  const h = location.hash.replace(/^#\/?/, "");
  return VIEW_IDS.has(h) ? (h as ViewId) : null;
}

/** Landing view: Home by default. */
function defaultView(): ViewId {
  return "home";
}

function useHashView(): [ViewId, (v: ViewId) => void] {
  const [view, setView] = useState<ViewId>(() => viewFromHash() ?? defaultView());
  useEffect(() => {
    const onHash = () => setView(viewFromHash() ?? defaultView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const nav = useCallback((v: ViewId) => {
    location.hash = `#/${v}`;
  }, []);
  return [view, nav];
}

/** True on narrow screens — agenda becomes the default timetable view there. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return narrow;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("jadualku:theme");
    return stored ? stored === "dark" : true;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("jadualku:theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Subjects / credits / hours / clash status as quiet chips above the timetable. */
function StatChips({ entries }: { entries: Entry[] }) {
  const stats = useMemo(() => {
    const visible = entries.filter((e) => !e.hidden);
    const subjects = new Set(visible.map((e) => e.subjectCode)).size;
    const credits = visible.reduce((sum, e) => sum + (e.credits ?? 0), 0);
    const minutes = visible.reduce((sum, e) => sum + e.sessions.reduce((a, s) => a + (s.end - s.start), 0), 0);
    return { subjects, credits, hours: minutes / 60, clashes: findClashes(visible).length };
  }, [entries]);
  const chip = "inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/70 px-2.5 py-1 text-xs text-soft backdrop-blur";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stats.clashes === 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-good/30 bg-good/10 px-2.5 py-1 text-xs font-semibold text-good">
          <Check className="size-3.5" /> No clashes
        </span>
      ) : null}
      <span className={chip}>
        <b className="text-ink">{stats.subjects}</b> {stats.subjects === 1 ? "subject" : "subjects"}
      </span>
      {stats.credits > 0 && (
        <span className={chip}>
          <b className="text-ink">{stats.credits}</b> credits
        </span>
      )}
      <span className={chip}>
        <b className="text-ink">{stats.hours % 1 ? stats.hours.toFixed(1) : stats.hours}</b> h / week
      </span>
    </div>
  );
}

/** Brief toast offering to undo the last preset-driven recolour. */
function RecolorToast() {
  const undoColors = usePlanner((s) => s.undoColors);
  const undoRecolor = usePlanner((s) => s.undoRecolor);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!undoColors?.length) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 7000);
    return () => clearTimeout(t);
  }, [undoColors]);
  if (!shown || !undoColors?.length) return null;
  return (
    <div className="anim-sheet surface fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-2.5 text-sm shadow-2xl sm:bottom-6 print:hidden">
      <span className="text-soft">
        Subjects recoloured from the palette: <b className="text-ink">{undoColors.length}</b> blocks
      </span>
      <button
        type="button"
        onClick={() => {
          undoRecolor();
          setShown(false);
        }}
        className="btn-accent flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
      >
        <Undo2 className="size-3.5" /> Undo
      </button>
      <button type="button" onClick={() => setShown(false)} className="rounded p-1 text-faint hover:bg-raised" aria-label="Dismiss">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Desktop overflow menu: the less-used actions, out of the way but one click from anywhere. */
function MoreMenu({ items }: { items: { icon: typeof Info; label: string; onClick: () => void; tone?: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More"
        className="rounded-xl border border-line bg-panel/70 p-2 text-soft backdrop-blur hover:bg-raised hover:text-ink"
      >
        <Ellipsis className="size-4" />
      </button>
      {open && (
        <div role="menu" className="anim-sheet surface absolute top-full right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl p-1.5 shadow-2xl">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <it.icon className={`size-4 ${it.tone ?? ""}`} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { dark, toggle } = useDarkMode();
  const [view, nav] = useHashView();
  const narrow = useNarrow();
  const plan = usePlanner(activePlan);
  const plans = usePlanner((s) => s.plans);
  const theme = usePlanner((s) => s.theme);
  const setTheme = usePlanner((s) => s.setTheme);
  const setActivePlan = usePlanner((s) => s.setActivePlan);
  const createPlan = usePlanner((s) => s.createPlan);
  const ghost = usePlanner((s) => s.ghost);
  const highlightIds = usePlanner((s) => s.highlightIds);
  const basketCount = usePlanner((s) => s.basket.length);
  const [tab, setTab] = useState<TabId>("browse");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [session, setSession] = useState("");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [incomingShare, setIncomingShare] = useState<SharePayload | null>(null);
  const ac = useAcademic();
  const weekNo = useMemo(
    () => (ac.semester ? weekInfo(ac.semester, ac.today, ac.state).week : undefined),
    [ac.semester, ac.today, ac.state],
  );
  /** On narrow screens the agenda is the default; this toggles back to the theme layout. */
  const [mobileGrid, setMobileGrid] = useState(false);

  // Incoming #share= or ?s= link — decode once, then clean the URL.
  useEffect(() => {
    let payload = "";
    if (location.hash.startsWith("#share=")) {
      payload = location.hash.slice("#share=".length);
      history.replaceState(null, "", `${location.pathname}${location.search}#/`);
    } else {
      const sp = new URLSearchParams(location.search);
      const s = sp.get("s") || sp.get("share");
      if (s) {
        payload = s;
        sp.delete("s");
        sp.delete("share");
        const query = sp.toString() ? `?${sp.toString()}` : "";
        history.replaceState(null, "", `${location.pathname}${query}${location.hash || "#/"}`);
      }
    }
    if (!payload) return;
    decodePlan(payload)
      .then(setIncomingShare)
      .catch((e) => console.warn("Invalid share link:", e));
  }, []);

  // Navigation triggers from other views (Home cards etc.).
  useEffect(() => {
    const onSetTab = (e: Event) => {
      const targetTab = (e as CustomEvent<TabId>).detail;
      if (targetTab) {
        setTab(targetTab);
        setSheetOpen(true);
      }
    };
    const onOpenDesign = () => setDesignOpen(true);
    window.addEventListener("jadualku:tab", onSetTab);
    window.addEventListener("jadualku:design", onOpenDesign);
    return () => {
      window.removeEventListener("jadualku:tab", onSetTab);
      window.removeEventListener("jadualku:design", onOpenDesign);
    };
  }, []);

  // Ctrl/Cmd+K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lazily fetch the selected timetable font.
  useEffect(() => {
    void loadFont(theme.font);
  }, [theme.font]);

  useEffect(() => {
    getSession()
      .then((r) => setSession(r.code))
      .catch(() => setSession(""));
  }, []);

  // Leaving the timetable closes any open phone sheets.
  useEffect(() => {
    setSheetOpen(false);
    setMoreOpen(false);
  }, [view]);

  const openTab = useCallback(
    (t: TabId) => {
      nav("timetable");
      setTab(t);
      setSheetOpen(true);
    },
    [nav],
  );

  const commands: Command[] = useMemo(() => {
    const go = (v: (typeof VIEWS)[number]) => ({
      id: `go-${v.id}`,
      label: v.label,
      group: "Go to",
      icon: v.icon,
      keywords: v.id,
      run: () => nav(v.id),
    });
    return [
      ...VIEWS.map(go),
      ...TABS.map<Command>((t) => ({
        id: `tab-${t.id}`,
        label: t.id === "browse" ? "Browse campus & subjects" : t.id === "group" ? "Add by group code" : t.id === "matric" ? "Import from matric number" : t.id === "manual" ? "Add a custom block" : "Open the auto-planner",
        group: "Add classes",
        icon: t.icon,
        keywords: `${t.label} add class subject course`,
        run: () => openTab(t.id),
      })),
      { id: "design", label: "Customize design", group: "Appearance", icon: Palette, hint: "Colours, fonts, backgrounds", keywords: "theme wallpaper background font color", run: () => setDesignOpen(true) },
      { id: "app-theme", label: dark ? "Switch app to light mode" : "Switch app to dark mode", group: "Appearance", icon: dark ? Sun : Moon, keywords: "dark light theme mode", run: toggle },
      { id: "tt-dark", label: "Timetable: dark", group: "Appearance", icon: Moon, keywords: "timetable dark mode", run: () => setTheme({ mode: "dark" }) },
      { id: "tt-light", label: "Timetable: light", group: "Appearance", icon: Sun, keywords: "timetable light mode", run: () => setTheme({ mode: "light" }) },
      { id: "tt-auto", label: "Timetable: match app", group: "Appearance", icon: SunMoon, keywords: "timetable auto mode", run: () => setTheme({ mode: "app" }) },
      { id: "tt-cols", label: "Timetable layout: days as columns", group: "Appearance", icon: Columns3, keywords: "grid orientation", run: () => setTheme({ layout: "grid", orientation: "days-columns" }) },
      { id: "tt-rows", label: "Timetable layout: days as rows", group: "Appearance", icon: Rows3, keywords: "grid orientation", run: () => setTheme({ layout: "grid", orientation: "days-rows" }) },
      { id: "tt-agenda", label: "Timetable layout: agenda list", group: "Appearance", icon: List, keywords: "list cards", run: () => setTheme({ layout: "agenda" }) },
      { id: "plan-new", label: "New plan", group: "Plans", icon: Plus, keywords: "create timetable plan", run: () => void createPlan() },
      ...plans
        .filter((p) => p.id !== plan.id)
        .map<Command>((p) => ({ id: `plan-${p.id}`, label: `Switch to ${p.name}`, group: "Plans", icon: LayoutGrid, keywords: "plan", run: () => setActivePlan(p.id) })),
      { id: "about", label: "About & disclaimer", group: "Help", icon: Info, run: () => setAboutOpen(true) },
      { id: "report", label: "Report an issue", group: "Help", icon: Bug, run: () => setReportOpen(true) },
      { id: "support", label: "Buy me a coffee", group: "Help", icon: Coffee, run: () => setSupportOpen(true) },
    ];
  }, [nav, openTab, dark, toggle, setTheme, createPlan, plans, plan.id, setActivePlan]);

  const panel = (
    <>
      {tab === "browse" && <BrowsePanel />}
      {tab === "group" && <GroupCodePanel />}
      {tab === "matric" && <MatricPanel />}
      {tab === "manual" && <ManualPanel />}
      {tab === "planner" && <PlannerPanel />}
    </>
  );

  // Compact 5-column segmented bar — all tabs visible, no horizontal scroll.
  const tabBar = (
    <div className="grid grid-cols-5 gap-1 border-b border-line p-2">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          title={t.label}
          aria-pressed={tab === t.id}
          className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors ${
            tab === t.id ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_30%,transparent)]" : "text-soft hover:bg-raised hover:text-ink"
          }`}
        >
          <span className="relative">
            <t.icon className="size-4" />
            {t.id === "planner" && basketCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 rounded-full bg-accent px-1 text-[9px] font-bold text-on-accent">{basketCount}</span>
            )}
          </span>
          {t.short}
        </button>
      ))}
    </div>
  );

  const timetableLayout = narrow && !mobileGrid ? "agenda" : theme.layout;
  const ActiveView = VIEWS.find((v) => v.id === view)?.component;
  const bottomItems = VIEWS.filter((v) => BOTTOM_IDS.includes(v.id));
  const layoutMode = theme.layout === "agenda" ? "agenda" : theme.orientation === "days-rows" ? "rows" : "cols";

  const moreItems = [
    { icon: Info, label: "About & disclaimer", onClick: () => setAboutOpen(true), tone: "" },
    { icon: Bug, label: "Report an issue", onClick: () => setReportOpen(true), tone: "text-warn" },
    { icon: Coffee, label: "Buy me a coffee", onClick: () => setSupportOpen(true), tone: "text-accent" },
  ];

  const seg = (on: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-accent/15 text-accent" : "text-soft hover:text-ink"}`;

  return (
    <div className="flex h-full flex-col text-ink">
      {/* ------------------------------------------------------------ Header */}
      <header className="surface relative z-30 flex items-center gap-2 rounded-none border-x-0 border-t-0 px-3 py-2.5 sm:gap-3 sm:px-5 print:hidden">
        <button
          type="button"
          onClick={() => nav("home")}
          aria-label="JadualUiTMKu home"
          className="group flex shrink-0 items-center gap-2.5 text-left"
        >
          <LogoMark className="size-8 shrink-0 transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-105" />
          <Wordmark className="hidden text-[17px] xl:block" />
        </button>

        {session && (
          <span className="hidden items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-soft min-[1680px]:inline-flex">
            <span className="live-dot" />
            Session {session}
            {weekNo ? <span className="text-faint">· Week {weekNo}</span> : null}
          </span>
        )}

        <div className="mx-auto">
          <SlidingNav items={VIEWS} current={view} onNav={nav} />
        </div>
        <span className="mr-auto sm:hidden" />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search and commands"
            className="flex items-center gap-2 rounded-xl border border-line bg-panel/70 p-2 text-soft backdrop-blur transition-colors hover:border-faint/60 hover:text-ink lg:px-3 lg:py-2"
          >
            <Search className="size-4" />
            <span className="hidden text-xs font-medium text-faint min-[1680px]:inline">Search</span>
            <span className="kbd hidden lg:inline">{isMac ? "⌘" : "Ctrl"} K</span>
          </button>
          <PlansMenu />
          <span className="hidden lg:inline-flex">
            <SupportButton onClick={() => setSupportOpen(true)} />
          </span>
          <button
            type="button"
            onClick={() => setDesignOpen(true)}
            aria-label="Customize"
            title="Customize"
            className="rounded-xl border border-line bg-panel/70 p-2 text-soft backdrop-blur hover:bg-raised hover:text-ink"
          >
            <Palette className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-xl border border-line bg-panel/70 p-2 text-soft backdrop-blur hover:bg-raised hover:text-ink"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <MoreMenu items={moreItems} />
        </div>
      </header>
      <DisclaimerBanner onAbout={() => setAboutOpen(true)} />

      {/* ------------------------------------------------------------ Content */}
      <div className="flex min-h-0 flex-1 flex-col max-sm:pb-[4.75rem]">
        {ActiveView ? (
          <Suspense
            fallback={
              <div className="mx-auto w-full max-w-4xl flex-1 space-y-3 p-6" aria-busy="true" aria-label="Loading">
                <div className="skeleton h-9 w-56" />
                <div className="skeleton h-28 w-full" />
                <div className="skeleton h-28 w-full" />
                <div className="skeleton h-28 w-3/4" />
              </div>
            }
          >
            <ActiveView />
          </Suspense>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Desktop side panel */}
            <aside className="surface hidden w-[27rem] shrink-0 flex-col rounded-none border-y-0 border-l-0 lg:flex print:hidden">
              {tabBar}
              <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
            </aside>

            {/* Main timetable area */}
            <main className="flex min-w-0 flex-1 flex-col">
              <ClashBanner entries={plan.entries} />
              {plan.entries.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 print:hidden">
                  <StatChips entries={plan.entries} />
                  <div className="flex items-center gap-2">
                    <ModeToggle compact />
                    {/* desktop: columns / rows / agenda */}
                    <div role="radiogroup" aria-label="Timetable layout" className="surface hidden rounded-xl p-0.5 lg:flex">
                      {(
                        [
                          ["cols", "Columns", Columns3, () => setTheme({ layout: "grid", orientation: "days-columns" })],
                          ["rows", "Rows", Rows3, () => setTheme({ layout: "grid", orientation: "days-rows" })],
                          ["agenda", "Agenda", List, () => setTheme({ layout: "agenda" })],
                        ] as const
                      ).map(([id, label, Icon, run]) => (
                        <button key={id} type="button" role="radio" aria-checked={layoutMode === id} onClick={run} title={label} className={seg(layoutMode === id)}>
                          <Icon className="size-3.5" />
                          <span className="hidden xl:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                    {/* phones / tablets: agenda <-> grid */}
                    <button type="button" onClick={() => setMobileGrid((g) => !g)} className={`surface flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-soft lg:hidden`}>
                      {timetableLayout === "agenda" ? (
                        <>
                          <LayoutGrid className="size-3.5" /> Grid
                        </>
                      ) : (
                        <>
                          <List className="size-3.5" /> Agenda
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
                {plan.entries.length === 0 && !ghost ? (
                  <StartPanel onPick={openTab} />
                ) : (
                  <div className={timetableLayout === "agenda" ? "mx-auto flex min-h-full max-w-2xl flex-1 flex-col pb-20 lg:pb-2" : "h-full px-2 pb-20 sm:px-3 lg:pb-3"}>
                    <TimetableView
                      entries={plan.entries}
                      theme={theme}
                      ghost={ghost}
                      highlightIds={highlightIds}
                      onBlockClick={setEditing}
                      layout={timetableLayout}
                      fill={timetableLayout !== "agenda"}
                      className={timetableLayout === "agenda" ? "flex min-h-full flex-1 flex-col" : "h-full overflow-hidden rounded-2xl border border-line"}
                    />
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
      </div>

      {/* ------------------------------------- Phone / tablet: add-classes sheet */}
      {view === "timetable" && (
        <div className="lg:hidden print:hidden">
          {!sheetOpen && plan.entries.length > 0 && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="btn-accent anim-fade fixed right-4 bottom-[5.5rem] z-30 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-xl sm:bottom-6"
            >
              <Plus className="size-4" /> Add classes
            </button>
          )}
          {sheetOpen && (
            <>
              <div className="anim-fade fixed inset-0 z-[39] bg-black/45 backdrop-blur-[2px]" onClick={() => setSheetOpen(false)} aria-hidden />
              <div className="anim-slide-up surface fixed inset-x-0 bottom-0 z-40 flex h-[78dvh] flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)]" role="dialog" aria-label="Add classes">
                <div className="flex items-center justify-between px-4 pt-2.5">
                  <span className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
                </div>
                <div className="flex items-center justify-between px-4 pt-1 pb-1">
                  <span className="text-base font-bold tracking-tight">{TABS.find((t) => t.id === tab)?.label}</span>
                  <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-faint hover:bg-raised">
                    <X className="size-5" />
                  </button>
                </div>
                {tabBar}
                <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------ Phone: bottom nav + More */}
      <BottomNav items={bottomItems} current={view} onNav={nav} onMore={() => setMoreOpen(true)} moreActive={!BOTTOM_IDS.includes(view)} />
      {moreOpen && (
        <div className="sm:hidden print:hidden">
          <div className="anim-fade fixed inset-0 z-[45] bg-black/50 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="anim-slide-up surface fixed inset-x-0 bottom-0 z-[46] rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-label="More">
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="grid grid-cols-4 gap-2">
              {VIEWS.filter((v) => !BOTTOM_IDS.includes(v.id)).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    nav(v.id);
                    setMoreOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold ${view === v.id ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-panel text-soft"}`}
                >
                  <v.icon className="size-5" /> {v.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setDesignOpen(true);
                }}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-panel p-3 text-xs font-semibold text-soft"
              >
                <Palette className="size-5" /> Customize
              </button>
            </div>
            <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
              <button type="button" onClick={toggle} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-soft">
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />} {dark ? "Light mode" : "Dark mode"}
              </button>
              {moreItems.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    it.onClick();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-soft"
                >
                  <it.icon className={`size-4 ${it.tone}`} /> {it.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <AppFooter onAbout={() => setAboutOpen(true)} onReport={() => setReportOpen(true)} onSupport={() => setSupportOpen(true)} />
      <RecolorToast />

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {editing && <EntryEditDialog entry={editing} onClose={() => setEditing(null)} />}
      {aboutOpen && (
        <AboutDialog onClose={() => setAboutOpen(false)} onReport={() => setReportOpen(true)} onSupport={() => setSupportOpen(true)} />
      )}
      {reportOpen && <ReportDialog onClose={() => setReportOpen(false)} />}
      {supportOpen && <SupportDialog onClose={() => setSupportOpen(false)} />}
      {designOpen && <DesignDrawer onClose={() => setDesignOpen(false)} />}
      {incomingShare && <ShareDialog payload={incomingShare} onClose={() => setIncomingShare(null)} onCompare={() => nav("compare")} />}
    </div>
  );
}
