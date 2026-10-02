import { GitCompareArrows, Save, X } from "lucide-react";
import type { SharePayload } from "../lib/share.ts";
import { payloadToPlan } from "../lib/share.ts";
import { usePlanner } from "../store/usePlanner.ts";
import TimetableView from "./TimetableView.tsx";

function uid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Incoming share link. Shows a live preview plus View / Save / Compare actions.
 */
export default function ShareDialog({ payload, onClose, onCompare }: { payload: SharePayload; onClose: () => void; onCompare: () => void }) {
  const importPlan = usePlanner((s) => s.importPlan);
  const addSharedPlan = usePlanner((s) => s.addSharedPlan);
  const theme = usePlanner((s) => s.theme);
  const plan = payloadToPlan(payload, uid());

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Shared timetable">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-xl flex-col rounded-t-2xl border-t border-line bg-panel lg:inset-y-10 lg:rounded-2xl lg:border">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold">
            Import “{payload.name}”
            <span className="ml-2 font-normal text-faint">{payload.entries.length} subjects</span>
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-raised">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TimetableView entries={plan.entries} theme={payload.theme ?? theme} />
        </div>
        <div className="flex gap-2 border-t border-line p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-soft hover:bg-raised"
          >
            Just view
          </button>
          <button
            type="button"
            onClick={() => {
              importPlan(payloadToPlan(payload, uid()));
              onClose();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-on-accent"
          >
            <Save className="size-4" /> Import as new plan
          </button>
          <button
            type="button"
            onClick={() => {
              addSharedPlan(payloadToPlan(payload, uid()));
              onCompare();
              onClose();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent px-3 py-2 text-sm font-bold text-accent hover:bg-accent/10"
          >
            <GitCompareArrows className="size-4" /> Compare with mine
          </button>
        </div>
      </div>
    </div>
  );
}
