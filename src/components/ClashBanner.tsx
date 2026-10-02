import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Entry } from "../lib/types.ts";
import { DAY_LABEL } from "../lib/types.ts";
import { findClashes } from "../lib/clash.ts";
import { fmtRangeCompact } from "../lib/time.ts";
import { usePlanner } from "../store/usePlanner.ts";

export default function ClashBanner({ entries }: { entries: Entry[] }) {
  const setHighlight = usePlanner((s) => s.setHighlight);
  const highlightIds = usePlanner((s) => s.highlightIds);
  const clashes = useMemo(() => findClashes(entries), [entries]);

  if (!clashes.length) {
    if (!entries.length) return null;
    return (
      <div className="flex items-center gap-2 border-b border-line bg-good/10 px-4 py-2 text-sm text-good print:hidden">
        <CheckCircle2 className="size-4" /> No clashes — this timetable works.
      </div>
    );
  }

  return (
    <div className="border-b border-bad/40 bg-bad/10 px-4 py-2 print:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-bad">
          <AlertTriangle className="size-4" />
          {clashes.length} {clashes.length === 1 ? "clash" : "clashes"}
        </span>
        {clashes.map((c, i) => {
          const ids = [c.a.entryId, c.b.entryId];
          const active = highlightIds.length === 2 && ids.every((id) => highlightIds.includes(id));
          return (
            <button
              key={i}
              type="button"
              onClick={() => setHighlight(active ? [] : ids)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                active ? "bg-bad text-white" : "bg-bad/15 text-bad hover:bg-bad/25"
              }`}
            >
              {c.a.subjectCode} ({c.a.group}) ↔ {c.b.subjectCode} ({c.b.group}) {DAY_LABEL[c.day]}{" "}
              {fmtRangeCompact(c.start, c.end)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
