import { useState } from "react";
import { Sparkles, Trash2, Wand2 } from "lucide-react";
import type { Day, Entry } from "../../lib/types.ts";
import { DAYS, DAY_LABEL } from "../../lib/types.ts";
import { generate, type Combo, type RankPreset } from "../../lib/generator.ts";
import { parseClock, fmt12 } from "../../lib/time.ts";
import { colorFor } from "../../lib/colors.ts";
import { usePlanner } from "../../store/usePlanner.ts";
import TimetableGrid from "../TimetableGrid.tsx";
import { Empty, Field, Spinner, btnGhost, btnPrimary, inputCls } from "../ui.tsx";

const PRESETS: { id: RankPreset; label: string }[] = [
  { id: "compact", label: "Compact — fewest days, then fewest gaps" },
  { id: "lateStart", label: "Late start — sleep in" },
  { id: "earlyFinish", label: "Early finish — home before dinner" },
  { id: "fewGaps", label: "Few gaps — back-to-back classes" },
];

function comboToEntries(combo: Combo): Entry[] {
  return combo.picks.map((p) => ({
    id: `${p.subject}:${p.group}`,
    subjectCode: p.subject,
    subjectName: p.subjectName ?? "",
    group: p.group,
    sessions: p.sessions,
    color: colorFor(p.subject),
    source: "icress",
  }));
}

