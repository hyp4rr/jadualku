import { describe, expect, it } from "vitest";
import { parseSow, parseSowDate } from "./sow.ts";

// Realistic UiTM-style SOW: label/value header, tab-separated week table,
// mixed BM/EN, a range week, assessments inside week rows and in a table,
// and weights that don't add to 100.
const FIXTURE_A = [
  "UNIVERSITI TEKNOLOGI MARA",
  "SCHEME OF WORK / PELAN KERJA",
  "Course Code : CSP600",
  "Course Name : Problem Solving and Programming",
  "Credit Hours : 3",
  "Lecturer\tDr. Aminah Binti Yusof",
  "\f",
  "Week\tTopics / Topik",
  "Week 1\tIntroduction to problem solving; algorithms",
  "Week 2\tFlowcharts and pseudocode",
  "Week 3-4\tSelection control structures (if, switch)",
  "\tQuiz 1 (10%) — selection",
  "Week 5\tRepetition: for, while",
  "Week 6\tMid-semester test (15%)",
  "Week 7\tArrays",
  "Week 8\tAssignment 1 due (Tugasan 1 — 20%)",
  "Minggu 9 – 10\tFunctions and parameter passing",
  "Week 11\tProject presentation (Pembentangan 15%)",
  "Week 12\tFile processing",
  "Week 13\tPointers intro",
  "Week 14\tRevision week",
  "Assessment / Penilaian",
  "Assessment\tWeight\tWeek",
  "Quiz 1\t10%\tW4",
  "Mid-semester test\t15%\tW6",
  "Assignment 1\t20%\tW8",
  "Project presentation\t15%\tW11",
  "Final Examination (Peperiksaan Akhir)\t30%\tExam week",
  "References / Rujukan",
  "Deitel & Deitel, C How to Program",
];

// Minimal alternative layout — "Minggu 1: …" prose style.
const FIXTURE_B = [
  "Nama Kursus: Perakaunan Kewangan",
  "Kod Kursus: FAR110",
  "Jam Kredit: 4",
  "Pensyarah: Encik Halim",
  "Minggu 1: Pengenalan kepada perakaunan",
  "Minggu 2 - 3: Kitaran perakaunan dan jurnal",
  "Minggu 4: Penyata kewangan; Kuiz 1 (5%)",
  "Minggu 5: Ujian pertengahan semester (25%)",
  "Minggu 6: Final Exam pada 12 November 2026 (70%)",
];

describe("parseSow — full fixture", () => {
  const doc = parseSow(FIXTURE_A, "csp600-sow.pdf", 1700000000000);

  it("reads header fields", () => {
    expect(doc.courseCode).toBe("CSP600");
    expect(doc.courseName).toBe("Problem Solving and Programming");
    expect(doc.credits).toBe(3);
    expect(doc.lecturer).toBe("Dr. Aminah Binti Yusof");
    expect(doc.fileName).toBe("csp600-sow.pdf");
  });

  it("builds weeks including ranges", () => {
    const w3 = doc.weeks.find((w) => w.week === 3);
    expect(w3?.weekEnd).toBe(4);
    expect(w3?.topics[0]).toContain("Selection control structures");
    const w9 = doc.weeks.find((w) => w.week === 9);
    expect(w9?.weekEnd).toBe(10);
    expect(doc.weeks.map((w) => w.week)).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14]);
  });

  it("detects assessments in week rows and the assessment table, deduped", () => {
    const names = doc.assessments.map((a) => a.name);
    expect(names.filter((n) => n.includes("Quiz 1"))).toHaveLength(1);
    const quiz = doc.assessments.find((a) => a.name.includes("Quiz 1"))!;
    expect(quiz.kind).toBe("quiz");
    expect(quiz.weight).toBe(10);
    expect(quiz.week).toBe(4);
    const mid = doc.assessments.find((a) => a.name.toLowerCase().includes("mid"))!;
    expect(mid.kind).toBe("test");
    expect(mid.weight).toBe(15);
    const pres = doc.assessments.find((a) => a.name.includes("Project presentation"))!;
    expect(pres.kind).toBe("presentation");
    expect(pres.weight).toBe(15);
    const final = doc.assessments.find((a) => a.kind === "exam")!;
    expect(final.weight).toBe(30);
  });

  it("warns about weights not summing to 100", () => {
    // 10 + 15 + 20 + 15 + 30 = 90
    expect(doc.warnings.some((w) => w.includes("90%"))).toBe(true);
  });
});

describe("parseSow — minimal BM fixture", () => {
  const doc = parseSow(FIXTURE_B, "far110.pdf");

  it("reads BM labels", () => {
    expect(doc.courseCode).toBe("FAR110");
    expect(doc.courseName).toBe("Perakaunan Kewangan");
    expect(doc.credits).toBe(4);
    expect(doc.lecturer).toBe("Encik Halim");
  });

  it("parses Minggu ranges and inline assessments", () => {
    expect(doc.weeks.find((w) => w.week === 2)?.weekEnd).toBe(3);
    const kuiz = doc.assessments.find((a) => a.kind === "quiz");
    expect(kuiz?.week).toBe(4);
    const ujian = doc.assessments.find((a) => a.kind === "test");
    expect(ujian?.week).toBe(5);
    const exam = doc.assessments.find((a) => a.kind === "exam");
    expect(exam?.date).toBe("2026-11-12");
    expect(exam?.weight).toBe(70);
    // 5 + 25 + 70 = 100 → no weight warning
    expect(doc.warnings.some((w) => w.includes("%"))).toBe(false);
  });
});

describe("parseSow — edge cases", () => {
  it("warns when code/weeks/assessments are missing", () => {
    const doc = parseSow(["Some random document", "with no structure"], "x.pdf");
    expect(doc.warnings).toContain("Course code not found — set it manually.");
    expect(doc.warnings.some((w) => w.includes("weekly topics"))).toBe(true);
    expect(doc.warnings.some((w) => w.includes("assessments"))).toBe(true);
  });

  it("falls back to first AAA123 pattern and name-after-code", () => {
    const doc = parseSow(["ENT600 TECHNOLOGY ENTREPRENEURSHIP", "Week 1 Intro"], "y.pdf");
    expect(doc.courseCode).toBe("ENT600");
    expect(doc.courseName).toBe("TECHNOLOGY ENTREPRENEURSHIP");
  });
});

describe("parseSowDate", () => {
  it("parses all supported formats (D/M/Y)", () => {
    expect(parseSowDate("due 12 November 2026")).toBe("2026-11-12");
    expect(parseSowDate("12 Nov 2026")).toBe("2026-11-12");
    expect(parseSowDate("12/11/2026")).toBe("2026-11-12");
    expect(parseSowDate("12-11-2026")).toBe("2026-11-12");
    expect(parseSowDate("no date")).toBeNull();
  });
});
