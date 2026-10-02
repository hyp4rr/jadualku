import { useRef, useState } from "react";
import { FileUp, GraduationCap, PencilLine, Plus, Trash2, X } from "lucide-react";
import { parseSow, type SowAssessment, type SowDoc, type SowKind } from "../lib/sow.ts";
import { activePlan, usePlanner } from "../store/usePlanner.ts";
import type { Entry } from "../lib/types.ts";
import { inputCls, inputSm } from "./ui.tsx";

const KINDS: SowKind[] = ["test", "quiz", "assignment", "project", "presentation", "lab", "exam", "other"];

interface Props {
  /** Entry to pre-attach to (from EntryEditDialog); otherwise auto-match by code. */
  attachEntryId?: string;
  /** Open straight into the editor for this course code (edits the saved info, or starts a blank one). */
  subjectCode?: string;
  /** Open straight into a blank editor (no PDF). */
  startManual?: boolean;
  onClose: () => void;
}

const toTime = (m?: number) => (m === undefined ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const fromTime = (v: string): number | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
};

function blankDoc(code: string, entry?: Entry): SowDoc {
  return {
    courseCode: code.toUpperCase(),
    courseName: entry?.subjectName ?? "",
    credits: entry?.credits,
    lecturer: entry?.lecturer,
    weeks: [],
    assessments: [],
    warnings: [],
    fileName: "Manual entry",
    importedAt: Date.now(),
    manual: true,
  };
}

