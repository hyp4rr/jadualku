// Transcribed from the official UiTM HEA academic calendar:
// https://hea.uitm.edu.my/index.php/calendars/academic-calendar (read 2026-10-01).
// Group A = Foundation / Professional. Group B = Pre-Diploma, Diploma, Bachelor, Master, PhD.
// `kkt` holds the alternate dates published for Kedah / Kelantan / Terengganu (Fri–Sat weekend).

export type CalendarGroup = "A" | "B";

export type PeriodKind = "lecture" | "online" | "test" | "break" | "revision" | "exam" | "eet";

export interface DateRange {
  start: string; // ISO date, inclusive
  end: string; // ISO date, inclusive
}

export interface CalendarPeriod extends DateRange {
  kind: PeriodKind;
  label: string;
  kkt?: DateRange;
  note?: string;
}

export interface Semester {
  code: string; // iCress session code, e.g. "20264"
  group: CalendarGroup;
  session: string;
  title: string;
  approved: string;
  periods: CalendarPeriod[];
  notes?: string[];
}

export const CALENDAR_SOURCE = "https://hea.uitm.edu.my/index.php/calendars/academic-calendar";
export const KKT_STATES = ["Kedah", "Kelantan", "Terengganu"] as const;

export const SEMESTERS: Semester[] = [
  {
    code: "20264",
    group: "A",
    session: "Session I 2026/2027",
    title: "June – October 2026",
    approved: "Approved by 328th UiTM Senate, updated 3 March 2026",
    periods: [
      { kind: "lecture", label: "Lecture", start: "2026-06-15", end: "2026-08-02" },
      { kind: "test", label: "Mid-Semester Test", start: "2026-08-03", end: "2026-08-09" },
      { kind: "break", label: "Mid-Semester Break", start: "2026-08-10", end: "2026-08-16" },
      { kind: "lecture", label: "Lecture", start: "2026-08-17", end: "2026-10-04" },
      { kind: "revision", label: "Revision Week", start: "2026-10-05", end: "2026-10-11" },
      { kind: "exam", label: "Final Examination", start: "2026-10-12", end: "2026-10-25" },
      { kind: "break", label: "Semester Break", start: "2026-10-26", end: "2026-11-20" },
    ],
  },
  {
    code: "20272",
    group: "A",
    session: "Session II 2026/2027",
    title: "November 2026 – April 2027",
    approved: "Approved by 328th UiTM Senate, updated 3 March 2026",
    periods: [
      { kind: "lecture", label: "Lecture", start: "2026-11-23", end: "2026-12-20" },
      { kind: "online", label: "Lecture (Online)", start: "2026-12-21", end: "2026-12-27", note: "Christmas: 25 December" },
      { kind: "lecture", label: "Lecture", start: "2026-12-28", end: "2027-01-10" },
      { kind: "test", label: "Mid-Semester Test", start: "2027-01-11", end: "2027-01-17" },
      { kind: "break", label: "Mid-Semester Break", start: "2027-01-18", end: "2027-01-24" },
      { kind: "lecture", label: "Lecture", start: "2027-01-25", end: "2027-03-07" },
      { kind: "break", label: "Special Break", start: "2027-03-08", end: "2027-03-14", note: "Aidil Fitri: 10 – 11 March" },
      { kind: "lecture", label: "Lecture", start: "2027-03-15", end: "2027-03-28" },
      { kind: "revision", label: "Revision Week", start: "2027-03-29", end: "2027-04-04" },
      { kind: "exam", label: "Final Examination", start: "2027-04-05", end: "2027-04-18" },
      { kind: "break", label: "Semester Break", start: "2027-04-19", end: "2027-05-16" },
    ],
  },
  {
    code: "20264",
    group: "B",
    session: "Session I 2026/2027",
    title: "September 2026 – February 2027",
    approved: "Approved by 327th UiTM Senate, updated 10 February 2026",
    periods: [
      { kind: "lecture", label: "Lecture", start: "2026-09-28", end: "2026-12-20", kkt: { start: "2026-09-27", end: "2026-12-19" } },
      {
        kind: "break",
        label: "Mid-Semester Break / Special Break",
        start: "2026-12-21",
        end: "2026-12-27",
        note: "Christmas: 25 December. Published as \"21 – 27 December 2025\"; the year is a typo in the official table.",
      },
      { kind: "lecture", label: "Lecture", start: "2026-12-28", end: "2027-01-10", kkt: { start: "2026-12-27", end: "2027-01-09" } },
      { kind: "eet", label: "English Exit Test (EET Speaking)", start: "2027-01-11", end: "2027-01-17" },
      { kind: "revision", label: "Revision Week", start: "2027-01-11", end: "2027-01-17" },
      { kind: "exam", label: "Final Examination / Assessment & EET (Writing)", start: "2027-01-18", end: "2027-02-07" },
      {
        kind: "break",
        label: "Semester Break",
        start: "2027-02-05",
        end: "2027-03-14",
        note: "Published as 5 February – 14 March 2027, which overlaps the last days of the final examination period.",
      },
    ],
    notes: ["Interim Week applies to Pre-Diploma / Diploma Part 1 students only (dates not published)."],
  },
  {
    code: "20272",
    group: "B",
    session: "Session II 2026/2027",
    title: "March – July 2027",
    approved: "Approved by 327th UiTM Senate, updated 10 February 2026",
    periods: [
      { kind: "lecture", label: "Lecture", start: "2027-03-15", end: "2027-05-16" },
      {
        kind: "online",
        label: "Lecture (Online)",
        start: "2027-05-17",
        end: "2027-05-29",
        kkt: { start: "2027-05-16", end: "2027-05-28" },
        note: "Aidil Adha: 17 – 18 May",
      },
      {
        kind: "break",
        label: "Mid-Semester Break / Special Break",
        start: "2027-05-30",
        end: "2027-06-06",
        note: "Keamatan: 30 – 31 May, Gawai: 1 – 2 June",
      },
      { kind: "lecture", label: "Lecture", start: "2027-06-07", end: "2027-06-27", kkt: { start: "2027-06-06", end: "2027-06-26" } },
      { kind: "eet", label: "English Exit Test (EET Speaking)", start: "2027-06-28", end: "2027-07-04" },
      { kind: "revision", label: "Revision Week", start: "2027-06-28", end: "2027-07-04" },
      { kind: "exam", label: "Final Examination / Assessment & EET (Writing)", start: "2027-07-05", end: "2027-07-25" },
      { kind: "break", label: "Semester Break", start: "2027-07-26", end: "2027-09-19" },
    ],
    notes: ["Interim Week applies to Pre-Diploma / Diploma Part 1 students only (dates not published)."],
  },
  {
    code: "20273",
    group: "B",
    session: "Session III 2026/2027",
    title: "July – September 2027 (Session III / Short Semester / Intersession)",
    approved: "Approved by 327th UiTM Senate, updated 10 February 2026",
    periods: [
      { kind: "lecture", label: "Session III / Short Semester (202633) Lecture", start: "2027-07-19", end: "2027-09-05" },
      { kind: "lecture", label: "Intersession Lecture (20263)", start: "2027-08-02", end: "2027-09-05" },
      { kind: "exam", label: "Session III / Intersession / Short Semester / Special Examination", start: "2027-09-06", end: "2027-09-12" },
      { kind: "break", label: "Semester Break", start: "2027-09-13", end: "2027-09-19" },
    ],
    notes: ["The first lecture week of Semester 202633 overlaps the third final-examination week of Semester 20272."],
  },
];
