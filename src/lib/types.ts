export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const DAY_LABEL: Record<Day, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

export interface Session {
  day: Day;
  start: number; // minutes since midnight
  end: number;
  room: string;
}

export interface Entry {
  id: string;
  subjectCode: string;
  subjectName: string;
  group: string;
  campus?: string;
  sessions: Session[];
  color: string;
  lecturer?: string;
  credits?: number;
  notes?: string;
  source: "icress" | "matric" | "manual";
  hidden?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  entries: Entry[];
  createdAt: number;
  updatedAt: number;
  /** Plans imported via share link get a "Friend" badge in Compare. */
  source?: "mine" | "friend";
}
