import { useEffect, useMemo, useState } from "react";
import { CalendarX2, Clock3, ListPlus, Plus, RefreshCw, Search, Users } from "lucide-react";
import type { Day, Entry, Session } from "../../lib/types.ts";
import { DAYS, DAY_LABEL } from "../../lib/types.ts";
import { getCampuses, getCourses, getFaculties, getGroups, type IdText } from "../../lib/api.ts";
import { toSessions, type GroupBlock } from "../../lib/normalize.ts";
import { clashesFor } from "../../lib/clash.ts";
import { fmtRangeCompact } from "../../lib/time.ts";
import { activePlan, usePlanner } from "../../store/usePlanner.ts";
import { Empty, ErrorBox, Field, Modal, SearchableSelect, Spinner, btnGhost, btnPrimary, inputCls } from "../ui.tsx";

function useDebounced<T>(value: T, ms = 150): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [ms, value]);
  return v;
}

interface Filters {
  programme: string;
  hideClashing: boolean;
  noBefore: string; // "08:00"
  noAfter: string;
  freeDay: "" | Day;
}

const EMPTY_FILTERS: Filters = { programme: "", hideClashing: false, noBefore: "", noAfter: "", freeDay: "" };

function hm(v: string): number | undefined {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

export default function BrowsePanel() {
  const plan = usePlanner(activePlan);
  const { addEntry, swapGroup, setGhost, addRecent, addToBasket } = usePlanner();
  const lastCampus = usePlanner((s) => s.lastCampus);
  const lastFaculty = usePlanner((s) => s.lastFaculty);
  const setLastCampus = usePlanner((s) => s.setLastCampus);
  const setLastFaculty = usePlanner((s) => s.setLastFaculty);
  const recents = usePlanner((s) => s.recents);

  const [campuses, setCampuses] = useState<IdText[]>([]);
  const [campusesErr, setCampusesErr] = useState("");
  const [faculties, setFaculties] = useState<IdText[]>([]);
  const [campus, setCampus] = useState(lastCampus);
  const [faculty, setFaculty] = useState(lastFaculty);
  const [courses, setCourses] = useState<{ code: string }[] | null>(null);
  const [coursesErr, setCoursesErr] = useState("");
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);

  const [selected, setSelected] = useState("");
  const [blocks, setBlocks] = useState<GroupBlock[] | null>(null);
  const [groupsErr, setGroupsErr] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [confirm, setConfirm] = useState<{ block: GroupBlock; clashes: string } | null>(null);

  const needsFaculty = campus === "B";

  useEffect(() => {
    getCampuses()
      .then(setCampuses)
      .catch((e) => setCampusesErr(e instanceof Error ? e.message : "Failed to load campuses"));
  }, []);

  useEffect(() => {
    if (needsFaculty && !faculties.length) {
      getFaculties()
        .then(setFaculties)
        .catch(() => setFaculties([]));
    }
  }, [needsFaculty, faculties.length]);

  const loadCourses = (c: string, f: string) => {
    setCoursesLoading(true);
    setCoursesErr("");
    setCourses(null);
    setSelected("");
    setBlocks(null);
    getCourses(c, f || undefined)
      .then(setCourses)
      .catch((e) => setCoursesErr(e instanceof Error ? e.message : "Failed to load courses"))
      .finally(() => setCoursesLoading(false));
  };

  useEffect(() => {
    if (!campus) return;
    if (needsFaculty && !faculty) {
      setCourses(null);
      return;
    }
    setLastCampus(campus);
    if (faculty) setLastFaculty(faculty);
    loadCourses(campus, faculty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus, faculty]);

  const openCourse = (code: string) => {
    setSelected(code);
    setBlocks(null);
    setGroupsErr("");
    setGroupsLoading(true);
    addRecent(campus, code);
    getGroups(campus, code, faculty || undefined)
      .then((rows) => setBlocks(toSessions(rows)))
      .catch((e) => setGroupsErr(e instanceof Error ? e.message : "Failed to load groups"))
      .finally(() => setGroupsLoading(false));
  };

  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    const q = debouncedQuery.trim().toUpperCase();
    const list = q ? courses.filter((c) => c.code.includes(q)) : courses;
    return list.slice(0, 200);
  }, [courses, debouncedQuery]);

  const entryFor = (code: string): Entry | undefined =>
    plan.entries.find((e) => e.subjectCode === code && e.source === "icress");

  const clashesOf = (sessions: Session[], ignoreId?: string) =>
    clashesFor(plan.entries, sessions, ignoreId);

  const visibleBlocks = useMemo(() => {
    if (!blocks) return [];
    const before = hm(filters.noBefore);
    const after = hm(filters.noAfter);
    return blocks.filter((b) => {
      if (filters.programme && !b.programs.join(",").toUpperCase().includes(filters.programme.toUpperCase())) return false;
      for (const s of b.sessions) {
        if (filters.freeDay && s.day === filters.freeDay) return false;
        if (before !== undefined && s.start < before) return false;
        if (after !== undefined && s.end > after) return false;
      }
      if (filters.hideClashing && clashesOf(b.sessions, entryFor(selected)?.id).length) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, filters, plan.entries, selected]);

  const doAdd = (block: GroupBlock) => {
    const existing = entryFor(selected);
    if (existing) {
      swapGroup(existing.id, { group: block.group, sessions: block.sessions });
    } else {
      addEntry({
        subjectCode: selected,
        subjectName: "",
        group: block.group,
        campus,
        sessions: block.sessions.map((s) => ({ ...s })),
        source: "icress",
      });
    }
    setGhost(null);
  };

  const tryAdd = (block: GroupBlock) => {
    const existing = entryFor(selected);
    const found = clashesOf(block.sessions, existing?.id);
    if (found.length) {
      const c = found[0];
      setConfirm({
        block,
        clashes: `Clashes with ${c.entry.subjectCode} ${c.entry.group} on ${DAY_LABEL[c.day]} ${fmtRangeCompact(c.start, c.end)}`,
      });
    } else {
      doAdd(block);
    }
  };

  const addToPlanner = () => {
    if (!blocks) return;
    addToBasket({
      code: selected,
      campus,
      groups: blocks.map((b) => ({ group: b.group, sessions: b.sessions, program: b.programs.join(",") })),
    });
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="grid grid-cols-1 gap-2">
        <Field label="Campus">
          {campusesErr ? (
            <ErrorBox message={`SIMSweb is unreachable: ${campusesErr}`} />
          ) : (
            <SearchableSelect
              value={campus}
              options={campuses}
              placeholder={campuses.length ? "Select campus…" : "Loading campuses…"}
              onChange={(id) => {
                setCampus(id);
                if (id !== "B") setFaculty("");
              }}
            />
          )}
        </Field>
        {needsFaculty && (
          <Field label="Faculty">
            <SearchableSelect
              value={faculty}
              options={faculties}
              placeholder={faculties.length ? "Select faculty…" : "Loading faculties…"}
              onChange={setFaculty}
            />
          </Field>
        )}
      </div>

      {coursesLoading && (
        <div className="flex items-center gap-2 text-sm text-soft">
          <Spinner /> Loading courses…
        </div>
      )}
      {coursesErr && <ErrorBox message={`SIMSweb failed: ${coursesErr}`} onRetry={() => loadCourses(campus, faculty)} />}

      {courses && !selected && (
        <>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${courses.length} courses by code…`}
              className={`${inputCls} pl-9 font-mono uppercase`}
            />
          </div>
          {recents.filter((r) => r.campus === campus).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-faint">Recent:</span>
              {recents
                .filter((r) => r.campus === campus)
                .map((r) => (
                  <button
                    key={r.course}
                    type="button"
                    onClick={() => openCourse(r.course)}
                    className="rounded-full border border-line bg-raised px-2.5 py-1 font-mono text-xs hover:border-accent"
                  >
                    {r.course}
                  </button>
                ))}
            </div>
          )}
          <div className="-mx-1 grid flex-1 grid-cols-2 content-start gap-1.5 overflow-y-auto px-1 pb-2 sm:grid-cols-3">
            {filteredCourses.map((c) => {
              const inPlan = !!entryFor(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => openCourse(c.code)}
                  className={`rounded-lg border px-2 py-2 text-left font-mono text-sm font-semibold transition-colors ${
                    inPlan ? "border-accent/50 bg-accent/10 text-accent" : "border-line bg-panel hover:border-accent"
                  }`}
                >
                  {c.code}
                </button>
              );
            })}
            {!filteredCourses.length && (
              <div className="col-span-full">
                <Empty>No course codes match “{debouncedQuery}”.</Empty>
              </div>
            )}
          </div>
        </>
      )}

      {selected && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setSelected("")} className="text-sm font-semibold text-accent hover:underline">
              ← All courses
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{selected}</span>
              <button
                type="button"
                onClick={addToPlanner}
                disabled={!blocks?.length}
                className={`${btnGhost} !px-2 !py-1 text-xs disabled:opacity-40`}
                title="Add subject to the auto-planner basket"
              >
                <ListPlus className="size-4" /> Planner
              </button>
            </div>
          </div>

          <details className="rounded-lg border border-line bg-raised/50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-soft">Filters</summary>
            <div className="mt-2 grid grid-cols-2 gap-2 pb-1">
              <input
                value={filters.programme}
                onChange={(e) => setFilters((f) => ({ ...f, programme: e.target.value }))}
                placeholder="Programme code e.g. CS240"
                className={`${inputCls} !py-1.5 text-xs`}
              />
              <select
                value={filters.freeDay}
                onChange={(e) => setFilters((f) => ({ ...f, freeDay: e.target.value as "" | Day }))}
                className={`${inputCls} !py-1.5 text-xs`}
              >
                <option value="">Keep a day free…</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    Free {DAY_LABEL[d]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-soft">
                <Clock3 className="size-3.5" /> Not before
                <input
                  type="time"
                  value={filters.noBefore}
                  onChange={(e) => setFilters((f) => ({ ...f, noBefore: e.target.value }))}
                  className="w-full rounded-md border border-line bg-panel px-1.5 py-1 text-xs"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-soft">
                <Clock3 className="size-3.5" /> Not after
                <input
                  type="time"
                  value={filters.noAfter}
                  onChange={(e) => setFilters((f) => ({ ...f, noAfter: e.target.value }))}
                  className="w-full rounded-md border border-line bg-panel px-1.5 py-1 text-xs"
                />
              </label>
              <label className="col-span-2 flex items-center gap-2 text-xs text-soft">
                <input
                  type="checkbox"
                  checked={filters.hideClashing}
                  onChange={(e) => setFilters((f) => ({ ...f, hideClashing: e.target.checked }))}
                  className="accent-accent"
                />
                <CalendarX2 className="size-3.5" /> Hide groups that clash with my plan
              </label>
            </div>
          </details>

          {groupsLoading && (
            <div className="flex items-center gap-2 text-sm text-soft">
              <Spinner /> Loading groups…
            </div>
          )}
          {groupsErr && <ErrorBox message={groupsErr} onRetry={() => openCourse(selected)} />}
          {blocks && !blocks.length && <Empty>No groups found for {selected} this session.</Empty>}

          <div className="flex flex-col gap-2 overflow-y-auto pb-2">
            {visibleBlocks.map((b) => {
              const existing = entryFor(selected);
              const added = existing?.group === b.group;
              const found = added ? [] : clashesOf(b.sessions, existing?.id);
              const first = found[0];
              return (
                <div
                  key={b.group}
                  tabIndex={0}
                  onMouseEnter={() => setGhost(b.sessions)}
                  onMouseLeave={() => setGhost(null)}
                  onFocus={() => setGhost(b.sessions)}
                  onBlur={() => setGhost(null)}
                  className={`rounded-xl border p-3 transition-colors outline-none ${
                    added ? "border-accent/60 bg-accent/5" : first ? "border-bad/50" : "border-line bg-panel"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold">{b.group}</span>
                    {added ? (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">Added</span>
                    ) : first ? (
                      <span className="rounded-full bg-bad/15 px-2 py-0.5 text-xs font-semibold text-bad">
                        Clashes with {first.entry.subjectCode} {DAY_LABEL[first.day]} {fmtRangeCompact(first.start, first.end)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-good/15 px-2 py-0.5 text-xs font-semibold text-good">Fits</span>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {b.sessions.map((s, i) => (
                      <div key={i} className="text-xs text-soft">
                        {DAY_LABEL[s.day]} {fmtRangeCompact(s.start, s.end)}
                        {s.room ? ` · ${s.room}` : ""}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-faint">
                    {b.programs.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" /> {b.programs.join(", ")}
                      </span>
                    )}
                    {b.mode && <span>{b.mode}</span>}
                    {b.status && <span>{b.status}</span>}
                  </div>
                  <div className="mt-2">
                    {added ? (
                      <span className="text-xs text-faint">In your plan</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => tryAdd(b)}
                        className={`${existing ? btnGhost : btnPrimary} !px-2.5 !py-1 text-xs`}
                      >
                        <Plus className="size-3.5" />
                        {existing ? `Swap to ${b.group}` : first ? "Add anyway…" : "Add"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {blocks && !visibleBlocks.length && <Empty>No groups match the current filters.</Empty>}
          </div>
        </>
      )}

      {!campus && !courses && (
        <Empty>
          Pick a campus to browse this session's courses. When SIMSweb is down, the Matric and Manual tabs still work.
        </Empty>
      )}

      {confirm && (
        <Modal title="Add anyway?" onClose={() => setConfirm(null)}>
          <p className="text-sm text-soft">
            {confirm.clashes}. Adding <span className="font-mono font-semibold text-ink">{confirm.block.group}</span> will
            overlap a class already in your plan.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className={btnGhost}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                doAdd(confirm.block);
                setConfirm(null);
              }}
              className={btnPrimary}
            >
              <RefreshCw className="size-4" /> Add anyway
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
