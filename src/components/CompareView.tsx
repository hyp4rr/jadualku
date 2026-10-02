import { useMemo, useState } from "react";
import { Columns2, Layers, Trash2 } from "lucide-react";
import type { Entry, Plan } from "../lib/types.ts";
import { DAY_LABEL } from "../lib/types.ts";
import { commonFreeSlots, diffPlans, planStats, type PlanStats } from "../lib/compare.ts";
import { usePlanner } from "../store/usePlanner.ts";
import { fmt12, fmt24 } from "../lib/time.ts";
import TimetableView from "./TimetableView.tsx";
import OverlayGrid from "./OverlayGrid.tsx";

interface Pick {
  id: string;
  name: string;
  entries: Entry[];
  friend?: boolean;
}

const fmt = (is12h: boolean, m: number) => (m <= 0 ? "—" : is12h ? fmt12(m) : fmt24(m));
const fmtDur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `${m}m`);

function StatTable({ picks, stats, timeFormat }: { picks: Pick[]; stats: PlanStats[]; timeFormat: "12h" | "24h" }) {
  const f = (m: number) => fmt(timeFormat === "12h", m);
  const rows: { label: string; values: (number | string)[]; best?: "min" | "max" }[] = [
    { label: "Subjects", values: stats.map((s) => s.subjects) },
    { label: "Credits", values: stats.map((s) => s.credits) },
    { label: "Contact h/week", values: stats.map((s) => (s.contactMinutes / 60).toFixed(1).replace(/\.0$/, "")), best: "min" },
    { label: "Campus days", values: stats.map((s) => s.campusDays), best: "min" },
    { label: "Free weekdays", values: stats.map((s) => s.freeWeekdays), best: "max" },
    { label: "Earliest start", values: stats.map((s) => f(s.earliest)) },
    { label: "Latest end", values: stats.map((s) => f(s.latest)) },
    { label: "Longest day", values: stats.map((s) => fmtDur(s.longestDay)), best: "min" },
    { label: "Gap time/week", values: stats.map((s) => fmtDur(s.gapMinutes)), best: "min" },
    { label: "Clashes", values: stats.map((s) => s.clashes), best: "min" },
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="bg-raised text-left text-faint">
            <th className="px-3 py-2 font-semibold">Stat</th>
            {picks.map((p) => (
              <th key={p.id} className="px-3 py-2 font-semibold text-soft">
                {p.name}
                {p.friend && <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold text-accent">Friend</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const nums = r.values.map((v) => (typeof v === "number" ? v : NaN));
            const valid = r.best && nums.every((n) => Number.isFinite(n));
            const best = valid ? (r.best === "min" ? Math.min(...nums) : Math.max(...nums)) : NaN;
            return (
              <tr key={r.label} className="border-t border-line">
                <td className="px-3 py-1.5 font-medium text-soft">{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={`px-3 py-1.5 font-semibold ${valid && nums[i] === best ? "text-good" : "text-ink"}`}>
                    {v}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CompareView() {
  const plans = usePlanner((s) => s.plans);
  const sharedPlans = usePlanner((s) => s.sharedPlans);
  const removeSharedPlan = usePlanner((s) => s.removeSharedPlan);
  const theme = usePlanner((s) => s.theme);

  const all: Pick[] = useMemo(
    () => [
      ...plans.map((p) => ({ id: p.id, name: p.name, entries: p.entries, friend: p.source === "friend" })),
      ...sharedPlans.map((p) => ({ id: `shared:${p.id}`, name: p.name, entries: p.entries, friend: true })),
    ],
    [plans, sharedPlans],
  );

  const [sel, setSel] = useState<string[]>([]);
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [minFree, setMinFree] = useState(30);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  const picks = sel.map((id) => all.find((p) => p.id === id)).filter((p): p is Pick => !!p);
  const stats = picks.map((p) => planStats(p.entries));
  const free = useMemo(
    () =>
      picks.length >= 2
        ? commonFreeSlots(
            picks.map((p) => p.entries),
            { from: 8 * 60, to: 18 * 60, days: ["MON", "TUE", "WED", "THU", "FRI"] },
            minFree,
          )
        : [],
    [picks, minFree],
  );
  const diff = useMemo(() => (picks.length === 2 ? diffPlans(picks[0].entries, picks[1].entries) : null), [picks]);

  const overlayOk = picks.length === 2;
  const effectiveMode = overlayOk ? mode : "side";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-4 p-3 sm:p-4">
        {/* plan picker */}
        <section className="rounded-xl border border-line bg-panel p-3">
          <h3 className="mb-2 text-xs font-bold tracking-wide text-faint uppercase">Compare timetables (pick 2–4)</h3>
          <div className="flex flex-wrap gap-1.5">
            {all.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  sel.includes(p.id) ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                }`}
              >
                {p.name}
                {p.friend && <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold text-accent">Friend</span>}
              </button>
            ))}
            {!all.length && <p className="text-xs text-faint">No plans yet.</p>}
          </div>
          {sharedPlans.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
              <span>Imported via share link:</span>
              {sharedPlans.map((p: Plan) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
                  {p.name}
                  <button type="button" onClick={() => removeSharedPlan(p.id)} className="text-faint hover:text-bad" aria-label={`Remove ${p.name}`}>
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {picks.length < 2 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-soft">
            Select at least two timetables above to compare them.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMode("side")}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  effectiveMode === "side" ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                }`}
              >
                <Columns2 className="size-3.5" /> Side by side
              </button>
              <button
                type="button"
                disabled={!overlayOk}
                onClick={() => setMode("overlay")}
                title={overlayOk ? "Both plans on one grid" : "Overlay needs exactly two plans"}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  effectiveMode === "overlay" ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-raised"
                }`}
              >
                <Layers className="size-3.5" /> Overlay / diff
              </button>
            </div>

            <StatTable picks={picks} stats={stats} timeFormat={theme.timeFormat} />

            {effectiveMode === "overlay" && overlayOk ? (
              <div className="overflow-x-auto rounded-xl border border-line">
                <OverlayGrid
                  a={picks[0].entries}
                  b={picks[1].entries}
                  labelA={picks[0].name}
                  labelB={picks[1].name}
                  theme={theme}
                  freeWindows={free}
                  className="min-w-[640px]"
                />
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 320px), 1fr))` }}>
                {picks.map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-xl border border-line">
                    <div className="border-b border-line bg-raised px-3 py-1.5 text-xs font-bold">
                      {p.name}
                      {p.friend && <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-px text-[9px] font-bold text-accent">Friend</span>}
                    </div>
                    <TimetableView entries={p.entries} theme={theme} layout="grid" />
                  </div>
                ))}
              </div>
            )}

            {/* common free time */}
            <section className="rounded-xl border border-line bg-panel p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-bold tracking-wide text-faint uppercase">Common free time — Mon–Fri 08:00–18:00</h3>
                <select
                  value={minFree}
                  onChange={(e) => setMinFree(Number(e.target.value))}
                  className="ml-auto rounded-md border border-line bg-panel px-2 py-1 text-xs text-soft"
                  aria-label="Minimum free length"
                >
                  <option value={30}>min 30 min</option>
                  <option value={60}>min 60 min</option>
                </select>
              </div>
              {free.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {free.map((w) => (
                    <li key={`${w.day}-${w.start}`} className="rounded-lg bg-good/10 px-2.5 py-1 text-xs font-semibold text-good">
                      {DAY_LABEL[w.day].slice(0, 3)} {fmt(theme.timeFormat === "12h", w.start)}–{fmt(theme.timeFormat === "12h", w.end)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-faint">No shared free windows of {minFree}+ minutes in that window.</p>
              )}
            </section>

            {/* diff list */}
            {diff && (
              <section className="rounded-xl border border-line bg-panel p-3">
                <h3 className="mb-2 text-xs font-bold tracking-wide text-faint uppercase">Differences</h3>
                <ul className="space-y-1 text-xs text-soft">
                  {diff.onlyA.map((c) => (
                    <li key={`a-${c}`}>
                      <b className="text-ink">{c}</b> — only in {picks[0].name}
                    </li>
                  ))}
                  {diff.onlyB.map((c) => (
                    <li key={`b-${c}`}>
                      <b className="text-ink">{c}</b> — only in {picks[1].name}
                    </li>
                  ))}
                  {diff.sameSubjectDifferentGroup.map((x) => (
                    <li key={`g-${x.code}`}>
                      <b className="text-ink">{x.code}</b> — group {x.aGroup} vs {x.bGroup}
                    </li>
                  ))}
                  {diff.identical.length > 0 && <li className="text-faint">Identical: {diff.identical.join(", ")}</li>}
                  {!diff.onlyA.length && !diff.onlyB.length && !diff.sameSubjectDifferentGroup.length && (
                    <li className="text-faint">The two plans are identical.</li>
                  )}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
