import { useCallback, useState } from 'react'

// One root-scoped key (ADR-3). It cannot be derived from anything already on the device:
// `pat_user_{sessionId}` is path-scoped to `/p/{sessionId}` (src/hooks/useSessionCookie.ts:8-10)
// and is invisible from `/`, so nothing here can be back-filled once it is gone.
export const RECENT_POLLS_KEY = 'pat_recent_polls'

export interface RecentPoll {
  // The server's own `PollData.expiration` (src/types.ts:36), in epoch SECONDS — copied, never
  // computed. A computed TTL would drift from the server-side deletion the privacy policy
  // promises, which is the one thing this field exists to stay tied to (AC-016).
  expiration: number
  // Epoch milliseconds, for ordering only.
  lastSeen: number
  // The visitor's OWN display name. No other participant's name and no availability is stored,
  // because `sessionId` is an unauthenticated read capability (AC-020).
  name: string
  pollName: string
  seenIntro: boolean
  sessionId: string
  userId: string
}

// What a caller supplies on entry; `lastSeen` and `seenIntro` are owned by the store.
export type RecentPollInput = Omit<RecentPoll, 'lastSeen' | 'seenIntro'>

export interface RecentPollsStore {
  // The legacy-key sweep's done flag lives here rather than in a key of its own: a separate
  // marker would be undisclosed in the privacy policy AND itself unprunable, which is the exact
  // defect this run exists to fix.
  migrated: boolean
  polls: RecentPoll[]
}

export interface RecentPolls {
  clear: () => void
  polls: RecentPoll[]
  // How many entries this read dropped, for the prune notice (AC-042). Fixed at mount.
  prunedCount: number
  record: (poll: RecentPollInput) => void
  remove: (sessionId: string) => void
  restore: (poll: RecentPoll) => void
  seenIntro: (sessionId: string) => boolean
  setSeenIntro: (sessionId: string, seen: boolean) => void
}

const EMPTY_STORE: RecentPollsStore = { migrated: false, polls: [] }

// Reading the property itself throws in some private-browsing modes, so even this is guarded.
export const defaultStorage = (): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// seenIntro is deliberately NOT in here. ADR-3 documents the stored entry as six fields, with no
// seenIntro -- that flag arrived later with ADR-4. Requiring it would make toEntry reject every
// entry written to the shape ADR-3 describes, silently emptying the list; the next write would then
// persist that emptiness and destroy the userIds AC-015 depends on, with no back-fill possible.
// It is defaulted below instead.
const ENTRY_TYPES: Record<Exclude<keyof RecentPoll, 'seenIntro'>, string> = {
  expiration: 'number',
  lastSeen: 'number',
  name: 'string',
  pollName: 'string',
  sessionId: 'string',
  userId: 'string',
}

const toEntry = (value: unknown): RecentPoll | undefined => {
  if (!isRecord(value)) return undefined
  if (!Object.entries(ENTRY_TYPES).every(([key, type]) => typeof value[key] === type)) return undefined
  const entry = value as unknown as RecentPoll
  // Rebuilt field by field so nothing a foreign writer added rides along into the next write.
  return {
    expiration: entry.expiration,
    lastSeen: entry.lastSeen,
    name: entry.name,
    pollName: entry.pollName,
    seenIntro: entry.seenIntro === true,
    sessionId: entry.sessionId,
    userId: entry.userId,
  }
}

export const readStore = (storage: Storage | undefined): RecentPollsStore => {
  try {
    const raw = storage?.getItem(RECENT_POLLS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    // ADR-3 describes the value as a bare array; ADR-4 requires the sweep's done flag to live in
    // the same key. The envelope carries both, and a bare array still reads as the list it is.
    const stored = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.polls) ? parsed.polls : []
    return {
      migrated: isRecord(parsed) && parsed.migrated === true,
      polls: stored.map(toEntry).filter((entry): entry is RecentPoll => entry !== undefined),
    }
  } catch {
    // Malformed JSON, or storage that throws on read. The list degrades to empty and the page
    // keeps working (AC-018).
    return EMPTY_STORE
  }
}

