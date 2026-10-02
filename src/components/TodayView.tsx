import { useMemo } from "react";
import { CalendarDays, PartyPopper } from "lucide-react";
import { DAYS, type Day, type Session } from "../lib/types.ts";
import { DAY_LABEL } from "../lib/types.ts";
import {
  effectiveRange,
  fmtIso,
  holidayApplies,
  isoAddDays,
  isoDiffDays,
  isoWeekday,
  teachingWeeks,
  weekInfo,
} from "../lib/academic.ts";
import { useAcademic, useNow } from "../lib/useAcademic.ts";
import { blockColors, hasBackdrop } from "../lib/theme.ts";
import { fmt24 } from "../lib/time.ts";
import { fmtTimeRange } from "./TimetableGrid.tsx";
import { activePlan, usePlanner } from "../store/usePlanner.ts";
import BackgroundLayer from "./BackgroundLayer.tsx";

export default function TodayView() {
  const plan = usePlanner(activePlan);
  const theme = usePlanner((s) => s.theme);
  const sows = usePlanner((s) => s.sows);
  const ac = useAcademic();
  const now = useNow();
  const { semester, state, today } = ac;

  const info = useMemo(() => (semester ? weekInfo(semester, today, state) : null), [semester, today, state]);
  const weeks = useMemo(() => (semester ? teachingWeeks(semester, state) : []), [semester, state]);

  const todayHoliday = ac.holidays.find((h) => h.date === today && holidayApplies(h, state));
  const tomorrow = isoAddDays(today, 1);
  const tomorrowHoliday = ac.holidays.find((h) => h.date === tomorrow && holidayApplies(h, state));

  const todayDay: Day = DAYS[isoWeekday(today)];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const teaching = info?.period?.kind === "lecture" || info?.period?.kind === "online";

  const todaysClasses = useMemo(() => {
    if (!teaching || todayHoliday) return [];
    const rows: { entry: (typeof plan.entries)[number]; session: Session }[] = [];
    for (const e of plan.entries) {
      if (e.hidden) continue;
      for (const s of e.sessions) if (s.day === todayDay) rows.push({ entry: e, session: s });
    }
    return rows.sort((a, b) => a.session.start - b.session.start);
  }, [plan.entries, todayDay, teaching, todayHoliday]);

  const current = todaysClasses.find((r) => r.session.start <= nowMin && nowMin < r.session.end);
  const next = todaysClasses.find((r) => r.session.start > nowMin);

  const upcoming = useMemo(() => {
    const horizon = isoAddDays(today, 14);
    const examHorizon = isoAddDays(today, 60);
    const out: { code: string; name: string; weight?: number; date: string; days: number; start?: number; venue?: string; kind: string }[] = [];
    for (const [code, doc] of Object.entries(sows)) {
      for (const a of doc.assessments) {
        let date = a.date;
        if (!date && a.week !== undefined) date = weeks.find((w) => w.n === a.week)?.start;
        if (!date && a.kind === "exam" && semester) {
          const exam = semester.periods.find((p) => p.kind === "exam");
          if (exam) date = effectiveRange(exam, state).start;
        }
        if (date && date >= today && date <= (a.kind === "exam" ? examHorizon : horizon))
          out.push({ code, name: a.name, weight: a.weight, date, days: isoDiffDays(today, date), start: a.start, venue: a.venue, kind: a.kind });
      }
    }
    return out.sort((a, b) => a.days - b.days);
  }, [sows, weeks, semester, state, today]);

  const thisWeekTopics = useMemo(() => {
    if (!info?.week) return [];
    const out: { code: string; topics: string[] }[] = [];
    for (const [code, doc] of Object.entries(sows)) {
      const w = doc.weeks.find((x) => info.week! >= x.week && info.week! <= (x.weekEnd ?? x.week));
      if (w?.topics.length) out.push({ code, topics: w.topics });
    }
    return out;
  }, [sows, info]);

  const fmtCount = (toMin: number) => {
    const d = toMin - nowMin;
    if (d >= 60) return `in ${Math.floor(d / 60)}h ${d % 60}m`;
    return `in ${d} min`;
  };

  const bd = hasBackdrop(theme);
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {bd && <BackgroundLayer theme={theme} />}
      <div className="relative z-10 mx-auto max-w-2xl space-y-4 p-3 pb-24 sm:p-4">
        {/* headline */}
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            {DAY_LABEL[todayDay]}, {fmtIso(today).slice(4)}
          </h2>
          {info && (
            <p className="text-xs text-faint">
              {info.week ? `Week ${info.week} of ${weeks.length}` : "—"} · {info.period?.label ?? "No period"} · {ac.semester?.session ?? ""}
            </p>
          )}
        </div>

        {/* holiday banners */}
        {todayHoliday && (
          <div className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm font-semibold text-good">
            <PartyPopper className="size-5" /> No classes today — {todayHoliday.name}
          </div>
        )}
        {!todayHoliday && tomorrowHoliday && (
          <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-semibold text-warn">
            No classes tomorrow — {tomorrowHoliday.name}
          </div>
        )}

        {/* now / next */}
        {teaching && !todayHoliday && (current || next) && (
          <div className="rounded-xl border border-line bg-panel p-4">
            <div className="text-[10px] font-bold tracking-wide text-faint uppercase">{current ? "Now" : "Next"}</div>
            {(() => {
              const r = (current ?? next)!;
              const colors = blockColors(theme, r.entry.color);
              return (
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-bold" style={{ color: colors.fg === theme.text ? undefined : undefined }}>
                      {r.entry.subjectCode} <span className="font-medium text-soft">{r.entry.subjectName}</span>
                    </div>
                    <div className="text-xs text-faint">
                      {fmtTimeRange(theme, r.session.start, r.session.end)}
                      {r.session.room ? ` · ${r.session.room}` : ""} · {r.entry.group}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-lg bg-accent/15 px-3 py-1.5 text-sm font-bold text-accent">
                    {current ? `ends in ${r.session.end - nowMin} min` : fmtCount(r.session.start)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* today's classes */}
        <section className="rounded-xl border border-line bg-panel">
          <h3 className="border-b border-line px-4 py-2.5 text-xs font-bold tracking-wide text-faint uppercase">Today's classes</h3>
          {!teaching ? (
            <p className="px-4 py-6 text-center text-sm text-faint">
              <CalendarDays className="mx-auto mb-2 size-8" />
              {info?.period ? `No classes during ${info.period.label.toLowerCase()}.` : "Outside the semester."}
            </p>
          ) : !todaysClasses.length ? (
            <p className="px-4 py-6 text-center text-sm text-faint">No classes today.</p>
          ) : (
            <ul>
              {todaysClasses.map((r, i) => {
                const colors = blockColors(theme, r.entry.color);
                const active = r === current;
                return (
                  <li key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i ? "border-t border-line" : ""} ${active ? "bg-accent/10" : ""}`}>
                    <div className="w-1 self-stretch rounded-full" style={{ background: r.entry.color }} />
                    <div className="w-24 shrink-0 font-mono text-xs text-soft">
                      {fmtTimeRange(theme, r.session.start, r.session.end)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold" style={{ color: colors.fg === theme.text ? theme.text : theme.text }}>
                        {r.entry.subjectCode}
                      </span>{" "}
                      <span className="text-xs text-faint">{r.entry.group}</span>
                    </div>
                    <span className="shrink-0 text-xs text-faint">{r.session.room}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* assessments due */}
        {upcoming.length > 0 && (
          <section className="rounded-xl border border-line bg-panel">
            <h3 className="border-b border-line px-4 py-2.5 text-xs font-bold tracking-wide text-faint uppercase">Coming up</h3>
            <ul>
              {upcoming.map((a, i) => (
                <li key={i} className={`flex items-baseline gap-2 px-4 py-2 text-xs ${i ? "border-t border-line" : ""}`}>
                  <span className="min-w-0 flex-1 font-medium">
                    {a.code} · {a.name}
                    {a.weight !== undefined && <span className="ml-1 text-faint">({a.weight}%)</span>}
                  </span>
                  <span className="shrink-0 text-faint">
                    {fmtIso(a.date)}
                    {a.start !== undefined && ` · ${fmt24(a.start)}`}
                    {a.venue && ` · ${a.venue}`}
                  </span>
                  <span className={`shrink-0 font-bold ${a.days <= 2 ? "text-bad" : "text-accent"}`}>{a.days === 0 ? "today" : `${a.days}d`}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* this week's topics */}
        {thisWeekTopics.length > 0 && (
          <section className="rounded-xl border border-line bg-panel">
            <h3 className="border-b border-line px-4 py-2.5 text-xs font-bold tracking-wide text-faint uppercase">This week's topics</h3>
            <ul className="px-4 py-2">
              {thisWeekTopics.map((t) => (
                <li key={t.code} className="py-1.5 text-xs">
                  <b>{t.code}</b> <span className="text-soft">{t.topics.join("; ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
