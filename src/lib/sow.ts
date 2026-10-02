// Pure Scheme-of-Work parser. Operates on extracted text lines (`\t` marks a
// table-column boundary, `\f` a page break) so it can be unit-tested without
// PDF machinery.

export interface SowWeek {
  week: number;
  weekEnd?: number;
  topics: string[];
}

export type SowKind = "test" | "quiz" | "assignment" | "project" | "presentation" | "lab" | "exam" | "other";

export interface SowAssessment {
  name: string;
  weight?: number;
  week?: number;
  /** ISO date when a literal date was found. */
  date?: string;
  kind: SowKind;
  /** Start / end as minutes since midnight (manual entry). */
  start?: number;
  end?: number;
  /** Hall / room for tests and exams. */
  venue?: string;
  note?: string;
}

export interface SowDoc {
  courseCode: string;
  courseName: string;
  credits?: number;
  lecturer?: string;
  weeks: SowWeek[];
  assessments: SowAssessment[];
  warnings: string[];
  fileName: string;
  importedAt: number;
  /** Free-form notes about the subject (manual entry). */
  notes?: string;
  /** True when created/edited by hand rather than parsed from a PDF. */
  manual?: boolean;
}

export const PAGE_BREAK = "\f";

const RE_CODE = /\b([A-Z]{3})\s?(\d{3}[A-Z]?)\b/;

interface LabelMatch {
  value: string | null;
  rest: string;
}

/** Try to read "Label: value" / "Label\tvalue" from a line; returns null when the line isn't a label line. */
function readLabel(line: string, labels: RegExp): LabelMatch | null {
  const m = labels.exec(line);
  if (!m) return null;
  const rest = line.slice(m[0].length).replace(/^\s*[:：]?\s*/, "");
  const value = rest.replace(/[\t:：].*$/, "").trim();
  return { value: value || null, rest };
}

const LABELS = {
  code: /\b(course\s*code|kod\s*kursus)\b/i,
  name: /\b(course\s*(?:name|title)|nama\s*kursus|tajuk\s*kursus)\b/i,
  credits: /\b(credit\s*hours?|credit\s*units?|jam\s*kredit|kredit)\b/i,
  lecturer: /\b(lecturers?|pensyarah)\b/i,
};

const RE_WEEK_START = /^\s*(?:week|minggu|w)\s*\.?\s*[:.]?\s*(\d{1,2})\s*(?:[-–—]\s*(\d{1,2}))?/i;
const RE_WEEK_REF = /(?:w(?:eek)?\s*(\d{1,2})|minggu\s*(\d{1,2}))/i;
const RE_SECTION_END = /^\s*(assessment|penilaian|references?|rujukan|bibliography|appendix|lampiran)\b/i;
const RE_ASSESS_SECTION = /^\s*(assessment|penilaian|continuous assessment|kaedah penilaian)\b/i;

const KIND_KEYWORDS: { kind: SowKind; re: RegExp }[] = [
  { kind: "exam", re: /final\s*exam|peperiksaan\s*akhir|\bexamination\b/i },
  { kind: "test", re: /\btest\b|ujian|mid[\s-]?term/i },
  { kind: "quiz", re: /quiz|kuiz/i },
  { kind: "assignment", re: /assignment|tugasan/i },
  { kind: "presentation", re: /presentation|pembentangan/i },
  { kind: "project", re: /project|projek/i },
  { kind: "lab", re: /\blab\b|practical|amali/i },
];
const RE_OTHER_KEYWORDS = /report|laporan|case\s*study|kes\s*kajian|\bexam\b|peperiksaan/i;

