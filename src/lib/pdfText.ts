// Browser-only PDF text extraction. pdfjs is lazy-loaded — the worker is
// bundled locally (never a CDN request).
import { PAGE_BREAK } from "./sow.ts";

export class ScannedPdfError extends Error {
  constructor() {
    super("This PDF looks scanned, so its text can't be read. Enter details manually.");
    this.name = "ScannedPdfError";
  }
}

interface TextItem {
  str: string;
  x: number;
  /** Baseline y; larger = lower on the page (pdf y is flipped). */
  y: number;
  h: number;
  w: number;
}

/**
 * Group text items into lines by y (tolerance ~ half the font height), sort by
 * x, and join with " " — or "\t" when the horizontal gap exceeds ~2× the
 * average char width, so table columns survive.
 */
export function itemsToLines(items: TextItem[]): string[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { y: number; items: TextItem[] }[] = [];
  for (const it of sorted) {
    const tol = Math.max(2, it.h * 0.5);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) {
      line.items.push(it);
      line.y = (line.y + it.y) / 2;
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  lines.sort((a, b) => a.y - b.y);
  return lines.map((l) => {
    l.items.sort((a, b) => a.x - b.x);
    let out = "";
    let prevEnd = -Infinity;
    let prevCharW = 4;
    for (const it of l.items) {
      const charW = it.str.trim() ? Math.max(1.5, it.w / Math.max(1, it.str.length)) : prevCharW;
      const gap = it.x - prevEnd;
      if (out && gap > prevCharW * 2) out += "\t";
      else if (out && gap > 0.5) out += " ";
      out += it.str;
      prevEnd = it.x + it.w;
      prevCharW = charW;
    }
    return out;
  });
}

/**
 * Extract text lines from a PDF File. Returns `string[]` with PAGE_BREAK
 * markers between pages. Throws ScannedPdfError for image-only PDFs.
 */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  // Bundle the worker as a local asset — no CDN request.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const out: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: TextItem[] = [];
      for (const raw of tc.items) {
        const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
        if (typeof it.str !== "string" || !it.transform) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        const h = it.height ?? (Math.abs(it.transform[3]) || 10);
        const w = it.width ?? Math.max(1, it.str.length * h * 0.5);
        items.push({ str: it.str, x, y: -y, h, w });
      }
      if (p > 1) out.push(PAGE_BREAK);
      out.push(...itemsToLines(items));
    }
  } finally {
    void task.destroy();
  }
  const total = out.join("").replace(/\s/g, "").length;
  if (total < 80) throw new ScannedPdfError();
  return out;
}
