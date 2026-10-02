// Browser-side helper: build + download the plan's .ics.
import { SEMESTERS } from "../data/academicCalendar.ts";
import { classOccurrences, resolveSemester, type Holiday, type MyState } from "./academic.ts";
import { buildIcs } from "./ics.ts";
import type { Plan } from "./types.ts";
import type { SowDoc } from "./sow.ts";

export interface IcsBuildInput {
  plan: Plan;
  semesterKey: string;
  state: MyState;
  holidays: Holiday[];
  sows: Record<string, SowDoc>;
  includeClasses: boolean;
  includeAssessments: boolean;
  includePeriods: boolean;
  reminderMinutes?: number;
}

/** Returns null when there is nothing to write. */
export function buildPlanIcs(input: IcsBuildInput): string | null {
  const semester = input.semesterKey === "auto" ? resolveSemester("auto") : SEMESTERS.find((s) => `${s.group}-${s.code}` === input.semesterKey) ?? null;
  if (!semester) return null;
  const occurrences = classOccurrences(input.plan.entries, semester, input.holidays, input.state);
  if (input.includeClasses && !occurrences.length && !input.includeAssessments && !input.includePeriods) return null;
  return buildIcs({
    planId: input.plan.id,
    occurrences,
    sows: input.sows,
    semester,
    state: input.state,
    includeClasses: input.includeClasses,
    includeAssessments: input.includeAssessments,
    includePeriods: input.includePeriods,
    reminderMinutes: input.reminderMinutes,
    calendarName: `JadualUiTMKu - ${input.plan.name}`,
  });
}

export function downloadText(filename: string, text: string, mime = "text/calendar") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));

/**
 * Hands the .ics to the OS calendar. On phones/tablets the share sheet offers
 * "Calendar" (iOS) / Google Calendar etc. (Android); everywhere else it downloads.
 */
export async function saveCalendarFile(filename: string, text: string): Promise<void> {
  const file = new File([text], filename, { type: "text/calendar" });
  if (isMobile() && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "JadualUiTMKu calendar" });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  downloadText(filename, text);
}