export default function PlannerPanel() {
  const basket = usePlanner((s) => s.basket);
  const { removeFromBasket, setBasketLock, clearBasket, addEntry, createPlan } = usePlanner();
  const removeEntryByCode = usePlanner((s) => s.removeEntry);
  const planEntries = usePlanner((s) => s.plans.find((p) => p.id === s.activePlanId)?.entries ?? []);

  const [noBefore, setNoBefore] = useState("");
  const [noAfter, setNoAfter] = useState("");
  const [freeDays, setFreeDays] = useState<Set<Day>>(new Set());
  const [programme, setProgramme] = useState("");
  const [preset, setPreset] = useState<RankPreset>("compact");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof generate> | null>(null);
  const [applied, setApplied] = useState<number | null>(null);

  const run = () => {
    setRunning(true);
    setApplied(null);
    // Let the spinner paint before the synchronous search.
    setTimeout(() => {
      const res = generate(
        basket.map((b) => ({ code: b.code, name: b.name, groups: b.groups, lockedGroup: b.lockedGroup })),
        {
          noClassBefore: noBefore ? (parseClock(noBefore) ?? undefined) : undefined,
          noClassAfter: noAfter ? (parseClock(noAfter) ?? undefined) : undefined,
          freeDays: [...freeDays],
          programme: programme || undefined,
        },
        preset,
        20,
      );
      setResult(res);
      setRunning(false);
    }, 30);
  };

  const apply = (combo: Combo, fresh: boolean) => {
    if (fresh) createPlan("Generated plan");
    for (const pick of combo.picks) {
      const existing = planEntries.find((e) => e.subjectCode === pick.subject);
      if (existing) removeEntryByCode(existing.id);
      addEntry({
        subjectCode: pick.subject,
        subjectName: pick.subjectName ?? "",
        group: pick.group,
        campus: basket.find((b) => b.code === pick.subject)?.campus,
        sessions: pick.sessions.map((s) => ({ ...s })),
        source: "icress",
      });
    }
    setApplied(combo.picks.length);
  };

  const toggleFree = (d: Day) =>
    setFreeDays((s) => {
      const n = new Set(s);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <p className="text-xs text-soft">
        Add subjects to the basket from the Browse tab (<span className="font-mono">+ Planner</span>), set constraints,
        and get the best clash-free timetables.
      </p>

      <Field label={`Subjects (${basket.length})`}>
        {basket.length ? (
          <div className="space-y-1.5">
            {basket.map((b) => (
              <div key={b.code} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5">
                <span className="font-mono text-sm font-bold">{b.code}</span>
                <select
                  value={b.lockedGroup ?? ""}
                  onChange={(e) => setBasketLock(b.code, e.target.value || undefined)}
                  className="ml-auto max-w-40 rounded-md border border-line bg-raised px-1.5 py-1 text-xs"
                >
                  <option value="">Any group ({b.groups.length})</option>
                  {b.groups.map((g) => (
                    <option key={g.group} value={g.group}>
                      Lock {g.group}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => removeFromBasket(b.code)} className="p-1 text-faint hover:text-bad">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty>The basket is empty — add subjects from the Browse tab.</Empty>
        )}
      </Field>

      {basket.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="No class before">
              <input type="time" value={noBefore} onChange={(e) => setNoBefore(e.target.value)} className={inputCls} />
            </Field>
            <Field label="No class after">
              <input type="time" value={noAfter} onChange={(e) => setNoAfter(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Keep days free">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleFree(d)}
                  className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-colors ${
                    freeDays.has(d) ? "border-accent bg-accent/15 text-accent" : "border-line bg-panel text-soft"
                  }`}
                >
                  {DAY_LABEL[d]}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Programme filter">
              <input value={programme} onChange={(e) => setProgramme(e.target.value)} placeholder="e.g. CS240" className={`${inputCls} !py-1.5 text-xs`} />
            </Field>
            <Field label="Rank by">
              <select value={preset} onChange={(e) => setPreset(e.target.value as RankPreset)} className={`${inputCls} !py-1.5 text-xs`}>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={run} disabled={running || !basket.length} className={btnPrimary}>
              {running ? <Spinner /> : <Wand2 className="size-4" />} Generate timetables
            </button>
            <button type="button" onClick={clearBasket} className={btnGhost}>
              Clear basket
            </button>
          </div>
        </>
      )}

      {applied !== null && (
        <div className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm text-good">
          Applied {applied} {applied === 1 ? "class" : "classes"} to the plan.
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.blocker && (
            <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              No clash-free combination exists. <span className="font-mono font-semibold">{result.blocker.a}</span> ↔{" "}
              <span className="font-mono font-semibold">{result.blocker.b}</span> collide most often ({result.blocker.clashes}{" "}
              group pairs). Try unlocking a group or relaxing a constraint.
            </div>
          )}
          {!result.combos.length && !result.blocker && <Empty>No combinations — the basket may be empty.</Empty>}
          {result.capped && <div className="text-xs text-faint">Search capped at 5000 valid combinations; showing the best.</div>}
          {result.combos.map((combo, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line bg-raised/60 px-3 py-1.5 text-xs font-semibold">
                <span>#{i + 1}</span>
                <span className="text-soft">
                  {combo.stats.days} day{combo.stats.days === 1 ? "" : "s"} · {Math.round(combo.stats.gapMinutes / 60)}h
                  {combo.stats.gapMinutes % 60 ? ` ${combo.stats.gapMinutes % 60}m` : ""} gaps · {fmt12(combo.stats.earliest)}–
                  {fmt12(combo.stats.latest)}
                </span>
              </div>
              <div className="pointer-events-none p-2">
                <TimetableGrid entries={comboToEntries(combo)} compact hourHeight={14} />
              </div>
              <div className="flex flex-wrap gap-1 px-3 pb-2 font-mono text-[10px] text-faint">
                {combo.picks.map((p) => (
                  <span key={p.subject} className="rounded bg-raised px-1.5 py-0.5">
                    {p.subject}·{p.group}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 border-t border-line px-3 py-2">
                <button type="button" onClick={() => apply(combo, false)} className={`${btnPrimary} !px-2.5 !py-1 text-xs`}>
                  <Sparkles className="size-3.5" /> Apply to current plan
                </button>
                <button type="button" onClick={() => apply(combo, true)} className={`${btnGhost} !px-2.5 !py-1 text-xs`}>
                  Save as new plan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
