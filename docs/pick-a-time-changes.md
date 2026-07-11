# Pick a Time — what changes in this UI

This repo currently is Choosee UI: a Next.js (Pages Router) front end for a restaurant-bracket-
voting app. We're repurposing it into the UI for Pick a Time at `pick-a-time.com`: a recurring,
multi-week group-availability scheduler. Most of the plumbing survives — Amplify/Cognito auth,
TanStack Query polling, cookie-based anonymous identity, the phase-driven session component
shape. The domain (restaurant search, brackets, voting, winners) does not.

This mirrors `pick-a-time-api/docs/pick-a-time-changes.md` — read that first if you haven't; the
client types below are the wire shapes that API defines, duplicated here the same way `SessionData`/
`User` are already duplicated client-side today rather than imported from the API repo.

## Core principle: the server is the source of truth

Same rule as the API side, restated because it's a UI architecture constraint, not just a backend
one: this UI never computes overlap, pattern aggregation, best-slot selection, or "who's busy."
It renders what `GET /sessions/{id}/overlap` returns. The one place local state is legitimate is
**in-flight paint-gesture feedback** — while a user is mid-drag on the availability grid, the
client shows the stroke locally (an API round-trip per cell crossed during a drag isn't viable).
The moment the gesture ends, it PATCHes the resulting cells and reconciles its display to
whatever the server returns — never to its own optimistic guess.

## What transfers as-is

- **Next.js Pages Router**, the overall `_app.tsx`/`_document.tsx`/error-page (`400`/`403`/`404`/`500`)
  shell, `AppBar`, `PrivacyLink`, `PrivacyPolicy`, `ErrorBoundary`, `FeedbackMessage`,
  `GoogleIcon`/`GoogleLogo`.
- **Amplify + Cognito Google sign-in** (`src/config/amplify.ts`, `src/hooks/useAuth.ts`) —
  completely unchanged. Same `signInWithRedirect({ provider: 'Google' })` flow, same `Hub.listen`
  pattern, same ID-token claims (`name`, `phone_number`). This is sign-in identity only — see the
  API doc for why Calendar access needs a second, separate OAuth grant that this hook doesn't
  cover.
- **Cookie-based anonymous identity** (`src/hooks/useSessionCookie.ts`) — same shape (`js-cookie`,
  path-scoped to the session, 1-day expiry), just rename the cookie prefix from `choosee_user_`
  to something plan-scoped (e.g. `pat_user_`).
- **The phase-driven page-component shape** `src/components/session/index.tsx` uses
  (`derivePhase` switching over a state machine, `useQuery` with a phase-dependent
  `refetchInterval`, resolving the effective user from `?id=` query param → cookie → none) — the
  exact pattern Plan A's UI page reuses, just with different phases (see below).
- **`aws-amplify/api` REST helpers** in `src/services/api.ts` (`apiGet`/`apiPost`/`apiPatch`,
  `authHeaders`, the authenticated/unauthenticated dual-endpoint-name split matching the API's
  `/authed`-suffixed route pattern) — the plumbing stays; only the endpoint list changes.
- **reCAPTCHA v3 invisible flow** (`waitForRecaptcha`, `grecaptcha.execute(...)` in
  `session-create/index.tsx`) — reuse verbatim for plan creation, same as today's session
  creation.
- **`qrcode.react`** — already a dependency. The storybook mockup drew a fake CSS QR pattern for
  the share scene because artifacts can't hit real libraries; the real build should render an
  actual QR code from the plan's share link.
- **`framer-motion`** — already a dependency, unused by the mockup (the mockup used plain CSS
  transitions because artifacts are self-contained files). Available if any of the mockup's
  motion — the nav's traveling sun, the "stamp" propagation animation, scroll reveals — turns out
  to want richer choreography than CSS handles cleanly. Not a requirement to use it everywhere;
  plain CSS transitions are fine where they're fine.
- **`@fontsource-variable/outfit`, `@fontsource/bebas-neue`** — already self-hosted font packages.
  The mockup used system font stacks because Artifacts can't load font files. The real build can
  use actual display faces instead — worth revisiting the mockup's serif choice against what's
  already installed here rather than adding a third font package.
- **`fast-json-patch`** stays for the `/name`/`/phone` user patch (still RFC 6902-shaped on the
  wire per the API's Task 8) but is *not* used for availability — see below.

## What gets removed (restaurant/bracket domain)

- Components: `bracket-view`, `restaurant-card` (+ `elements`/tests), `photo-carousel`
  (`embla-carousel-*` becomes an unused dependency), the restaurant-specific pieces of
  `session-create/elements.tsx` (`AddressField`, `MultiSelect`, `DistanceSlider`,
  `MaxChoicesSlider`, `SortByFieldset`, `FilterClosingSoonToggle`, `UseMyLocationButton`,
  `VoteCountHint`), `session/voting`, `session/waiting`, `session/winner`
- `src/utils/bracket.ts`, `src/utils/hours.ts` (restaurant open-hours logic)
- `src/assets/images/*` (restaurant screenshots), `src/utils/session.ts`'s `isClosingSoonError`
- Types: `PriceLevel`, `PlaceTypeDisplay`, `ChoiceDetail`, `ChoicesMap`, `SortOption`,
  `RadiusConfig`, the places-related fields of `SessionConfig`, old `NewSessionRequest`
- `fetchAddress`, `fetchSessionConfig`, `fetchChoices`, `closeRound`, `subscribeToRound` from
  `src/services/api.ts`

## New client-side types (mirrors the API's wire shapes)

```ts
// was SessionData
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

// User loses votes/subscribedRounds — same shape as the API's slimmed UserRecord
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

// NOT JSON Patch — matches the API's purpose-built AvailabilityPatchInput (Plan A, Task 11)
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

## New pages

| Route | Was | Now |
|---|---|---|
| `/` (`src/pages/index.tsx`) | Restaurant search hero + `SessionCreate` | Hero + `PlanCreate`: plan name, weekday picker, week-count stepper, hour-range slider — the actual fields from storybook scene 2 |
| `/p/[sessionId]` (was `/s/[sessionId]`) | `Session` phase machine: loading → error → winner → user-select → voting → waiting | `Plan` phase machine: loading → error → identity → painting → results (see below) |
| `/auth/callback`, `400`/`403`/`404`/`500` | — | unchanged |

The URL prefix change (`/s/` → `/p/`) matches the share-link format already designed in the
storybook mockup (`pick-a-time.com/p/amber-harbor`) — confirm this against whatever routing
`pick-a-time.com`'s DNS/hosting actually expects before locking it in.

### Phase mapping (`src/components/session/index.tsx` → `src/components/plan/index.tsx`)

| Old phase | New phase | Old component | New component, modeled on storybook scene |
|---|---|---|---|
| `user-select` | `identity` | `UserSelectPhase` | Near-identical shape — pick an existing name from the list or create new; add the "Continue with Google" secondary action and the calendar-sync consent copy from storybook scene 3 |
| `voting` | `painting` | `VotingPhase` (bracket matchups) | New: the drag-to-paint grid, week strip with override dots, the Google Calendar auto-block toggle, from storybook scene 4 |
| `waiting` + `winner` | `results` | `WaitingPhase`/`WinnerPhase` | New: Pattern/By-week tabs, the heatmap, best-slot banner, exceptions list, from storybook scene 5 — merges what used to be two separate phases, since there's no single terminal "winner" moment, just an always-current computed result |

`derivePhase`'s shape (a pure function of plan/user/data-loaded state, switched over in one
`renderPhase`) is worth keeping exactly as-is — it's a clean pattern, just re-derive the phase enum
and its transition conditions for the new domain (e.g. `painting` vs `results` isn't about "have I
voted yet," it's more likely just always-available tabs the user can move between, which may mean
this stops being a strict linear phase machine — see Open Questions).

## New hooks

- `useSessionCookie` — reused, rename the cookie key prefix
- `useAuth` — reused unchanged
- New: something like `usePaintGesture` — owns the local in-flight grid state during a drag,
  batches the touched cells, and fires one `patchAvailability` call on pointer-up, reconciling to
  the response per the Core Principle above. This is the client-side home for the storybook
  mockup's `setPaintCell`/pointer-capture logic, rebuilt as a real hook instead of inline vanilla
  JS.

## `services/api.ts` — new surface

```ts
export const createPlan = (plan: NewPlanRequest, token: string): Promise<{ sessionId: string }> => ...
export const fetchPlan = (sessionId: string): Promise<PlanData> => ...
export const fetchUsers = (sessionId: string): Promise<User[]> => ...
export const createUser = (sessionId: string, authenticated: boolean): Promise<User> => ... // unchanged shape
export const patchUser = (sessionId: string, userId: string, ops: PatchOperation[], authenticated: boolean): Promise<User> => ... // unchanged shape
export const fetchAvailability = (sessionId: string, userId: string): Promise<AvailabilityRecord> => ...
export const patchAvailability = (sessionId: string, userId: string, body: AvailabilityPatchRequest): Promise<AvailabilityRecord> => ...
export const fetchOverlap = (sessionId: string, week: 'pattern' | number): Promise<OverlapResponse> => ... // Plan B — stub until that API plan ships
export const shareSession = (sessionId: string, userId: string, phone: string): Promise<ShareResult> => ... // unchanged, just copy text differs
```

`createUser`'s existing authed-with-401-retry-then-fallback-to-unauthenticated logic (lines 95-131
of today's `api.ts`) is exactly right for the new domain too — carry it over unmodified.

## Open questions

- **Is `painting`/`results` actually a linear phase, or two tabs the user freely switches
  between?** The old app's `voting` → `waiting` was a one-way door (you vote, then you wait). This
  app's core pitch is "watch the answer update live as more people paint" — that argues for
  `painting` and `results` being simultaneously reachable (a tab switch, not a phase transition),
  which changes `derivePhase`'s shape more than the table above implies. Decide before building
  the phase machine, not after.
- **Shared types with the API repo.** Both repos will hand-duplicate `PlanData`/`User`/
  `AvailabilityRecord` the same way `SessionData`/`User` are duplicated today. Fine for now (matches
  existing convention), but worth a conscious "not yet" rather than an accident, given how easy
  these two copies are to let drift.
- **Icon set.** `lucide-react` is already a dependency and used today (see `pages/index.tsx`'s
  `Utensils` icon). Decide whether Pick a Time keeps it or swaps to something else — not required,
  just flagging that it's an existing choice, not a foregone one.
- **How literally to port the storybook's day-arc visual system.** The mockup's scroll-driven
  dawn→noon→dusk background and the "meridian" framing were a marketing/pitch treatment for a
  single scrolling page, not necessarily the visual language of the actual multi-page app UI (the
  create-plan form, the join screen, the painting screen are each their own page here, not scenes
  in one scroll). Decide how much of that identity (the gold/indigo palette, the serif numerals,
  the phone-frame aesthetic) carries into the real component library versus was pitch-specific
  staging.
- **`getStaticPaths`/`getStaticProps` on `/p/[sessionId]`** currently returns a placeholder path
  and relies on `fallback: 'blocking'` in dev / `fallback: false` in production with a build-time
  placeholder — confirm this static-export strategy (this app exports to `out/` per
  `next-export-optimize-images` in `package.json`) still fits a page that now polls two additional
  resources (availability, overlap) instead of one.
