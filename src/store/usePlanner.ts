import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Entry, Plan, Session } from "../lib/types.ts";
import { colorFor } from "../lib/colors.ts";
import type { GenGroup } from "../lib/generator.ts";
import { DEFAULT_THEME, getPreset, type ThemeSettings } from "../lib/theme.ts";
import type { MyState } from "../lib/academic.ts";
import type { SowDoc } from "../lib/sow.ts";

export interface CalendarPrefs {
  group: "A" | "B";
  state: MyState;
  /** `${group}-${code}` or "auto". */
  semesterKey: string;
}

export const DEFAULT_CALENDAR: CalendarPrefs = { group: "B", state: "Selangor", semesterKey: "auto" };

export interface BasketItem {
  code: string;
  name?: string;
  campus?: string;
  groups: GenGroup[];
  lockedGroup?: string;
}

export interface SavedTheme {
  id: string;
  name: string;
  settings: ThemeSettings;
}

interface PersistedSlice {
  plans: Plan[];
  activePlanId: string;
  lastCampus: string;
  lastFaculty: string;
  recents: { campus: string; course: string }[];
  theme: ThemeSettings;
  savedThemes: SavedTheme[];
  /** Plans imported via share links, kept separate for Compare. */
  sharedPlans: Plan[];
  calendar: CalendarPrefs;
  /** Parsed Scheme-of-Work docs keyed by course code (never the PDF itself). */
  sows: Record<string, SowDoc>;
}

interface PlannerState extends PersistedSlice {
  // Transient UI state (not persisted).
  basket: BasketItem[];
  ghost: Session[] | null;
  highlightIds: string[];
  /** Snapshot of entry colours before the last preset recolour, for Undo. */
  undoColors: { id: string; color: string }[] | null;

  // Plan actions.
  createPlan: (name?: string) => string;
  duplicatePlan: (id: string) => string | null;
  renamePlan: (id: string, name: string) => void;
  deletePlan: (id: string) => void;
  setActivePlan: (id: string) => void;
  /** Adds an already-built plan (share link "Save as my plan", backup import). */
  importPlan: (plan: Plan) => string;

  // Entry actions (always operate on the active plan).
  addEntry: (entry: Omit<Entry, "id" | "color"> & { color?: string }) => string;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => void;
  removeEntry: (id: string) => void;
  toggleHidden: (id: string) => void;
  swapGroup: (entryId: string, group: { group: string; sessions: Session[] }) => void;

  // Context.
  setLastCampus: (campus: string) => void;
  setLastFaculty: (faculty: string) => void;
  addRecent: (campus: string, course: string) => void;

  // Theme.
  setTheme: (patch: Partial<Omit<ThemeSettings, "show">> & { show?: Partial<ThemeSettings["show"]> }) => void;
  /** Applies a preset AND recolours every entry from its palette (undoable). */
  applyPreset: (presetId: string) => void;
  /** Re-assigns every entry's colour from the current palette, in entry order. */
  recolorFromPalette: () => void;
  /** Restores entry colours captured by the last recolour. */
  undoRecolor: () => void;
  saveTheme: (name: string) => void;
  deleteTheme: (id: string) => void;
  loadSavedTheme: (id: string) => void;

  // Shared plans (for Compare).
  addSharedPlan: (plan: Plan) => void;
  removeSharedPlan: (id: string) => void;

  // Academic calendar prefs + SOW docs.
  setCalendar: (patch: Partial<CalendarPrefs>) => void;
  setSow: (code: string, doc: SowDoc) => void;
  removeSow: (code: string) => void;

  // Backup.
  replaceAll: (backup: { plans: Plan[]; sharedPlans?: Plan[]; theme?: ThemeSettings; savedThemes?: SavedTheme[] }, merge: boolean) => void;

  // Planner basket + transient UI.
  addToBasket: (item: BasketItem) => void;
  removeFromBasket: (code: string) => void;
  setBasketLock: (code: string, group?: string) => void;
  clearBasket: () => void;
  setGhost: (sessions: Session[] | null) => void;
  setHighlight: (ids: string[]) => void;
}

const KEEP_ON_PRESET: (keyof ThemeSettings)[] = [
  "mode", "bgKind", "bgGradient", "bgFit", "bgX", "bgY", "bgZoom", "bgBlur", "bgTint", "bgPattern", "bgScope",
  "panelOpacity", "panelBlur", "bgLum", "autoText", "backgroundImage", "backgroundDim",
];

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyPlan(name = "My timetable"): Plan {
  const now = Date.now();
  return { id: uid(), name, entries: [], createdAt: now, updatedAt: now };
}

const initial = emptyPlan();

function mutateActive(state: PlannerState, fn: (plan: Plan) => Plan): Partial<PersistedSlice> {
  return {
    plans: state.plans.map((p) => (p.id === state.activePlanId ? { ...fn(p), updatedAt: Date.now() } : p)),
  };
}

/**
 * v1 → v3: keep plans/activePlanId/lastCampus/lastFaculty/recents; theme came
 * in at v2, calendar/sows at v3 — missing keys get defaults here.
 */