function assessmentKind(text: string): SowKind | null {
  for (const { kind, re } of KIND_KEYWORDS) if (re.test(text)) return kind;
  if (RE_OTHER_KEYWORDS.test(text)) return "other";
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse "12 November 2026", "12 Nov 2026", "12/11/2026" (D/M/Y), "12-11-2026" → ISO. */
export function parseSowDate(text: string): string | null {
  let m = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i.exec(text);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(text);
  if (m) {
    const dd = +m[1];
    const mm = +m[2];
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) return `${m[3]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return null;
}

function cleanTopic(line: string): string {
  return line
    .replace(/^[\s•\-*·▪○◦–—]+/, "")
    .replace(/^\(?[0-9ivxlcdm]+[.)]\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function parseSow(lines: string[], fileName: string, importedAt = Date.now()): SowDoc {
  const doc: SowDoc = {
    courseCode: "",
    courseName: "",
    weeks: [],
    assessments: [],
    warnings: [],
    fileName,
    importedAt,
  };
  const clean = lines.filter((l) => l !== PAGE_BREAK).map((l) => l.replace(/\s+$/g, ""));

  // ---- header fields ----
  for (const line of clean) {
    const codeM = readLabel(line, LABELS.code);
    if (codeM && !doc.courseCode) {
      const m = RE_CODE.exec(codeM.rest);
      if (m) doc.courseCode = `${m[1]}${m[2]}`.toUpperCase();
      else if (codeM.value) doc.courseCode = codeM.value.toUpperCase();
      continue;
    }
    const nameM = readLabel(line, LABELS.name);
    if (nameM && !doc.courseName) {
      doc.courseName = (nameM.rest.split("\t")[0] || nameM.value || "").trim();
      continue;
    }
    const credM = readLabel(line, LABELS.credits);
    if (credM && doc.credits === undefined) {
      const m = /(\d+(?:\.\d+)?)/.exec(credM.rest);
      if (m) doc.credits = Number(m[1]);
      continue;
    }
    const lecM = readLabel(line, LABELS.lecturer);
    if (lecM && !doc.lecturer) {
      doc.lecturer = (lecM.rest.split("\t")[0] || lecM.value || "").trim();
      continue;
    }
  }
  if (!doc.courseCode) {
    for (const line of clean) {
      const m = RE_CODE.exec(line);
      if (m) {
        doc.courseCode = `${m[1]}${m[2]}`.toUpperCase();
        // Name fallback: text after the code on the same line.
        if (!doc.courseName) {
          const after = line.slice(m.index + m[0].length).replace(/^[\s\-–—:]+/, "").split("\t")[0].trim();
          if (after.length >= 4) doc.courseName = after;
        }
        break;
      }
    }
  }

  // ---- weeks + assessments ----
  interface Ctx {
    week: SowWeek | null;
    inAssess: boolean;
  }
  const ctx: Ctx = { week: null, inAssess: false };
  const pushTopic = (t: string) => {
    t = cleanTopic(t);
    if (t && ctx.week && !ctx.week.topics.some((x) => normName(x) === normName(t))) ctx.week.topics.push(t);
  };

  /** Tidy an assessment name: strip weight/date fragments, parenthetical BM glosses, and " — detail" tails. */
  const cleanAssessName = (s: string) =>
    cleanTopic(s)
      .replace(/\([^)]*\)/g, "")
      .replace(/\d{1,3}\s?%/g, "")
      .replace(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i, "")
      .replace(/\d{1,2}[/-]\d{1,2}[/-]\d{4}/, "")
      .replace(/\s+[—–]\s+.*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const assessKeys = new Map<string, SowAssessment>();
  const explicitWeek = new Set<SowAssessment>();
  const addAssessment = (rawName: string, text: string, enclosingWeek?: number) => {
    const kind = assessmentKind(text);
    if (!kind) return;
    const name = cleanAssessName(rawName);
    const weightM = /(\d{1,3})\s?%/.exec(text);
    const weekM = RE_WEEK_REF.exec(text);
    const weight = weightM ? Number(weightM[1]) : undefined;
    const week = weekM ? Number(weekM[1] ?? weekM[2]) : enclosingWeek;
    const explicit = !!weekM;
    const date = parseSowDate(text) ?? undefined;
    // Dedupe key: numbered items merge on kind+number ("Assignment 1 due
    // (Tugasan 1 — 20%)" ≡ table "Assignment 1"); unnumbered items keep
    // name+week so different sessions don't collapse.
    const num = /(\d+)/.exec(name)?.[1] ?? "";
    const key = num ? `${kind}|${num}` : `${kind}|${normName(name)}|${week ?? date ?? ""}`;
    if (!name) return;
    const ex = assessKeys.get(key);
    if (ex) {
      ex.weight = ex.weight ?? weight;
      // An explicit "W4" beats a week inherited from the enclosing row.
      if (explicit && (!explicitWeek.has(ex) || ex.week === undefined)) ex.week = week;
      else ex.week = ex.week ?? week;
      ex.date = ex.date ?? date;
      return;
    }
    const a: SowAssessment = { name, kind, weight, week, date };
    if (explicit) explicitWeek.add(a);
    assessKeys.set(key, a);
    doc.assessments.push(a);
  };

  for (const rawLine of clean) {
    const line = rawLine.trim();
    if (!line) continue;

    const weekM = RE_WEEK_START.exec(line);
    const cells = line.split("\t");
    const cellWeek = cells.length > 1 && /^\d{1,2}$/.test(cells[0].trim()) ? Number(cells[0]) : null;

    if (RE_SECTION_END.test(line) && !weekM) {
      ctx.week = null;
      ctx.inAssess = RE_ASSESS_SECTION.test(line);
      continue;
    }

    if (weekM || (cellWeek !== null && cellWeek >= 1 && cellWeek <= 20)) {
      const wn = weekM ? Number(weekM[1]) : cellWeek!;
      const we = weekM?.[2] ? Number(weekM[2]) : undefined;
      const wk: SowWeek = { week: wn, weekEnd: we, topics: [] };
      doc.weeks.push(wk);
      ctx.week = wk;
      ctx.inAssess = false;
      const rest = weekM ? line.slice(weekM[0].length) : cells.slice(1).join("\t");
      if (rest.trim()) {
        const firstCell = cleanTopic(rest.split("\t")[0]);
        if (assessmentKind(rest)) addAssessment(firstCell || rest.split("\t")[0].trim(), rest, wn);
        else pushTopic(rest);
      }
      continue;
    }

    if (ctx.inAssess) {
      // Assessment table/section row: name + weight/week/date cells.
      const text = cells.join(" ");
      const kind = assessmentKind(text);
      if (kind) {
        const name = cleanTopic(cells[0]) || cleanTopic(text).slice(0, 80);
        addAssessment(name, text, undefined);
      }
      continue;
    }

    // Inside a week block — assessment keywords attach to the current week.
    if (ctx.week && assessmentKind(line)) {
      const name = cleanTopic(line.split("\t")[0]);
      addAssessment(name, line, ctx.week.week);
      continue;
    }
    pushTopic(line);
  }

  // Merge duplicate week rows (same number keeps its topics).
  const merged = new Map<number, SowWeek>();
  for (const w of doc.weeks) {
    const ex = merged.get(w.week);
    if (ex) {
      for (const t of w.topics) if (!ex.topics.some((x) => normName(x) === normName(t))) ex.topics.push(t);
      ex.weekEnd = ex.weekEnd ?? w.weekEnd;
    } else merged.set(w.week, w);
  }
  doc.weeks = [...merged.values()].sort((a, b) => a.week - b.week);

  // ---- warnings ----
  if (!doc.courseCode) doc.warnings.push("Course code not found — set it manually.");
  if (!doc.weeks.length) doc.warnings.push("No weekly topics were detected.");
  if (!doc.assessments.length) doc.warnings.push("No assessments were detected.");
  const weighted = doc.assessments.filter((a) => a.weight !== undefined);
  if (weighted.length) {
    const total = weighted.reduce((s, a) => s + (a.weight ?? 0), 0);
    if (total !== 100) doc.warnings.push(`Assessment weights add up to ${total}%, not 100%.`);
  }
  return doc;
}
