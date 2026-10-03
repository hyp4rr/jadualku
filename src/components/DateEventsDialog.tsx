import { useEffect } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  Sparkles,
  User,
  X,
} from "lucide-react";
import type { CalendarPeriod, PeriodKind, Semester } from "../data/academicCalendar.ts";
import {
  holidayApplies,
  isoAddDays,
  isoDiffDays,
  periodAt,
  teachingWeeks,
  type ClassOccurrence,
  type Holiday,
  type MyState,
} from "../lib/academic.ts";

export const PERIOD_COLORS: Record<PeriodKind, string> = {
  lecture: "#14b8a6",
  online: "#38bdf8",
  test: "#fb923c",
  break: "#94a3b8",
  revision: "#a78bfa",
  exam: "#ef4444",
  eet: "#ec4899",
};

export interface DateAssessment {
  code: string;
  name: string;
  kind: string;
  weight?: number;
  date: string;
  week?: number;
}

interface DateEventsDialogProps {
  iso: string;
  onClose: () => void;
  onSelectDate: (iso: string) => void;
  semester: Semester | null;
  state: MyState;
  today: string;
  holidays: Holiday[];
  occurrences: ClassOccurrence[];
  assessments: DateAssessment[];
  showAllStates?: boolean;
}

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function formatDuration(start: number, end: number): string {
  const diff = end - start;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function assessmentKindStyle(kind: string): { bg: string; text: string; border: string } {
  const k = kind.toLowerCase();
  if (k.includes("exam")) return { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30" };
  if (k.includes("test")) return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" };
  if (k.includes("quiz")) return { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" };
  if (k.includes("project")) return { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" };
  return { bg: "bg-sky-500/15", text: "text-sky-400", border: "border-sky-500/30" };
}

export default function DateEventsDialog({
  iso,
  onClose,
  onSelectDate,
  semester,
  state,
  today,
  holidays,
  occurrences,
  assessments,
  showAllStates = false,
}: DateEventsDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSelectDate(isoAddDays(iso, -1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onSelectDate(isoAddDays(iso, 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [iso, onClose, onSelectDate]);

  const isToday = iso === today;
  const diffDays = isoDiffDays(today, iso);

  // UiTM Academic info
  const period: CalendarPeriod | null = semester ? periodAt(semester, iso, state) : null;
  const weeks = semester ? teachingWeeks(semester, state) : [];
  const teachingWeek = weeks.find((w) => iso >= w.start && iso <= w.end);

  // Applicable holidays
  const dayHolidays = holidays.filter(
    (h) => h.date === iso && (showAllStates || holidayApplies(h, state)),
  );

  // Classes on this day (sorted by start time)
  const dayClasses = occurrences
    .filter((o) => o.date === iso)
    .sort((a, b) => a.session.start - b.session.start);

  // Assessments on this day
  const dayAssessments = assessments.filter((a) => a.date === iso);

  const hasEvents =
    dayHolidays.length > 0 || dayClasses.length > 0 || dayAssessments.length > 0;

  return (
    <div
      className="anim-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label={`Events for ${formatFullDate(iso)}`}
      onClick={onClose}
    >
      <div
        className="anim-sheet flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-line bg-panel/90 px-4 py-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            {/* Day Switcher Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectDate(isoAddDays(iso, -1))}
                className="flex size-7 items-center justify-center rounded-lg border border-line text-soft transition-colors hover:bg-raised hover:text-ink"
                title="Previous day (Left Arrow)"
                aria-label="Previous day"
              >
                <ChevronLeft className="size-4" />
              </button>
              {iso !== today && (
                <button
                  type="button"
                  onClick={() => onSelectDate(today)}
                  className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-soft transition-colors hover:bg-raised hover:text-ink"
                  title="Jump to today"
                >
                  Today
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectDate(isoAddDays(iso, 1))}
                className="flex size-7 items-center justify-center rounded-lg border border-line text-soft transition-colors hover:bg-raised hover:text-ink"
                title="Next day (Right Arrow)"
                aria-label="Next day"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-lg p-1 text-faint transition-colors hover:bg-raised hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-2.5">
            <h2 className="text-base font-bold tracking-tight text-ink sm:text-lg">
              {formatFullDate(iso)}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              {isToday && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                  Today
                </span>
              )}
              {!isToday && (
                <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] font-medium text-faint">
                  {diffDays === 1
                    ? "Tomorrow"
                    : diffDays === -1
                      ? "Yesterday"
                      : diffDays > 0
                        ? `In ${diffDays} days`
                        : `${Math.abs(diffDays)} days ago`}
                </span>
              )}
              {teachingWeek && (
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2 py-0.5 text-[11px] font-semibold text-soft">
                  Week {teachingWeek.n}
                </span>
              )}
              {period && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${PERIOD_COLORS[period.kind]} 15%, transparent)`,
                    color: PERIOD_COLORS[period.kind],
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: PERIOD_COLORS[period.kind] }}
                  />
                  {period.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* Holidays on this day */}
          {dayHolidays.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold tracking-wide text-faint uppercase">
                Public Holiday
              </div>
              {dayHolidays.map((h, i) => {
                const isNational = h.states === "all";
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 ${
                      isNational
                        ? "border-bad/30 bg-bad/10 text-bad"
                        : "border-warn/30 bg-warn/10 text-warn"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm text-ink">{h.name}</div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isNational
                            ? "bg-bad/20 text-bad"
                            : "bg-warn/20 text-warn"
                        }`}
                      >
                        {isNational
                          ? "National Holiday"
                          : `State: ${(h.states as string[]).join(", ")}`}
                      </span>
                    </div>
                    {h.tentative && (
                      <div className="mt-1 text-xs opacity-80">
                        Date is tentative subject to official government confirmation.
                      </div>
                    )}
                    <div className="mt-1 text-xs text-soft">
                      Official holiday in {state}. Regular scheduled classes are suspended.
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SOW Assessments & Deadlines */}
          {dayAssessments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-faint uppercase">
                <GraduationCap className="size-3.5 text-accent" />
                Assessments & Deadlines ({dayAssessments.length})
              </div>
              <div className="space-y-2">
                {dayAssessments.map((a, i) => {
                  const style = assessmentKindStyle(a.kind);
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-line bg-raised/50 p-3 transition-colors hover:border-accent/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                            {a.code}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${style.bg} ${style.text} ${style.border}`}
                          >
                            {a.kind}
                          </span>
                        </div>
                        {a.weight !== undefined && (
                          <span className="rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-bold text-good">
                            {a.weight}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 font-semibold text-sm text-ink">
                        {a.name}
                      </div>
                      {a.week !== undefined && (
                        <div className="mt-1 text-xs text-faint">
                          Scheduled for Academic Week {a.week}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scheduled Classes */}
          {dayClasses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold tracking-wide text-faint uppercase">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-accent" />
                  Scheduled Classes ({dayClasses.length})
                </span>
                <span>{formatFullDate(iso).split(",")[0]}</span>
              </div>
              <div className="space-y-2">
                {dayClasses.map((c, i) => {
                  const isSkipped = c.skipped;
                  return (
                    <div
                      key={i}
                      className={`relative flex overflow-hidden rounded-xl border border-line bg-panel p-3 transition-colors ${
                        isSkipped ? "opacity-60 bg-raised/40" : "hover:border-accent/40"
                      }`}
                    >
                      {/* Left color bar matching timetable entry */}
                      <div
                        className="mr-3 w-1.5 shrink-0 self-stretch rounded-full"
                        style={{ backgroundColor: c.entry.color }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-ink">
                              {c.entry.subjectCode}
                            </span>
                            <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] font-semibold text-soft">
                              {c.entry.group}
                            </span>
                          </div>
                          {isSkipped ? (
                            <span className="flex items-center gap-1 rounded-md bg-bad/15 px-2 py-0.5 text-[10px] font-bold text-bad">
                              <AlertTriangle className="size-3" />
                              Cancelled · {c.holidayName ?? "Holiday"}
                            </span>
                          ) : (
                            <span className="rounded-md bg-raised px-2 py-0.5 text-xs font-semibold text-soft">
                              {fmtMin(c.session.start)} – {fmtMin(c.session.end)} (
                              {formatDuration(c.session.start, c.session.end)})
                            </span>
                          )}
                        </div>

                        <div className="mt-1 font-medium text-xs text-soft">
                          {c.entry.subjectName || c.entry.subjectCode}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                          {c.session.room && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3 text-soft" />
                              {c.session.room}
                            </span>
                          )}
                          {c.entry.lecturer && (
                            <span className="flex items-center gap-1">
                              <User className="size-3 text-soft" />
                              {c.entry.lecturer}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Academic Period details (Break / Revision / Exam note) */}
          {period && period.note && (
            <div className="rounded-xl border border-line bg-raised/40 p-3 text-xs text-soft">
              <div className="font-bold text-ink">{period.label}</div>
              <div className="mt-1 leading-relaxed text-faint">{period.note}</div>
            </div>
          )}

          {/* Empty State */}
          {!hasEvents && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-line bg-raised text-accent">
                {period?.kind === "break" ? (
                  <Sparkles className="size-6" />
                ) : (
                  <CalendarCheck className="size-6" />
                )}
              </div>
              <h3 className="mt-3 font-bold text-sm text-ink">
                No classes or deadlines
              </h3>
              <p className="mt-1 max-w-xs text-xs text-faint">
                {period?.kind === "break"
                  ? "Mid-semester or semester break. Enjoy your time off!"
                  : period?.kind === "revision"
                    ? "Revision period — great time to prepare for your upcoming exams."
                    : period?.kind === "exam"
                      ? "Examination period. Check your examination slip for exact papers."
                      : "You have no scheduled classes or coursework deadlines for this day."}
              </p>
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between border-t border-line bg-raised/40 px-4 py-2.5 text-[11px] text-faint">
          <span className="flex items-center gap-2">
            <span className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[10px]">
              ←
            </span>
            <span className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[10px]">
              →
            </span>
            <span>Switch day</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[10px]">
              Esc
            </span>
            <span>Close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