export function migratePersisted(persisted: unknown, _version: number): PersistedSlice {
  const old = (persisted ?? {}) as Partial<PersistedSlice>;
  const cal = (old.calendar ?? {}) as Partial<CalendarPrefs>;
  return {
    plans: Array.isArray(old.plans) && old.plans.length ? (old.plans as Plan[]) : [emptyPlan()],
    activePlanId: typeof old.activePlanId === "string" ? old.activePlanId : "",
    lastCampus: typeof old.lastCampus === "string" ? old.lastCampus : "",
    lastFaculty: typeof old.lastFaculty === "string" ? old.lastFaculty : "",
    recents: Array.isArray(old.recents) ? old.recents : [],
    theme: old.theme ?? { ...DEFAULT_THEME, palette: [...DEFAULT_THEME.palette], show: { ...DEFAULT_THEME.show } },
    savedThemes: Array.isArray(old.savedThemes) ? old.savedThemes : [],
    sharedPlans: Array.isArray(old.sharedPlans) ? old.sharedPlans : [],
    calendar: {
      group: cal.group === "A" || cal.group === "B" ? cal.group : DEFAULT_CALENDAR.group,
      state: typeof cal.state === "string" ? cal.state : DEFAULT_CALENDAR.state,
      semesterKey: typeof cal.semesterKey === "string" ? cal.semesterKey : DEFAULT_CALENDAR.semesterKey,
    },
    sows: old.sows && typeof old.sows === "object" ? old.sows : {},
  };
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set, get) => ({
      plans: [initial],
      activePlanId: initial.id,
      lastCampus: "",
      lastFaculty: "",
      recents: [],
      theme: { ...DEFAULT_THEME, mode: "app", palette: [...DEFAULT_THEME.palette], show: { ...DEFAULT_THEME.show } },
      savedThemes: [],
      sharedPlans: [],
      calendar: { ...DEFAULT_CALENDAR },
      sows: {},
      basket: [],
      ghost: null,
      highlightIds: [],
      undoColors: null,

      createPlan: (name) => {
        const plan = emptyPlan(name?.trim() || `Plan ${get().plans.length + 1}`);
        set((s) => ({ plans: [...s.plans, plan], activePlanId: plan.id }));
        return plan.id;
      },

      duplicatePlan: (id) => {
        const src = get().plans.find((p) => p.id === id);
        if (!src) return null;
        const now = Date.now();
        const copy: Plan = {
          ...src,
          id: uid(),
          name: `${src.name} copy`,
          entries: src.entries.map((e) => ({ ...e, id: uid(), sessions: e.sessions.map((s) => ({ ...s })) })),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ plans: [...s.plans, copy], activePlanId: copy.id }));
        return copy.id;
      },

      renamePlan: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, name: trimmed, updatedAt: Date.now() } : p)) }));
      },

      deletePlan: (id) => {
        set((s) => {
          let plans = s.plans.filter((p) => p.id !== id);
          if (!plans.length) plans = [emptyPlan()];
          const activePlanId = s.activePlanId === id ? plans[plans.length - 1].id : s.activePlanId;
          return { plans, activePlanId };
        });
      },

      setActivePlan: (id) => {
        if (get().plans.some((p) => p.id === id)) set({ activePlanId: id, ghost: null, highlightIds: [] });
      },

      importPlan: (plan) => {
        set((s) => ({ plans: [...s.plans, plan], activePlanId: plan.id }));
        return plan.id;
      },

      addEntry: (entry) => {
        const id = uid();
        set((s) =>
          mutateActive(s, (plan) => {
            const color = entry.color ?? colorFor(entry.subjectCode, plan.entries.map((e) => e.color));
            return { ...plan, entries: [...plan.entries, { ...entry, id, color }] };
          }),
        );
        return id;
      },

      updateEntry: (id, patch) =>
        set((s) =>
          mutateActive(s, (plan) => ({
            ...plan,
            entries: plan.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          })),
        ),

      removeEntry: (id) =>
        set((s) =>
          mutateActive(s, (plan) => ({ ...plan, entries: plan.entries.filter((e) => e.id !== id) })),
        ),

      toggleHidden: (id) =>
        set((s) =>
          mutateActive(s, (plan) => ({
            ...plan,
            entries: plan.entries.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)),
          })),
        ),

      swapGroup: (entryId, group) =>
        set((s) =>
          mutateActive(s, (plan) => ({
            ...plan,
            entries: plan.entries.map((e) =>
              e.id === entryId ? { ...e, group: group.group, sessions: group.sessions.map((x) => ({ ...x })) } : e,
            ),
          })),
        ),

      setLastCampus: (campus) => set({ lastCampus: campus }),
      setLastFaculty: (faculty) => set({ lastFaculty: faculty }),

      addRecent: (campus, course) =>
        set((s) => ({
          recents: [{ campus, course }, ...s.recents.filter((r) => !(r.campus === campus && r.course === course))].slice(0, 8),
        })),

      setTheme: (patch) => set((s) => ({ theme: { ...s.theme, ...patch, show: { ...s.theme.show, ...(patch.show ?? {}) } } })),

      applyPreset: (presetId) => {
        const p = getPreset(presetId);
        if (!p) return;
        // A preset swaps colours/fonts/blocks but keeps the user's dark/light mode and backdrop.
        const cur = get().theme;
        const keep: Partial<ThemeSettings> = {};
        for (const k of KEEP_ON_PRESET) if (cur[k] !== undefined) Object.assign(keep, { [k]: cur[k] });
        set({ theme: { ...p.settings, ...keep, palette: [...p.settings.palette], show: { ...p.settings.show } } });
        get().recolorFromPalette();
      },

      recolorFromPalette: () =>
        set((s) => {
          const undo = s.plans.find((p) => p.id === s.activePlanId)?.entries.map((e) => ({ id: e.id, color: e.color })) ?? null;
          return {
            ...mutateActive(s, (plan) => {
              const seen = new Map<string, string>();
              let i = 0;
              const colorOf = (code: string) => {
                if (!seen.has(code)) seen.set(code, s.theme.palette[i++ % s.theme.palette.length]);
                return seen.get(code)!;
              };
              return { ...plan, entries: plan.entries.map((e) => ({ ...e, color: colorOf(e.subjectCode) })) };
            }),
            undoColors: undo,
          };
        }),

      undoRecolor: () =>
        set((s) => {
          if (!s.undoColors) return {};
          const prev = new Map(s.undoColors.map((x) => [x.id, x.color]));
          return {
            ...mutateActive(s, (plan) => ({
              ...plan,
              entries: plan.entries.map((e) => (prev.has(e.id) ? { ...e, color: prev.get(e.id)! } : e)),
            })),
            undoColors: null,
          };
        }),

      saveTheme: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          savedThemes: [
            ...s.savedThemes,
            { id: uid(), name: trimmed, settings: { ...s.theme, palette: [...s.theme.palette], show: { ...s.theme.show } } },
          ],
        }));
      },

      deleteTheme: (id) => set((s) => ({ savedThemes: s.savedThemes.filter((t) => t.id !== id) })),

      loadSavedTheme: (id) => {
        const t = get().savedThemes.find((x) => x.id === id);
        if (t) set({ theme: { ...t.settings, palette: [...t.settings.palette], show: { ...t.settings.show } } });
      },

      addSharedPlan: (plan) => set((s) => ({ sharedPlans: [...s.sharedPlans, plan] })),
      removeSharedPlan: (id) => set((s) => ({ sharedPlans: s.sharedPlans.filter((p) => p.id !== id) })),

      setCalendar: (patch) => set((s) => ({ calendar: { ...s.calendar, ...patch } })),
      setSow: (code, doc) => set((s) => ({ sows: { ...s.sows, [code.toUpperCase()]: doc } })),
      removeSow: (code) =>
        set((s) => {
          const sows = { ...s.sows };
          delete sows[code.toUpperCase()];
          return { sows };
        }),

      replaceAll: (backup, merge) =>
        set((s) => {
          if (merge) {
            const existing = new Set(s.plans.map((p) => p.id));
            const shared = new Set(s.sharedPlans.map((p) => p.id));
            return {
              plans: [...s.plans, ...backup.plans.filter((p) => !existing.has(p.id))],
              sharedPlans: [...s.sharedPlans, ...(backup.sharedPlans ?? []).filter((p) => !shared.has(p.id))],
              savedThemes: [...s.savedThemes, ...(backup.savedThemes ?? [])],
              theme: backup.theme ?? s.theme,
            };
          }
          const plans = backup.plans.length ? backup.plans : [emptyPlan()];
          return {
            plans,
            activePlanId: plans[0].id,
            sharedPlans: backup.sharedPlans ?? [],
            savedThemes: backup.savedThemes ?? [],
            theme: backup.theme ?? s.theme,
          };
        }),

      addToBasket: (item) =>
        set((s) => ({
          basket: [...s.basket.filter((b) => b.code !== item.code), item],
        })),
      removeFromBasket: (code) => set((s) => ({ basket: s.basket.filter((b) => b.code !== code) })),
      setBasketLock: (code, group) =>
        set((s) => ({ basket: s.basket.map((b) => (b.code === code ? { ...b, lockedGroup: group } : b)) })),
      clearBasket: () => set({ basket: [] }),

      setGhost: (sessions) => set({ ghost: sessions }),
      setHighlight: (ids) => set({ highlightIds: ids }),
    }),
    {
      name: "jadualku:v1",
      version: 3,
      migrate: migratePersisted,
      partialize: (s): PersistedSlice => ({
        plans: s.plans,
        activePlanId: s.activePlanId,
        lastCampus: s.lastCampus,
        lastFaculty: s.lastFaculty,
        recents: s.recents,
        theme: s.theme,
        savedThemes: s.savedThemes,
        sharedPlans: s.sharedPlans,
        calendar: s.calendar,
        sows: s.sows,
      }),
    },
  ),
);

export function activePlan(state: PlannerState): Plan {
  return state.plans.find((p) => p.id === state.activePlanId) ?? state.plans[0];
}

export type { Entry, Plan, Session };
export type { Day } from "../lib/types.ts";
