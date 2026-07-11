# Pick a Time UI — Core Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Review cadence (overrides this plan's default per-task reviewer):** Tasks are grouped into
> Sections (table below). After the last task in a Section, dispatch one devil's-advocate review
> subagent — persona: a UX genius AND a principal engineer, reviewing for design quality,
> simplicity, good patterns, and security — covering that Section's full diff. This review runs
> **once, not looped** — record its findings, fix anything Critical/Important inline, and move on;
> do not re-dispatch it to confirm the fix. After ALL sections are complete, dispatch the same
> devil's-advocate persona once more over the **whole branch diff**. This final one MAY be repeated
> once if it finds concerns (fix, then re-run) — **maximum 2 total runs** of the final review, or
> stop at 1 if it finds nothing. Do not stop implementation to check in between tasks/sections;
> only stop for a BLOCKED status or a Critical finding you can't resolve.

**Goal:** Transform this repo from Choosee UI (restaurant-bracket-voting) into the Pick a Time UI:
create a recurring plan, join it under an adjective-noun identity (or Google sign-in), paint a
template+override availability grid with a live drag gesture, and view the computed overlap.

**Architecture:** Next.js Pages Router (unchanged), TanStack Query for data fetching/polling
(unchanged pattern), Amplify + Cognito for Google sign-in (unchanged), cookie-based anonymous
identity (unchanged shape, renamed key), a phase-driven page component (same shape as today's
`src/components/session/index.tsx`, new phases). Talks to the API built in
`pick-a-time-api`'s `docs/superpowers/plans/2026-07-10-pick-a-time-core-domain.md` — this plan
assumes that API's contract (see Global Constraints) and does not re-derive it.

**Tech Stack:** Next.js 15, React 19, TypeScript, TanStack Query v5, AWS Amplify (Auth + REST API),
HeroUI (`@heroui/react`) for form controls/buttons/alerts, Tailwind CSS, `js-cookie`,
`qrcode.react`, Jest + Testing Library.

## Global Constraints

- **The server is the source of truth.** This UI never computes overlap, pattern aggregation,
  best-slot selection, or "who's busy." It renders whatever the API returns. The one legitimate
  local state is in-flight paint-gesture feedback during a drag — reconciled to the server's
  response the moment the gesture ends, never trusted as final on its own.
- API wire shapes (must match `pick-a-time-api` exactly — see that repo's Plan A, Task 2 and
  Task 11): `PlanRecord` → this repo's `PlanData`, `AvailabilityRecord`, `AvailabilityPatchInput`
  (NOT JSON Patch — `{ weekIndex, cells, resetToPattern }`), `UserRecord` (no `votes`/
  `subscribedRounds`).
- Grid shape: `template`/`overrides` are `boolean[][]` indexed `[hourIndex][dayIndex]`, sized
  `(endHour-startHour) x weekdays.length`. Hourly slots only — no 30-minute granularity.
- Module aliases (from `jest.config.mjs`/`tsconfig.json`): `@components/*`, `@config/*`,
  `@hooks/*`, `@pages/*`, `@services/*`, `@test/*`, `@types`, `@utils/*`.
