import { useMemo } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, MapPin, MoonStar, PartyPopper, Timer } from "lucide-react";
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
import { hasBackdrop } from "../lib/theme.ts";
import { fmt24 } from "../lib/time.ts";
import { fmtTimeRange } from "./TimetableGrid.tsx";
import { activePlan, usePlanner } from "../store/usePlanner.ts";
import BackgroundLayer from "./BackgroundLayer.tsx";

const delay = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;

const fmtDur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60 ? `${min % 60}m` : ""}`.trim() : `${min} min`);

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

  const todayIdx = isoWeekday(today);
  const todayDay: Day = DAYS[todayIdx];
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

  /** The next weekday (after today) that has a class, for the "free day" state. */
  const nextClassDay = useMemo(() => {
    for (let d = 1; d <= 7; d++) {
      const day = DAYS[(todayIdx + d) % 7];
      const rows: { code: string; start: number }[] = [];
      for (const e of plan.entries) {
        if (e.hidden) continue;
        for (const s of e.sessions) if (s.day === day) rows.push({ code: e.subjectCode, start: s.start });
      }
      if (rows.length) {
        rows.sort((a, b) => a.start - b.start);
        return { day, ...rows[0], daysAhead: d };
      }
    }
    return null;
  }, [plan.entries, todayIdx]);

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

  const bd = hasBackdrop(theme);
  const hero = current ?? next;
  const allDone = teaching && !todayHoliday && todaysClasses.length > 0 && !hero;
  const dateObj = new Date(`${today}T00:00:00`);
  const weekdayLong = dateObj.toLocaleDateString("en-GB", { weekday: "long" });
  const dateLong = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "long" });

  /** Class count + first start per weekday, for the week-at-a-glance strip. */
  const weekStrip = DAYS.map((d) => {
    const rows: number[] = [];
    for (const e of plan.entries) if (!e.hidden) for (const s of e.sessions) if (s.day === d) rows.push(s.start);
    return { day: d, count: rows.length, first: rows.length ? Math.min(...rows) : null };
  });

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {bd && <BackgroundLayer theme={theme} />}
      <div className="relative z-10 mx-auto max-w-2xl space-y-5 p-4 pb-28 sm:p-6">
        {/* ------------------------------------------------ headline */}
        <header className="reveal flex items-end justify-between gap-4" style={delay(0)}>
          <div>
            <span className="eyebrow">
              {info?.week ? `Week ${info.week} of ${weeks.length}` : "Today"}
              {info?.period ? ` · ${info.period.label}` : ""}
            </span>
            <h1 className="mt-1 text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">{weekdayLong}</h1>
            <p className="mt-2 text-sm text-soft">
              {dateLong} <span className="text-faint">· {ac.semester?.session ?? ""}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">{fmt24(nowMin)}</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-faint">
              <span className="live-dot" /> live
            </div>
          </div>
        </header>

        {/* --------------------------------------------- holiday banners */}
        {todayHoliday && (
          <div className="reveal flex items-center gap-3 rounded-2xl border border-good/30 bg-good/10 px-4 py-3.5 text-sm font-semibold text-good" style={delay(1)}>
            <PartyPopper className="size-5 shrink-0" /> No classes today. It&rsquo;s {todayHoliday.name}.
          </div>
        )}
        {!todayHoliday && tomorrowHoliday && (
          <div className="reveal flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3.5 text-sm font-semibold text-warn" style={delay(1)}>
            <CalendarDays className="size-5 shrink-0" /> No classes tomorrow: {tomorrowHoliday.name}.
          </div>
        )}

        {/* --------------------------------------------- hero: now / next */}
        {teaching && !todayHoliday && hero && (() => {
          const r = hero;
          const live = !!current;
          const total = r.session.end - r.session.start;
          const pct = live ? Math.min(100, Math.max(0, ((nowMin - r.session.start) / total) * 100)) : 0;
          const remaining = live ? r.session.end - nowMin : r.session.start - nowMin;
          return (
            <section className="reveal card relative overflow-hidden p-5 sm:p-6" style={delay(2)}>
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: r.entry.color }} aria-hidden />
              <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full opacity-20 blur-3xl" style={{ background: r.entry.color }} aria-hidden />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase" style={{ color: live ? "var(--good)" : "var(--accent)" }}>
                    {live && <span className="live-dot" />}
                    {live ? "Happening now" : "Up next"}
                  </span>
                  <span className="rounded-full bg-raised px-2.5 py-1 font-mono text-[11px] font-semibold text-soft">{fmtTimeRange(theme, r.session.start, r.session.end)}</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-3xl leading-none font-extrabold tracking-tight">{r.entry.subjectCode}</h2>
                    {r.entry.subjectName && <p className="mt-1.5 truncate text-sm text-soft">{r.entry.subjectName}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-2xl font-bold tracking-tight tabular-nums" style={{ color: live ? "var(--good)" : "var(--accent)" }}>
                      {fmtDur(remaining)}
                    </div>
                    <div className="text-[11px] font-semibold text-faint">{live ? "left" : "to go"}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-soft">
                  {r.session.room && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-faint" /> {r.session.room}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-3.5 text-faint" /> {fmtDur(total)} · Group {r.entry.group}
                  </span>
                </div>
                {live && (
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${pct}%`, background: r.entry.color }} />
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {allDone && (
          <section className="reveal card flex items-center gap-4 p-5" style={delay(2)}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-good/12 text-good">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">That&rsquo;s a wrap for today</h2>
              <p className="text-sm text-soft">All {todaysClasses.length} classes are done. Time to rest or revise.</p>
            </div>
          </section>
        )}

        {/* ------------------------------------------- empty / break states */}
        {!hero && !allDone && !todayHoliday && (
          <section className="reveal card flex flex-col items-center px-6 py-10 text-center" style={delay(2)}>
            <span className="flex size-14 items-center justify-center rounded-2xl bg-raised text-accent">
              <MoonStar className="size-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold tracking-tight">
              {!teaching ? (info?.period ? `No classes during ${info.period.label.toLowerCase()}` : "Outside the semester") : plan.entries.length ? "No classes today" : "Nothing planned yet"}
            </h2>
            {teaching && nextClassDay ? (
              <p className="mt-1.5 text-sm text-soft">
                Next up: <b className="text-ink">{nextClassDay.code}</b> on {DAY_LABEL[nextClassDay.day]} at {fmt24(nextClassDay.start)}
                {nextClassDay.daysAhead === 1 ? " (tomorrow)" : ""}.
              </p>
            ) : !plan.entries.length ? (
              <>
                <p className="mt-1.5 max-w-xs text-sm text-soft">Add your classes and today&rsquo;s schedule will show up here.</p>
                <button
                  type="button"
                  onClick={() => {
                    location.hash = "#/timetable";
                  }}
                  className="btn-accent mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
                >
                  Add classes <ArrowRight className="size-4" />
                </button>
              </>
            ) : null}
          </section>
        )}

        {/* ------------------------------------------------- day timeline */}
        {teaching && !todayHoliday && todaysClasses.length > 0 && (
          <section className="reveal" style={delay(3)}>
            <h3 className="eyebrow mb-3 px-1">Today&rsquo;s schedule</h3>
            <ol className="relative space-y-2.5">
              <span className="absolute top-3 bottom-3 left-[5.35rem] w-px bg-line" aria-hidden />
              {todaysClasses.map((r, i) => {
                const active = r === current;
                const past = r.session.end <= nowMin;
                return (
                  <li key={i} className={`relative flex items-stretch gap-3 transition-opacity ${past ? "opacity-45" : ""}`}>
                    <div className="w-[4.4rem] shrink-0 pt-3.5 text-right font-mono text-xs text-soft">
                      <div className="font-semibold text-ink">{fmt24(r.session.start)}</div>
                      <div className="text-faint">{fmt24(r.session.end)}</div>
                    </div>
                    <span className="relative z-10 mt-4 size-2.5 shrink-0 rounded-full ring-4 ring-bg" style={{ background: active ? "var(--good)" : r.entry.color }} aria-hidden />
                    <div className={`card min-w-0 flex-1 px-4 py-3 ${active ? "border-good/50" : ""}`} style={{ borderRadius: "1rem" }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">{r.entry.subjectCode}</span>
                        {active && <span className="rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-good uppercase">Now</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-faint">
                        {r.entry.subjectName && <span className="truncate">{r.entry.subjectName}</span>}
                        <span>{r.entry.group}</span>
                        {r.session.room && <span>{r.session.room}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* ------------------------------------------- week at a glance */}
        {plan.entries.length > 0 && (
          <section className="reveal" style={delay(4)}>
            <h3 className="eyebrow mb-3 px-1">This week</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {weekStrip.map((d) => {
                const isToday = d.day === todayDay;
                return (
                  <div
                    key={d.day}
                    className={`flex flex-col items-center rounded-2xl border px-1 py-2.5 text-center ${
                      isToday ? "border-accent/60 bg-accent/10" : "border-line bg-panel/70"
                    } ${d.count === 0 ? "opacity-55" : ""}`}
                  >
                    <span className={`text-[10px] font-bold tracking-wide uppercase ${isToday ? "text-accent" : "text-faint"}`}>{DAY_LABEL[d.day].slice(0, 3)}</span>
                    <span className="mt-1 text-lg leading-none font-extrabold tabular-nums">{d.count}</span>
                    <span className="mt-1 font-mono text-[9px] text-faint">{d.first !== null ? fmt24(d.first) : "free"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------------------------------------------- assessments due */}
        {upcoming.length > 0 && (
          <section className="reveal" style={delay(4)}>
            <h3 className="eyebrow mb-3 px-1">Coming up</h3>
            <ul className="space-y-2">
              {upcoming.map((a, i) => (
                <li key={i} className="card flex items-center gap-3 px-4 py-3" style={{ borderRadius: "1rem" }}>
                  <span
                    className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl font-mono leading-none ${
                      a.days <= 2 ? "bg-bad/12 text-bad" : "bg-accent/12 text-accent"
                    }`}
                  >
                    <b className="text-base">{a.days === 0 ? "0" : a.days}</b>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase">{a.days === 1 ? "day" : "days"}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">
                      {a.code} · {a.name}
                      {a.weight !== undefined && <span className="ml-1 font-medium text-faint">({a.weight}%)</span>}
                    </div>
                    <div className="truncate text-xs text-faint">
                      {fmtIso(a.date)}
                      {a.start !== undefined && ` · ${fmt24(a.start)}`}
                      {a.venue && ` · ${a.venue}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ------------------------------------------ this week's topics */}
        {thisWeekTopics.length > 0 && (
          <section className="reveal" style={delay(5)}>
            <h3 className="eyebrow mb-3 px-1">This week&rsquo;s topics</h3>
            <div className="card divide-y divide-line overflow-hidden" style={{ borderRadius: "1rem" }}>
              {thisWeekTopics.map((t) => (
                <div key={t.code} className="px-4 py-3 text-xs">
                  <b className="text-[13px]">{t.code}</b>
                  <p className="mt-0.5 leading-relaxed text-soft">{t.topics.join("; ")}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
