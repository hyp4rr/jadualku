// Shared client hooks/helpers for the academic calendar, holidays and SOW.
import { useEffect, useMemo, useState } from "react";
import { getHolidays, type HolidaysResponse } from "./api.ts";
import { resolveSemester, todayIso, type Holiday, type MyState } from "./academic.ts";
import type { Semester } from "../data/academicCalendar.ts";
import { usePlanner } from "../store/usePlanner.ts";

let holidayCache: HolidaysResponse | null = null;
let holidayPromise: Promise<HolidaysResponse | null> | null = null;

export function useHolidays(): HolidaysResponse | null {
  const [h, setH] = useState<HolidaysResponse | null>(holidayCache);
  useEffect(() => {
    if (holidayCache) return;
    holidayPromise ??= getHolidays().catch(() => null);
    void holidayPromise.then((r) => {
      holidayCache = r;
      setH(r);
    });
  }, []);
  return h;
}

export interface AcademicContext {
  semester: Semester | null;
  state: MyState;
  group: "A" | "B";
  semesterKey: string;
  holidays: Holiday[];
  holidaysSource: "live" | "snapshot" | null;
  holidaysFetchedAt: number;
  today: string;
}

export function useAcademic(): AcademicContext {
  const calendar = usePlanner((s) => s.calendar);
  const hol = useHolidays();
  return useMemo(() => {
    const key = calendar.semesterKey === "auto" ? "auto" : calendar.semesterKey;
    return {
      semester: resolveSemester(key, calendar.group),
      state: calendar.state,
      group: calendar.group,
      semesterKey: key,
      holidays: hol?.holidays ?? [],
      holidaysSource: hol?.source ?? null,
      holidaysFetchedAt: hol?.fetchedAt ?? 0,
      today: todayIso(),
    };
  }, [calendar.semesterKey, calendar.state, calendar.group, hol]);
}

/** Minute-ticking "now" for countdowns. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
