import { useMemo, useState } from "react";
import { CalendarClock, ChevronRight, FileText, MapPin, PencilLine, Trash2, Upload } from "lucide-react";
import { fmt24 } from "../lib/time.ts";
import { fmtIso, isoDiffDays, teachingWeeks, weekInfo } from "../lib/academic.ts";
import { useAcademic } from "../lib/useAcademic.ts";
import { activePlan, usePlanner } from "../store/usePlanner.ts";
import SowImportDialog from "./SowImportDialog.tsx";
import type { SowDoc } from "../lib/sow.ts";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const examOf = (doc: SowDoc) => doc.assessments.find((a) => a.kind === "exam");

export default function SubjectsView() {
  const plan = usePlanner(activePlan);
  const sows = usePlanner((s) => s.sows);
  const removeSow = usePlanner((s) => s.removeSow);
  const { semester, state, today } = useAcademic();
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [manualNew, setManualNew] = useState(false);

  const subjects = useMemo(() => {
    const seen = new Map<string, { code: string; name: string; groups: string[] }>();
    for (const e of plan.entries) {
      const c = e.subjectCode.toUpperCase();
      const ex = seen.get(c);
      if (ex) ex.groups.push(e.group);
      else seen.set(c, { code: e.subjectCode, name: sows[c]?.courseName || e.subjectName, groups: [e.group] });
    }
    // Subjects with saved info that aren't in the active plan still get a card.
    for (const [code, d] of Object.entries(sows)) if (!seen.has(code)) seen.set(code, { code, name: d.courseName, groups: [] });
    return [...seen.values()];
  }, [plan.entries, sows]);

  const weeks = useMemo(() => (semester ? teachingWeeks(semester, state) : []), [semester, state]);
  const currentWeek = useMemo(() => (semester ? weekInfo(semester, today, state).week : undefined), [semester, today, state]);

  const weekRange = (n: number, end?: number) => {
    const w = weeks.find((x) => x.n === n);
    const we = end !== undefined ? weeks.find((x) => x.n === end) : undefined;
    if (!w) return "";
    return `${fmtIso(w.start)} – ${fmtIso((we ?? w).end)}`;
  };

  const assessDate = (_doc: SowDoc, a: SowDoc["assessments"][number]): string => {
    if (a.date) return fmtIso(a.date);
    if (a.week !== undefined) {
      const w = weeks.find((x) => x.n === a.week);
      if (w) return `week ${a.week} · ${fmtIso(w.start)}`;
    }
    if (a.kind === "exam") return "exam period — see official exam timetable";
    return "";
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Subjects & Scheme of Work</h2>
            <p className="text-xs text-faint">Upload a SOW PDF or type in exam dates, topics and notes yourself.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setManualNew(true)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-bold text-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <PencilLine className="size-4" /> Add info
            </button>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-on-accent transition-transform active:scale-[0.97]"
            >
              <Upload className="size-4" /> Upload SOW
            </button>
          </div>
        </div>

        {!subjects.length && (
          <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-faint">
            No subjects in the active plan yet — add classes first.
          </div>
        )}

        {subjects.map((s) => {
          const doc = sows[s.code] ?? null;
          const expanded = open === s.code;
          const weekNow = currentWeek ? doc?.weeks.find((w) => currentWeek >= w.week && currentWeek <= (w.weekEnd ?? w.week)) : undefined;
          const totalWeight = doc?.assessments.reduce((sum, a) => sum + (a.weight ?? 0), 0) ?? 0;
          return (
            <div key={s.code} className="overflow-hidden rounded-xl border border-line bg-panel">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : s.code)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <FileText className={`size-4 shrink-0 ${doc ? "text-good" : "text-faint"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    {s.code} <span className="font-medium text-soft">{s.name}</span>
                  </div>
                  <div className="text-[11px] text-faint">
                    {doc
                      ? `${doc.manual ? "Info added" : "SOW attached"} · ${plural(doc.weeks.length, "week")} · ${plural(doc.assessments.length, "assessment")}`
                      : "No SOW or info yet"}
                  </div>
                  {doc && examOf(doc)?.date && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-accent">
                      <CalendarClock className="size-3" /> Exam {fmtIso(examOf(doc)!.date!)}
                      {examOf(doc)!.start !== undefined && ` · ${fmt24(examOf(doc)!.start!)}`}
                    </div>
                  )}
                </div>
                <ChevronRight className={`size-4 shrink-0 text-faint transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>

              {expanded && (
                <div className="space-y-3 border-t border-line px-4 py-3">
                  {!doc ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setImporting(true)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-4 text-xs font-semibold text-soft transition-colors hover:bg-raised"
                      >
                        <Upload className="size-4" /> Upload SOW PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCode(s.code)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-4 text-xs font-semibold text-soft transition-colors hover:bg-raised"
                      >
                        <PencilLine className="size-4" /> Enter exam &amp; details by hand
                      </button>
                    </div>
                  ) : (
                    <>
                      {examOf(doc) && (
                        <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="flex items-center gap-1.5 font-bold">
                              <CalendarClock className="size-4 text-accent" /> {examOf(doc)!.name || "Final exam"}
                            </span>
                            {examOf(doc)!.date ? (
                              <>
                                <span className="font-semibold">{fmtIso(examOf(doc)!.date!)}</span>
                                {examOf(doc)!.start !== undefined && (
                                  <span className="font-mono text-xs text-soft">
                                    {fmt24(examOf(doc)!.start!)}
                                    {examOf(doc)!.end !== undefined && `–${fmt24(examOf(doc)!.end!)}`}
                                  </span>
                                )}
                                {isoDiffDays(today, examOf(doc)!.date!) >= 0 && (
                                  <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">
                                    {isoDiffDays(today, examOf(doc)!.date!) === 0 ? "today" : `in ${isoDiffDays(today, examOf(doc)!.date!)} days`}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-soft">date not set yet</span>
                            )}
                          </div>
                          {(examOf(doc)!.venue || examOf(doc)!.note) && (
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-soft">
                              {examOf(doc)!.venue && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3" /> {examOf(doc)!.venue}
                                </span>
                              )}
                              {examOf(doc)!.note && <span>{examOf(doc)!.note}</span>}
                            </p>
                          )}
                        </div>
                      )}
                      {weekNow && (
                        <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-soft">
                          <b className="text-ink">This week (W{currentWeek}):</b> {weekNow.topics.join("; ") || "—"}
                        </p>
                      )}

                      {doc.weeks.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-[11px] font-bold tracking-wide text-faint uppercase">Syllabus timeline</h4>
                        <ul className="space-y-0.5">
                          {doc.weeks.map((w) => {
                            const isNow = currentWeek !== undefined && currentWeek >= w.week && currentWeek <= (w.weekEnd ?? w.week);
                            return (
                              <li key={w.week} className={`rounded px-2 py-1 text-xs ${isNow ? "bg-accent/15 font-semibold" : ""}`}>
                                <span className="mr-2 font-mono font-bold text-soft">
                                  W{w.week}
                                  {w.weekEnd ? `–${w.weekEnd}` : ""}
                                </span>
                                <span className="text-faint">{weekRange(w.week, w.weekEnd)}</span>
                                <span className="ml-2 text-soft">{w.topics.join("; ")}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      )}

                      {doc.assessments.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-[11px] font-bold tracking-wide text-faint uppercase">
                          Assessments{totalWeight ? ` · total ${totalWeight}%` : ""}
                          {totalWeight !== 0 && totalWeight !== 100 && <span className="ml-1 text-warn">(≠100%)</span>}
                        </h4>
                        <ul className="space-y-0.5">
                          {doc.assessments.map((a, i) => {
                            const dateIso = a.date ?? (a.week !== undefined ? weeks.find((x) => x.n === a.week)?.start : undefined);
                            const countdown = dateIso ? isoDiffDays(today, dateIso) : null;
                            return (
                              <li key={i} className="flex items-baseline gap-2 text-xs">
                                <span className="w-20 shrink-0 rounded bg-raised px-1.5 py-px text-center font-mono text-[10px] font-bold uppercase text-soft">
                                  {a.kind}
                                </span>
                                <span className="min-w-0 flex-1 font-medium">
                                  {a.name}
                                  {a.weight !== undefined && <span className="ml-1 text-faint">({a.weight}%)</span>}
                                </span>
                                <span className="shrink-0 text-[11px] text-faint">
                                  {assessDate(doc, a)}
                                  {a.start !== undefined && ` · ${fmt24(a.start)}`}
                                  {a.venue && ` · ${a.venue}`}
                                </span>
                                {countdown !== null && countdown >= 0 && <span className="shrink-0 text-[11px] font-semibold text-accent">{countdown}d</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      )}

                      {doc.notes && <p className="rounded-lg bg-raised px-3 py-2 text-xs whitespace-pre-wrap text-soft">{doc.notes}</p>}

                      <div className="flex items-center justify-between gap-2 text-[11px] text-faint">
                        <span className="min-w-0 truncate">
                          {doc.courseName}
                          {doc.manual ? " · added by hand" : ` · imported ${new Date(doc.importedAt).toLocaleDateString()} from ${doc.fileName}`}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => setEditCode(s.code)} className="flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold text-accent hover:bg-accent/10">
                            <PencilLine className="size-3.5" /> Edit
                          </button>
                          <button type="button" onClick={() => removeSow(s.code)} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-bad">
                            <Trash2 className="size-3.5" /> Remove
                          </button>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {importing && <SowImportDialog onClose={() => setImporting(false)} />}
      {manualNew && <SowImportDialog startManual onClose={() => setManualNew(false)} />}
      {editCode && <SowImportDialog subjectCode={editCode} onClose={() => setEditCode(null)} />}
    </div>
  );
}
