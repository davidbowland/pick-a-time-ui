import { RECENT_POLLS_KEY, defaultStorage, readStore, writeStore } from '@hooks/useRecentPolls'

// The keys `usePollOnboarding` wrote before onboarding state moved into `pat_recent_polls`
// (ADR-4). They hold the literal string 'true' and record no expiration, so they cannot be
// selectively pruned — they are swept wholesale, once.
export const LEGACY_ONBOARDING_PREFIX = 'pat_onboarded_'

// Matched with an anchored `startsWith` and nothing looser. `pat_recent_polls` lives in the same
// `pat_` namespace, and a loose match would delete it along with every `userId` re-entry depends
// on (AC-015) — unrecoverable, since the identity cookie is path-scoped to `/p/{sessionId}` and
// cannot be read from `/` to back-fill it.
const isLegacyKey = (key: string | null): key is string => key !== null && key.startsWith(LEGACY_ONBOARDING_PREFIX)

// Collects every match BEFORE anything is removed. `removeItem` re-indexes localStorage, so
// deleting inside an ascending `key(i)` walk skips the very next match — and because the sweep is
// one-shot, the keys it skipped would never be swept again.
export const collectLegacyKeys = (storage: Storage): string[] =>
  Array.from({ length: storage.length }, (_unused, index) => storage.key(index)).filter(isLegacyKey)

/**
 * Removes the legacy `pat_onboarded_*` keys once per device (AC-029). Returns whether this call
 * performed the sweep.
 */
export const runRecentPollsMigration = (storage: Storage | undefined = defaultStorage()): boolean => {
  if (!storage) return false

  // Distinguish "nothing stored" from "could not read what is stored". readStore collapses both
  // to EMPTY_STORE, and writing on the second clobbers a real store -- while also setting the
  // one-shot flag, so it would never retry. A transient read failure would permanently empty the
  // list. Bail instead; the next load tries again.
  let raw: string | null = null
  try {
    raw = storage.getItem(RECENT_POLLS_KEY)
  } catch {
    return false
  }
  if (raw !== null) {
    try {
      JSON.parse(raw)
    } catch {
      return false
    }
  }

  const store = readStore(storage)
  if (store.migrated) return false

  try {
    collectLegacyKeys(storage).forEach((key) => storage.removeItem(key))
  } catch {
    // Storage threw part-way through. The flag stays unset so the next load retries, and the page
    // is never taken down by it (AC-018).
    return false
  }

  writeStore(storage, { migrated: true, polls: store.polls })
  return true
}
