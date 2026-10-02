import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { getRegistered } from "../../lib/api.ts";
import { parseDayTime } from "../../lib/time.ts";
import type { Session } from "../../lib/types.ts";
import { colorFor } from "../../lib/colors.ts";
import { usePlanner } from "../../store/usePlanner.ts";
import { ErrorBox, Field, Spinner, btnPrimary, inputCls } from "../ui.tsx";

export default function MatricPanel() {
  const { addEntry, createPlan } = usePlanner();
  const [matric, setMatric] = useState("");
  const [newPlan, setNewPlan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const importNow = async () => {
    const m = matric.trim();
    if (!/^\d{10}$/.test(m)) {
      setError("A matric number is exactly 10 digits.");
      return;
    }
    setLoading(true);
    setError("");
    setDone("");
    try {
      const rows = await getRegistered(m);
      if (!rows.length) {
        setError("That timetable is empty.");
        return;
      }
      if (newPlan) createPlan(`Matric ${m}`);
      // Group rows into entries by course+group.
      const byKey = new Map<string, { course: string; group: string; lecturer: string; sessions: Session[] }>();
      for (const r of rows) {
        const slot = parseDayTime(r.day_time);
        if (!slot) continue;
        const key = `${r.course}|${r.group}`;
        const e = byKey.get(key) ?? { course: r.course, group: r.group, lecturer: r.lecturer, sessions: [] };
        e.sessions.push({ day: slot.day, start: slot.start, end: slot.end, room: r.room });
        byKey.set(key, e);
      }
      let count = 0;
      for (const e of byKey.values()) {
        addEntry({
          subjectCode: e.course,
          subjectName: "",
          group: e.group,
          sessions: e.sessions,
          lecturer: e.lecturer || undefined,
          color: colorFor(e.course),
          source: "matric",
        });
        count++;
      }
      setDone(`Imported ${count} ${count === 1 ? "class" : "classes"} into the ${newPlan ? "new" : "current"} plan.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <p className="text-xs text-soft">
        Already registered on MyStudent? Import your confirmed classes straight into a plan.
      </p>
      <Field label="Matric number">
        <input
          value={matric}
          onChange={(e) => setMatric(e.target.value.replace(/\D/g, "").slice(0, 10))}
          onKeyDown={(e) => e.key === "Enter" && importNow()}
          placeholder="e.g. 2024123456"
          inputMode="numeric"
          className={`${inputCls} font-mono`}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-soft">
        <input type="checkbox" checked={newPlan} onChange={(e) => setNewPlan(e.target.checked)} className="accent-accent" />
        Import into a new plan instead of the current one
      </label>
      <button type="button" onClick={importNow} disabled={loading || matric.trim().length !== 10} className={btnPrimary}>
        {loading ? <Spinner /> : <Download className="size-4" />} Import registered classes
      </button>
      {error && <ErrorBox message={error} />}
      {done && <div className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm text-good">{done}</div>}
      <div className="flex items-start gap-2 rounded-lg border border-line bg-raised/50 px-3 py-2 text-xs text-faint">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Your matric number is only sent to our own /api proxy — never to third parties — and is not stored.
      </div>
    </div>
  );
}
