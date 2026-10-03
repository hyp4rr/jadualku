import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  IcressError,
  getCampuses,
  getCourses,
  getFaculties,
  getGroups,
  getSessionCode,
} from "./icress.ts";
import type { GroupRow } from "./icress.ts";
import { handleHolidays } from "./holidays.ts";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const RE_CAMPUS = /^[A-Z0-9]{1,6}$/;
const RE_FACULTY = /^[A-Z]{2,4}$/;
const RE_COURSE = /^[A-Z]{2,4}\d{3}[A-Z]?$/;
const RE_MATRIC = /^\d{10}$/;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function param(url: URL, name: string, re: RegExp, required = true): string {
  const v = (url.searchParams.get(name) ?? "").trim().toUpperCase();
  if (!v) {
    if (required) throw new HttpError(400, `${name} is required`);
    return "";
  }
  if (!re.test(v)) throw new HttpError(400, `Invalid ${name}`);
  return v;
}

import { tmpdir } from "node:os";
import { join } from "node:path";

// ---- Group index ("find by group code") ----

const INDEX_TTL = 7 * 24 * 60 * 60 * 1000;
const CACHE_DIR = process.env.VERCEL
  ? join(tmpdir(), "jadualku-cache")
  : fileURLToPath(new URL("../.cache/", import.meta.url));

interface GroupIndex {
  /** Schema version — bump when the group-row parsing changes so stale disk caches rebuild. */
  v: 2;
  builtAt: number;
  campus: string;
  faculty: string;
  groups: Record<string, { course: string; rows: GroupRow[] }[]>;
}

interface Build {
  total: number;
  done: number;
  error?: string;
  result?: GroupIndex;
}

const builds = new Map<string, Build>();
const inFlightBuilds = new Map<string, Promise<GroupIndex>>();
const memoryIndexCache = new Map<string, GroupIndex>();

function indexKey(campus: string, faculty: string) {
  return faculty ? `${campus}-${faculty}` : campus;
}

function getCandidateReadPaths(key: string): string[] {
  const filename = `index-${key}.json`;
  return [
    join(tmpdir(), "jadualku-cache", filename),
    join(process.cwd(), "server", "fixtures", "indices", filename),
    join(process.cwd(), ".cache", filename),
    fileURLToPath(new URL(`../.cache/${filename}`, import.meta.url)),
    fileURLToPath(new URL(`../fixtures/indices/${filename}`, import.meta.url)),
  ];
}

