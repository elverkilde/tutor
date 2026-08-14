# Byg & Tæl

An adaptive math game for one particular 10-year-old: touch-first, zero reading required,
all instruction via Danish speech + demonstration, Minecraft-flavored block rewards.

## Run it

```bash
npm install
npm run dev        # starts vite on all interfaces (--host)
```

Open the printed `http://<laptop-ip>:5173` URL on the tablet (same wifi).
Tap the big green button — that tap also unlocks audio on iOS.

```bash
npm test           # engine + template generation tests (vitest)
npm run build      # typecheck + production build to dist/
```

## First-time iPad checklist

1. **Danish voice**: Settings → Accessibility → Spoken Content → Voices → Danish —
   make sure a voice is downloaded. The app picks any `da-*` voice, preferring on-device ones.
   If no voice exists the game still runs, just silently (an adult should then read the prompts).
2. Silent-switch off / volume up.
3. During drag games, nothing should scroll or bounce. If it does, file a bug.

## How it works

- `src/data/skills.json` — **the curriculum.** A DAG of micro-skills with prerequisites and
  per-skill template parameters. Edit this to add/tune skills; the engine validates it at
  startup and in tests. Never needs engine changes.
- `src/data/phrases.ts` — every Danish phrase the app can speak. Doubles as the recording
  script if TTS quality disappoints and we switch to pre-recorded clips.
- `src/engine/` — pure, unit-tested: DAG validation & frontier (`graph.ts`), moving-window
  mastery (`mastery.ts`, mastered = ≥85% clean correct over last 8), item selection
  (`selector.ts`, ~80% frontier / ~20% review).
- `src/templates/` — plug-in mini-games. Each has a pure `generateTrial(params, seed)`
  (same seed ⇒ same quantities on scaffolded retries), a pure `applyScaffold`, and a Preact
  `View`. New game = new folder + one line in `registry.ts`.
- **Errorless ladder** (in `PlayScreen`): miss → same trial re-presented easier (fewer
  choices / counting slots / digit hints); second miss → the app demonstrates the answer
  while counting aloud, then moves on. No harsh feedback anywhere.
- Every attempt is logged to IndexedDB (`tutor:trials:v1`) with skill, params, scaffold
  level, outcome, and response time — this is the assessment data.
- Correct answers earn blocks (every 4th is rare); after 10 rounds comes **build time**:
  blocks get placed in a persistent world grid.

## Profiles (testing without touching his progress)

The active profile's name sits bottom-left on the start screen — glance at it before handing
over the tablet. In the adult area → Settings → Profiles you can add a test profile, switch,
rename, and delete. Each profile has its own mastery, placement, trial log, blocks, and world.
Browser storage is per-device anyway (laptop testing never touches the iPad), but profiles make
the iPad itself safe to test on.

**Preview his exact next session on the laptop**: adult area → Data export → Send to computer
(on the iPad), then on the laptop: adult area → Profiles → Import file… and pick the file from
`exports/`. You'll be playing a copy of his real state; his data stays untouched on the iPad.
Import also works as *restore* — importing a bundle whose profile already exists overwrites it.

## Adult area

Hold the faint gear (bottom-right of the start screen) for 2 seconds.

- **Overview**: suggested focus (placement status, close-to-mastery, needs-support, due-for-
  review), every skill's mastery state with its recent-attempt dots, and per-session history.
- **Skill map**: the whole curriculum as a graph — domain tracks left-to-right by difficulty,
  colored by mastery. The green/blue boundary is his frontier.
- **Trends**: first-try success per session (per domain + overall, 80% target line) and median
  thinking time of correct answers.
- **Settings**: rounds per session (5/10/15), which skill areas are active, calm mode
  (dampens all animation), and **Reset profile** — use this before the child's first real
  session if you've been testing on the same device, so he gets a fresh placement.

## Placement (how the first sessions work)

A fresh profile starts in placement mode: per domain, an adaptive staircase probes skills
(two clean passes → rung mastered, jump up; fail-after-pass → that's the frontier, next
domain). Max 18 probes, then normal practice mode takes over. The child sees ordinary play
throughout — rewards flow regardless of correctness. The probe verdict is always the first,
unscaffolded attempt.

## The curriculum (M3)

30 skills across 7 domains, each taught concrete → representational → abstract:

- **Subitizing**: instant amounts 1-3, quick comparison 1-4
- **Counting**: fetch to the chest (1-5, 5-10, 10-15), build towers (3-6, 5-10)
- **Digits ↔ quantities**: match digit to pile (1-5, 1-10, 10-15), produce from the sign alone
- **More/fewer**: compare piles (1-5, 1-10), then bare digits (1-5, 1-10)
- **Ordering**: find numbers on the number line (1-5, 1-10), the number just after / just before
- **Addition & subtraction**: combine piles → total; blocks hop away → how many left;
  then bare equations (+ to 5, + to 10, − to 10)
- **Patterns**: AB, ABC, AABB, mixed — a root skill on purpose (often a relative
  strength, gives early wins)

Nine mini-game mechanics serve these skills; new block types (sand, leaves, brick, ice,
snow, emerald, obsidian, redstone) unlock as skills are mastered, so the reward world
itself tracks his learning.

## Deployment (PWA)

The app is an offline-capable PWA. Deploys to GitHub Pages via `.github/workflows/deploy.yml`
on every push to `main` (build is relative-base, so it works at any URL).

**Install on the iPad** (one-time, needs the Pages URL over HTTPS):
1. Open `https://elverkilde.github.io/tutor/` in Safari.
2. Share button → *Add to Home Screen* ("Føj til hjemmeskærm").
3. Launch from the icon: fullscreen, no browser chrome, works offline from then on.
   Updates arrive automatically next time it's opened with network.

Note: the home-screen install has its own storage — it starts fresh (new profile + placement),
separate from the Safari-tab/LAN data. Use adult-area export/import to carry a profile over.
TTS quality: download the *enhanced* Danish voice under Settings → Accessibility → Spoken
Content → Voices → Dansk.

## Roadmap

- ~~**M2**: placement mode, adult gate + settings, first dashboard.~~ Done.
- ~~**M3**: full 30-skill curriculum, 6 new mechanics, curriculum-linked block unlocks.~~ Done.
- ~~**M5**: profiles + export/import, offline PWA, GitHub Pages deploy.~~ Done (recorded Danish
  clips remain an option if enhanced TTS isn't good enough).
- ~~**M4**: adult dashboard — skill map, per-session trends, suggested focus.~~ Done.
- **M6** (from field observations): first-encounter ghost-hand demos, curriculum to 20 +
  missing-number equations + practical math (clock/money), reward world growth, shareable
  progress report for school meetings.