export const writeStore = (storage: Storage | undefined, store: RecentPollsStore): void => {
  try {
    storage?.setItem(RECENT_POLLS_KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded, or storage that throws on write. Losing the record is acceptable; taking
    // the page down with it is not (AC-018).
  }
}

// `expiration` is epoch seconds (see `formatExpiration`, src/utils/dates.ts:27-31); `nowMs` is
// epoch milliseconds, as `Date.now` returns.
const isLive = (poll: RecentPoll, nowMs: number): boolean => poll.expiration * 1000 > nowMs

export const prunePolls = (polls: RecentPoll[], nowMs: number): RecentPoll[] =>
  polls.filter((poll) => isLive(poll, nowMs))

const sortedByRecency = (polls: RecentPoll[]): RecentPoll[] => [...polls].sort((a, b) => b.lastSeen - a.lastSeen)

// Every mutation goes through here: it re-reads storage (so a second tab's writes survive),
// prunes, applies the change, and preserves the migration flag it did not author.
const updatePolls = (
  storage: Storage | undefined,
  now: () => number,
  update: (polls: RecentPoll[]) => RecentPoll[],
): RecentPoll[] => {
  const store = readStore(storage)
  const next = sortedByRecency(update(prunePolls(store.polls, now())))
  writeStore(storage, { migrated: store.migrated, polls: next })
  return next
}

const initialRead = (storage: Storage | undefined, now: () => number): { polls: RecentPoll[]; prunedCount: number } => {
  const store = readStore(storage)
  const polls = prunePolls(store.polls, now())
  const prunedCount = store.polls.length - polls.length
  // Pruning is a read that writes: the entry must be gone from storage, not merely unlisted
  // (AC-016, AC-030).
  if (prunedCount > 0) writeStore(storage, { migrated: store.migrated, polls })
  return { polls: sortedByRecency(polls), prunedCount }
}

export const readSeenIntro = (
  sessionId: string,
  storage: Storage | undefined = defaultStorage(),
  now: () => number = Date.now,
): boolean => prunePolls(readStore(storage).polls, now()).some((poll) => poll.sessionId === sessionId && poll.seenIntro)

// A no-op on content when no entry exists yet: entries are written once identity resolves and
// carry the server's `expiration` (ADR-4). Creating one here would mean an onboarding record with
// no expiry — the exact defect the sweep removes.
export const writeSeenIntro = (
  sessionId: string,
  seen: boolean,
  storage: Storage | undefined = defaultStorage(),
  now: () => number = Date.now,
): void => {
  updatePolls(storage, now, (polls) =>
    polls.map((poll) => (poll.sessionId === sessionId ? { ...poll, seenIntro: seen } : poll)),
  )
}

export function useRecentPolls(
  storage: Storage | undefined = defaultStorage(),
  now: () => number = Date.now,
): RecentPolls {
  const [initial] = useState(() => initialRead(storage, now))
  const [polls, setPolls] = useState<RecentPoll[]>(initial.polls)

  const record = useCallback(
    (poll: RecentPollInput): void => {
      setPolls(
        updatePolls(storage, now, (current) => {
          const previous = current.find((existing) => existing.sessionId === poll.sessionId)
          return [
            // Re-entering a poll must not resurface an introduction already dismissed.
            { ...poll, lastSeen: now(), seenIntro: previous?.seenIntro === true },
            ...current.filter((existing) => existing.sessionId !== poll.sessionId),
          ]
        }),
      )
    },
    [now, storage],
  )

  const remove = useCallback(
    (sessionId: string): void => {
      setPolls(updatePolls(storage, now, (current) => current.filter((poll) => poll.sessionId !== sessionId)))
    },
    [now, storage],
  )

  const restore = useCallback(
    (poll: RecentPoll): void => {
      setPolls(
        updatePolls(storage, now, (current) => [
          poll,
          ...current.filter((existing) => existing.sessionId !== poll.sessionId),
        ]),
      )
    },
    [now, storage],
  )

  const clear = useCallback((): void => {
    setPolls(updatePolls(storage, now, () => []))
  }, [now, storage])

  const seenIntro = useCallback((sessionId: string): boolean => readSeenIntro(sessionId, storage, now), [now, storage])

  const setSeenIntro = useCallback(
    (sessionId: string, seen: boolean): void => {
      setPolls(
        updatePolls(storage, now, (current) =>
          current.map((poll) => (poll.sessionId === sessionId ? { ...poll, seenIntro: seen } : poll)),
        ),
      )
    },
    [now, storage],
  )

  return { clear, polls, prunedCount: initial.prunedCount, record, remove, restore, seenIntro, setSeenIntro }
}
