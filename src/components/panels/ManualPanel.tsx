import { useState } from "react";
import { Plus } from "lucide-react";
import type { Day, Session } from "../../lib/types.ts";
import { DAYS, DAY_LABEL } from "../../lib/types.ts";
import { parseClock } from "../../lib/time.ts";
import { SUBJECT_PALETTE, colorFor } from "../../lib/colors.ts";
import { usePlanner } from "../../store/usePlanner.ts";
import { ErrorBox, Field, btnPrimary, inputCls } from "../ui.tsx";

export default function ManualPanel() {
  const addEntry = usePlanner((s) => s.addEntry);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [days, setDays] = useState<Set<Day>>(new Set());
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [color, setColor] = useState(colorFor("manual"));
  const [error, setError] = useState("");
  const [addedMsg, setAddedMsg] = useState("");

  const toggleDay = (d: Day) =>
    setDays((s) => {
      const n = new Set(s);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  const submit = () => {
    setError("");
    setAddedMsg("");
    const s = parseClock(start);
    const e = parseClock(end);
    if (!code.trim()) return setError("A code or short label is required.");
    if (!days.size) return setError("Pick at least one day.");
    if (s === null || e === null || e <= s) return setError("End must be after start.");
    const sessions: Session[] = DAYS.filter((d) => days.has(d)).map((d) => ({ day: d, start: s, end: e, room: room.trim() }));
    addEntry({
      subjectCode: code.trim().toUpperCase(),
      subjectName: name.trim(),
      group: "CUSTOM",
      sessions,
      color,
      source: "manual",
    });
    setAddedMsg(`Added ${code.trim().toUpperCase()} — ${sessions.length} session${sessions.length > 1 ? "s" : ""}/week.`);
    setCode("");
    setName("");
    setRoom("");
    setDays(new Set());
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <p className="text-xs text-soft">
        Co-curriculum, society meetings, part-time work — anything that should block out time on the grid.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Code / label">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SPORTS" className={`${inputCls} font-mono uppercase`} />
        </Field>
        <Field label="Name (optional)">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basketball club" className={inputCls} />
        </Field>
      </div>
      <Field label="Days">
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                days.has(d) ? "border-accent bg-accent/15 text-accent" : "border-line bg-panel text-soft hover:border-faint"
              }`}
            >
              {DAY_LABEL[d]}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Start">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="End">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Room">
          <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Optional" className={inputCls} />
        </Field>
      </div>
      <Field label="Color">
        <div className="flex flex-wrap gap-1.5">
          {SUBJECT_PALETTE.slice(0, 12).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={`size-7 rounded-full border-2 transition-transform ${color === c ? "scale-110 border-ink" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>
      <button type="button" onClick={submit} className={btnPrimary}>
        <Plus className="size-4" /> Add to plan
      </button>
      {error && <ErrorBox message={error} />}
      {addedMsg && <div className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm text-good">{addedMsg}</div>}
    </div>
  );
}
