# JadualKu

**Live App:** [https://jadualku-six.vercel.app](https://jadualku-six.vercel.app)

A standalone UiTM timetable generator — browse live iCress/SIMSweb course data, build and compare multiple timetable plans, attach Schemes of Work, and export device-perfect wallpapers, print A4, or a `.ics` calendar.

## Features

- **Live course discovery** — campus → (faculty for Selangor `B`) → subject → group cards with merged sessions, Fits/Clash badges, ghost previews, swap-group, filters (programme, time bounds, free day).
- **Import paths** — browse, group-code index (server-crawled, disk-cached), matric number, manual blocks, and an auto-planner (backtracking generator with ranking presets).
- **Timetable** — clash detection with a sticky banner + striped blocks, grid/rotated/agenda layouts, per-day agenda on phones.
- **Design studio** — 11 presets, custom colours/palette/block styles/radius/fonts (9 self-hosted variable fonts, lazy-loaded), title/subtitle, background image, saved themes, undoable preset recolour.
- **Export** — exact-pixel device templates (iPhone/iPad/PC/Mac/A4/custom), lock/home-screen safe zones, PNG/JPEG, `navigator.share`, print stylesheet, and `.ics` calendar export (classes / SOW assessments / academic periods).
- **Compare** — 2–4 plans side-by-side, stats table, two-plan overlay diff, common free-time finder. Share links (`#share=`, deflate+base64url) import as "Friend" plans.
- **Academic calendar** — official HEA semester data (Group A/B, KKT variants), week counter, period timeline, month view with holidays, upcoming list, classes-affected-by-holidays, `Today` view (default on mobile).
- **SOW reader** — drag a Scheme-of-Work PDF in; text is extracted locally (pdf.js, bundled worker — no OCR, no upload) into weeks/topics/assessments with an editable review form.

## Data sources

| Data | Source |
| --- | --- |
| Courses, groups, sessions | SIMSweb iCress (`simsweb4.uitm.edu.my`) via the `/api` proxy scraper |
| Academic calendar | Transcribed from the UiTM HEA page into `src/data/academicCalendar.ts` on 2026-10-01 — **update by hand each semester** |
| Public holidays | Google public ICS feed (`en.malaysia#holiday`), 12 h cache, falls back to `server/fixtures/malaysia-holidays.ics` |
| Registered timetable by matric | `cdn.uitm.link/jadual/baru/<matric>.json` proxied with a mystudent referer |

## Scripts

```sh
npm.cmd run dev        # Vite dev server on :5181 (strict port)
npm.cmd run typecheck  # tsc --noEmit
npm.cmd test           # vitest (src/ + server/)
npm.cmd run build      # typecheck + vite build → dist/
npm.cmd run preview    # vite preview (same /api plugin)
npm.cmd run start      # node server/serve.ts — production static+API on $PORT (default 5181)
```

## Notes

- State persists in `localStorage` key `jadualku:v1` (persist version 3, with migrations).
- All fonts and the pdf.js worker are bundled — the app makes no remote requests except our own `/api`.
- The group-index builder writes `.cache/index-<campus>[-<fac>].json` (6 h TTL).

## Disclaimer and credits

JadualUiTMKu is an independent student project created by **hyp4rr**. It is not an official UiTM service and is not affiliated with or endorsed by Universiti Teknologi MARA. Class data comes from public iCress pages and can be wrong or out of date, so always confirm on official UiTM channels. The wording lives in `src/data/links.ts`, which also holds the Support and GitHub URLs.
