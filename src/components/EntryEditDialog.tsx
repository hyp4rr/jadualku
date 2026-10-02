import { useState } from "react";
import { EyeOff, FileUp, Plus, Trash2 } from "lucide-react";
import type { Day, Entry, Session } from "../lib/types.ts";
import { DAYS, DAY_LABEL } from "../lib/types.ts";
import { parseClock, fmt24 } from "../lib/time.ts";
import { SUBJECT_PALETTE } from "../lib/colors.ts";
import { usePlanner } from "../store/usePlanner.ts";
import { Field, Modal, btnDanger, btnGhost, btnPrimary, inputCls } from "./ui.tsx";
import SowImportDialog from "./SowImportDialog.tsx";

export default function EntryEditDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { updateEntry, removeEntry, toggleHidden } = usePlanner();
  const [subjectName, setSubjectName] = useState(entry.subjectName);
  const [lecturer, setLecturer] = useState(entry.lecturer ?? "");
  const [credits, setCredits] = useState(entry.credits?.toString() ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [color, setColor] = useState(entry.color);
  const [sessions, setSessions] = useState<(Session & { key: number })[]>(
    entry.sessions.map((s, i) => ({ ...s, key: i })),
  );
  const [err, setErr] = useState("");
  const [sowOpen, setSowOpen] = useState(false);

  const patchSession = (key: number, patch: Partial<Session>) =>
    setSessions((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const save = () => {
    const clean: Session[] = [];
    for (const s of sessions) {
      if (!(s.end > s.start)) {
        setErr(`A session on ${DAY_LABEL[s.day]} ends before it starts.`);
        return;
      }
      clean.push({ day: s.day, start: s.start, end: s.end, room: s.room.trim() });
    }
    if (!clean.length) {
      setErr("Keep at least one session, or delete the class.");
      return;
    }
    updateEntry(entry.id, {
      subjectName: subjectName.trim(),
      lecturer: lecturer.trim() || undefined,
      credits: credits.trim() ? Number(credits) : undefined,
      notes: notes.trim() || undefined,
      color,
      sessions: clean,
    });
    onClose();
  };

  return (
    <Modal title={`${entry.subjectCode} · ${entry.group}`} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Subject name">
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Lecturer">
          <input value={lecturer} onChange={(e) => setLecturer(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Credits">
          <input
            value={credits}
            onChange={(e) => setCredits(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            className={inputCls}
          />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {SUBJECT_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className={`size-6 rounded-full border-2 transition-transform ${color === c ? "scale-110 border-ink" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold tracking-wide text-soft uppercase">Sessions</span>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.key} className="grid grid-cols-[5.5rem_1fr_1fr_1fr_auto] items-center gap-1.5">
              <select
                value={s.day}
                onChange={(e) => patchSession(s.key, { day: e.target.value as Day })}
                className={`${inputCls} !px-1.5 !py-1.5 text-xs`}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABEL[d]}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={fmt24(s.start)}
                onChange={(e) => patchSession(s.key, { start: parseClock(e.target.value) ?? s.start })}
                className={`${inputCls} !px-1.5 !py-1.5 text-xs`}
              />
              <input
                type="time"
                value={fmt24(s.end)}
                onChange={(e) => patchSession(s.key, { end: parseClock(e.target.value) ?? s.end })}
                className={`${inputCls} !px-1.5 !py-1.5 text-xs`}
              />
              <input
                value={s.room}
                onChange={(e) => patchSession(s.key, { room: e.target.value })}
                placeholder="Room"
                className={`${inputCls} !px-1.5 !py-1.5 text-xs`}
              />
              <button
                type="button"
                onClick={() => setSessions((ss) => ss.filter((x) => x.key !== s.key))}
                className="p-1.5 text-faint hover:text-bad"
                aria-label="Remove session"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSessions((ss) => [
                ...ss,
                { key: Math.max(0, ...ss.map((x) => x.key)) + 1, day: "MON", start: 8 * 60, end: 9 * 60, room: "" },
              ])
            }
            className={`${btnGhost} !px-2.5 !py-1 text-xs`}
          >
            <Plus className="size-3.5" /> Add session
          </button>
        </div>
      </div>

      <div className="mt-3">
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </Field>
      </div>

      {err && <div className="mt-2 text-sm text-bad">{err}</div>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => { toggleHidden(entry.id); onClose(); }} className={btnGhost}>
            <EyeOff className="size-4" /> {entry.hidden ? "Unhide" : "Hide"}
          </button>
          <button type="button" onClick={() => setSowOpen(true)} className={btnGhost} title="Import the Scheme of Work PDF for this subject">
            <FileUp className="size-4" /> Attach SOW
          </button>
          <button
            type="button"
            onClick={() => {
              removeEntry(entry.id);
              onClose();
            }}
            className={btnDanger}
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="button" onClick={save} className={btnPrimary}>
            Save
          </button>
        </div>
      </div>
      {sowOpen && <SowImportDialog attachEntryId={entry.id} onClose={() => setSowOpen(false)} />}
    </Modal>
  );
}
