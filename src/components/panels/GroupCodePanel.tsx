import { useEffect, useRef, useState } from "react";
import { FolderSearch, Plus } from "lucide-react";
import { getCampuses, getFaculties, getGroupIndex, type GroupIndexReady, type IdText } from "../../lib/api.ts";
import { toSessions, type RawRow } from "../../lib/normalize.ts";
import { DAY_LABEL } from "../../lib/types.ts";
import { fmtRangeCompact } from "../../lib/time.ts";
import { activePlan, usePlanner } from "../../store/usePlanner.ts";
import { Empty, ErrorBox, Field, SearchableSelect, Spinner, btnPrimary, inputCls } from "../ui.tsx";

// Keeps finished indices for the session so re-looking-up is instant across actions & reloads.
const indexCache = new Map<string, GroupIndexReady>();

function getCachedCampusIndex(key: string): GroupIndexReady | null {
  const mem = indexCache.get(key);
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(`jadualku:campus-index:${key}`);
    if (raw) {
      const parsed = JSON.parse(raw) as GroupIndexReady;
      if (parsed?.groups) {
        indexCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {}
  return null;
}

function setCachedCampusIndex(key: string, data: GroupIndexReady) {
  indexCache.set(key, data);
  try {
    sessionStorage.setItem(`jadualku:campus-index:${key}`, JSON.stringify(data));
  } catch {}
}

interface MatchResult {
  matchedCode: string;
  items: { course: string; rows: RawRow[] }[];
}

function findGroupCourses(
  groups: Record<string, { course: string; rows: RawRow[] }[]> | undefined,
  rawCode: string,
  campus: string,
): MatchResult | null {
  if (!groups) return null;
  const q = rawCode.trim().toUpperCase();
  if (!q) return null;

  // 1. Direct exact match
  if (groups[q]) return { matchedCode: q, items: groups[q] };

  // 2. Try prefixing campus code (e.g. user typed CS2554B for campus M3 -> M3CS2554B)
  const c = campus.trim().toUpperCase();
  if (c) {
    const withCampus = `${c}${q}`;
    if (groups[withCampus]) return { matchedCode: withCampus, items: groups[withCampus] };

    // 3. User typed campus prefix but group index is unprefixed (e.g. M3CS2554B -> CS2554B)
    if (q.startsWith(c)) {
      const stripped = q.slice(c.length);
      if (groups[stripped]) return { matchedCode: stripped, items: groups[stripped] };
    }
  }

  // 4. Case-insensitive lookup or partial suffix match
  const lowerQ = q.toLowerCase();
  for (const [k, v] of Object.entries(groups)) {
    const lowerK = k.toLowerCase();
    if (lowerK === lowerQ) return { matchedCode: k, items: v };
    if (c && lowerK === `${c.toLowerCase()}${lowerQ}`) return { matchedCode: k, items: v };
  }

  return null;
}

export default function GroupCodePanel() {
  const plan = usePlanner(activePlan);
  const { addEntry, setGhost } = usePlanner();
  const lastCampus = usePlanner((s) => s.lastCampus);

  const [campuses, setCampuses] = useState<IdText[]>([]);
  const [faculties, setFaculties] = useState<IdText[]>([]);
  const [campus, setCampus] = useState(lastCampus);
  const [faculty, setFaculty] = useState("");
  const [code, setCode] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [index, setIndex] = useState<GroupIndexReady | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const needsFaculty = campus === "B";

  useEffect(() => {
    getCampuses()
      .then(setCampuses)
      .catch(() => {});
    getFaculties()
      .then(setFaculties)
      .catch(() => {});
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, []);

  // Pre-load cached index if available when campus changes
  useEffect(() => {
    const key = needsFaculty ? `${campus}-${faculty}` : campus;
    if (campus && (!needsFaculty || faculty)) {
      const cached = getCachedCampusIndex(key);
      if (cached) setIndex(cached);
    }
  }, [campus, faculty, needsFaculty]);

  const startLookup = () => {
    const key = needsFaculty ? `${campus}-${faculty}` : campus;
    const groupCode = code.trim().toUpperCase();
    if (!campus || !groupCode || (needsFaculty && !faculty)) return;
    setError("");
    setAdded(new Set());

    const cached = getCachedCampusIndex(key);
    if (cached) {
      setIndex(cached);
      setProgress(null);
      return;
    }
    setIndex(null);
    setProgress({ done: 0, total: 0 });

    const tick = async () => {
      try {
        const res = await getGroupIndex(campus, needsFaculty ? faculty : undefined);
        if (res.status === "ready") {
          setCachedCampusIndex(key, res);
          setIndex(res);
          setProgress(null);
          if (poll.current) clearInterval(poll.current);
          poll.current = null;
        } else {
          setProgress({ done: res.done, total: res.total });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Index build failed");
        setProgress(null);
        if (poll.current) clearInterval(poll.current);
        poll.current = null;
      }
    };
    void tick();
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(tick, 1000);
  };

  const match = findGroupCourses(index?.groups, code, campus);
  const results = match?.items ?? null;
  const matchedCode = match?.matchedCode ?? code.trim().toUpperCase();

  const addSubject = (course: string, rows: RawRow[]) => {
    const blocks = toSessions(rows);
    // Merge all group rows for this course (one group code, multiple sessions).
    const sessions = blocks.flatMap((b) => b.sessions);
    addEntry({
      subjectCode: course,
      subjectName: "",
      group: matchedCode,
      campus,
      sessions,
      source: "icress",
    });
    setAdded((s) => new Set(s).add(course));
    setGhost(null);
  };

  const addAll = () => {
    results?.forEach((r) => {
      if (!plan.entries.some((e) => e.subjectCode === r.course)) addSubject(r.course, r.rows);
    });
  };

  const pct = progress ? (progress.total ? Math.round((progress.done / progress.total) * 100) : 0) : 0;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <p className="text-xs text-soft">
        Find every subject running under one group code (e.g. <span className="font-mono">CS2403A</span>). Campus
        indices are cached for rapid lookup.
      </p>
      <div className="grid grid-cols-1 gap-2">
        <Field label="Campus">
          <SearchableSelect
            value={campus}
            options={campuses}
            placeholder="Select campus…"
            onChange={(id) => {
              setCampus(id);
              setIndex(null);
              if (id !== "B") setFaculty("");
            }}
          />
        </Field>
        {needsFaculty && (
          <Field label="Faculty">
            <SearchableSelect value={faculty} options={faculties} placeholder="Select faculty…" onChange={setFaculty} />
          </Field>
        )}
        <Field label="Group code">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && startLookup()}
              placeholder="e.g. CS2403A"
              className={`${inputCls} font-mono uppercase`}
            />
            <button
              type="button"
              onClick={startLookup}
              disabled={!campus || !code.trim() || (needsFaculty && !faculty) || !!progress}
              className={btnPrimary}
            >
              <FolderSearch className="size-4" /> Find
            </button>
          </div>
        </Field>
      </div>

      {progress && (
        <div className="rounded-lg border border-line bg-raised/50 p-3">
          <div className="flex items-center gap-2 text-sm text-soft">
            <Spinner /> Building index for campus {campus}…
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-faint">
            {progress.done}/{progress.total || "?"} courses · {pct}%
          </div>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {index && (
        <div className="text-xs text-faint">
          Index for {campus}: {Object.keys(index.groups).length} group codes · built{" "}
          {new Date(index.builtAt).toLocaleTimeString()}
        </div>
      )}

      {index && results && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {results.length} {results.length === 1 ? "subject" : "subjects"} under {matchedCode}
            </span>
            <button type="button" onClick={addAll} className={`${btnPrimary} !px-2.5 !py-1 text-xs`}>
              <Plus className="size-3.5" /> Add all
            </button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto pb-2">
            {results.map((r) => {
              const sessions = toSessions(r.rows).flatMap((b) => b.sessions);
              const inPlan = plan.entries.some((e) => e.subjectCode === r.course) || added.has(r.course);
              return (
                <div
                  key={r.course}
                  onMouseEnter={() => setGhost(sessions)}
                  onMouseLeave={() => setGhost(null)}
                  className="rounded-xl border border-line bg-panel p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold">{r.course}</span>
                    {inPlan ? (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">Added</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addSubject(r.course, r.rows)}
                        className={`${btnPrimary} !px-2.5 !py-1 text-xs`}
                      >
                        <Plus className="size-3.5" /> Add
                      </button>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {sessions.map((s, i) => (
                      <div key={i} className="text-xs text-soft">
                        {DAY_LABEL[s.day]} {fmtRangeCompact(s.start, s.end)}
                        {s.room ? ` · ${s.room}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {index && !results && code.trim() && (
        <Empty>No subjects found under “{code.trim().toUpperCase()}” on campus {campus}.</Empty>
      )}
      {index && !code.trim() && <Empty>Enter a group code above and press Find.</Empty>}
    </div>
  );
}
