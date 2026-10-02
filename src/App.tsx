import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bug,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock,
  Coffee,
  FolderSearch,
  GitCompareArrows,
  GraduationCap,
  ImageDown,
  Info,
  LayoutGrid,
  List,
  Moon,
  Palette,
  PenLine,
  Search,
  Sun,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import type { Entry } from "./lib/types.ts";
import { getSession } from "./lib/api.ts";
import { activePlan, usePlanner } from "./store/usePlanner.ts";
import { decodePlan, type SharePayload } from "./lib/share.ts";
import { hasBackdrop, loadFont } from "./lib/theme.ts";
import { useAcademic } from "./lib/useAcademic.ts";
import { weekInfo } from "./lib/academic.ts";
import ClashBanner from "./components/ClashBanner.tsx";
import PlansMenu from "./components/PlansMenu.tsx";
import EntryEditDialog from "./components/EntryEditDialog.tsx";
import DesignDrawer from "./components/DesignDrawer.tsx";
import ShareDialog from "./components/ShareDialog.tsx";
import TimetableView from "./components/TimetableView.tsx";
import BackgroundLayer from "./components/BackgroundLayer.tsx";
import ModeToggle from "./components/ModeToggle.tsx";
import AboutDialog, { AboutButton, AppFooter, DisclaimerBanner } from "./components/AboutDialog.tsx";
import ReportDialog, { ReportButton } from "./components/ReportDialog.tsx";
import SupportDialog, { SupportButton } from "./components/SupportDialog.tsx";
import BrowsePanel from "./components/panels/BrowsePanel.tsx";
import GroupCodePanel from "./components/panels/GroupCodePanel.tsx";
import MatricPanel from "./components/panels/MatricPanel.tsx";
import ManualPanel from "./components/panels/ManualPanel.tsx";
import PlannerPanel from "./components/panels/PlannerPanel.tsx";

// Top-level views — lazy so each view is a separate chunk.
const TodayView = lazy(() => import("./components/TodayView.tsx"));
const CalendarView = lazy(() => import("./components/CalendarView.tsx"));
const SubjectsView = lazy(() => import("./components/SubjectsView.tsx"));
const CompareView = lazy(() => import("./components/CompareView.tsx"));
const ExportView = lazy(() => import("./components/ExportView.tsx"));

const VIEWS = [
  { id: "today", label: "Today", icon: Clock, component: TodayView },
  { id: "timetable", label: "Timetable", icon: LayoutGrid, component: null },
  { id: "calendar", label: "Calendar", icon: CalendarRange, component: CalendarView },
  { id: "subjects", label: "Subjects", icon: BookOpen, component: SubjectsView },
  { id: "compare", label: "Compare", icon: GitCompareArrows, component: CompareView },
  { id: "export", label: "Export", icon: ImageDown, component: ExportView },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];
const VIEW_IDS = new Set<string>(VIEWS.map((v) => v.id));

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

/** Landing view: Today on phones, Timetable elsewhere. */
function defaultView(): ViewId {
  return window.matchMedia("(max-width: 1023px)").matches ? "today" : "timetable";
}