async function readIndexFile(key: string): Promise<GroupIndex | null> {
  const mem = memoryIndexCache.get(key);
  if (mem && Date.now() - mem.builtAt < INDEX_TTL && mem.groups) return mem;

  for (const p of getCandidateReadPaths(key)) {
    try {
      const raw = await readFile(p, "utf-8");
      const parsed = JSON.parse(raw) as GroupIndex;
      if (parsed.v === 2 && Date.now() - parsed.builtAt < INDEX_TTL && parsed.groups) {
        memoryIndexCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function buildIndex(key: string, campus: string, faculty: string, build: Build): Promise<GroupIndex> {
  const courses = await getCourses(campus, faculty || undefined);
  build.total = courses.length;
  if (!courses.length) throw new IcressError(`SIMSweb returned no courses for campus ${campus}`);

  const groups: GroupIndex["groups"] = {};
  let cursor = 0;
  let failed = 0;

  async function worker() {
    while (cursor < courses.length) {
      const course = courses[cursor++];
      try {
        const rows = await getGroups(course.path);
        const byGroup = new Map<string, GroupRow[]>();
        for (const row of rows) {
          const g = row.group.trim().toUpperCase();
          if (!g) continue;
          const list = byGroup.get(g) ?? [];
          list.push(row);
          byGroup.set(g, list);
        }
        for (const [g, list] of byGroup) {
          (groups[g] ??= []).push({ course: course.code, rows: list });
        }
      } catch {
        failed++;
        // Skip a course that fails — don't sink the whole index.
      }
      build.done++;
    }
  }

  // 16 parallel workers crawl ~280 courses in 2-3 seconds instead of minutes
  await Promise.all(Array.from({ length: 16 }, worker));

  if (failed >= courses.length) {
    throw new IcressError(`Every course fetch failed for campus ${campus} — SIMSweb may be down`);
  }

  const result: GroupIndex = { v: 2, builtAt: Date.now(), campus, faculty, groups };
  memoryIndexCache.set(key, result);
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `index-${key}.json`), JSON.stringify(result));
  } catch {
    // Disk write may fail on read-only environments; in-memory cache still holds it
  }
  build.result = result;
  return result;
}

async function groupIndex(campus: string, faculty: string) {
  const key = indexKey(campus, faculty);
  const cached = await readIndexFile(key);
  if (cached) return { status: "ready" as const, builtAt: cached.builtAt, groups: cached.groups };

  let inFlight = inFlightBuilds.get(key);
  if (!inFlight) {
    const build: Build = { total: 0, done: 0 };
    builds.set(key, build);
    inFlight = (async () => {
      try {
        return await buildIndex(key, campus, faculty, build);
      } finally {
        inFlightBuilds.delete(key);
        builds.delete(key);
      }
    })();
    inFlightBuilds.set(key, inFlight);
  }

  try {
    const result = await inFlight;
    return { status: "ready" as const, builtAt: result.builtAt, groups: result.groups };
  } catch (e) {
    throw new HttpError(502, `Group index build failed: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

// ---- Matric (registered classes) ----

interface MatricDay {
  hari: string;
  jadual: { masa: string; courseid: string; bilik: string; lecturer: string; groups: string }[];
}

interface RegisteredRow {
  course: string;
  group: string;
  day_time: string;
  room: string;
  lecturer: string;
}

export function normalizeRegistered(data: Record<string, MatricDay>): RegisteredRow[] {
  const seen = new Set<string>();
  const out: RegisteredRow[] = [];
  for (const day of Object.values(data ?? {})) {
    if (!day?.jadual?.length) continue;
    for (const cls of day.jadual) {
      const item: RegisteredRow = {
        course: (cls.courseid ?? "").trim(),
        group: (cls.groups ?? "").trim(),
        day_time: `${(day.hari ?? "").toUpperCase()}( ${(cls.masa ?? "").trim()} )`,
        room: (cls.bilik ?? "").trim(),
        lecturer: (cls.lecturer ?? "").trim(),
      };
      const key = `${item.day_time}|${item.group}|${item.course}`;
      if (!item.course || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

async function registered(matric: string): Promise<RegisteredRow[]> {
  const res = await fetch(`https://cdn.uitm.link/jadual/baru/${matric}.json`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://mystudent.uitm.edu.my/",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 404) throw new HttpError(404, "No registered timetable found for that matric number");
  if (!res.ok) throw new HttpError(502, `Matric service answered ${res.status}`);
  return normalizeRegistered((await res.json()) as Record<string, MatricDay>);
}

// ---- Report Issue ----

const reportCooldowns = new Map<string, number>();
const REPORT_COOLDOWN_MS = 60 * 1000;

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  return req.socket.remoteAddress || "unknown";
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 50_000) reject(new HttpError(413, "Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch {
        reject(new HttpError(400, "Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function handleReport(req: IncomingMessage, res: ServerResponse) {
  const ip = getClientIp(req);
  const now = Date.now();
  const lastTime = reportCooldowns.get(ip);
  if (lastTime && now - lastTime < REPORT_COOLDOWN_MS) {
    const waitSec = Math.ceil((REPORT_COOLDOWN_MS - (now - lastTime)) / 1000);
    throw new HttpError(429, `Please wait ${waitSec}s before submitting another report.`);
  }

  if (reportCooldowns.size > 500) {
    for (const [k, t] of reportCooldowns.entries()) {
      if (now - t > REPORT_COOLDOWN_MS) reportCooldowns.delete(k);
    }
  }

  const body = await readJsonBody(req);
  const { category, summary, description, diagnostics, honeypot } = body;

  if (honeypot) {
    return send(res, 200, { ok: true, message: "Report received." });
  }

  if (!description || typeof description !== "string" || description.trim().length < 5) {
    throw new HttpError(400, "Please describe the issue in at least 5 characters.");
  }
  if (description.length > 3000) {
    throw new HttpError(400, "Description is too long (max 3000 characters).");
  }

  reportCooldowns.set(ip, now);

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new HttpError(500, "Server configuration error: RESEND_API_KEY is not configured.");
  }

  const recipient = process.env.REPORT_EMAIL;
  if (!recipient) {
    throw new HttpError(500, "Server configuration error: REPORT_EMAIL is not configured.");
  }
  const cleanCategory = String(category || "General").slice(0, 100);
  const cleanSummary = String(summary || "").slice(0, 200);
  const subject = `[JadualUiTMKu Issue] ${cleanCategory}${cleanSummary ? `: ${cleanSummary}` : ""}`;

  let diagText = "";
  if (diagnostics && typeof diagnostics === "object") {
    diagText = `\n\n--- Technical Diagnostics ---\n${JSON.stringify(diagnostics, null, 2)}`;
  }

  const plainText = `[JadualUiTMKu Issue Report]
Category: ${cleanCategory}
Summary: ${cleanSummary || "(None)"}
Submitted At: ${new Date().toISOString()}

--- Description ---
${description.trim()}${diagText}`;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "JadualUiTMKu <onboarding@resend.dev>",
      to: [recipient],
      subject,
      text: plainText,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  const resendData = (await resendRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resendRes.ok) {
    console.error("Resend delivery failed:", resendRes.status, resendData);
    const msg = typeof resendData.message === "string" ? resendData.message : `HTTP ${resendRes.status}`;
    throw new HttpError(502, `Failed to deliver report via Resend: ${msg}`);
  }

  return send(res, 200, { ok: true, message: "Report sent successfully." });
}

// ---- URL Shortening ----

const shortUrlCache = new Map<string, string>();

async function shortenUrlService(rawUrl: string): Promise<string | null> {
  // 1. CleanURI: direct 301, clean URL, no ads
  try {
    const res = await fetch("https://cleanuri.com/api/v1/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "url=" + encodeURIComponent(rawUrl),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as { result_url?: string };
      if (data && typeof data.result_url === "string" && data.result_url) {
        return data.result_url;
      }
    }
  } catch {}

  // 2. TinyURL fallback
  try {
    const res = await fetch("https://tinyurl.com/api-create.php?url=" + encodeURIComponent(rawUrl), {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith("http")) return text.trim();
    }
  } catch {}

  // 3. Ulvis fallback
  try {
    const res = await fetch("https://ulvis.net/API/write/get?url=" + encodeURIComponent(rawUrl) + "&type=json", {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as { success?: boolean; data?: { url?: string } };
      if (data && data.success && data.data && data.data.url) return data.data.url;
    }
  } catch {}

  return null;
}

async function handleShorten(req: IncomingMessage, res: ServerResponse) {
  const body = await readJsonBody(req);
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl || (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://"))) {
    throw new HttpError(400, "Valid http(s) URL is required");
  }
  if (rawUrl.length > 50_000) {
    throw new HttpError(400, "URL too long");
  }

  const cached = shortUrlCache.get(rawUrl);
  if (cached) {
    return send(res, 200, { shortUrl: cached, cached: true });
  }

  const short = await shortenUrlService(rawUrl);
  if (short) {
    shortUrlCache.set(rawUrl, short);
    if (shortUrlCache.size > 2000) {
      const oldest = shortUrlCache.keys().next().value;
      if (oldest) shortUrlCache.delete(oldest);
    }
    return send(res, 200, { shortUrl: short, cached: false });
  }

  return send(res, 200, { shortUrl: rawUrl, fallback: true });
}

// ---- Router ----

export async function handleApi(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://local");
  try {
    if (req.method === "POST" && url.pathname === "/report") {
      return await handleReport(req, res);
    }

    if (req.method === "POST" && url.pathname === "/shorten") {
      return await handleShorten(req, res);
    }

    if (req.method !== "GET") return send(res, 405, { error: "GET only" });

    switch (url.pathname) {
      case "/session":
        return send(res, 200, { code: await getSessionCode() });
      case "/campuses":
        return send(res, 200, await getCampuses());
      case "/faculties":
        return send(res, 200, await getFaculties());
      case "/courses": {
        const campus = param(url, "campus", RE_CAMPUS);
        const faculty = param(url, "faculty", RE_FACULTY, false) || undefined;
        const courses = await getCourses(campus, faculty);
        return send(res, 200, courses.map((c) => ({ code: c.code })));
      }
      case "/groups": {
        const campus = param(url, "campus", RE_CAMPUS);
        const faculty = param(url, "faculty", RE_FACULTY, false) || undefined;
        const course = param(url, "course", RE_COURSE);
        const courses = await getCourses(campus, faculty);
        const ref = courses.find((c) => c.code === course);
        if (!ref) throw new HttpError(404, `Course ${course} was not found for that campus`);
        return send(res, 200, await getGroups(ref.path));
      }
      case "/group-index": {
        const campus = param(url, "campus", RE_CAMPUS);
        const faculty = param(url, "faculty", RE_FACULTY, false);
        return send(res, 200, await groupIndex(campus, faculty));
      }
      case "/registered": {
        const matric = param(url, "matric", RE_MATRIC);
        return send(res, 200, await registered(matric));
      }
      case "/holidays":
        return send(res, 200, await handleHolidays());
      default:
        return send(res, 404, { error: "Not found" });
    }
  } catch (e) {
    const status =
      e instanceof HttpError
        ? e.status
        : e instanceof Error && e.name === "TimeoutError"
          ? 504
          : e instanceof IcressError
            ? 502
            : 502;
    send(res, status, { error: e instanceof Error ? e.message : "Request failed" });
  }
}

/** Mounts the JadualKu API at /api on the dev and preview servers. */
export function jadualkuApiPlugin(): Plugin {
  return {
    name: "jadualku-api",
    configureServer(server) {
      server.middlewares.use("/api", (req, res) => void handleApi(req, res));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api", (req, res) => void handleApi(req, res));
    },
  };
}
