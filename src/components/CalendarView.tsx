import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { CALENDAR_SOURCE, SEMESTERS, type PeriodKind } from "../data/academicCalendar.ts";
import {
  classOccurrences,
  effectiveRange,
  fmtIso,
  holidayApplies,
  isoAddDays,
  isoDiffDays,
  isoWeekday,
  isKkt,
  MY_STATES,
  periodAt,
  teachingWeeks,
  weekInfo,
  type Holiday,
  type MyState,
} from "../lib/academic.ts";
import { buildPlanIcs, saveCalendarFile } from "../lib/icsFile.ts";
import { useAcademic } from "../lib/useAcademic.ts";
import { activePlan, usePlanner } from "../store/usePlanner.ts";
import { inputCls } from "./ui.tsx";
import DateEventsDialog, { PERIOD_COLORS } from "./DateEventsDialog.tsx";

const fmtMin = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
/** "18 Jan" — fmtIso without the weekday prefix, for compact headline ranges. */
const fmtIsoShort = (iso: string) => fmtIso(iso).replace(/^\w+ /, "");

export default function CalendarView() {
  const plan = usePlanner(activePlan);
  const calendar = usePlanner((s) => s.calendar);
  const setCalendar = usePlanner((s) => s.setCalendar);
  const sows = usePlanner((s) => s.sows);
  const ac = useAcademic();
  const { semester, state, today } = ac;

  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [showAllStates, setShowAllStates] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weeks = useMemo(() => (semester ? teachingWeeks(semester, state) : []), [semester, state]);
  const info = useMemo(() => (semester ? weekInfo(semester, today, state) : null), [semester, today, state]);
  const occurrences = useMemo(
    () => (semester ? classOccurrences(plan.entries, semester, ac.holidays, state) : []),
    [semester, plan.entries, ac.holidays, state],
  );
  const holidayHits = useMemo(() => occurrences.filter((o) => o.skipped), [occurrences]);

  const assessments = useMemo(() => {
    const out: { code: string; name: string; kind: string; weight?: number; date: string; week?: number }[] = [];
    for (const [code, doc] of Object.entries(sows)) {
      for (const a of doc.assessments) {
        let date = a.date;
        if (!date && a.week !== undefined) date = weeks.find((w) => w.n === a.week)?.start;
        if (!date && a.kind === "exam" && semester) date = effectiveRange(semester.periods.find((p) => p.kind === "exam")!, state).start;
        if (date) out.push({ code, name: a.name, kind: a.kind, weight: a.weight, date, week: a.week });
      }
    }
    return out;
  }, [sows, weeks, semester, state]);

  // ---- month grid ----
  const kkt = isKkt(state);
  const monthDays = useMemo(() => {
    const first = `${month}-01`;
    const wd = isoWeekday(first); // 0=Mon
    const lead = kkt ? (wd + 1) % 7 : wd; // KKT weeks start Sunday
    const start = isoAddDays(first, -lead);
    const cells: { iso: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const iso = isoAddDays(start, i);
      cells.push({ iso, inMonth: iso.slice(0, 7) === month });
    }
    // Trim a trailing row that's entirely outside the month.
    const tail = cells.slice(35);
    return tail.every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
  }, [month, kkt]);

  const dayKind = (iso: string): PeriodKind | null => (semester ? periodAt(semester, iso, state)?.kind ?? null : null);
  const holOn = (iso: string): Holiday[] => {
    const all = ac.holidays.filter((h) => h.date === iso);
    return showAllStates ? all : all.filter((h) => holidayApplies(h, state));
  };
  const classCountOn = (iso: string) => occurrences.filter((o) => o.date === iso && !o.skipped).length;
  const assessOn = (iso: string) => assessments.filter((a) => a.date === iso);

  // ---- semester timeline ----
  const span = useMemo(() => {
    if (!semester) return null;
    const rs = semester.periods.map((p) => effectiveRange(p, state));
    return {
      start: rs.reduce((m, r) => (r.start < m ? r.start : m), rs[0].start),
      end: rs.reduce((m, r) => (r.end > m ? r.end : m), rs[0].end),
    };
  }, [semester, state]);

  const upcoming = useMemo(() => {
    if (!semester) return [];
    const horizon = isoAddDays(today, 30);
    const items: { date: string; label: string; kind: "period" | "holiday" | "assessment" }[] = [];
    for (const p of semester.periods) {
      const r = effectiveRange(p, state);
      if (r.start >= today && r.start <= horizon) items.push({ date: r.start, label: p.label, kind: "period" });
    }
    for (const h of ac.holidays) {
      if (h.date >= today && h.date <= horizon && (showAllStates || holidayApplies(h, state)))
        items.push({ date: h.date, label: `${h.name}${h.tentative ? " (tentative)" : ""}`, kind: "holiday" });
    }
    for (const a of assessments) {
      if (a.date >= today && a.date <= horizon) items.push({ date: a.date, label: `${a.code} ${a.name}`, kind: "assessment" });
    }
    return items.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [semester, today, ac.holidays, state, showAllStates, assessments]);

  const downloadIcs = () => {
    const ics = buildPlanIcs({
      plan,
      semesterKey: ac.semesterKey,
      state,
      holidays: ac.holidays,
      sows,
      includeClasses: true,
      includeAssessments: true,
      includePeriods: true,
    });
    if (ics) void saveCalendarFile(`jadualku-${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`, ics);
  };

  const weekdayNames = kkt ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
        {/* selectors */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-[10px] font-bold tracking-wide text-faint uppercase">Group</div>
            <div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
              {(["A", "B"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setCalendar({ group: g })}
                  className={`rounded-md px-3 py-1 ${calendar.group === g ? "bg-accent/15 text-accent" : "text-soft hover:bg-raised"}`}
                >
                  Group {g}
                </button>
              ))}
            </div>
          </div>
          <label className="text-[10px] font-bold tracking-wide text-faint uppercase">
            State
            <select value={state} onChange={(e) => setCalendar({ state: e.target.value as MyState })} className={`${inputCls} mt-1 block w-40`}>
              {MY_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold tracking-wide text-faint uppercase">
            Semester
            <select
              value={calendar.semesterKey}
              onChange={(e) => setCalendar({ semesterKey: e.target.value })}
              className={`${inputCls} mt-1 block w-64`}
            >
              <option value="auto">Auto (current semester)</option>
              {SEMESTERS.map((s) => (
                <option key={`${s.group}-${s.code}`} value={`${s.group}-${s.code}`}>
                  {s.code} · Group {s.group} · {s.session}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={downloadIcs}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-soft hover:bg-raised"
          >
            <CalendarPlus className="size-4" /> Add to calendar (.ics)
          </button>
        </div>

        {semester && info && (
          <>
            {/* headline */}
            <div className="rounded-xl border border-line bg-panel px-4 py-3">
              <div className="text-lg font-extrabold tracking-tight">
                {info.week ? `Week ${info.week} of ${weeks.length}` : "Between weeks"} ·{" "}
                <span className="text-soft">{info.period?.label ?? "—"}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-faint">
                <span>
                  {semester.session} · Group {semester.group} · {state}
                  {isKkt(state) ? " (KKT dates)" : ""}
                </span>
                {info.daysToExam !== null && info.exam && (
                  <span>
                    Final exam: {fmtIsoShort(info.exam.start)} – {fmtIsoShort(info.exam.end)} ·{" "}
                    {info.daysToExam === 0 ? "now" : `in ${info.daysToExam} day${info.daysToExam === 1 ? "" : "s"}`}
                  </span>
                )}
                {info.nextBreak &&
                  (() => {
                    const d = isoDiffDays(today, info.nextBreak!.start);
                    return (
                      <span>
                        Next break: {fmtIso(info.nextBreak!.start)} – {fmtIso(info.nextBreak!.end)} · {d <= 0 ? "now" : `in ${d} day${d === 1 ? "" : "s"}`}
                      </span>
                    );
                  })()}
              </div>
            </div>

            {/* semester timeline */}
            {span && (
              <div className="rounded-xl border border-line bg-panel p-3">
                <div className="relative flex h-7 overflow-hidden rounded-lg">
                  {semester.periods.map((p, i) => {
                    const r = effectiveRange(p, state);
                    const total = isoDiffDays(span.start, span.end) + 1;
                    const w = ((isoDiffDays(r.start, r.end) + 1) / total) * 100;
                    return (
                      <div
                        key={i}
                        title={`${p.label} · ${fmtIso(r.start)} – ${fmtIso(r.end)}`}
                        className="h-full"
                        style={{ width: `${w}%`, background: PERIOD_COLORS[p.kind], opacity: 0.8 }}
                      />
                    );
                  })}
                  {today >= span.start && today <= span.end && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-ink"
                      style={{ left: `${(isoDiffDays(span.start, today) / (isoDiffDays(span.start, span.end) + 1)) * 100}%` }}
                      title="Today"
                    />
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-faint">
                  {(Object.keys(PERIOD_COLORS) as PeriodKind[]).map((k) => (
                    <span key={k} className="flex items-center gap-1">
                      <span className="inline-block size-2 rounded-sm" style={{ background: PERIOD_COLORS[k] }} /> {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* month grid */}
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setMonth(isoAddDays(`${month}-01`, -1).slice(0, 7))} className="rounded-lg p-1.5 text-soft hover:bg-raised" aria-label="Previous month">
              <ChevronLeft className="size-5" />
            </button>
            <h3 className="text-sm font-bold">
              {new Date(`${month}-15T00:00:00`).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
            </h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-soft">
                <input type="checkbox" checked={showAllStates} onChange={(e) => setShowAllStates(e.target.checked)} className="size-3.5 accent-(--accent)" />
                All states
              </label>
              <button type="button" onClick={() => setMonth(isoAddDays(`${month}-28`, 5).slice(0, 7))} className="rounded-lg p-1.5 text-soft hover:bg-raised" aria-label="Next month">
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-center">
            {weekdayNames.map((d) => (
              <div key={d} className="bg-raised py-1 text-[10px] font-bold tracking-wide text-faint uppercase">
                {d}
              </div>
            ))}
            {monthDays.map(({ iso, inMonth }) => {
              const kind = dayKind(iso);
              const hols = holOn(iso);
              const count = classCountOn(iso);
              const assess = assessOn(iso);
              const isToday = iso === today;
              const isSelected = selectedDate === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={`group relative flex min-h-16 flex-col p-1.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    inMonth
                      ? "bg-panel hover:bg-raised/80 hover:shadow-sm"
                      : "bg-panel/40 opacity-35 hover:opacity-75 hover:bg-raised/40"
                  } ${isSelected ? "ring-2 ring-accent z-10" : ""}`}
                  style={{
                    background:
                      kind && inMonth
                        ? `color-mix(in oklab, ${PERIOD_COLORS[kind]} 14%, var(--panel))`
                        : undefined,
                  }}
                  title={`Click to view events for ${iso}`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={`text-[11px] font-bold ${
                        isToday
                          ? "inline-flex items-center gap-1 rounded-full bg-accent/20 px-1.5 py-0.2 text-accent"
                          : "text-soft group-hover:text-ink"
                      }`}
                    >
                      {isToday && <span className="size-1.5 rounded-full bg-accent animate-pulse" />}
                      {Number(iso.slice(8))}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {hols.length > 0 && (
                        <span className="size-1.5 rounded-full bg-bad" title="Holiday" />
                      )}
                      {count > 0 && (
                        <span className="size-1.5 rounded-full bg-accent" title={`${count} classes`} />
                      )}
                      {assess.length > 0 && (
                        <span className="size-1.5 rounded-full bg-good" title={`${assess.length} assessments`} />
                      )}
                    </div>
                  </div>
                  {hols.map((h, i) => (
                    <div
                      key={i}
                      title={`${h.name}${h.states === "all" ? " (national)" : ` (${(h.states as string[]).join(", ")})`}${h.tentative ? " — tentative" : ""}`}
                      className={`mt-0.5 w-full truncate rounded px-1 text-[9px] font-semibold ${
                        h.states === "all" ? "bg-bad/20 text-bad" : "border border-warn/50 text-warn"
                      }`}
                    >
                      {h.name}
                      {h.tentative ? "?" : ""}
                    </div>
                  ))}
                  {count > 0 && inMonth && (
                    <div className="mt-0.5 text-[9px] font-medium text-faint">
                      {count} class{count === 1 ? "" : "es"}
                    </div>
                  )}
                  {assess.map((a, i) => (
                    <div
                      key={`a${i}`}
                      className="mt-0.5 w-full truncate rounded bg-accent/20 px-1 text-[9px] font-semibold text-accent"
                      title={`${a.code} ${a.name}`}
                    >
                      {a.code} {a.name}
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* upcoming */}
          <div className="rounded-xl border border-line bg-panel p-3">
            <h3 className="mb-2 text-xs font-bold tracking-wide text-faint uppercase">Upcoming · next 30 days</h3>
            <ul className="space-y-1">
              {upcoming.length === 0 && <li className="text-xs text-faint">Nothing scheduled in the next 30 days.</li>}
              {upcoming.map((u, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(u.date)}
                    className="group flex w-full items-baseline gap-2 rounded-lg p-1.5 text-left text-xs transition-colors hover:bg-raised/70"
                  >
                    <span className="w-20 shrink-0 font-mono text-faint group-hover:text-soft">{fmtIso(u.date)}</span>
                    <span
                      className={`size-2 shrink-0 self-center rounded-full ${
                        u.kind === "holiday" ? "bg-bad" : u.kind === "assessment" ? "bg-accent" : "bg-good"
                      }`}
                    />
                    <span className="min-w-0 font-medium text-soft group-hover:text-ink">{u.label}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-faint">in {isoDiffDays(today, u.date)}d</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* classes affected by holidays */}
          <div className="rounded-xl border border-line bg-panel p-3">
            <h3 className="mb-2 text-xs font-bold tracking-wide text-faint uppercase">Classes affected by holidays</h3>
            <ul className="space-y-1">
              {holidayHits.length === 0 && <li className="text-xs text-faint">No classes land on {state} holidays this semester.</li>}
              {holidayHits.map((o, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(o.date)}
                    className="group w-full rounded-lg p-1.5 text-left text-xs text-soft transition-colors hover:bg-raised/70"
                  >
                    <b className="text-ink group-hover:text-accent">{fmtIso(o.date)}</b> — {o.entry.subjectCode} ({o.entry.group}) {fmtMin(o.session.start)}–
                    {fmtMin(o.session.end)} · <span className="text-bad">{o.holidayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* footer */}
        {semester && (
          <footer className="space-y-1 border-t border-line pt-3 text-[11px] text-faint">
            {semester.periods.filter((p) => p.note).map((p, i) => (
              <p key={i}>
                <b>{p.label}:</b> {p.note}
              </p>
            ))}
            {semester.notes?.map((n, i) => <p key={`n${i}`}>{n}</p>)}
            <p>
              {semester.approved} · Official calendar:{" "}
              <a href={CALENDAR_SOURCE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent underline">
                UiTM HEA <ExternalLink className="size-3" />
              </a>
            </p>
            <p>
              Holidays: {ac.holidaysSource === "live" ? "Google Calendar (live)" : ac.holidaysSource === "snapshot" ? "bundled snapshot" : "loading…"}
              {ac.holidaysFetchedAt ? ` · fetched ${new Date(ac.holidaysFetchedAt).toLocaleString()}` : ""}
            </p>
          </footer>
        )}

        {/* Date events popup modal */}
        {selectedDate && (
          <DateEventsDialog
            iso={selectedDate}
            onClose={() => setSelectedDate(null)}
            onSelectDate={setSelectedDate}
            semester={semester}
            state={state}
            today={today}
            holidays={ac.holidays}
            occurrences={occurrences}
            assessments={assessments}
            showAllStates={showAllStates}
          />
        )}
      </div>
    </div>
  );
}