- Testing standards (this repo's `CLAUDE.md`): `clearMocks: true` is on — never call
  `jest.clearAllMocks()` manually, never use `beforeEach`; write a named `setup()` function
  instead. Use `jest.mocked(fn)`, not `fn as jest.Mock`. Functional style where practical:
  dependency injection over hidden singletons, avoid mutating inputs. All copy reviewed against
  plain-language/active-voice/concrete-noun principles (this repo's CLAUDE.md "Copy and UX
  Writing" section) — apply that lens directly when writing button labels, empty states, and
  errors below, not just to prose in this plan.
- Accessibility: WCAG AA — 4.5:1 text contrast (3:1 large text), full keyboard navigability,
  visible focus states, ARIA roles/labels, never color-alone for state. The availability grid in
  particular needs a non-color way to tell "on" from "off" (e.g. `aria-pressed`, not just a
  background-color swap) and the heatmap needs the numeric detail available via the tap-to-inspect
  summary line, not color alone.
- `pick-a-time-api`'s Plan B (`GET /sessions/{id}/overlap`) has not shipped yet as of this plan.
  Build the Results phase against its documented contract (`pick-a-time-api/docs/superpowers/plans/2026-07-10-pick-a-time-overlap-results.md`)
  anyway — it will simply start returning real data once that API plan ships. Do not block this
  plan on that one.
- **This repo has two test locations, not one.** Most existing tests live in a top-level `test/`
  directory mirroring `src/` with flattened names (e.g. `test/components/session-voting.test.tsx`
  for `src/components/session/voting/`), from before this project started colocating tests next to
  the component (`src/components/logo/index.test.tsx`, `src/services/api.test.ts`,
  `src/hooks/useSessionCookie.test.ts` are the colocated exceptions). Both locations run under
  `npm test` — `jest.config.mjs` doesn't restrict discovery to either one. Whenever a task deletes
  or replaces a component/util, check `test/` (not just alongside the source file) for its legacy
  test and delete that too — new tests this plan adds should be colocated, matching the newer
  convention, but cleanup must find both.
- **Standing policy: stub forward, don't leave the repo broken between tasks.** This repo's
  pre-commit hook runs `jest --findRelatedTests` on every staged file, which walks the _whole_
  dependency graph — including consumers that belong to a later, not-yet-run task. Task 1 hit this
  (`session/index.tsx` still importing deleted `voting`/`waiting`/`winner`) and Task 3 hits it again
  (`session-create` still calling API functions Task 3 removes; it isn't rewritten until Task 5).
  This will keep happening: whenever a task removes something a not-yet-updated consumer depends
  on, that task must also neutralize the consumer enough to load and pass — delete it and stub its
  one call site with an inert placeholder if the whole thing is invalidated (as with
  `session-create`, whose entire body depends on removed functions), or a narrower in-place stub if
  only part of it broke (as with `session/index.tsx`'s three phase cases). The task that "owns"
  building the real replacement still does that work in full — this is expected, minor redone work
  at the placeholder, not a shortcut around it. Never use `git commit --no-verify` to route around
  this instead.

## Section Map

| Section              | Tasks      | What it delivers                                                     |
| -------------------- | ---------- | -------------------------------------------------------------------- |
| 1 — Foundation       | 1, 2, 3    | Restaurant domain removed; new types; new API client; cookie renamed |
| 2 — Identity phase   | 4          | Join screen: pick existing name, create new, sign in with Google     |
| 3 — Create-plan page | 5, 6       | The plan-setup form and hero page                                    |
| 4 — Painting phase   | 7, 8       | Drag-to-paint hook + the availability grid screen                    |
| 5 — Results + Share  | 9, 10      | Pattern/by-week overlap view; share screen adapted                   |
| 6 — Wiring + cleanup | 11, 12, 13 | Phase machine, routing, dependency cleanup, final verification       |

---

## File Structure

**Delete:**

- `src/components/bracket-view/`, `src/components/restaurant-card/`, `src/components/photo-carousel/`
- `src/components/session/voting/`, `src/components/session/waiting/`, `src/components/session/winner/`,
  `src/components/session/user-select/`, `src/components/session/loading/`,
  `src/components/session/index.tsx` (+ `helpers.ts`, `elements.tsx`)
- `src/utils/bracket.ts`, `src/utils/hours.ts`
- `src/assets/images/*` (restaurant screenshots)
- `src/pages/s/[sessionId]/index.tsx`
- Their legacy counterparts in the top-level `test/` suite (see Global Constraints) —
  `test/components/bracket-view.test.tsx`, `photo-carousel.test.tsx`, `restaurant-card.test.tsx`,
  `session-voting.test.tsx`, `session-waiting.test.tsx`, `session-winner.test.tsx`,
  `session-user-select.test.tsx`, `session-loading.test.tsx`, `session.test.tsx`,
  `session-helpers.test.ts`, `test/utils/bracket.test.ts`, `test/utils/hours.test.ts`,
  `test/pages/s/[sessionId]/index.test.tsx`

**Modify:**

- `src/types.ts` — remove restaurant types, add `PlanData`, slim `User`, `AvailabilityRecord`,
  `NewPlanRequest`, `AvailabilityCell`, `AvailabilityPatchRequest`
- `src/services/api.ts` (+ colocated test) — new endpoint surface
- `src/hooks/useSessionCookie.ts` (+ colocated test) — rename cookie key prefix, and while
  touched, bring the test off `beforeEach`/`jest.clearAllMocks()` per current `CLAUDE.md`
- `src/utils/users.ts` + `test/utils/users.test.ts` — `displayName` title-cases adjective-noun IDs
- `src/components/session-create/` → rewritten as `src/components/plan-create/`
- `src/components/share/` + `test/components/share.test.tsx` — route/copy update
- `src/pages/index.tsx` + `test/pages/index.test.tsx`
- `package.json` — drop `embla-carousel-react`, `embla-carousel-autoplay`

**Create:**

- `src/hooks/usePaintGesture.ts` (+ colocated test)
- `src/components/plan/identity/` (replaces `src/components/session/user-select/`)
- `src/components/plan/painting/` (grid + toolbar + week strip + calendar toggle)
- `src/components/plan/results/` (tabs + heatmap + best banner + exceptions)
- `src/components/plan/index.tsx` (the phase machine, replaces `src/components/session/index.tsx`)
- `src/pages/p/[sessionId]/index.tsx` + `test/pages/p/[sessionId]/index.test.tsx`

---

### Task 1: Remove the restaurant/bracket domain

**Files:**

- Delete: `src/components/bracket-view/`, `src/components/restaurant-card/`,
  `src/components/photo-carousel/`, `src/components/session/voting/`,
  `src/components/session/waiting/`, `src/components/session/winner/`, `src/utils/bracket.ts`,
  `src/utils/hours.ts`, `src/assets/images/automatic-location.png`, `restaurant-search.png`,
  `text-others.png`, `vote-options.png`, `winning-decision.png`, `contact-info.png`
- Delete (legacy top-level test suite — see Global Constraints): `test/components/bracket-view.test.tsx`,
  `test/components/photo-carousel.test.tsx`, `test/components/restaurant-card.test.tsx`,
  `test/components/session-voting.test.tsx`, `test/components/session-waiting.test.tsx`,
  `test/components/session-winner.test.tsx`, `test/utils/bracket.test.ts`, `test/utils/hours.test.ts`
- Modify: `src/types.ts` (partial — remove restaurant-only exports; the plan/availability types
  are added in Task 2, not here)

**Interfaces:** None — deletion only. Nothing later depends on anything removed here.

- [ ] **Step 1: Delete the dead component directories and utils**

```bash
git rm -r src/components/bracket-view src/components/restaurant-card src/components/photo-carousel \
  src/components/session/voting src/components/session/waiting src/components/session/winner \
  src/utils/bracket.ts src/utils/hours.ts
git rm test/components/bracket-view.test.tsx test/components/photo-carousel.test.tsx \
  test/components/restaurant-card.test.tsx test/components/session-voting.test.tsx \
  test/components/session-waiting.test.tsx test/components/session-winner.test.tsx \
  test/utils/bracket.test.ts test/utils/hours.test.ts
```

- [ ] **Step 2: Delete the now-unused restaurant screenshot assets**

```bash
git rm src/assets/images/automatic-location.png src/assets/images/restaurant-search.png \
  src/assets/images/text-others.png src/assets/images/vote-options.png \
  src/assets/images/winning-decision.png src/assets/images/contact-info.png
```

(Keep any remaining files under `src/assets/images/` that aren't restaurant screenshots — check
what's left with `ls src/assets/images/` before assuming the directory is now empty.)

- [ ] **Step 3: Remove restaurant-only exports from `src/types.ts`**

Delete: `PriceLevel`, `PlaceTypeDisplay`, `ChoiceDetail`, `ChoicesMap`, `SortOption`,
`RadiusConfig`, `SessionConfig`, `AddressResult`. Leave `PatchOperation`, `ErrorCode`,
`SessionData`, `User`, `NewSessionRequest` untouched for now — Task 2 replaces those.

- [ ] **Step 4: Stub the now-dangling imports in `src/components/session/index.tsx`**

This repo's pre-commit hook runs `jest --findRelatedTests` on staged files. `session/index.tsx`
still imports `VotingPhase`/`WaitingPhase`/`WinnerPhase` from the directories just deleted, so it
(and anything that transitively depends on `src/types.ts`, which the hook will walk into once
Step 3 stages that file) fails to even load — which fails the hook, not just `typecheck`. Task 11
replaces this whole file, but that's 10 tasks away; leaving it broken for that long blocks every
intermediate commit. Patch it minimally now:

- Remove the `import VotingPhase from './voting'`, `import WaitingPhase from './waiting'`,
  `import WinnerPhase from './winner'` lines.
- In `renderPhase`, replace the `case 'voting':`, `case 'waiting':`, and `case 'winner':` bodies
  with `return null` each, and add a one-line comment: `// stubbed — Task 11 replaces this whole
file`.
- Delete `src/components/session/index.test.tsx` and `test/components/session.test.tsx` — both
  assert on the voting/waiting/winner phases this stub just removed, and Task 11 was already going
  to delete both files wholesale. Doing it now (rather than carrying 10 tasks of red tests) is the
  same end state, just sooner.
- Leave `test/pages/s/[sessionId]/index.test.tsx` alone — it `jest.mock()`s `@components/session`
  as a whole and doesn't assert on voting/waiting/winner specifics, so it passes again once
  `session/index.tsx` loads cleanly.

- [ ] **Step 5: Confirm the tree is still consistent**

Run: `npm run typecheck`
Expected: errors concentrated in files this task didn't touch yet (`src/services/api.ts`,
`src/components/session-create/*`, anything importing the deleted restaurant types) — those are
fixed in later tasks. If typecheck errors on something _outside_ that set, you deleted something
still in use — restore it.

Run: `npm test`
Expected: passes (no suites failing to load) — the Step 4 stub is what makes this possible before
Task 11 lands.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove restaurant/bracket domain components and assets"
```

---

### Task 2: New client types

**Files:**

- Modify: `src/types.ts`

**Interfaces:**

- Produces: `PlanData`, `User` (slimmed), `AvailabilityRecord`, `NewPlanRequest`,
  `AvailabilityCell`, `AvailabilityPatchRequest` — every later task imports these from `@types`.

- [ ] **Step 1: Replace `SessionData`/`User`/`NewSessionRequest` in `src/types.ts`**

```ts
export interface PlanData {
  sessionId: string
  name: string
  weekdays: number[] // 0=Sun..6=Sat, display column order
  startDate: string // "YYYY-MM-DD"
  weekCount: number
  startHour: number
  endHour: number
  timezone: string
  participantCount: number
}

export interface User {
  userId: string
  name: string | null
  phone: string | null
  textsSent: number
}

export interface AvailabilityRecord {
  userId: string
  template: boolean[][] // [hourIndex][dayIndex]
  overrides: Record<number, boolean[][]>
}

export interface NewPlanRequest {
  name: string
  weekdays: number[]
  startDate: string
  weekCount: number
  startHour: number
  endHour: number
  timezone: string
}

export interface AvailabilityCell {
  hourIndex: number
  dayIndex: number
  value: boolean
}

export interface AvailabilityPatchRequest {
  weekIndex: number | null
  cells: AvailabilityCell[]
  resetToPattern: boolean
}
```

Leave `PatchOperation`, `ErrorCode` untouched.

- [ ] **Step 2: Run typecheck to confirm this file compiles on its own**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep types.ts || echo "types.ts clean"`
Expected: `types.ts clean` (errors in _other_ files that reference the old shapes are expected and
fixed by later tasks)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Plan/Availability client types, remove restaurant types"
```

---

### Task 3: API client + cookie rename

**Files:**

- Modify: `src/services/api.ts`, `src/services/api.test.ts`, `src/hooks/useSessionCookie.ts`,
  `src/hooks/useSessionCookie.test.ts`, `src/pages/index.tsx` (stubbed), `test/pages/index.test.tsx`
  (stubbed)
- Delete: `src/components/session-create/` (its whole body depends on functions this task
  removes — see Step 9; Task 5 rebuilds it fresh as `plan-create`, so nothing here is wasted beyond
  the deletion itself)

**Interfaces:**

- Consumes: `PlanData`, `User`, `AvailabilityRecord`, `NewPlanRequest`, `AvailabilityPatchRequest`
  (Task 2)
- Produces: `createPlan`, `fetchPlan`, `fetchUsers`, `createUser`, `patchUser`, `fetchAvailability`,
  `patchAvailability`, `fetchOverlap`, `shareSession`, `parseApiMessage`, `hasErrorCode` — every UI
  task from here on calls into these.

- [ ] **Step 1: Write the failing API client tests**

Rewrite `src/services/api.test.ts`'s session-creation/fetch tests (keep the existing `authHeaders`/
`apiGet`/`apiPost`/`apiPatch` plumbing tests and the `createUser` auth-retry tests as-is — they're
domain-agnostic):

```ts
import { get, patch, post } from 'aws-amplify/api'

import { createPlan, fetchAvailability, fetchPlan, patchAvailability } from './api'

// ... existing jest.mock('aws-amplify/api') / jest.mock('aws-amplify/auth') setup stays

describe('createPlan', () => {
  it('should POST to /sessions with the plan body and recaptcha header', async () => {
    jest.mocked(post).mockReturnValue({
      response: Promise.resolve({ body: { json: async () => ({ sessionId: 'amber-harbor' }) } }),
    } as any)

    const plan = {
      name: 'Fall rec soccer practice',
      weekdays: [4, 5, 6],
      startDate: '2025-09-04',
      weekCount: 6,
      startHour: 16,
      endHour: 20,
      timezone: 'America/Chicago',
    }
    const result = await createPlan(plan, 'recaptcha-token')

    expect(result).toEqual({ sessionId: 'amber-harbor' })
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/sessions',
        options: expect.objectContaining({ headers: { 'x-recaptcha-token': 'recaptcha-token' }, body: plan }),
      }),
    )
  })
})

describe('fetchPlan', () => {
  it('should GET /sessions/{id}', async () => {
    jest.mocked(get).mockReturnValue({
      response: Promise.resolve({ body: { json: async () => ({ sessionId: 'amber-harbor' }) } }),
    } as any)

    await fetchPlan('amber-harbor')

    expect(get).toHaveBeenCalledWith(expect.objectContaining({ path: '/sessions/amber-harbor' }))
  })
})

describe('fetchAvailability', () => {
  it('should GET /sessions/{id}/users/{userId}/availability', async () => {
    jest.mocked(get).mockReturnValue({
      response: Promise.resolve({ body: { json: async () => ({ userId: 'quiet-falcon' }) } }),
    } as any)

    await fetchAvailability('amber-harbor', 'quiet-falcon')

    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/sessions/amber-harbor/users/quiet-falcon/availability' }),
    )
  })
})

describe('patchAvailability', () => {
  it('should PATCH the availability body as-is (not JSON Patch)', async () => {
    jest.mocked(patch).mockReturnValue({
      response: Promise.resolve({ body: { json: async () => ({ userId: 'quiet-falcon' }) } }),
    } as any)

    const body = { weekIndex: null, cells: [{ hourIndex: 0, dayIndex: 0, value: true }], resetToPattern: false }
    await patchAvailability('amber-harbor', 'quiet-falcon', body)

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/sessions/amber-harbor/users/quiet-falcon/availability',
        options: expect.objectContaining({ body }),
      }),
    )
  })
})
```

Remove the old `fetchAddress`/`fetchSessionConfig`/`fetchChoices`/`closeRound`/`subscribeToRound`
tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest api.test.ts`
Expected: FAIL — `createPlan`, `fetchAvailability`, `patchAvailability` not exported

