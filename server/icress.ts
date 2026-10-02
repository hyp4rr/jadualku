// SIMSweb (iCress) scraper — pure parsing + fetch. No tough-cookie: a small
// cookie map is kept, and redirects are followed manually so Set-Cookie headers
// on the index.cfm → index_<session>.cfm 302 are captured.

export const BASE = "https://simsweb4.uitm.edu.my/estudent/class_timetable/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const SCRAPS_TTL = 10 * 60 * 1000;
const COURSES_TTL = 30 * 60 * 1000;
const GROUPS_TTL = 10 * 60 * 1000;

export class IcressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcressError";
  }
}

// ---- TTL cache ----
const cache = new Map<string, { at: number; value: unknown }>();

function cacheGet<T>(key: string, ttl: number): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  return null;
}

function cacheSet(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
}

export function clearScrapsCache() {
  cache.delete("scraps");
}

// ---- Cookies ----
const cookies = new Map<string, string>();

function storeCookies(setCookies: string[]) {
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(): string {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

// ---- Fetch with manual redirect following (captures cookies on 302s) ----
interface Fetched {
  text: string;
  finalUrl: string;
  status: number;
}

async function fetchIcress(
  path: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<Fetched> {
  let url = path.startsWith("http") ? path : new URL(path, BASE).toString();
  const method = options.method ?? "GET";

  for (let hops = 0; hops < 8; hops++) {
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Referer: `${BASE}index.cfm`,
      ...options.headers,
    };
    const ch = cookieHeader();
    if (ch) headers["Cookie"] = ch;

    const res = await fetch(url, {
      method,
      headers,
      body: options.body,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    storeCookies(res.headers.getSetCookie?.() ?? []);

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new IcressError(`SIMSweb ${res.status} without Location for ${path}`);
      url = new URL(loc, url).toString();
      // 302/303 on a POST converts to GET; GETs just follow.
      continue;
    }

    if (!res.ok) throw new IcressError(`SIMSweb answered ${res.status} for ${path}`);
    return { text: await res.text(), finalUrl: res.url || url, status: res.status };
  }
  throw new IcressError(`Too many SIMSweb redirects for ${path}`);
}

// ---- HTML parsing ----
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      return String.fromCodePoint(
        e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)),
      );
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Tags become spaces so "Fulltime<br>and Part-time" stays "Fulltime and Part-time". */
export function cellText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractAjaxUrl(script: string): string | null {
  const patterns = [
    /url\s*:\s*['"]([^'")]+)['"]/m,
    /\$\.ajax\(\s*['"]([^'")]+)['"]/m,
    /\$\.post\(\s*['"]([^'")]+)['"]/m,
    /fetch\(\s*['"]([^'")]+)['"]/m,
  ];
  for (const re of patterns) {
    const m = script.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export interface Scraps {
  tokens: Record<string, string>;
  indexLocation: string;
  indexResultLocation: string;
  campusSelectLocation: string;
  sessionCode: string | null;
}

/** Parses the iCress index page: hidden inputs, JS token assignments, ajax + campus URLs. */
export function parseIndex(html: string, finalUrl: string): Scraps {
  const idToName: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  for (const m of html.matchAll(/<input\b[^>]*type\s*=\s*["']hidden["'][^>]*>/gi)) {
    const tag = m[0];
    const name = tag.match(/name\s*=\s*["']([^"']+)["']/)?.[1];
    const id = tag.match(/\bid\s*=\s*["']([^"']+)["']/)?.[1];
    const value = tag.match(/value\s*=\s*["']([^"']*)["']/)?.[1] ?? "";
    if (name) {
      tokens[name] = value;
      if (id) idToName[id] = name;
    }
  }

  let indexResultLocation = "";
  let campusSelectLocation = "";

  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = m[1];

    if (script.includes("check_form_before_submit")) {
      const u = extractAjaxUrl(script);
      if (u) indexResultLocation = u;

      // document.getElementById('id').value = 'val' — mapped id → field name.
      for (const assign of script.matchAll(
        /document\.getElementById\(['"]([^'"]+)['"]\)\.value\s*=\s*['"]([^'"]*)['"]/g,
      )) {
        const name = idToName[assign[1]] ?? assign[1];
        tokens[name] = assign[2];
      }
    }

    if (script.includes("find_cam_icress_student") && !campusSelectLocation) {
      const u = extractAjaxUrl(script);
      if (u) campusSelectLocation = u;
    }
  }

  return {
    tokens,
    indexLocation: finalUrl,
    indexResultLocation,
    campusSelectLocation,
    sessionCode: parseSessionCode(finalUrl),
  };
}

export function parseSessionCode(url: string): string | null {
  return url.match(/index_(\d{5})\.cfm/i)?.[1] ?? null;
}

async function fetchScraps(force = false): Promise<Scraps> {
  if (!force) {
    const hit = cacheGet<Scraps>("scraps", SCRAPS_TTL);
    if (hit) return hit;
  }
  const { text, finalUrl } = await fetchIcress("index.cfm");
  const scraps = parseIndex(text, finalUrl);
  cacheSet("scraps", scraps);
  return scraps;
}

/** Runs `fn` with fresh-once semantics: one retry with re-fetched tokens on failure. */
async function withSessionRetry<T>(fn: (scraps: Scraps) => Promise<T>): Promise<T> {
  const scraps = await fetchScraps();
  try {
    return await fn(scraps);
  } catch (e) {
    if (e instanceof IcressError || (e instanceof Error && e.name === "TimeoutError")) {
      const fresh = await fetchScraps(true);
      return fn(fresh);
    }
    throw e;
  }
}

// ---- Public API ----

export async function getSessionCode(): Promise<string> {
  const scraps = await fetchScraps();
  if (scraps.sessionCode) return scraps.sessionCode;
  // Fall back: derive from the result URL name (index_<code>_result.cfm).
  const m = scraps.indexResultLocation.match(/index_(\d{5})_result\.cfm/i);
  if (m) return m[1];
  throw new IcressError("Could not determine the iCress session code.");
}

export interface IdText {
  id: string;
  text: string;
}

/** Parses a select2 JSON response or a `<br>`-separated "ID - NAME" list. */
export function parseIdText(text: string): IdText[] {
  try {
    const json = JSON.parse(text) as { results?: IdText[] } | IdText[];
    const list = Array.isArray(json) ? json : (json.results ?? []);
    return list
      .filter((e) => e && typeof e.id === "string")
      .map((e) => ({ id: String(e.id).trim(), text: String(e.text ?? "").trim() }));
  } catch {
    return text
      .split(/<br\s*\/?>/i)
      .map((l) => decodeEntities(l.replace(/<[^>]+>/g, " ")).trim())
      .map((l) => l.match(/^([A-Za-z0-9]+)\s*-\s*(.+)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => ({ id: m[1].trim(), text: m[2].trim() }));
  }
}

export async function getCampuses(): Promise<IdText[]> {
  return withSessionRetry(async (scraps) => {
    const location = scraps.campusSelectLocation || "AJAX_campus_icress_lIII.cfm";
    const sep = location.includes("?") ? "&" : "?";
    const { text } = await fetchIcress(`${location}${sep}key=All&page=1&page_limit=100`);
    const entries = parseIdText(text).filter((c) => c.id && c.id !== "X");
    if (!entries.length) throw new IcressError("SIMSweb returned no campuses.");
    return entries;
  });
}

export function parseFacultyList(text: string): IdText[] {
  return text
    .split(/<br\s*\/?>/i)
    .map((l) => decodeEntities(l.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .map((l) => l.match(/^([A-Z]{2,4})\s*-\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ id: m[1].trim(), text: m[2].trim() }));
}

export async function getFaculties(): Promise<IdText[]> {
  const hit = cacheGet<IdText[]>("faculties", SCRAPS_TTL);
  if (hit) return hit;
  const { text } = await fetchIcress("combo_select_faculty.txt");
  const list = parseFacultyList(text);
  if (!list.length) throw new IcressError("SIMSweb returned no faculties.");
  cacheSet("faculties", list);
  return list;
}

export interface CourseRef {
  code: string;
  path: string;
}

/** Parses the course-result table (`gradeU` rows): second cell = code, first href = path. */
export function parseCourseRows(html: string): CourseRef[] {
  const courses: CourseRef[] = [];
  for (const m of html.matchAll(/<tr[^>]*class\s*=\s*["']gradeU["'][^>]*>[\s\S]*?<\/tr>/gi)) {
    const row = m[0];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const code = (cells[1]?.[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .trim()
      .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
    const path = row.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    if (code && path) courses.push({ code: code.toUpperCase(), path });
  }
  return courses;
}

export async function getCourses(campus: string, faculty?: string): Promise<CourseRef[]> {
  const key = `courses:${campus}:${faculty ?? ""}`;
  const hit = cacheGet<CourseRef[]>(key, COURSES_TTL);
  if (hit) return hit;

  const courses = await withSessionRetry(async (scraps) => {
    const params = new URLSearchParams({ ...scraps.tokens, search_campus: campus, search_course: "" });
    if (faculty) params.set("search_faculty", faculty);
    const submitPath = scraps.indexResultLocation || "INDEX_RESULT_lII1II11I1lIIII11IIl1I111I.cfm";
    const { text } = await fetchIcress(submitPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: scraps.indexLocation,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: params.toString(),
    });
    return parseCourseRows(text);
  });

  if (courses.length) cacheSet(key, courses);
  return courses;
}

export interface GroupRow {
  day_time: string;
  group: string;
  mode: string;
  status: string;
  room: string;
  program: string;
  faculty: string;
}

type GroupField = keyof GroupRow;

/** Header labels iCress uses across campuses (both the 8- and 6-column layouts). */
const GROUP_HEADERS: Record<string, GroupField | "no"> = {
  NO: "no",
  "DAY TIME": "day_time",
  GROUP: "group",
  MODE: "mode",
  STATUS: "status",
  ROOM: "room",
  "ONLY FOR PROGRAM": "program",
  PROGRAM: "program",
  "ONLY FOR FACULTY": "faculty",
  FACULTY: "faculty",
};

const tdCells = (tr: string) =>
  [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => cellText(c[1]));
const anyCells = (tr: string) =>
  [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1]));

/**
 * Recognises a header `<tr>` (th or td cells): its texts are known column
 * names. Returns the column-name → cell-index map, or null for data rows.
 */
function groupHeaderMap(trHtml: string): Map<GroupField, number> | null {
  const cells = anyCells(trHtml);
  if (!cells.length) return null;
  const map = new Map<GroupField, number>();
  let known = 0;
  cells.forEach((text, i) => {
    const name = text.toUpperCase().replace(/\s+/g, " ").trim().replace(/\.+$/, "");
    const field = GROUP_HEADERS[name];
    if (field === undefined) return;
    known++;
    if (field !== "no" && !map.has(field)) map.set(field, i);
  });
  // A real header names at least the day and group columns.
  if (map.has("day_time") && map.has("group") && known >= 3) return map;
  return null;
}

/**
 * Parses an iCress course-groups page. Column positions are taken from the
 * table's header row (campuses differ: some have PROGRAM/FACULTY columns, some
 * don't, and the header may sit in `<thead>` or be a plain `<tr>` in `<tbody>`).
 * Falls back to the legacy 8-column positional mapping when no header is found.
 */
export function parseGroupRows(html: string): GroupRow[] {
  const rows: GroupRow[] = [];
  for (const tbody of html.matchAll(/<tbody[\s\S]*?<\/tbody>/gi)) {
    const trs = [...tbody[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)];

    let colMap: Map<GroupField, number> | null = null;
    for (const tr of trs) {
      colMap = groupHeaderMap(tr[0]);
      if (colMap) break;
    }
    if (!colMap) {
      const heads = [...html.slice(0, tbody.index).matchAll(/<thead[\s\S]*?<\/thead>/gi)];
      const head = heads.at(-1)?.[0];
      if (head) {
        for (const tr of head.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
          colMap = groupHeaderMap(tr[0]);
          if (colMap) break;
        }
      }
    }

    if (colMap) {
      const map = colMap;
      const need = Math.max(...map.values()) + 1;
      const pick = (cells: string[], field: GroupField) => cells[map.get(field) ?? -1] ?? "";
      for (const tr of trs) {
        if (groupHeaderMap(tr[0])) continue; // skip the header row itself
        const cells = tdCells(tr[0]);
        if (cells.length < need) continue;
        rows.push({
          day_time: pick(cells, "day_time"),
          group: pick(cells, "group"),
          mode: pick(cells, "mode"),
          status: pick(cells, "status"),
          room: pick(cells, "room"),
          program: pick(cells, "program"),
          faculty: pick(cells, "faculty"),
        });
      }
    } else {
      for (const tr of trs) {
        const cells = tdCells(tr[0]);
        if (cells.length >= 7) {
          rows.push({
            day_time: cells[1] ?? "",
            group: cells[2] ?? "",
            mode: cells[3] ?? "",
            status: cells[4] ?? "",
            room: cells[5] ?? "",
            program: cells[6] ?? "",
            faculty: cells[7] ?? "",
          });
        }
      }
    }
  }
  return rows;
}

export async function getGroups(path: string): Promise<GroupRow[]> {
  const key = `groups:${path}`;
  const hit = cacheGet<GroupRow[]>(key, GROUPS_TTL);
  if (hit) return hit;
  const rows = await withSessionRetry(async (scraps) => {
    const { text } = await fetchIcress(path, { headers: { Referer: scraps.indexLocation } });
    return parseGroupRows(text);
  });
  if (rows.length) cacheSet(key, rows);
  return rows;
}
