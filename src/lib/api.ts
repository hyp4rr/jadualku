import type { RawRow } from "./normalize.ts";
import type { Holiday } from "./academic.ts";

export interface HolidaysResponse {
  source: "live" | "snapshot";
  fetchedAt: number;
  holidays: Holiday[];
}

export interface IdText {
  id: string;
  text: string;
}

export interface GroupIndexReady {
  status: "ready";
  builtAt: number;
  groups: Record<string, { course: string; rows: RawRow[] }[]>;
}

export interface GroupIndexBuilding {
  status: "building";
  done: number;
  total: number;
}

export type GroupIndexResponse = GroupIndexReady | GroupIndexBuilding;

export interface RegisteredRow {
  course: string;
  group: string;
  day_time: string;
  room: string;
  lecturer: string;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  return data as T;
}

export const getSession = () => apiGet<{ code: string }>("/session");
export const getCampuses = () => apiGet<IdText[]>("/campuses");
export const getFaculties = () => apiGet<IdText[]>("/faculties");
export const getCourses = (campus: string, faculty?: string) =>
  apiGet<{ code: string }[]>(`/courses?campus=${encodeURIComponent(campus)}${faculty ? `&faculty=${encodeURIComponent(faculty)}` : ""}`);
export const getGroups = (campus: string, course: string, faculty?: string) =>
  apiGet<RawRow[]>(`/groups?campus=${encodeURIComponent(campus)}&course=${encodeURIComponent(course)}${faculty ? `&faculty=${encodeURIComponent(faculty)}` : ""}`);
export const getGroupIndex = (campus: string, faculty?: string) =>
  apiGet<GroupIndexResponse>(`/group-index?campus=${encodeURIComponent(campus)}${faculty ? `&faculty=${encodeURIComponent(faculty)}` : ""}`);
export const getRegistered = (matric: string) => apiGet<RegisteredRow[]>(`/registered?matric=${encodeURIComponent(matric)}`);
export const getHolidays = () => apiGet<HolidaysResponse>("/holidays");

export interface ReportPayload {
  category: string;
  summary?: string;
  description: string;
  diagnostics?: Record<string, unknown>;
  honeypot?: string;
}

export async function submitReport(payload: ReportPayload): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Submission failed (${res.status})`);
  }

  return { ok: true, message: typeof data.message === "string" ? data.message : "Report sent successfully." };
}

export async function shortenUrl(longUrl: string): Promise<string> {
  // 1. Try backend endpoint /api/shorten
  try {
    const res = await fetch("/api/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: longUrl }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = (await res.json()) as { shortUrl?: string };
      if (typeof data.shortUrl === "string" && data.shortUrl) return data.shortUrl;
    }
  } catch {}

  // 2. Client-side fallback to CleanURI
  try {
    const res = await fetch("https://cleanuri.com/api/v1/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "url=" + encodeURIComponent(longUrl),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as { result_url?: string };
      if (data && typeof data.result_url === "string" && data.result_url) return data.result_url;
    }
  } catch {}

  // 3. Client-side fallback to TinyURL
  try {
    const res = await fetch("https://tinyurl.com/api-create.php?url=" + encodeURIComponent(longUrl), {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith("http")) return text.trim();
    }
  } catch {}

  return longUrl;
}