- [ ] **Step 3: Rewrite `src/services/api.ts`'s public surface**

Keep `authHeaders`, `endpointFor`, `apiGet`, `apiPost`, `apiPatch`, `parseApiMessage`,
`hasErrorCode`, `parseBodyField` exactly as-is. Replace everything under `// --- Public API ---`:

```ts
export const createPlan = (plan: NewPlanRequest, token: string): Promise<{ sessionId: string }> =>
  apiPost('/sessions', false, plan, { 'x-recaptcha-token': token })

export const fetchPlan = (sessionId: string): Promise<PlanData> => apiGet(`/sessions/${encodeURIComponent(sessionId)}`)

export const fetchUsers = (sessionId: string): Promise<User[]> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/users`)

export const createUser = async (sessionId: string, authenticated: boolean): Promise<User> => {
  // unchanged from today's implementation — the authed-with-401-retry-then-fallback logic
  // is exactly right for this domain too; copy it verbatim.
}

export const patchUser = (
  sessionId: string,
  userId: string,
  operations: PatchOperation[],
  authenticated: boolean,
): Promise<User> =>
  apiPatch(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}`, authenticated, operations)

export const fetchAvailability = (sessionId: string, userId: string): Promise<AvailabilityRecord> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/availability`)

export const patchAvailability = (
  sessionId: string,
  userId: string,
  body: AvailabilityPatchRequest,
): Promise<AvailabilityRecord> =>
  apiPatch(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/availability`, false, body)

export interface OverlapCell {
  hourIndex: number
  dayIndex: number
  freeCount: number
  freeUserIds: string[]
}

export interface OverlapResponse {
  mode: 'pattern' | 'week'
  weekIndex: number | null
  grid: { cells: OverlapCell[][]; bestSlot: { hourIndex: number; dayIndex: number; freeCount: number } }
  exceptions: { weekIndex: number; hourIndex: number; dayIndex: number; description: string }[]
}

export const fetchOverlap = (sessionId: string, week: 'pattern' | number): Promise<OverlapResponse> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/overlap`, { week: String(week) })

export interface ShareResult {
  userId: string
}

