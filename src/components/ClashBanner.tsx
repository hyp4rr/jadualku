import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Entry } from "../lib/types.ts";
import { DAY_LABEL } from "../lib/types.ts";
import { findClashes } from "../lib/clash.ts";
import { fmtRangeCompact } from "../lib/time.ts";
import { usePlanner } from "../store/usePlanner.ts";

export default function ClashBanner({ entries }: { entries: Entry[] }) {
  const setHighlight = usePlanner((s) => s.setHighlight);
  const highlightIds = usePlanner((s) => s.highlightIds);
  const clashes = useMemo(() => findClashes(entries), [entries]);

  if (!clashes.length) return null;

  return (
    <div className="anim-fade border-b border-bad/30 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--bad)_14%,transparent),color-mix(in_oklab,var(--bad)_6%,transparent))] px-4 py-2.5 print:hidden" role="alert">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-bold text-bad">
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
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                active ? "border-bad bg-bad text-white" : "border-bad/30 bg-bad/10 text-bad hover:bg-bad/20"
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
