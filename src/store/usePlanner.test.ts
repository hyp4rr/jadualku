import { beforeEach, describe, expect, it } from "vitest";

// Minimal localStorage stub so zustand/persist works under the node env
// (zustand v5 reaches it via window.localStorage).
const mem = new Map<string, string>();
const stubStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} satisfies Storage;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: stubStorage });
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: stubStorage } });

const { usePlanner, activePlan, migratePersisted } = await import("./usePlanner.ts");

const ses = (day: "MON" | "TUE", start: number, end: number) => ({ day, start, end, room: "" });

function reset() {
  usePlanner.setState({
    plans: [
      { id: "p1", name: "Main", entries: [], createdAt: 1, updatedAt: 1 },
      { id: "p2", name: "Alt", entries: [], createdAt: 1, updatedAt: 1 },
    ],
    activePlanId: "p1",
    basket: [],
    ghost: null,
    highlightIds: [],
  });
}

const addTestEntry = () =>
  usePlanner.getState().addEntry({
    subjectCode: "CSC404",
    subjectName: "",
    group: "CS2403A",
    sessions: [ses("MON", 480, 600)],
    source: "icress",
  });

describe("planner store", () => {
  beforeEach(reset);

  it("adds entries to the active plan with a deterministic distinct color", () => {
    const id = addTestEntry();
    const plan = activePlan(usePlanner.getState());
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].id).toBe(id);
    expect(plan.entries[0].color).toMatch(/^#/);
    expect(plan.updatedAt).toBeGreaterThan(1);
  });

  it("swapGroup replaces group and sessions", () => {
    const id = addTestEntry();
    usePlanner.getState().swapGroup(id, { group: "CS2403B", sessions: [ses("TUE", 600, 720)] });
    const e = activePlan(usePlanner.getState()).entries[0];
    expect(e.group).toBe("CS2403B");
    expect(e.sessions).toEqual([{ day: "TUE", start: 600, end: 720, room: "" }]);
  });

  it("duplicatePlan deep-copies entries with fresh ids and activates the copy", () => {
    const id = addTestEntry();
    const copyId = usePlanner.getState().duplicatePlan("p1")!;
    const state = usePlanner.getState();
    const copy = state.plans.find((p) => p.id === copyId)!;
    expect(state.activePlanId).toBe(copyId);
    expect(copy.name).toBe("Main copy");
    expect(copy.entries).toHaveLength(1);
    expect(copy.entries[0].id).not.toBe(id);
    expect(copy.entries[0].subjectCode).toBe("CSC404");
    // Mutating the copy leaves the original untouched.
    usePlanner.getState().removeEntry(copy.entries[0].id);
    expect(usePlanner.getState().plans.find((p) => p.id === "p1")!.entries).toHaveLength(1);
  });

  it("deleting the active plan activates another and always keeps one plan", () => {
    usePlanner.getState().deletePlan("p1");
    let state = usePlanner.getState();
    expect(state.plans).toHaveLength(1);
    expect(state.activePlanId).toBe("p2");
    usePlanner.getState().deletePlan("p2");
    state = usePlanner.getState();
    expect(state.plans).toHaveLength(1);
    expect(state.plans[0].entries).toHaveLength(0);
    expect(state.activePlanId).toBe(state.plans[0].id);
  });

  it("toggleHidden flips hidden; updateEntry patches fields", () => {
    const id = addTestEntry();
    usePlanner.getState().toggleHidden(id);
    expect(activePlan(usePlanner.getState()).entries[0].hidden).toBe(true);
    usePlanner.getState().updateEntry(id, { lecturer: "DR X", credits: 3 });
    const e = activePlan(usePlanner.getState()).entries[0];
    expect(e.lecturer).toBe("DR X");
    expect(e.credits).toBe(3);
  });

  it("theme actions: applyPreset, setTheme patch, save/load/delete theme, recolor", () => {
    const s = usePlanner.getState();
    s.applyPreset("ocean");
    expect(usePlanner.getState().theme.presetId).toBe("ocean");
    s.setTheme({ radius: 14, show: { lecturer: true } });
    let t = usePlanner.getState().theme;
    expect(t.radius).toBe(14);
    expect(t.show.lecturer).toBe(true);
    expect(t.show.code).toBe(true); // untouched toggles preserved

    usePlanner.getState().saveTheme("Mine");
    const saved = usePlanner.getState().savedThemes.at(-1)!;
    usePlanner.getState().applyPreset("classic-light");
    usePlanner.getState().loadSavedTheme(saved.id);
    expect(usePlanner.getState().theme.radius).toBe(14);
    usePlanner.getState().deleteTheme(saved.id);
    expect(usePlanner.getState().savedThemes.find((x) => x.id === saved.id)).toBeUndefined();

    addTestEntry();
    usePlanner.getState().recolorFromPalette();
    const e = activePlan(usePlanner.getState()).entries[0];
    expect(usePlanner.getState().theme.palette).toContain(e.color);
  });

  it("importPlan and shared plans are tracked separately", () => {
    const plan = { id: "ext1", name: "Shared", entries: [], createdAt: 1, updatedAt: 1 };
    usePlanner.getState().addSharedPlan(plan);
    expect(usePlanner.getState().sharedPlans).toHaveLength(1);
    usePlanner.getState().removeSharedPlan("ext1");
    expect(usePlanner.getState().sharedPlans).toHaveLength(0);

    const newId = usePlanner.getState().importPlan(plan);
    expect(usePlanner.getState().activePlanId).toBe(newId);
  });

  it("v1→v2 migration preserves plans and fills theme defaults", () => {
    const v1 = {
      plans: [{ id: "p1", name: "Main", entries: [{ id: "e", subjectCode: "AAA400" }], createdAt: 1, updatedAt: 1 }],
      activePlanId: "p1",
      lastCampus: "A",
      lastFaculty: "CS",
      recents: [{ campus: "A", course: "AAA400" }],
    };
    const out = migratePersisted(v1, 1);
    expect(out.plans[0].name).toBe("Main");
    expect(out.activePlanId).toBe("p1");
    expect(out.lastCampus).toBe("A");
    expect(out.theme.presetId).toBeTruthy();
    expect(out.theme.palette.length).toBeGreaterThan(0);
    expect(out.savedThemes).toEqual([]);
    expect(out.sharedPlans).toEqual([]);
  });
});