export const shareSession = (sessionId: string, userId: string, phone: string): Promise<ShareResult> =>
  apiPost(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/share`, true, {
    phone,
    type: 'text',
  })
```

Update the `import { ... } from '@types'` line to pull `PlanData`, `User`, `AvailabilityRecord`,
`NewPlanRequest`, `AvailabilityPatchRequest`, `PatchOperation`, `ErrorCode` instead of the removed
restaurant types.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest api.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing cookie-rename test**

In `src/hooks/useSessionCookie.test.ts`, replace `beforeEach(() => { jest.clearAllMocks() ... })`
with a named `setup()` called at the start of each `it` (per this repo's current `CLAUDE.md` — the
existing file predates that convention), and update every `choosee_user_` assertion to
`pat_user_`:

```ts
import { renderHook, act } from '@testing-library/react'
import Cookies from 'js-cookie'

import { useSessionCookie } from './useSessionCookie'

jest.mock('js-cookie')

describe('useSessionCookie', () => {
  const mockGet = jest.mocked(Cookies.get)
  const mockSet = jest.mocked(Cookies.set)
  const mockRemove = jest.mocked(Cookies.remove)

  function setup(protocol: 'https:' | 'http:' = 'https:'): void {
    Object.defineProperty(window, 'location', { value: { protocol }, writable: true })
  }

  it('should read userId from cookie on mount', () => {
    setup()
    mockGet.mockReturnValueOnce('user-123' as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    expect(mockGet).toHaveBeenCalledWith('pat_user_abc')
    expect(result.current.userId).toBe('user-123')
  })

  it('should return undefined when no cookie exists', () => {
    setup()
    mockGet.mockReturnValueOnce(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    expect(result.current.userId).toBeUndefined()
  })

  it('should set cookie and update state', () => {
    setup()
    mockGet.mockReturnValueOnce(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))
    act(() => result.current.setUserId('user-456'))

    expect(mockSet).toHaveBeenCalledWith('pat_user_abc', 'user-456', {
      path: '/p/abc',
      expires: 1,
      sameSite: 'Strict',
      secure: true,
    })
    expect(result.current.userId).toBe('user-456')
  })

  it('should set secure to false on http', () => {
    setup('http:')
    mockGet.mockReturnValueOnce(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))
    act(() => result.current.setUserId('user-456'))

    expect(mockSet).toHaveBeenCalledWith('pat_user_abc', 'user-456', expect.objectContaining({ secure: false }))
  })

  it('should clear cookie and reset state', () => {
    setup()
    mockGet.mockReturnValueOnce('user-123' as any)

    const { result } = renderHook(() => useSessionCookie('abc'))
    act(() => result.current.clearUserId())

    expect(mockRemove).toHaveBeenCalledWith('pat_user_abc', { path: '/p/abc' })
    expect(result.current.userId).toBeUndefined()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest useSessionCookie.test.ts`
Expected: FAIL — hook still uses `choosee_user_`/`/s/` prefixes

- [ ] **Step 7: Update `src/hooks/useSessionCookie.ts`**

Change `getCookieName` to `` `pat_user_${sessionId}` `` and `getCookiePath` to `` `/p/${sessionId}` ``.
No other logic changes.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx jest useSessionCookie.test.ts api.test.ts`
Expected: PASS

- [ ] **Step 9: Stub the now-broken `session-create` consumer (see Global Constraints' standing
      policy)**

`src/components/session-create/index.tsx` calls `fetchSessionConfig`, `fetchAddress`, and the old
`createSession` — all removed by this task. Its entire body depends on removed functions (this
isn't a partial break like Task 1's), so there's no smaller stub than replacing it outright:

- Delete `src/components/session-create/` (including its colocated `index.test.tsx`) — Task 5
  rebuilds this from scratch as `plan-create` anyway.
- In `src/pages/index.tsx`, remove `import SessionCreate from '@components/session-create'` and
  replace `<SessionCreate />` with a plain placeholder: `<p>Plan creation coming soon.</p>` plus a
  comment `{/* stubbed — Task 5/6 replace this with PlanCreate */}`.
- In `test/pages/index.test.tsx`, remove the `jest.mock('@components/session-create')` line and
  the `SessionCreate`-related mock/assertion (`should render SessionCreate`) — keep the `AppBar`
  and `PrivacyLink` tests as-is. Task 6 replaces this whole file for real when `PlanCreate` exists.

Run `npm test` again after this to confirm the whole suite is green, not just this task's own new
files.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: rewrite API client for plan/availability domain, rename session cookie"
```

---

**→ End of Section 1. Dispatch the devil's-advocate review (UX genius + principal engineer) over
the combined diff of Tasks 1-3 before starting Task 4. Single pass, not looped.**

---

### Task 4: Identity phase

**Files:**

- Create: `src/components/plan/identity/index.tsx`, `src/components/plan/identity/elements.tsx`
- Test: `src/components/plan/identity/index.test.tsx`
- Modify: `src/utils/users.ts`, `test/utils/users.test.ts` (the real location of this file's test
  today — not colocated; see Global Constraints)
- Delete: `src/components/session/user-select/`, `test/components/session-user-select.test.tsx`

**Interfaces:**

- Consumes: `createUser`, `parseApiMessage` (Task 3), `useAuthContext` (unchanged), `User` (Task 2)
- Produces: `IdentityPhase` component — `{ sessionId, users, onUserSelected }` props, same shape as
  today's `UserSelectPhase` — Task 11's phase machine wires it in exactly where `UserSelectPhase`
  is today.

- [ ] **Step 1: Write the failing test for title-cased display names**

Replace `test/utils/users.test.ts` in full (this file's real location; it is NOT colocated in
`src/` today — see Global Constraints). It updates `makeUser` for the slimmed `User` shape from
Task 2 and keeps the existing edge-case coverage (collapsing separators, trimming, all-non-alpha),
adding title-casing:

```ts
import { User } from '@types'
import { displayName } from '@utils/users'

const makeUser = (overrides: Partial<User> = {}): User => ({
  userId: 'abc-123-def',
  name: null,
  phone: null,
  textsSent: 0,
  ...overrides,
})

describe('displayName', () => {
  it('should return the user name when set', () => {
    expect(displayName(makeUser({ name: 'Alice' }))).toBe('Alice')
  })

  it('should title-case an adjective-noun userId when name is null', () => {
    expect(displayName(makeUser({ userId: 'quiet-falcon' }))).toBe('Quiet Falcon')
  })

  it('should collapse consecutive non-alpha characters into a single space', () => {
    expect(displayName(makeUser({ userId: 'abc--123--def' }))).toBe('Abc Def')
  })

  it('should trim leading and trailing non-alpha characters', () => {
    expect(displayName(makeUser({ userId: '123abc456' }))).toBe('Abc')
  })

  it('should return empty string when userId is all non-alpha', () => {
    expect(displayName(makeUser({ userId: '123-456' }))).toBe('')
  })
})
```

(The old file's "prefer name over userId even if name is whitespace-only" case documented an edge
case of the old truthy-string check — still accurate after this change, since `user.name`'s
truthiness check is unchanged, but it's a low-value case to keep; drop it rather than port it
forward mechanically.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/utils/users.test.ts`
Expected: FAIL — current `displayName` returns `'quiet falcon'`, not `'Quiet Falcon'`

- [ ] **Step 3: Update `src/utils/users.ts`**

```ts
import { User } from '@types'

export function displayName(user: User): string {
  if (user.name) return user.name
  return user.userId
    .replace(/[^a-z]+/gi, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
```

Remove `isSoloVoter` (restaurant-only) if this file still has it after Task 1 — check before
deleting.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest users.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing component test**

```tsx
// src/components/plan/identity/index.test.tsx
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import IdentityPhase from './index'
import { useAuthContext } from '@components/auth-context'
import { createUser } from '@services/api'

jest.mock('@components/auth-context')
jest.mock('@services/api')

describe('IdentityPhase', () => {
  const onUserSelected = jest.fn()
  const users = [{ userId: 'quiet-falcon', name: null, phone: null, textsSent: 0 }]

  function setup(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoading: false,
      handleSignIn: jest.fn(),
      handleSignOut: jest.fn(),
    })
  }

  it('should list existing users by their title-cased name', () => {
    setup()
    render(<IdentityPhase onUserSelected={onUserSelected} sessionId="amber-harbor" users={users} />)

    expect(screen.getByText('Quiet Falcon')).toBeInTheDocument()
  })

  it('should call onUserSelected with the new userId after creating one', async () => {
    setup()
    jest.mocked(createUser).mockResolvedValueOnce({ userId: 'bright-heron', name: null, phone: null, textsSent: 0 })

    render(<IdentityPhase onUserSelected={onUserSelected} sessionId="amber-harbor" users={users} />)
    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(onUserSelected).toHaveBeenCalledWith('bright-heron'))
  })

  it('should show a full-group error message on 400', async () => {
    setup()
    const { ApiError } = jest.requireActual('aws-amplify/api')
    jest.mocked(createUser).mockRejectedValueOnce(
      Object.assign(new ApiError({ message: 'full', name: 'x' } as any), {
        response: { statusCode: 400, body: JSON.stringify({ message: 'This group is full.' }) },
      }),
    )

    render(<IdentityPhase onUserSelected={onUserSelected} sessionId="amber-harbor" users={users} />)
    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('This group is full.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest src/components/plan/identity`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 7: Implement `src/components/plan/identity/elements.tsx`**

```tsx
import { Button, Radio, RadioGroup } from '@heroui/react'
import React from 'react'

import { PillArrowButton } from '@components/pill-arrow-button'

export const SectionContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="arena-glass-outer">
    <div className="arena-glass-inner flex flex-col gap-4 p-6">{children}</div>
  </div>
)

export const SectionTitle = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <h2 className="text-lg font-semibold text-[#F5F5F5]">{children}</h2>
)

export const UserOptions = ({
  users,
  selected,
  createNew,
  onSelectUser,
  onSelectCreateNew,
}: {
  users: { userId: string; label: string }[]
  selected: string | null
  createNew: boolean
  onSelectUser: (userId: string) => void
  onSelectCreateNew: () => void
}): React.ReactNode => (
  <RadioGroup
    onChange={(value) => (value === '__new__' ? onSelectCreateNew() : onSelectUser(value))}
    value={createNew ? '__new__' : (selected ?? undefined)}
  >
    {users.map((user) => (
      <Radio key={user.userId} value={user.userId}>
        {user.label}
      </Radio>
    ))}
    <Radio value="__new__">Join as someone new</Radio>
  </RadioGroup>
)

export const ErrorMessage = ({ message }: { message: string }): React.ReactNode => (
  <p className="text-sm text-red-400">{message}</p>
)

export const GoogleSignInButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button
    className="w-full rounded-full border-white/[0.09] bg-white/[0.05] text-[#D4D4D4]"
    onPress={onPress}
    variant="secondary"
  >
    Continue with Google
  </Button>
)

export const CalendarSyncNote = (): React.ReactNode => (
  <p className="text-center text-xs text-[#6B7280]">
    Signing in with Google also blocks off times you&apos;re already busy, across every week of this plan.
  </p>
)
```

- [ ] **Step 8: Implement `src/components/plan/identity/index.tsx`**

Base this on today's `src/components/session/user-select/index.tsx` (same auto-create-when-empty
behavior, same `isSignedInRef` pattern for the mutation closure), swapping in the new elements and
title-cased display names:

```tsx
import { useMutation } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  CalendarSyncNote,
  ErrorMessage,
  GoogleSignInButton,
  SectionContainer,
  SectionTitle,
  UserOptions,
} from './elements'
import { useAuthContext } from '@components/auth-context'
import { PillArrowButton } from '@components/pill-arrow-button'
import { createUser, parseApiMessage } from '@services/api'
import { User } from '@types'
import { displayName } from '@utils/users'

export interface IdentityPhaseProps {
  sessionId: string
  users: User[]
  onUserSelected: (userId: string) => void
}

const IdentityPhase = ({ sessionId, users, onUserSelected }: IdentityPhaseProps): React.ReactNode => {
  const { isSignedIn, isLoading: isAuthLoading, handleSignIn } = useAuthContext()
  const [selected, setSelected] = useState<string | null>(null)
  const [createNew, setCreateNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoCreateFired = useRef(false)

  const isSignedInRef = useRef(isSignedIn)
  isSignedInRef.current = isSignedIn

  const createMutation = useMutation({
    mutationFn: () => createUser(sessionId, isSignedInRef.current),
    onSuccess: (newUser) => onUserSelected(newUser.userId),
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.response?.statusCode === 400) {
        setError(parseApiMessage(err.response.body, 'This group is full.'))
        return
      }
      setError("Couldn't join. Try again.")
    },
  })

  const isEmpty = users.length === 0
  const doAutoCreate = useCallback(() => {
    if (isEmpty && !isAuthLoading && !autoCreateFired.current) {
      autoCreateFired.current = true
      createMutation.mutate()
    }
  }, [isEmpty, isAuthLoading, createMutation])

  useEffect(() => {
    doAutoCreate()
  }, [doAutoCreate])

  if (isEmpty) return null

  const handleConfirm = (): void => {
    if (isAuthLoading) return
    if (createNew) createMutation.mutate()
    else if (selected) onUserSelected(selected)
  }

  return (
    <SectionContainer>
      <SectionTitle>{users.length === 1 ? 'Welcome back' : 'Back again? Choose your name'}</SectionTitle>
      <UserOptions
        createNew={createNew}
        onSelectCreateNew={() => {
          setCreateNew(true)
          setSelected(null)
        }}
        onSelectUser={(userId) => {
          setSelected(userId)
          setCreateNew(false)
        }}
        selected={selected}
        users={users.map((u) => ({ userId: u.userId, label: displayName(u) }))}
      />
      {error && <ErrorMessage message={error} />}
      <PillArrowButton
        isDisabled={!createNew && !selected}
        isLoading={createMutation.isPending || isAuthLoading}
        label="Continue"
        loadingLabel="Joining..."
        onPress={handleConfirm}
      />
      {!isSignedIn && (
        <>
          <GoogleSignInButton onPress={handleSignIn} />
          <CalendarSyncNote />
        </>
      )}
    </SectionContainer>
  )
}

export default IdentityPhase
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx jest src/components/plan/identity test/utils/users.test.ts`
Expected: PASS

- [ ] **Step 10: Delete the old user-select component and its legacy test**

```bash
git rm -r src/components/session/user-select test/components/session-user-select.test.tsx
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add identity phase with title-cased adjective-noun display names"
```

---

**→ End of Section 2. Dispatch the devil's-advocate review over Task 4's diff. Single pass.**

---

### Task 5: Plan-create form

**Files:**

- Create: `src/components/plan-create/index.tsx`, `src/components/plan-create/elements.tsx`
- Test: `src/components/plan-create/index.test.tsx`

**Interfaces:**

- Consumes: `createPlan` (Task 3), `NewPlanRequest` (Task 2)
- Produces: `PlanCreate` component, no props — Task 6 mounts it on the home page in place of the
  placeholder Task 3 left there.

Note: `src/components/session-create/` no longer exists — Task 3 already deleted it (its whole body
depended on API functions that task removed; see that task's Step 9 and the Global Constraints'
standing "stub forward" policy). This task only needs to create the new component, not delete an
old one.

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/router'
import React from 'react'

import PlanCreate from './index'
import { createPlan } from '@services/api'

jest.mock('@services/api')
jest.mock('next/router')

describe('PlanCreate', () => {
  function setup(): { push: jest.Mock } {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ push } as any)
    ;(global as any).grecaptcha = { ready: (cb: () => void) => cb(), execute: jest.fn().mockResolvedValue('token') }
    return { push }
  }

  it('should show a validation message when the plan name is empty', async () => {
    setup()
    render(<PlanCreate />)

    await userEvent.click(screen.getByRole('button', { name: /start a plan/i }))

    expect(await screen.findByText(/name your plan/i)).toBeInTheDocument()
    expect(createPlan).not.toHaveBeenCalled()
  })

  it('should submit the selected weekdays, week count, and hour range', async () => {
    const { push } = setup()
    jest.mocked(createPlan).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    render(<PlanCreate />)
    await userEvent.type(screen.getByLabelText(/plan name/i), 'Fall rec soccer practice')
    await userEvent.click(screen.getByRole('checkbox', { name: /^thu/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^fri/i }))
    await userEvent.click(screen.getByRole('button', { name: /start a plan/i }))

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fall rec soccer practice', weekdays: expect.arrayContaining([4, 5]) }),
      'token',
    )
    expect(push).toHaveBeenCalledWith('/p/amber-harbor')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/plan-create`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `src/components/plan-create/elements.tsx`**

Reuse `CreateCard`/`LoadingCard`'s `arena-glass-outer`/`arena-glass-inner` shell from today's
`session-create/elements.tsx` verbatim (it's domain-agnostic styling), plus new fields:

```tsx
import { Checkbox, CheckboxGroup, Input } from '@heroui/react'
import React from 'react'

export const CreateCard = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="arena-glass-outer">
    <div className="arena-glass-inner p-6">
      <div className="flex flex-col gap-[18px]">{children}</div>
    </div>
  </div>
)

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const PlanNameField = ({
  value,
  error,
  onChange,
}: {
  value: string
  error?: string
  onChange: (value: string) => void
}): React.ReactNode => (
  <Input
    aria-label="Plan name"
    errorMessage={error}
    isInvalid={!!error}
    label="Plan name"
    onChange={(e) => onChange(e.target.value)}
    placeholder="Fall rec soccer practice"
    value={value}
  />
)

export const WeekdayPicker = ({
  selected,
  onChange,
}: {
  selected: number[]
  onChange: (weekdays: number[]) => void
}): React.ReactNode => (
  <CheckboxGroup
    label="Which days?"
    onChange={(values) => onChange(values.map(Number).sort((a, b) => a - b))}
    orientation="horizontal"
    value={selected.map(String)}
  >
    {WEEKDAY_LABELS.map((label, day) => (
      <Checkbox key={day} value={String(day)}>
        {label}
      </Checkbox>
    ))}
  </CheckboxGroup>
)

export const WeekCountStepper = ({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}): React.ReactNode => (
  <div className="flex items-center gap-4">
    <button aria-label="Fewer weeks" onClick={() => onChange(Math.max(1, value - 1))} type="button">
      −
    </button>
    <span>{value} weeks</span>
    <button aria-label="More weeks" onClick={() => onChange(Math.min(12, value + 1))} type="button">
      +
    </button>
  </div>
)

export const HourRangeFields = ({
  startHour,
  endHour,
  onChangeStart,
  onChangeEnd,
}: {
  startHour: number
  endHour: number
  onChangeStart: (hour: number) => void
  onChangeEnd: (hour: number) => void
}): React.ReactNode => (
  <div className="flex items-center gap-3">
    <label>
      From
      <input
        aria-label="Start hour"
        max={23}
        min={0}
        onChange={(e) => onChangeStart(Number(e.target.value))}
        type="number"
        value={startHour}
      />
    </label>
    <label>
      To
      <input
        aria-label="End hour"
        max={24}
        min={1}
        onChange={(e) => onChangeEnd(Number(e.target.value))}
        type="number"
        value={endHour}
      />
    </label>
  </div>
)
```

(`HourRangeFields` and `WeekCountStepper` are deliberately plain here — swap for HeroUI/richer
slider components if the devil's-advocate review or later polish pass wants it; functionally
complete either way.)

- [ ] **Step 4: Implement `src/components/plan-create/index.tsx`**

Mirror `session-create/index.tsx`'s reCAPTCHA-script-injection and `waitForRecaptcha` helper
verbatim (copy those two unchanged — they're domain-agnostic), replacing the mutation body and
form fields:

```tsx
import { useMutation } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'

import { CreateCard, HourRangeFields, PlanNameField, WeekCountStepper, WeekdayPicker } from './elements'
import FeedbackMessage from '@components/feedback-message'
import { PillArrowButton } from '@components/pill-arrow-button'
import { createPlan } from '@services/api'

const RECAPTCHA_SCRIPT_ID = 'recaptcha-v3-script'
const RECAPTCHA_TIMEOUT_MS = 10_000

const waitForRecaptcha = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + RECAPTCHA_TIMEOUT_MS
    const check = () => {
      if (typeof grecaptcha !== 'undefined' && grecaptcha.ready) {
        grecaptcha.ready(resolve)
      } else if (Date.now() > deadline) {
        reject(new Error('reCAPTCHA failed to load'))
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const PlanCreate = (): React.ReactNode => {
  const router = useRouter()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [weekCount, setWeekCount] = useState(6)
  const [startHour, setStartHour] = useState(16)
  const [endHour, setEndHour] = useState(20)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    if (!document.getElementById(RECAPTCHA_SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = RECAPTCHA_SCRIPT_ID
      script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const planMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createPlan>[0]) => {
      await waitForRecaptcha()
      const token = await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'CREATE_PLAN' })
      return createPlan(input, token)
    },
    onSuccess: (data) => {
      setIsNavigating(true)
      router.push(`/p/${data.sessionId}`)
    },
    onError: (error: unknown) => {
      setErrorMessage(
        error instanceof ApiError && error.response?.statusCode === 403
          ? 'Unusual traffic detected. Please try again later.'
          : 'Something went wrong setting up your plan. Try again.',
      )
    },
  })

  const handleSubmit = (): void => {
    if (!name.trim()) {
      setNameError('Name your plan so people know what they’re joining')
      return
    }
    setNameError(undefined)
    if (weekdays.length === 0) {
      setErrorMessage('Pick at least one day of the week')
      return
    }

    planMutation.mutate({
      name: name.trim(),
      weekdays,
      startDate: todayIso(),
      weekCount,
      startHour,
      endHour,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  }

  const isLoading = planMutation.isPending || isNavigating

  return (
    <>
      <CreateCard>
        <PlanNameField error={nameError} onChange={setName} value={name} />
        <WeekdayPicker onChange={setWeekdays} selected={weekdays} />
        <WeekCountStepper onChange={setWeekCount} value={weekCount} />
        <HourRangeFields
          endHour={endHour}
          onChangeEnd={setEndHour}
          onChangeStart={setStartHour}
          startHour={startHour}
        />
        <PillArrowButton isLoading={isLoading} label="Start a plan" loadingLabel="Starting..." onPress={handleSubmit} />
      </CreateCard>
      <FeedbackMessage
        autoHideDuration={15_000}
        message={errorMessage}
        onClose={() => setErrorMessage(undefined)}
        severity="error"
      />
    </>
  )
}

export default PlanCreate
```

Note `startDate` defaults to today's date client-side — this only satisfies the API's "`startDate`
must fall on `weekdays[0]`" validation (Plan A, Task 4) if today happens to be that weekday. Flag
this to the section's devil's-advocate reviewer explicitly: either the form needs a real date
picker constrained to valid weekdays, or the API needs to accept "first occurrence on or after
`startDate` matching `weekdays[0]`" instead of an exact match. Don't silently paper over it — this
is a real gap between the form as sketched here and the API contract it calls.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/components/plan-create`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add plan-create form, flag startDate/weekdays[0] validation gap"
```

---

### Task 6: Home page hero

**Files:**

- Modify: `src/pages/index.tsx`, `test/pages/index.test.tsx`

**Interfaces:**

- Consumes: `PlanCreate` (Task 5)

- [ ] **Step 1: Update the failing test first**

`test/pages/index.test.tsx` currently only tests `AppBar`/`PrivacyLink` — Task 3 stripped its
`SessionCreate` mock/assertion when it stubbed the page (see that task's Step 9). Restore full
coverage, this time mocking `@components/plan-create`:

```tsx
import Index from '@pages/index'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'
import PlanCreate from '@components/plan-create'
import PrivacyLink from '@components/privacy-link'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-link')
jest.mock('@components/plan-create')

describe('Index page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<></>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
    jest.mocked(PlanCreate).mockReturnValue(<></>)
  })

  it('should render AppBar', () => {
    render(<Index />)
    expect(AppBar).toHaveBeenCalledTimes(1)
  })

  it('should render PlanCreate', () => {
    render(<Index />)
    expect(PlanCreate).toHaveBeenCalledTimes(1)
  })

  it('should render PrivacyLink', () => {
    render(<Index />)
    expect(PrivacyLink).toHaveBeenCalledTimes(1)
  })
})
```

(This file uses `beforeAll` for shared mock setup, consistent with this repo's `CLAUDE.md` — no
change needed there, just the swapped import/component.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/pages/index.test.tsx`
Expected: FAIL — `@components/plan-create` doesn't exist yet if Task 5 wasn't completed first (it
was — this task runs after Task 5 in the plan), or FAIL because `src/pages/index.tsx` still
imports `SessionCreate`

- [ ] **Step 3: Update `src/pages/index.tsx`**

```tsx
import Head from 'next/head'
import React from 'react'

import AppBar from '@components/app-bar'
import PlanCreate from '@components/plan-create'
import PrivacyLink from '@components/privacy-link'

const Index = (): React.ReactNode => (
  <>
    <Head>
      <title>Pick a Time</title>
    </Head>
    <AppBar />
    <main className="mx-auto max-w-[1060px] px-5 pt-10 pb-12">
      <div className="flex flex-col gap-10 md:grid md:grid-cols-[1fr_460px] md:gap-11 md:pt-4">
        <div className="flex flex-col justify-center gap-5">
          <h1 className="choosee-brand text-[clamp(64px,7.5vw,100px)] leading-[0.9] tracking-[0.04em] text-[#F5F5F5]">
            FIND THE
            <br />
            MINUTE
            <br />
            <span className="text-[#F59E0B]">EVERYONE&apos;S FREE</span>
          </h1>
          <p className="max-w-[320px] text-sm leading-[1.7] text-[#4B5563]">
            No accounts, no reply-all thread. Start a plan, send one link, and watch the free time appear where
            everyone&apos;s schedules overlap — for one afternoon, or a whole season of Thursday practices.
          </p>
        </div>
        <div>
          <PlanCreate />
        </div>
      </div>
    </main>
    <PrivacyLink />
  </>
)

export default Index
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/pages/index.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.tsx test/pages/index.test.tsx
git commit -m "feat: update home page hero copy for Pick a Time"
```

---

**→ End of Section 3. Dispatch the devil's-advocate review over Tasks 5-6's diff. Single pass.**

---

### Task 7: Paint-gesture hook

**Files:**

- Create: `src/hooks/usePaintGesture.ts`
- Test: `src/hooks/usePaintGesture.test.ts`

**Interfaces:**

- Consumes: nothing external — pure state-and-callback hook
- Produces: `usePaintGesture(grid, onCommit)` — Task 8's grid component owns the pointer event
  wiring and calls into this for state; `onCommit(cells: AvailabilityCell[])` fires once per
  released gesture, matching `patchAvailability`'s `cells` shape.

- [ ] **Step 1: Write the failing tests**

```ts
import { act, renderHook } from '@testing-library/react'

import { usePaintGesture } from './usePaintGesture'

describe('usePaintGesture', () => {
  const grid = [
    [false, false],
    [false, false],
  ]

  it('should mark a cell on and report it as dirty while painting', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => result.current.startPaint(0, 0))

    expect(result.current.isOn(0, 0)).toBe(true)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('should toggle off when starting on an already-on cell', () => {
    const onCommit = jest.fn()
    const onGrid = [
      [true, false],
      [false, false],
    ]
    const { result } = renderHook(() => usePaintGesture(onGrid, onCommit))

    act(() => result.current.startPaint(0, 0))

    expect(result.current.isOn(0, 0)).toBe(false)
  })

  it('should paint additional cells the same way during the drag', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => {
      result.current.startPaint(0, 0)
      result.current.continuePaint(0, 1)
      result.current.continuePaint(1, 0)
    })

    expect(result.current.isOn(0, 0)).toBe(true)
    expect(result.current.isOn(0, 1)).toBe(true)
    expect(result.current.isOn(1, 0)).toBe(true)
  })

  it('should commit only the cells that actually changed on release', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => {
      result.current.startPaint(0, 0)
      result.current.continuePaint(0, 1)
      result.current.endPaint()
    })

    expect(onCommit).toHaveBeenCalledWith([
      { hourIndex: 0, dayIndex: 0, value: true },
      { hourIndex: 0, dayIndex: 1, value: true },
    ])
  })

  it('should not commit when the gesture touched no cells', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => result.current.endPaint())

    expect(onCommit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest usePaintGesture.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `src/hooks/usePaintGesture.ts`**

```ts
import { useCallback, useRef, useState } from 'react'

import { AvailabilityCell } from '@types'

export interface PaintGesture {
  isOn: (hourIndex: number, dayIndex: number) => boolean
  startPaint: (hourIndex: number, dayIndex: number) => void
  continuePaint: (hourIndex: number, dayIndex: number) => void
  endPaint: () => void
}

export function usePaintGesture(baseGrid: boolean[][], onCommit: (cells: AvailabilityCell[]) => void): PaintGesture {
  const [overlay, setOverlay] = useState<Map<string, boolean>>(new Map())
  const paintValueRef = useRef(true)
  const paintingRef = useRef(false)

  const key = (h: number, d: number): string => `${h}:${d}`

  const isOn = useCallback(
    (hourIndex: number, dayIndex: number): boolean => {
      const k = key(hourIndex, dayIndex)
      return overlay.has(k) ? (overlay.get(k) as boolean) : baseGrid[hourIndex][dayIndex]
    },
    [overlay, baseGrid],
  )

  const paintCell = useCallback((hourIndex: number, dayIndex: number, value: boolean) => {
    setOverlay((prev) => {
      const next = new Map(prev)
      next.set(key(hourIndex, dayIndex), value)
      return next
    })
  }, [])

  const startPaint = useCallback(
    (hourIndex: number, dayIndex: number) => {
      paintingRef.current = true
      paintValueRef.current = !baseGrid[hourIndex][dayIndex]
      paintCell(hourIndex, dayIndex, paintValueRef.current)
    },
    [baseGrid, paintCell],
  )

  const continuePaint = useCallback(
    (hourIndex: number, dayIndex: number) => {
      if (!paintingRef.current) return
      paintCell(hourIndex, dayIndex, paintValueRef.current)
    },
    [paintCell],
  )

  const endPaint = useCallback(() => {
    paintingRef.current = false
    if (overlay.size === 0) return
    const cells: AvailabilityCell[] = Array.from(overlay.entries()).map(([k, value]) => {
      const [hourIndex, dayIndex] = k.split(':').map(Number)
      return { hourIndex, dayIndex, value }
    })
    onCommit(cells)
    setOverlay(new Map())
  }, [overlay, onCommit])

  return { isOn, startPaint, continuePaint, endPaint }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest usePaintGesture.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePaintGesture.ts src/hooks/usePaintGesture.test.ts
git commit -m "feat: add paint-gesture hook for the availability grid"
```

---

### Task 8: Painting phase

**Files:**

- Create: `src/components/plan/painting/index.tsx`, `src/components/plan/painting/elements.tsx`,
  `src/components/plan/painting/grid.tsx`
- Test: `src/components/plan/painting/index.test.tsx`

**Interfaces:**

- Consumes: `usePaintGesture` (Task 7), `fetchAvailability`, `patchAvailability` (Task 3)
- Produces: `PaintingPhase` component — `{ sessionId, userId, plan }` props; Task 11's phase
  machine mounts this alongside `ResultsPhase` (see the tabs-vs-linear decision flagged in the
  overview doc's Open Questions — resolve it in Task 11, not here; this component just needs to
  render correctly whenever it's mounted).

- [ ] **Step 1: Write the failing test**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import PaintingPhase from './index'
import { fetchAvailability, patchAvailability } from '@services/api'
import { PlanData } from '@types'

jest.mock('@services/api')

describe('PaintingPhase', () => {
  const plan: PlanData = {
    sessionId: 'amber-harbor',
    name: 'Fall rec soccer practice',
    weekdays: [4, 5, 6],
    startDate: '2025-09-04',
    weekCount: 6,
    startHour: 18,
    endHour: 20,
    timezone: 'America/Chicago',
    participantCount: 1,
  }

  function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  it('should render an empty grid once availability loads', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [false, false, false],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('should PATCH the painted cell on pointer up', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [false, false, false],
        [false, false, false],
      ],
      overrides: {},
    })
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, false, false],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: [{ hourIndex: 0, dayIndex: 0, value: true }],
        resetToPattern: false,
      }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/plan/painting`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `src/components/plan/painting/grid.tsx`**

```tsx
import React from 'react'

import { usePaintGesture } from '@hooks/usePaintGesture'
import { AvailabilityCell } from '@types'

export interface PaintGridProps {
  hourLabels: string[]
  dayLabels: string[]
  grid: boolean[][]
  onCommit: (cells: AvailabilityCell[]) => void
}

const PaintGrid = ({ hourLabels, dayLabels, grid, onCommit }: PaintGridProps): React.ReactNode => {
  const gesture = usePaintGesture(grid, onCommit)

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `2.5rem repeat(${dayLabels.length}, 1fr)` }}
      onPointerUp={gesture.endPaint}
      onPointerLeave={gesture.endPaint}
    >
      <div />
      {dayLabels.map((label) => (
        <div className="text-center text-xs font-semibold" key={label}>
          {label}
        </div>
      ))}
      {hourLabels.map((hourLabel, hourIndex) => (
        <React.Fragment key={hourLabel}>
          <div className="text-right text-xs text-[#6B7280]">{hourLabel}</div>
          {dayLabels.map((_, dayIndex) => {
            const on = gesture.isOn(hourIndex, dayIndex)
            return (
              <button
                aria-label={`${hourLabel}, ${dayLabels[dayIndex]}`}
                aria-pressed={on}
                className={`h-8 rounded ${on ? 'bg-[#F59E0B]' : 'bg-white/10'}`}
                key={dayIndex}
                onPointerDown={() => gesture.startPaint(hourIndex, dayIndex)}
                onPointerEnter={() => gesture.continuePaint(hourIndex, dayIndex)}
                type="button"
              />
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}

export default PaintGrid
```

- [ ] **Step 4: Implement `src/components/plan/painting/elements.tsx`**

```tsx
import React from 'react'

export const Toolbar = ({ onAllDay, onClear }: { onAllDay: () => void; onClear: () => void }): React.ReactNode => (
  <div className="flex gap-2">
    <button className="rounded-full border px-3 py-1 text-xs" onClick={onAllDay} type="button">
      All day
    </button>
    <button className="rounded-full border px-3 py-1 text-xs" onClick={onClear} type="button">
      Clear
    </button>
  </div>
)

export const CalendarToggle = ({
  connected,
  onToggle,
}: {
  connected: boolean
  onToggle: (value: boolean) => void
}): React.ReactNode => (
  <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 text-sm">
    <span>Google Calendar connected</span>
    <input checked={connected} onChange={(e) => onToggle(e.target.checked)} type="checkbox" />
  </label>
)
```

- [ ] **Step 5: Implement `src/components/plan/painting/index.tsx`**

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { CalendarToggle, Toolbar } from './elements'
import PaintGrid from './grid'
import { fetchAvailability, patchAvailability } from '@services/api'
import { AvailabilityCell, AvailabilityRecord, PlanData } from '@types'

export interface PaintingPhaseProps {
  sessionId: string
  userId: string
  plan: PlanData
}

const hourLabel = (hour: number): string => {
  const hr = hour % 12 === 0 ? 12 : hour % 12
  return `${hr}${hour < 12 ? 'a' : 'p'}`
}
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PaintingPhase = ({ sessionId, userId, plan }: PaintingPhaseProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const queryKey = ['availability', sessionId, userId]

  const { data: availability } = useQuery<AvailabilityRecord>({
    queryKey,
    queryFn: () => fetchAvailability(sessionId, userId),
  })

  const handleCommit = async (cells: AvailabilityCell[]): Promise<void> => {
    const updated = await patchAvailability(sessionId, userId, { weekIndex: null, cells, resetToPattern: false })
    queryClient.setQueryData(queryKey, updated)
  }

  if (!availability) return null

  const hourLabels = Array.from({ length: plan.endHour - plan.startHour }, (_, i) => hourLabel(plan.startHour + i))
  const dayLabels = plan.weekdays.map((d) => DAY_NAMES[d])

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        onAllDay={() => handleCommit(allCells(hourLabels.length, dayLabels.length, true))}
        onClear={() => handleCommit(allCells(hourLabels.length, dayLabels.length, false))}
      />
      <PaintGrid dayLabels={dayLabels} grid={availability.template} hourLabels={hourLabels} onCommit={handleCommit} />
      <CalendarToggle connected={availability.calendarConnected ?? false} onToggle={() => {}} />
    </div>
  )
}

function allCells(hourCount: number, dayCount: number, value: boolean): AvailabilityCell[] {
  const cells: AvailabilityCell[] = []
  for (let h = 0; h < hourCount; h++) {
    for (let d = 0; d < dayCount; d++) {
      cells.push({ hourIndex: h, dayIndex: d, value })
    }
  }
  return cells
}

export default PaintingPhase
```

Note: `AvailabilityRecord` doesn't currently have a `calendarConnected` field (Task 2's type
doesn't include one, and neither does the API's Plan A). The `CalendarToggle`'s `onToggle` is a
no-op stub here — real calendar connect/disconnect depends on the API's Plan C, which hasn't
shipped. Flag this explicitly to the section's devil's-advocate reviewer rather than silently
wiring a toggle that does nothing: either stub the whole toggle out behind a "coming soon" state,
or leave it wired-but-inert with a comment, but don't ship something that looks interactive and
isn't — that is precisely the kind of thing a UX review should catch, so raise it rather than
pre-deciding it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/components/plan/painting`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/plan/painting src/hooks/usePaintGesture.ts src/hooks/usePaintGesture.test.ts
git commit -m "feat: add painting phase with drag-to-paint availability grid"
```

---

**→ End of Section 4. Dispatch the devil's-advocate review over Tasks 7-8's diff. Single pass.**

---

### Task 9: Results phase

**Files:**

- Create: `src/components/plan/results/index.tsx`, `src/components/plan/results/elements.tsx`
- Test: `src/components/plan/results/index.test.tsx`

**Interfaces:**

- Consumes: `fetchOverlap`, `OverlapResponse` (Task 3)
- Produces: `ResultsPhase` component — `{ sessionId, plan }` props

- [ ] **Step 1: Write the failing test**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import ResultsPhase from './index'
import { fetchOverlap } from '@services/api'
import { PlanData } from '@types'

jest.mock('@services/api')

describe('ResultsPhase', () => {
  const plan: PlanData = {
    sessionId: 'amber-harbor',
    name: 'Fall rec soccer practice',
    weekdays: [4, 5, 6],
    startDate: '2025-09-04',
    weekCount: 6,
    startHour: 18,
    endHour: 20,
    timezone: 'America/Chicago',
    participantCount: 3,
  }

  const overlapResponse = {
    mode: 'pattern' as const,
    weekIndex: null,
    grid: {
      cells: [[{ hourIndex: 0, dayIndex: 1, freeCount: 3, freeUserIds: ['a', 'b', 'c'] }]],
      bestSlot: { hourIndex: 0, dayIndex: 1, freeCount: 3 },
    },
    exceptions: [],
  }

  function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  it('should show the best slot from the pattern view by default', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByText(/3 of 3/i)).toBeInTheDocument()
    expect(fetchOverlap).toHaveBeenCalledWith('amber-harbor', 'pattern')
  })

  it('should refetch a specific week when the By-week tab is selected', async () => {
    jest.mocked(fetchOverlap).mockResolvedValue(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)
    await screen.findByText(/3 of 3/i)
    await userEvent.click(screen.getByRole('tab', { name: /by week/i }))

    await waitFor(() => expect(fetchOverlap).toHaveBeenCalledWith('amber-harbor', 0))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/plan/results`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `src/components/plan/results/elements.tsx`**

```tsx
import { Tab, TabList, TabPanel, Tabs } from '@heroui/react'
import React from 'react'

export const ModeTabs = ({
  mode,
  onChange,
}: {
  mode: 'pattern' | 'week'
  onChange: (mode: 'pattern' | 'week') => void
}): React.ReactNode => (
  <Tabs onSelectionChange={(key) => onChange(key as 'pattern' | 'week')} selectedKey={mode}>
    <TabList>
      <Tab id="pattern">Pattern</Tab>
      <Tab id="week">By week</Tab>
    </TabList>
    <TabPanel id="pattern" />
    <TabPanel id="week" />
  </Tabs>
)

export const BestSlotBanner = ({
  label,
  freeCount,
  total,
}: {
  label: string
  freeCount: number
  total: number
}): React.ReactNode => (
  <div className="flex items-center justify-between rounded-2xl bg-black/80 p-4 text-white">
    <div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs opacity-60">
        {freeCount} of {total} free
      </div>
    </div>
  </div>
)

export const ExceptionsList = ({ exceptions }: { exceptions: string[] }): React.ReactNode =>
  exceptions.length === 0 ? null : (
    <ul className="flex flex-col gap-1 text-xs text-[#6B7280]">
      {exceptions.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  )
```

- [ ] **Step 4: Implement `src/components/plan/results/index.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { BestSlotBanner, ExceptionsList, ModeTabs } from './elements'
import { fetchOverlap } from '@services/api'
import { OverlapResponse, PlanData } from '@types'

export interface ResultsPhaseProps {
  sessionId: string
  plan: PlanData
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const hourLabelFull = (hour: number): string => {
  const hr = hour % 12 === 0 ? 12 : hour % 12
  return `${hr}:00 ${hour < 12 ? 'AM' : 'PM'}`
}

const ResultsPhase = ({ sessionId, plan }: ResultsPhaseProps): React.ReactNode => {
  const [mode, setMode] = useState<'pattern' | 'week'>('pattern')
  const [week, setWeek] = useState(0)

  const { data } = useQuery<OverlapResponse>({
    queryKey: ['overlap', sessionId, mode, mode === 'week' ? week : null],
    queryFn: () => fetchOverlap(sessionId, mode === 'pattern' ? 'pattern' : week),
  })

  if (!data) return null

  const { bestSlot } = data.grid
  const label = `${DAY_NAMES[plan.weekdays[bestSlot.dayIndex]]} ${hourLabelFull(plan.startHour + bestSlot.hourIndex)}`

  return (
    <div className="flex flex-col gap-4">
      <ModeTabs
        mode={mode}
        onChange={(next) => {
          setMode(next)
          if (next === 'week') setWeek(0)
        }}
      />
      <BestSlotBanner freeCount={bestSlot.freeCount} label={label} total={plan.participantCount} />
      <ExceptionsList exceptions={data.exceptions.map((e) => e.description)} />
    </div>
  )
}

export default ResultsPhase
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/components/plan/results`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/plan/results
git commit -m "feat: add results phase with pattern/by-week overlap tabs"
```

---

### Task 10: Share component

**Files:**

- Modify: `src/components/share/index.tsx`, `test/components/share.test.tsx` (this component's
  real test location — not colocated; see Global Constraints)

**Interfaces:**

- Consumes: `shareSession` (unchanged signature from Task 3)

- [ ] **Step 1: Update the failing assertion first**

`test/components/share.test.tsx` has one assertion tied to the old route
(`expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining(`/s/${sessionId}`))`) — change
`/s/` to `/p/` there. Everything else in this test (the copy-URL flow, the SMS invite gate) is
domain-agnostic and stays as-is.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/components/share.test.tsx`
Expected: FAIL — component still builds the URL with `/s/`

- [ ] **Step 3: Update the route in `src/components/share/index.tsx`**

Change `` `${...}/s/${sessionId}` `` to `` `${...}/p/${sessionId}` ``. Nothing else in this
component changes (QR code, copy button, SMS gate are all domain-agnostic).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/components/share.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/share test/components/share.test.tsx
git commit -m "feat: update share link to /p/ route"
```

---

**→ End of Section 5. Dispatch the devil's-advocate review over Tasks 9-10's diff. Single pass.**

---

### Task 11: Phase machine

**Files:**

- Create: `src/components/plan/index.tsx`, `src/components/plan/helpers.ts`
- Test: `src/components/plan/index.test.tsx`
- Delete: `src/components/session/index.tsx`, `src/components/session/helpers.ts`,
  `src/components/session/elements.tsx`, `src/components/session/loading/` (orphaned once Task 5
  removed its only other consumer, `session-create`'s `LoadingCard`)
- Delete (legacy top-level tests — see Global Constraints): `test/components/session-helpers.test.ts`,
  `test/components/session-loading.test.tsx`
- (`src/components/session/index.test.tsx` and `test/components/session.test.tsx` were already
  deleted in Task 1, Step 4 — that task had to stub `session/index.tsx`'s dangling
  voting/waiting/winner imports early to keep the pre-commit hook's `jest --findRelatedTests`
  green, and deleted their now-inapplicable tests at the same time. Don't try to re-delete them
  here — `git rm` on an already-gone path just errors.)

**Interfaces:**

- Consumes: `IdentityPhase` (Task 4), `PaintingPhase` (Task 8), `ResultsPhase` (Task 9),
  `fetchPlan`, `fetchUsers` (Task 3)
- Produces: `Plan` component — `{ sessionId }` props, same as today's `Session` — Task 12 mounts it

Resolves the tabs-vs-linear question flagged in the overview doc: `painting` and `results` are
both always reachable once identity is established — a tab switch inside one "active" phase, not
a one-way linear transition. `derivePhase` only needs to decide `loading` / `error` /
`identity` / `active`; which of painting/results shows within `active` is separate UI state (the
user can flip between them), not a phase.

- [ ] **Step 1: Write the failing test**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import Plan from './index'
import { fetchPlan, fetchUsers } from '@services/api'

jest.mock('@services/api')
jest.mock('@hooks/useSessionCookie', () => ({ useSessionCookie: () => ({ userId: undefined, setUserId: jest.fn() }) }))
jest.mock('@components/auth-context', () => ({ useAuthContext: () => ({ isSignedIn: false, isLoading: false }) }))

describe('Plan', () => {
  function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  it('should show the identity phase once the plan and empty user list load', async () => {
    jest.mocked(fetchPlan).mockResolvedValueOnce({
      sessionId: 'amber-harbor',
      name: 'Fall rec soccer practice',
      weekdays: [4, 5, 6],
      startDate: '2025-09-04',
      weekCount: 6,
      startHour: 18,
      endHour: 20,
      timezone: 'America/Chicago',
      participantCount: 0,
    })
    jest.mocked(fetchUsers).mockResolvedValueOnce([])

    renderWithClient(<Plan sessionId="amber-harbor" />)

    expect(await screen.findByText('Fall rec soccer practice')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/plan/index.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `src/components/plan/helpers.ts`**

```ts
import { PlanData, User } from '@types'

export type Phase = 'loading' | 'error' | 'identity' | 'active'

export function derivePhase(plan: PlanData | undefined, usersLoaded: boolean, userIdentified: boolean): Phase {
  if (!plan) return 'loading'
  if (!usersLoaded) return 'loading'
  if (!userIdentified) return 'identity'
  return 'active'
}
```

- [ ] **Step 4: Implement `src/components/plan/index.tsx`**

Base the `?id=` query-param consumption, cookie resolution, and refetch-interval shape directly on
today's `src/components/session/index.tsx` — that plumbing is unchanged; only the phase enum and
what's rendered per phase differs:

```tsx
import { useQuery } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'

import { derivePhase } from './helpers'
import IdentityPhase from './identity'
import PaintingPhase from './painting'
import ResultsPhase from './results'
import ErrorBoundary from '@components/error-boundary'
import { useSessionCookie } from '@hooks/useSessionCookie'
import { fetchPlan, fetchUsers } from '@services/api'
import { PlanData, User } from '@types'

function consumeQueryParamId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id') ?? undefined
  if (id) {
    params.delete('id')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }
  return id
}

export interface PlanProps {
  sessionId: string
}

const PlanComponent = ({ sessionId }: PlanProps): React.ReactNode => {
  const { userId, setUserId } = useSessionCookie(sessionId)
  const queryParamId = useMemo(() => consumeQueryParamId(), [])
  const [tab, setTab] = useState<'painting' | 'results'>('painting')

  const { data: plan } = useQuery<PlanData>({ queryKey: ['plan', sessionId], queryFn: () => fetchPlan(sessionId) })
  const { data: users } = useQuery<User[]>({ queryKey: ['users', sessionId], queryFn: () => fetchUsers(sessionId) })

  const usersLoaded = users !== undefined
  const effectiveUserId = useMemo(() => {
    if (!users) return undefined
    if (queryParamId && users.some((u) => u.userId === queryParamId)) return queryParamId
    if (userId && users.some((u) => u.userId === userId)) return userId
    return undefined
  }, [queryParamId, userId, users])

  const phase = derivePhase(plan, usersLoaded, effectiveUserId != null)

  if (phase === 'loading' || !plan) return null
  if (phase === 'identity') {
    return <IdentityPhase onUserSelected={setUserId} sessionId={sessionId} users={users ?? []} />
  }

  return (
    <div>
      <h1>{plan.name}</h1>
      <div role="tablist">
        <button aria-selected={tab === 'painting'} onClick={() => setTab('painting')} role="tab">
          Your hours
        </button>
        <button aria-selected={tab === 'results'} onClick={() => setTab('results')} role="tab">
          The overlap
        </button>
      </div>
      {tab === 'painting' ? (
        <PaintingPhase plan={plan} sessionId={sessionId} userId={effectiveUserId as string} />
      ) : (
        <ResultsPhase plan={plan} sessionId={sessionId} />
      )}
    </div>
  )
}

const PlanWithErrorBoundary = ({ sessionId }: PlanProps): React.ReactNode => (
  <ErrorBoundary>
    <PlanComponent sessionId={sessionId} />
  </ErrorBoundary>
)

export default PlanWithErrorBoundary
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/components/plan/index.test.tsx`
Expected: PASS

- [ ] **Step 6: Delete the old session phase-machine component**

```bash
git rm -r src/components/session/index.tsx src/components/session/helpers.ts \
  src/components/session/elements.tsx src/components/session/loading
git rm test/components/session-helpers.test.ts test/components/session-loading.test.tsx
```

(`src/components/session/index.test.tsx` and `test/components/session.test.tsx` are already gone
— deleted in Task 1, Step 4.)

`src/components/session/` should now be empty (`user-select/`, `voting/`, `waiting/`, `winner/`
were removed in Tasks 1 and 4) — remove the directory too if so.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: replace bracket phase machine with plan phase machine (identity/painting/results)"
```

---

### Task 12: Page routing

**Files:**

- Create: `src/pages/p/[sessionId]/index.tsx`, `test/pages/p/[sessionId]/index.test.tsx`
- Delete: `src/pages/s/[sessionId]/index.tsx`, `test/pages/s/[sessionId]/index.test.tsx`

**Interfaces:**

- Consumes: `Plan` (Task 11)

- [ ] **Step 1: Write the failing test at the new location**

Adapted from `test/pages/s/[sessionId]/index.test.tsx`, updated for the new route/component and
brought onto this repo's current `CLAUDE.md` convention (named `setup()`, no `beforeEach`):

```tsx
import PlanPage, { getStaticPaths, getStaticProps } from '@pages/p/[sessionId]/index'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'
import Plan from '@components/plan'
import PrivacyLink from '@components/privacy-link'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-link')
jest.mock('@components/plan')

describe('Plan page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<>AppBar</>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
    jest.mocked(Plan).mockReturnValue(<></>)
  })

  function setup(pathname: string): void {
    Object.defineProperty(window, 'location', { value: { pathname }, writable: true })
  }

  it('should render AppBar', () => {
    setup('/p/amber-harbor/')
    render(<PlanPage />)
    expect(AppBar).toHaveBeenCalled()
  })

  it('should render PrivacyLink', () => {
    setup('/p/amber-harbor/')
    render(<PlanPage />)
    expect(PrivacyLink).toHaveBeenCalled()
  })

  it('should render Plan with sessionId from pathname', () => {
    setup('/p/amber-harbor/')
    render(<PlanPage />)
    expect(Plan).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'amber-harbor' }), undefined)
  })

  it('should not render Plan when pathname has no sessionId', () => {
    setup('/')
    render(<PlanPage />)
    expect(Plan).not.toHaveBeenCalled()
  })

  it('should return blocking fallback with empty paths in development', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
    expect(getStaticPaths({})).toEqual({ fallback: 'blocking', paths: [] })
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
  })

  it('should return placeholder path in production', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
    expect(getStaticPaths({})).toEqual({ fallback: false, paths: [{ params: { sessionId: '__placeholder__' } }] })
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
  })

  it('should return empty props from getStaticProps', async () => {
    expect(await getStaticProps({} as any)).toEqual({ props: {} })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "test/pages/p/\[sessionId\]/index.test.tsx"`
Expected: FAIL — `src/pages/p/[sessionId]/index.tsx` doesn't exist yet

- [ ] **Step 3: Create `src/pages/p/[sessionId]/index.tsx`**

Copy today's `src/pages/s/[sessionId]/index.tsx` structure, changing: the path-match regex to
`/^\/p\/([^/]+)/`, the import/render to `Plan` instead of `Session`, and the page title to
`Pick a Time`:

```tsx
import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import React, { useEffect, useState } from 'react'

import AppBar from '@components/app-bar'
import Plan from '@components/plan'
import PrivacyLink from '@components/privacy-link'

function useSessionIdFromPath(): string | undefined {
  const [sessionId, setSessionId] = useState<string | undefined>()
  useEffect(() => {
    const match = window.location.pathname.match(/^\/p\/([^/]+)/)
    if (match) setSessionId(decodeURIComponent(match[1]))
  }, [])
  return sessionId
}

const PlanPage = (): React.ReactNode => {
  const sessionId = useSessionIdFromPath()

  return (
    <>
      <Head>
        <title>Pick a Time</title>
      </Head>
      <AppBar />
      <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-4 py-6">
        <div className="flex-1">{sessionId ? <Plan sessionId={sessionId} /> : null}</div>
        <PrivacyLink />
      </main>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = () => {
  if (process.env.NODE_ENV === 'development') {
    return { fallback: 'blocking', paths: [] }
  }
  return { fallback: false, paths: [{ params: { sessionId: '__placeholder__' } }] }
}

export const getStaticProps: GetStaticProps = () => ({ props: {} })

export default PlanPage
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "test/pages/p/\[sessionId\]/index.test.tsx"`
Expected: PASS

- [ ] **Step 5: Delete the old route and its test**

```bash
git rm -r src/pages/s test/pages/s
```

- [ ] **Step 6: Manually verify**

Run: `npm start`, visit `/p/<some-id>` and confirm the page loads (will 404 against a real API
until `pick-a-time-api`'s Plan A is deployed — that's expected; confirm the Next.js routing itself
resolves, which is what this task delivers).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: move plan route from /s/{id} to /p/{id}"
```

---

### Task 13: Dependency cleanup + final verification

**Files:**

- Modify: `package.json`

**Interfaces:** None — cleanup only.

- [ ] **Step 1: Remove now-unused dependencies**

```bash
npm uninstall embla-carousel-react embla-carousel-autoplay
```

- [ ] **Step 2: Run the full verification suite**

```bash
npm run typecheck
npm test
npm run lint
```

Expected: all green. Fix anything that surfaces — a full-repo `typecheck`/`test` pass is the real
gate here, not any individual task's narrower run.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused restaurant-carousel dependencies"
```

---

**→ End of Section 6 and of the plan. Dispatch the devil's-advocate review over the ENTIRE branch
diff (all 13 tasks). This final review may run a second time (fix, then re-review) if it finds
concerns — maximum 2 total runs of this final review, stop at 1 if it finds nothing.**