function useHashView(): [ViewId, (v: ViewId) => void] {
  const [view, setView] = useState<ViewId>(() => viewFromHash() ?? defaultView());
  useEffect(() => {
    const onHash = () => setView(viewFromHash() ?? defaultView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const nav = (v: ViewId) => {
    location.hash = `#/${v}`;
  };
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

function SummaryStrip({ entries }: { entries: Entry[] }) {
  const stats = useMemo(() => {
    const visible = entries.filter((e) => !e.hidden);
    const subjects = new Set(visible.map((e) => e.subjectCode)).size;
    const credits = visible.reduce((sum, e) => sum + (e.credits ?? 0), 0);
    const minutes = visible.reduce((sum, e) => sum + e.sessions.reduce((a, s) => a + (s.end - s.start), 0), 0);
    return { subjects, credits, hours: minutes / 60 };
  }, [entries]);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line bg-panel px-4 py-2 text-xs text-soft print:hidden">
      <span>
        <b className="text-ink">{stats.subjects}</b> {stats.subjects === 1 ? "subject" : "subjects"}
      </span>
      <span>
        <b className="text-ink">{stats.credits}</b> credits
      </span>
      <span>
        <b className="text-ink">{stats.hours % 1 ? stats.hours.toFixed(1) : stats.hours}</b> h contact / week
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
    <div className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm shadow-2xl lg:bottom-4 print:hidden">
      <span className="text-soft">
        Subjects recoloured from the palette — <b className="text-ink">{undoColors.length}</b> blocks
      </span>
      <button
        type="button"
        onClick={() => {
          undoRecolor();
          setShown(false);
        }}
        className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-on-accent"
      >
        <Undo2 className="size-3.5" /> Undo
      </button>
      <button type="button" onClick={() => setShown(false)} className="rounded p-1 text-faint hover:bg-raised" aria-label="Dismiss">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export default function App() {
  const { dark, toggle } = useDarkMode();
  const [view, nav] = useHashView();
  const narrow = useNarrow();
  const plan = usePlanner(activePlan);
  const theme = usePlanner((s) => s.theme);
  const ghost = usePlanner((s) => s.ghost);
  const highlightIds = usePlanner((s) => s.highlightIds);
  const basketCount = usePlanner((s) => s.basket.length);
  const [tab, setTab] = useState<TabId>("browse");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [session, setSession] = useState("");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [incomingShare, setIncomingShare] = useState<SharePayload | null>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const ac = useAcademic();
  const weekNo = useMemo(
    () => (ac.semester ? weekInfo(ac.semester, ac.today, ac.state).week : undefined),
    [ac.semester, ac.today, ac.state],
  );
  /** On narrow screens the agenda is the default; this toggles back to the theme layout. */
  const [mobileGrid, setMobileGrid] = useState(false);

  // Incoming #share= link — decode once, then clear the hash.
  useEffect(() => {
    if (!location.hash.startsWith("#share=")) return;
    const payload = location.hash.slice("#share=".length);
    history.replaceState(null, "", `${location.pathname}${location.search}#/`);
    decodePlan(payload)
      .then(setIncomingShare)
      .catch((e) => console.warn("Invalid share link:", e));
  }, []);

  // Close the mobile view menu on outside click.
  useEffect(() => {
    if (!viewMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) setViewMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [viewMenuOpen]);

  // Lazily fetch the selected timetable font.
  useEffect(() => {
    void loadFont(theme.font);
  }, [theme.font]);

  useEffect(() => {
    getSession()
      .then((r) => setSession(r.code))
      .catch(() => setSession(""));
  }, []);

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
    <div className="grid grid-cols-5 gap-1 border-b border-line px-2 py-2">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          title={t.label}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors ${
            tab === t.id ? "bg-accent/15 text-accent" : "text-soft hover:bg-raised"
          }`}
        >
          <span className="relative">
            <t.icon className="size-4" />
            {t.id === "planner" && basketCount > 0 && (
              <span className="absolute -top-1 -right-2 rounded-full bg-accent px-1 text-[9px] text-on-accent">{basketCount}</span>
            )}
          </span>
          {t.short}
        </button>
      ))}
    </div>
  );

  const timetableLayout = narrow && !mobileGrid ? "agenda" : theme.layout;
  const ActiveView = VIEWS.find((v) => v.id === view)?.component;

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      {/* Header */}
      <header className="flex items-center gap-1.5 border-b border-line bg-panel px-2 py-2 sm:gap-2 sm:px-4 print:hidden">
        <CalendarDays className="size-5 shrink-0 text-accent" />
        <h1 className="hidden text-base font-extrabold tracking-tight sm:block">JadualUiTMKu</h1>
        {session && (
          <span className="hidden rounded-full bg-raised px-2 py-0.5 text-[11px] font-semibold text-soft md:inline">
            Session {session}
            {weekNo ? ` · Week ${weekNo}` : ""}
          </span>
        )}
        {/* view switcher — icon bar on sm+, a single dropdown on phones so the header fits 360px */}
        <nav className="ml-1 hidden rounded-lg border border-line p-0.5 text-xs font-semibold sm:flex">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => nav(v.id)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 sm:px-2.5 ${view === v.id ? "bg-accent/15 text-accent" : "text-soft hover:bg-raised"}`}
            >
              <v.icon className="size-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </nav>
        <div ref={viewMenuRef} className="relative ml-1 sm:hidden">
          <button
            type="button"
            onClick={() => setViewMenuOpen((o) => !o)}
            aria-label="Switch view"
            aria-haspopup="menu"
            aria-expanded={viewMenuOpen}
            className="flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-soft"
          >
            {(() => {
              const Icon = VIEWS.find((v) => v.id === view)?.icon ?? LayoutGrid;
              return <Icon className="size-4" />;
            })()}
            <ChevronDown className="size-3 text-faint" />
          </button>
          {viewMenuOpen && (
            <div role="menu" className="absolute top-full left-0 z-40 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-xl">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    nav(v.id);
                    setViewMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold ${
                    view === v.id ? "bg-accent/10 text-accent" : "text-soft hover:bg-raised"
                  }`}
                >
                  <v.icon className="size-3.5" /> {v.label}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSupportOpen(true);
                  setViewMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-xs font-semibold text-soft hover:bg-raised"
              >
                <Coffee className="size-3.5 text-accent" /> Belanja Kopi
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setReportOpen(true);
                  setViewMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-xs font-semibold text-soft hover:bg-raised"
              >
                <Bug className="size-3.5 text-warn" /> Report an issue
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAboutOpen(true);
                  setViewMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-xs font-semibold text-soft hover:bg-raised"
              >
                <Info className="size-3.5" /> About &amp; disclaimer
              </button>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <PlansMenu />
          <span className="hidden sm:inline-flex">
            <SupportButton onClick={() => setSupportOpen(true)} />
          </span>
          <span className="hidden sm:inline-flex">
            <ReportButton onClick={() => setReportOpen(true)} />
          </span>
          <span className="hidden sm:inline-flex">
            <AboutButton onClick={() => setAboutOpen(true)} />
          </span>
          <button
            type="button"
            onClick={() => setDesignOpen(true)}
            aria-label="Customize"
            title="Customize"
            className="rounded-lg border border-line bg-panel p-2 text-soft hover:bg-raised"
          >
            <Palette className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-lg border border-line bg-panel p-2 text-soft hover:bg-raised"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>
      <DisclaimerBanner onAbout={() => setAboutOpen(true)} />

      {ActiveView ? (
        <Suspense
          fallback={
            <div className="mx-auto w-full max-w-4xl flex-1 space-y-3 p-4" aria-busy="true" aria-label="Loading">
              <div className="skeleton h-8 w-48" />
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-24 w-3/4" />
            </div>
          }
        >
          <ActiveView />
        </Suspense>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Desktop side panel */}
          <aside className="hidden w-105 shrink-0 flex-col border-r border-line bg-panel lg:flex print:hidden">
            {tabBar}
            <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
          </aside>

          {/* Main timetable area */}
          <main className="flex min-w-0 flex-1 flex-col">
            <ClashBanner entries={plan.entries} />
            {/* narrow-screen layout toggle */}
            {plan.entries.length > 0 && (
              <div className="flex items-center justify-end gap-2 px-3 pt-2 print:hidden">
                <ModeToggle compact />
                <button
                  type="button"
                  onClick={() => setMobileGrid((g) => !g)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-semibold text-soft lg:hidden"
                >
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
            )}
            <div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
              {plan.entries.length === 0 && !ghost ? (
                <div className="relative flex min-h-full flex-col items-center justify-center gap-2 overflow-hidden p-8 pb-24 text-center">
                  {hasBackdrop(theme) && <BackgroundLayer theme={theme} />}
                  <div className="relative z-10 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-line bg-panel/85 p-6 shadow-sm backdrop-blur-md">
                    <CalendarDays className="size-10 text-accent" />
                    <p className="text-sm text-soft">
                      Your timetable is empty. Add classes on the left — browse a campus, look up a group code, import your
                      matric timetable, or drop in a custom block.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSheetOpen(true)}
                      className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent lg:hidden"
                    >
                      Add classes
                    </button>
                  </div>
                </div>
              ) : (
                <div className={timetableLayout === "agenda" ? "mx-auto flex min-h-full max-w-2xl flex-col" : "h-full"}>
                  <TimetableView
                    entries={plan.entries}
                    theme={theme}
                    ghost={ghost}
                    highlightIds={highlightIds}
                    onBlockClick={setEditing}
                    layout={timetableLayout}
                    fill={timetableLayout !== "agenda"}
                    className={timetableLayout === "agenda" ? "min-h-full flex-1 pb-20 lg:pb-2" : "h-full pb-20 lg:pb-0"}
                  />
                </div>
              )}
            </div>
            <SummaryStrip entries={plan.entries} />
          </main>
        </div>
      )}

      {/* Mobile bottom sheet */}
      {view === "timetable" && (
        <div className="lg:hidden print:hidden">
          <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-line bg-panel">
            {sheetOpen && (
              <div className="flex h-[68dvh] flex-col">
                <div className="flex items-center justify-between px-3 pt-2">
                  <span className="text-sm font-bold">{TABS.find((t) => t.id === tab)?.label}</span>
                  <button type="button" onClick={() => setSheetOpen(false)} className="rounded-md p-1.5 text-faint hover:bg-raised">
                    <X className="size-5" />
                  </button>
                </div>
                {tabBar}
                <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
              </div>
            )}
            {!sheetOpen && (
              <div className="grid grid-cols-5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id);
                      setSheetOpen(true);
                    }}
                    className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-soft"
                  >
                    <t.icon className="size-5" />
                    {t.short}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AppFooter
        onAbout={() => setAboutOpen(true)}
        onReport={() => setReportOpen(true)}
        onSupport={() => setSupportOpen(true)}
      />
      <RecolorToast />

      {editing && <EntryEditDialog entry={editing} onClose={() => setEditing(null)} />}
      {aboutOpen && (
        <AboutDialog
          onClose={() => setAboutOpen(false)}
          onReport={() => setReportOpen(true)}
          onSupport={() => setSupportOpen(true)}
        />
      )}
      {reportOpen && <ReportDialog onClose={() => setReportOpen(false)} />}
      {supportOpen && <SupportDialog onClose={() => setSupportOpen(false)} />}
      {designOpen && <DesignDrawer onClose={() => setDesignOpen(false)} />}
      {incomingShare && (
        <ShareDialog payload={incomingShare} onClose={() => setIncomingShare(null)} onCompare={() => nav("compare")} />
      )}
    </div>
  );
}