export default function SowImportDialog({ attachEntryId, subjectCode, startManual, onClose }: Props) {
  const setSow = usePlanner((s) => s.setSow);
  const updateEntry = usePlanner((s) => s.updateEntry);
  const plan = usePlanner(activePlan);
  const sows = usePlanner((s) => s.sows);

  const seed = (): SowDoc | null => {
    if (subjectCode) {
      const saved = sows[subjectCode.toUpperCase()];
      if (saved) return { ...saved, weeks: saved.weeks.map((w) => ({ ...w, topics: [...w.topics] })), assessments: saved.assessments.map((a) => ({ ...a })) };
      return blankDoc(subjectCode, plan.entries.find((e) => e.subjectCode.toUpperCase() === subjectCode.toUpperCase()));
    }
    return startManual ? blankDoc("") : null;
  };
  const [doc, setDoc] = useState<SowDoc | null>(seed);
  const [stage, setStage] = useState<"pick" | "review">(doc ? "review" : "pick");
  const [attachTo, setAttachTo] = useState<string>(() => {
    if (attachEntryId) return attachEntryId;
    const code = (subjectCode ?? "").toUpperCase();
    return plan.entries.find((e) => code && e.subjectCode.toUpperCase() === code)?.id ?? "auto";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showText, setShowText] = useState(false);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const openFile = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const { extractPdfLines } = await import("../lib/pdfText.ts");
      const lines = await extractPdfLines(file);
      setRawLines(lines);
      const parsed = parseSow(lines, file.name);
      setDoc(parsed);
      // Auto-match the plan entry by course code.
      const hit = plan.entries.find((e) => e.subjectCode.toUpperCase() === parsed.courseCode.toUpperCase());
      setAttachTo(attachEntryId ?? (hit ? hit.id : "none"));
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that PDF");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!doc) return;
    const code = doc.courseCode.toUpperCase();
    if (!code) return setError("Set a course code before saving.");
    setSow(code, { ...doc, importedAt: Date.now(), manual: doc.manual || doc.fileName === "Manual entry" });
    // Edited / hand-entered info is authoritative: push it onto every plan entry with this code.
    // PDF imports only fill fields that are still empty.
    const overwrite = !!(doc.manual || subjectCode);
    const pick = <T,>(cur: T | undefined, next: T | undefined): T | undefined => (overwrite ? (next === undefined || next === '' ? cur : next) : (cur === undefined || cur === '' ? next : cur));
    const linked = new Set(plan.entries.filter((e) => e.subjectCode.toUpperCase() === code).map((e) => e.id));
    if (attachTo && attachTo !== "none" && attachTo !== "auto") linked.add(attachTo);
    for (const id of linked) {
      const entry = plan.entries.find((e) => e.id === id);
      if (!entry) continue;
      updateEntry(entry.id, {
        subjectName: pick(entry.subjectName, doc.courseName) ?? entry.subjectName,
        credits: pick(entry.credits, doc.credits),
        lecturer: pick(entry.lecturer, doc.lecturer),
      });
    }
    onClose();
  };

  const setWeek = (i: number, patch: Partial<{ week: number; weekEnd?: number; topics: string }>) => {
    if (!doc) return;
    const weeks = doc.weeks.map((w, j) => {
      if (j !== i) return w;
      const topics = patch.topics !== undefined ? patch.topics.split("\n").filter((t) => t.trim()) : w.topics;
      return { ...w, ...patch, topics };
    });
    setDoc({ ...doc, weeks });
  };
  const setAssess = (i: number, patch: Partial<SowAssessment>) => {
    if (!doc) return;
    setDoc({ ...doc, assessments: doc.assessments.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  };

  const examIdx = doc ? doc.assessments.findIndex((a) => a.kind === "exam") : -1;
  const exam = doc && examIdx >= 0 ? doc.assessments[examIdx] : null;

  return (
    <div className="anim-fade fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="anim-sheet flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <GraduationCap className="size-4 text-accent" />
            {stage === "pick" ? "Add subject info" : doc?.manual ? "Subject info" : "Review Scheme of Work"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-raised" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
          {stage === "pick" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void openFile(f);
              }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                dragOver ? "border-accent bg-accent/10" : "border-line"
              }`}
            >
              <FileUp className="size-10 text-faint" />
              <p className="text-sm text-soft">
                Drop a SOW PDF here, or{" "}
                <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold text-accent underline">
                  choose a file
                </button>
              </p>
              <p className="text-xs text-faint">Text-based PDFs only — the file is parsed locally and never uploaded.</p>
              {busy && <p className="text-xs text-soft">Extracting text…</p>}
              <div className="flex w-full items-center gap-3 text-[11px] text-faint">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setDoc(blankDoc(""));
                  setStage("review");
                }}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-soft transition-colors hover:bg-raised hover:text-ink"
              >
                <PencilLine className="size-4" /> Enter subject details by hand
              </button>
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void openFile(e.target.files[0])} />
            </div>
          ) : doc ? (
            <div className="space-y-4">
              {doc.warnings.length > 0 && (
                <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                  {doc.warnings.map((w, i) => (
                    <p key={i}>⚠ {w}</p>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-soft">
                  Course code
                  <input value={doc.courseCode} onChange={(e) => setDoc({ ...doc, courseCode: e.target.value })} className={`${inputCls} mt-1`} />
                </label>
                <label className="text-xs text-soft">
                  Credits
                  <input
                    type="number"
                    min={0}
                    value={doc.credits ?? ""}
                    onChange={(e) => setDoc({ ...doc, credits: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className={`${inputCls} mt-1`}
                  />
                </label>
                <label className="col-span-2 text-xs text-soft">
                  Course name
                  <input value={doc.courseName} onChange={(e) => setDoc({ ...doc, courseName: e.target.value })} className={`${inputCls} mt-1`} />
                </label>
                <label className="col-span-2 text-xs text-soft">
                  Lecturer
                  <input value={doc.lecturer ?? ""} onChange={(e) => setDoc({ ...doc, lecturer: e.target.value || undefined })} className={`${inputCls} mt-1`} />
                </label>
              </div>

              <section className="rounded-xl border border-line bg-raised/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold tracking-wide text-faint uppercase">Final exam</h3>
                  {exam ? (
                    <button
                      type="button"
                      onClick={() => setDoc({ ...doc, assessments: doc.assessments.filter((_, j) => j !== examIdx) })}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-faint hover:text-bad"
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDoc({ ...doc, assessments: [...doc.assessments, { name: "Final Examination", kind: "exam" }] })}
                      className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-on-accent"
                    >
                      <Plus className="size-3.5" /> Add exam
                    </button>
                  )}
                </div>
                {exam ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="col-span-2 text-xs text-soft">
                      Date
                      <input type="date" value={exam.date ?? ""} onChange={(e) => setAssess(examIdx, { date: e.target.value || undefined })} className={`${inputSm} mt-1 w-full`} />
                    </label>
                    <label className="text-xs text-soft">
                      Start
                      <input type="time" value={toTime(exam.start)} onChange={(e) => setAssess(examIdx, { start: fromTime(e.target.value) })} className={`${inputSm} mt-1 w-full`} />
                    </label>
                    <label className="text-xs text-soft">
                      End
                      <input type="time" value={toTime(exam.end)} onChange={(e) => setAssess(examIdx, { end: fromTime(e.target.value) })} className={`${inputSm} mt-1 w-full`} />
                    </label>
                    <label className="col-span-2 text-xs text-soft">
                      Venue / hall
                      <input value={exam.venue ?? ""} onChange={(e) => setAssess(examIdx, { venue: e.target.value || undefined })} placeholder="e.g. Dewan Besar 2" className={`${inputSm} mt-1 w-full`} />
                    </label>
                    <label className="text-xs text-soft">
                      Weight %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={exam.weight ?? ""}
                        onChange={(e) => setAssess(examIdx, { weight: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className={`${inputSm} mt-1 w-full`}
                      />
                    </label>
                    <label className="text-xs text-soft">
                      Week
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={exam.week ?? ""}
                        onChange={(e) => setAssess(examIdx, { week: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className={`${inputSm} mt-1 w-full`}
                      />
                    </label>
                    <label className="col-span-2 text-xs text-soft sm:col-span-4">
                      Note
                      <input value={exam.note ?? ""} onChange={(e) => setAssess(examIdx, { note: e.target.value || undefined })} placeholder="Seat number, paper code, open book…" className={`${inputSm} mt-1 w-full`} />
                    </label>
                  </div>
                ) : (
                  <p className="text-xs text-faint">Add the exam date, time and hall so it appears on Today, Calendar and your calendar export.</p>
                )}
              </section>

              <section>
                <h3 className="mb-1.5 text-xs font-bold tracking-wide text-faint uppercase">Weekly topics</h3>
                <div className="space-y-1.5">
                  {doc.weeks.map((w, i) => (
                    <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1.5">
                      <div className="flex items-center gap-1 pt-0.5">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={w.week}
                          onChange={(e) => setWeek(i, { week: Number(e.target.value) || 1 })}
                          className={`${inputSm} w-14 text-center`}
                          title="Week"
                          aria-label="Week"
                        />
                        <span className="text-faint" aria-hidden>
                          –
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={w.weekEnd ?? ""}
                          placeholder="–"
                          onChange={(e) => setWeek(i, { weekEnd: e.target.value === "" ? undefined : Number(e.target.value) })}
                          className={`${inputSm} w-14 text-center`}
                          title="Week end (range)"
                          aria-label="Week end"
                        />
                      </div>
                      <textarea
                        value={w.topics.join("\n")}
                        onChange={(e) => setWeek(i, { topics: e.target.value })}
                        rows={Math.min(3, Math.max(1, w.topics.length))}
                        className={`${inputSm} min-w-0`}
                        placeholder="Topics, one per line"
                      />
                      <button
                        type="button"
                        onClick={() => setDoc({ ...doc, weeks: doc.weeks.filter((_, j) => j !== i) })}
                        className="mt-1.5 rounded p-1 text-faint hover:text-bad"
                        aria-label="Remove week"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDoc({ ...doc, weeks: [...doc.weeks, { week: (doc.weeks.at(-1)?.weekEnd ?? doc.weeks.at(-1)?.week ?? 0) + 1, topics: [] }] })}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-soft hover:bg-raised"
                  >
                    + Add week
                  </button>
                </div>
              </section>

              <section>
                <h3 className="mb-1.5 text-xs font-bold tracking-wide text-faint uppercase">Tests, quizzes &amp; assignments</h3>
                <div className="space-y-1.5">
                  {doc.assessments.map((a, i) =>
                    i === examIdx ? null : (
                    <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line/70 p-1.5">
                      <input
                        value={a.name}
                        onChange={(e) => setAssess(i, { name: e.target.value })}
                        placeholder="Name"
                        className={`${inputSm} min-w-0 flex-1 basis-32`}
                        aria-label="Assessment name"
                      />
                      <select value={a.kind} onChange={(e) => setAssess(i, { kind: e.target.value as SowKind })} className={`${inputSm} w-24`} aria-label="Kind">
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={a.weight ?? ""}
                        placeholder="%"
                        title="Weight %"
                        onChange={(e) => setAssess(i, { weight: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className={`${inputSm} w-14 text-center`}
                        aria-label="Weight percent"
                      />
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={a.week ?? ""}
                        placeholder="Wk"
                        title="Week"
                        onChange={(e) => setAssess(i, { week: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className={`${inputSm} w-14 text-center`}
                        aria-label="Week"
                      />
                      <input
                        type="date"
                        value={a.date ?? ""}
                        title="Date"
                        onChange={(e) => setAssess(i, { date: e.target.value || undefined })}
                        className={`${inputSm} w-32`}
                        aria-label="Date"
                      />
                      <button
                        type="button"
                        onClick={() => setDoc({ ...doc, assessments: doc.assessments.filter((_, j) => j !== i) })}
                        className="rounded p-1 text-faint hover:text-bad"
                        aria-label="Remove assessment"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      <div className="basis-full" />
                      <input type="time" value={toTime(a.start)} title="Start time" aria-label="Start time" onChange={(e) => setAssess(i, { start: fromTime(e.target.value) })} className={`${inputSm} w-32`} />
                      <input type="time" value={toTime(a.end)} title="End time" aria-label="End time" onChange={(e) => setAssess(i, { end: fromTime(e.target.value) })} className={`${inputSm} w-32`} />
                      <input value={a.venue ?? ""} placeholder="Venue" aria-label="Venue" onChange={(e) => setAssess(i, { venue: e.target.value || undefined })} className={`${inputSm} min-w-0 flex-1 basis-24`} />
                    </div>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => setDoc({ ...doc, assessments: [...doc.assessments, { name: "", kind: "other" }] })}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-soft hover:bg-raised"
                  >
                    + Add test / quiz / assignment
                  </button>
                </div>
              </section>

              <label className="block text-xs text-soft">
                <span className="mb-1 block text-xs font-bold tracking-wide text-faint uppercase">Notes</span>
                <textarea
                  value={doc.notes ?? ""}
                  onChange={(e) => setDoc({ ...doc, notes: e.target.value || undefined })}
                  rows={3}
                  placeholder="Anything worth remembering about this subject — policies, contact, reminders…"
                  className={`${inputSm} w-full`}
                />
              </label>

              {!doc.manual && (
                <label className="flex items-center gap-1.5 text-xs text-soft">
                  <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} className="size-3.5 accent-(--accent)" />
                  Show extracted text
                </label>
              )}
              {showText && !doc.manual && (
                <pre className="max-h-48 overflow-auto rounded-lg border border-line bg-bg p-2 font-mono text-[10px] whitespace-pre-wrap text-faint">
                  {rawLines.join("\n")}
                </pre>
              )}

              <div>
                <h3 className="mb-1.5 text-xs font-bold tracking-wide text-faint uppercase">Attach to subject</h3>
                <select value={attachTo} onChange={(e) => setAttachTo(e.target.value)} className={`${inputCls} w-full`}>
                  <option value="none">Don't link to a plan subject</option>
                  {plan.entries.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.subjectCode} · {e.group}
                      {e.subjectCode.toUpperCase() === doc.courseCode.toUpperCase() ? " (match)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-faint">Fills the entry's name / credits / lecturer only where they're empty.</p>
              </div>
            </div>
          ) : null}
          {error && <p className="mt-3 text-xs text-bad">{error}</p>}
        </div>

        {stage === "review" && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
            {subjectCode || startManual ? (
              <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-soft hover:bg-raised">
                Cancel
              </button>
            ) : (
              <button type="button" onClick={() => setStage("pick")} className="rounded-lg px-3 py-2 text-xs font-semibold text-soft hover:bg-raised">
                Choose another file
              </button>
            )}
            <button type="button" onClick={save} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-on-accent transition-transform active:scale-[0.97]">
              {doc?.manual ? "Save info" : "Save SOW"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
