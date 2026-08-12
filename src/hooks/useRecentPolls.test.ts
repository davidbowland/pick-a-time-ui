import { RecentPoll, readSeenIntro, useRecentPolls, writeSeenIntro } from './useRecentPolls'
import { act, renderHook } from '@testing-library/react'

// A wall-clock instant chosen once. `expiration` is epoch SECONDS (the server's own value);
// `lastSeen` and the injected clock are epoch milliseconds.
const NOW_MS = 1_700_000_000_000
const now = (): number => NOW_MS
const LIVE_EXPIRATION = 1_700_086_400 // one day after NOW_MS
const EXPIRED_EXPIRATION = 1_699_913_600 // one day before NOW_MS

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial))
  return {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  } as Storage
}

function throwingStorage(): Storage {
  return {
    clear: () => {
      throw new Error('storage unavailable')
    },
    getItem: () => {
      throw new Error('storage unavailable')
    },
    key: () => {
      throw new Error('storage unavailable')
    },
    length: 0,
    removeItem: () => {
      throw new Error('storage unavailable')
    },
    setItem: () => {
      throw new Error('storage unavailable')
    },
  } as Storage
}

function fullStorage(initial: Record<string, string> = {}): Storage {
  const storage = fakeStorage(initial)
  return {
    ...storage,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  } as Storage
}

function entry(overrides: Partial<RecentPoll> = {}): RecentPoll {
  return {
    expiration: LIVE_EXPIRATION,
    lastSeen: NOW_MS - 1_000,
    name: 'Dana',
    pollName: 'Amber Harbor',
    seenIntro: false,
    sessionId: 'amber-harbor',
    userId: 'user-amber',
    ...overrides,
  }
}

function seeded(polls: RecentPoll[], migrated = false): Storage {
  return fakeStorage({ pat_recent_polls: JSON.stringify({ migrated, polls }) })
}

function storedEnvelope(storage: Storage): { migrated: boolean; polls: RecentPoll[] } {
  return JSON.parse(storage.getItem('pat_recent_polls') ?? 'null')
}

describe('useRecentPolls', () => {
  describe('reading', () => {
    it('lists unexpired polls newest first', () => {
      const storage = seeded([
        entry({ lastSeen: NOW_MS - 5_000, pollName: 'Older', sessionId: 'older' }),
        entry({ lastSeen: NOW_MS - 1_000, pollName: 'Newer', sessionId: 'newer' }),
      ])

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls.map((poll) => poll.pollName)).toEqual(['Newer', 'Older'])
    })

    it('keeps the userId re-entry depends on', () => {
      const storage = seeded([entry({ userId: 'user-amber' })])

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls[0].userId).toBe('user-amber')
    })

    it('drops an entry whose expiration has passed and removes it from storage', () => {
      const storage = seeded([entry({ expiration: EXPIRED_EXPIRATION, sessionId: 'gone' }), entry()])

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['amber-harbor'])
      expect(storedEnvelope(storage).polls.map((poll) => poll.sessionId)).toEqual(['amber-harbor'])
    })

    it('reports one pruned entry', () => {
      const storage = seeded([entry({ expiration: EXPIRED_EXPIRATION, sessionId: 'gone' }), entry()])

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.prunedCount).toBe(1)
    })

    it('reports several pruned entries, for the plural notice', () => {
      const storage = seeded([
        entry({ expiration: EXPIRED_EXPIRATION, sessionId: 'gone-one' }),
        entry({ expiration: EXPIRED_EXPIRATION, sessionId: 'gone-two' }),
        entry(),
      ])

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.prunedCount).toBe(2)
    })

    it('reports nothing pruned when every entry is live, and leaves storage alone', () => {
      const storage = seeded([entry()], true)
      const before = storage.getItem('pat_recent_polls')

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.prunedCount).toBe(0)
      expect(storage.getItem('pat_recent_polls')).toBe(before)
    })

    it('keeps an entry expiring exactly now out of the list', () => {
      const storage = seeded([entry({ expiration: NOW_MS / 1_000 })])

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls).toEqual([])
    })

    // The fixture here is written out literally rather than built with entry(), and that is the
    // whole point of the test. entry() includes seenIntro, which ADR-3's documented six-field entry
    // does not -- so a fixture built from it passes whether or not the bare-array path actually
    // accepts the shape ADR-3 describes. It did not: requiring seenIntro made every such entry
    // rejected, emptying the list and destroying userIds on the next write.
    it('reads a bare array of ADR-3 six-field entries, with no seenIntro', () => {
      const storage = fakeStorage({
        pat_recent_polls: JSON.stringify([
          {
            expiration: LIVE_EXPIRATION,
            lastSeen: NOW_MS,
            name: 'Dave',
            pollName: 'Sprint retro',
            sessionId: 'amber-harbor',
            userId: 'u_7Qk2',
          },
        ]),
      })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['amber-harbor'])
    })

    it('defaults seenIntro to false for an entry that predates it', () => {
      const storage = fakeStorage({
        pat_recent_polls: JSON.stringify([
          {
            expiration: LIVE_EXPIRATION,
            lastSeen: NOW_MS,
            name: 'Dave',
            pollName: 'Sprint retro',
            sessionId: 'amber-harbor',
            userId: 'u_7Qk2',
          },
        ]),
      })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.seenIntro('amber-harbor')).toBe(false)
    })
  })

  describe('surviving bad storage', () => {
    it('degrades to an empty list on malformed JSON', () => {
      const storage = fakeStorage({ pat_recent_polls: '{ not json' })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls).toEqual([])
    })

    it('degrades to an empty list when the stored value is neither array nor envelope', () => {
      const storage = fakeStorage({ pat_recent_polls: '42' })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls).toEqual([])
    })

    it('degrades to an empty list when the envelope holds a non-array list', () => {
      const storage = fakeStorage({ pat_recent_polls: JSON.stringify({ migrated: true, polls: 'nope' }) })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls).toEqual([])
    })

    it('drops malformed entries and keeps the well-formed ones', () => {
      const storage = fakeStorage({
        pat_recent_polls: JSON.stringify({
          migrated: false,
          polls: [null, 'string', [], { sessionId: 'no-other-fields' }, entry()],
        }),
      })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['amber-harbor'])
    })

    it('degrades to an empty list when storage throws on read', () => {
      const { result } = renderHook(() => useRecentPolls(throwingStorage(), now))

      expect(result.current.polls).toEqual([])
    })

    it('records without throwing when storage throws on read and write', () => {
      const { result } = renderHook(() => useRecentPolls(throwingStorage(), now))

      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dana',
          pollName: 'P',
          sessionId: 's',
          userId: 'u',
        }),
      )

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['s'])
    })

    it('records without throwing when the quota is exhausted', () => {
      const storage = fullStorage()
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dana',
          pollName: 'P',
          sessionId: 's',
          userId: 'u',
        }),
      )

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['s'])
      expect(storage.getItem('pat_recent_polls')).toBeNull()
    })

    it('degrades to an empty list, and still records in memory, when reading window.localStorage itself throws', () => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage') as PropertyDescriptor
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => {
          throw new Error('access denied')
        },
      })

      try {
        const { result } = renderHook(() => useRecentPolls(undefined, now))
        expect(result.current.polls).toEqual([])

        act(() =>
          result.current.record({
            expiration: LIVE_EXPIRATION,
            name: 'Dana',
            pollName: 'P',
            sessionId: 's',
            userId: 'u',
          }),
        )
        expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['s'])
      } finally {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    })

    it('reads window.localStorage when no storage is injected', () => {
      window.localStorage.clear()
      window.localStorage.setItem('pat_recent_polls', JSON.stringify({ migrated: true, polls: [entry()] }))

      try {
        const { result } = renderHook(() => useRecentPolls(undefined, now))
        expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['amber-harbor'])
      } finally {
        window.localStorage.clear()
      }
    })

    it('falls back to the real clock when none is injected, on a store with nothing to prune', () => {
      const { result } = renderHook(() => useRecentPolls(fakeStorage()))

      expect(result.current.polls).toEqual([])
      expect(result.current.prunedCount).toBe(0)
    })
  })

  describe('record', () => {
    it('writes exactly the seven disclosed fields, and no availability or other participant', () => {
      const storage = fakeStorage()
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dana',
          pollName: 'Amber Harbor',
          sessionId: 'amber-harbor',
          userId: 'user-amber',
        }),
      )

      expect(storedEnvelope(storage).polls).toEqual([
        {
          expiration: LIVE_EXPIRATION,
          lastSeen: NOW_MS,
          name: 'Dana',
          pollName: 'Amber Harbor',
          seenIntro: false,
          sessionId: 'amber-harbor',
          userId: 'user-amber',
        },
      ])
    })

    it('replaces the existing entry for the same poll rather than duplicating it', () => {
      const storage = seeded([entry({ lastSeen: NOW_MS - 90_000, userId: 'stale-user' })])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dana',
          pollName: 'Amber Harbor',
          sessionId: 'amber-harbor',
          userId: 'user-amber',
        }),
      )

      expect(result.current.polls).toHaveLength(1)
      expect(result.current.polls[0].userId).toBe('user-amber')
      expect(result.current.polls[0].lastSeen).toBe(NOW_MS)
    })

    it('does not resurface an introduction already dismissed for that poll', () => {
      const storage = seeded([entry({ seenIntro: true })])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dana',
          pollName: 'Amber Harbor',
          sessionId: 'amber-harbor',
          userId: 'user-amber',
        }),
      )

      expect(result.current.polls[0].seenIntro).toBe(true)
    })

    it('puts the just-recorded poll at the head of the list', () => {
      const storage = seeded([entry({ lastSeen: NOW_MS, sessionId: 'other' })])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dana',
          pollName: 'New',
          sessionId: 'new',
          userId: 'user-new',
        }),
      )

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['new', 'other'])
    })

    it('preserves the sweep flag it did not author', () => {
      const storage = seeded([], true)
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dana',
          pollName: 'Amber Harbor',
          sessionId: 'amber-harbor',
          userId: 'user-amber',
        }),
      )

      expect(storedEnvelope(storage).migrated).toBe(true)
    })
  })

  describe('remove, restore, and clear', () => {
    it('removes one entry from the list and from storage immediately', () => {
      const storage = seeded([entry(), entry({ sessionId: 'other' })])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() => result.current.remove('amber-harbor'))

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['other'])
      expect(storedEnvelope(storage).polls.map((poll) => poll.sessionId)).toEqual(['other'])
    })

    it('restores a removed entry, in its place by recency', () => {
      const removed = entry({ lastSeen: NOW_MS - 5_000 })
      const storage = seeded([removed, entry({ lastSeen: NOW_MS - 1_000, sessionId: 'other' })])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() => result.current.remove('amber-harbor'))
      act(() => result.current.restore(removed))

      expect(result.current.polls.map((poll) => poll.sessionId)).toEqual(['other', 'amber-harbor'])
      expect(storedEnvelope(storage).polls).toHaveLength(2)
    })

    it('restoring an entry that is somehow still present does not duplicate it', () => {
      const present = entry()
      const storage = seeded([present])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() => result.current.restore(present))

      expect(result.current.polls).toHaveLength(1)
    })

    it('clears every entry from the list and from storage', () => {
      const storage = seeded([entry(), entry({ sessionId: 'other' })], true)
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() => result.current.clear())

      expect(result.current.polls).toEqual([])
      expect(storedEnvelope(storage)).toEqual({ migrated: true, polls: [] })
    })
  })

  describe('seenIntro', () => {
    it('reports false for a poll whose introduction has not been dismissed', () => {
      const { result } = renderHook(() => useRecentPolls(seeded([entry()]), now))

      expect(result.current.seenIntro('amber-harbor')).toBe(false)
    })

    it('reports true once dismissed, and persists it', () => {
      const storage = seeded([entry()])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() => result.current.setSeenIntro('amber-harbor', true))

      expect(result.current.seenIntro('amber-harbor')).toBe(true)
      expect(storedEnvelope(storage).polls[0].seenIntro).toBe(true)
    })

    it('leaves other polls untouched', () => {
      const storage = seeded([entry(), entry({ sessionId: 'other' })])
      const { result } = renderHook(() => useRecentPolls(storage, now))

      act(() => result.current.setSeenIntro('amber-harbor', true))

      expect(result.current.seenIntro('other')).toBe(false)
    })

    it('reports false for an expired poll, so no record of viewing it survives it', () => {
      const storage = seeded([entry({ expiration: EXPIRED_EXPIRATION, seenIntro: true })])

      expect(readSeenIntro('amber-harbor', storage, now)).toBe(false)
    })

    it('reports false for a poll that was never recorded', () => {
      expect(readSeenIntro('never-seen', seeded([entry()]), now)).toBe(false)
    })

    it('does not invent an entry for a poll that has none, which would be an onboarding record with no expiry', () => {
      const storage = fakeStorage()

      writeSeenIntro('never-recorded', true, storage, now)

      expect(storedEnvelope(storage).polls).toEqual([])
      expect(readSeenIntro('never-recorded', storage, now)).toBe(false)
    })

    it('writes through injected storage when called directly, touching only the poll named', () => {
      const storage = seeded([entry({ seenIntro: true }), entry({ seenIntro: true, sessionId: 'other' })])

      writeSeenIntro('amber-harbor', false, storage, now)

      expect(readSeenIntro('amber-harbor', storage, now)).toBe(false)
      expect(readSeenIntro('other', storage, now)).toBe(true)
    })

    it('falls back to window.localStorage when no storage is injected', () => {
      window.localStorage.clear()
      window.localStorage.setItem('pat_recent_polls', JSON.stringify({ migrated: true, polls: [entry()] }))

      try {
        writeSeenIntro('amber-harbor', true, undefined, now)
        expect(readSeenIntro('amber-harbor', undefined, now)).toBe(true)
      } finally {
        window.localStorage.clear()
      }
    })

    it('falls back to the real clock when none is injected, on a store with nothing recorded', () => {
      const storage = fakeStorage()

      writeSeenIntro('amber-harbor', true, storage)

      expect(readSeenIntro('amber-harbor', storage)).toBe(false)
    })
  })

  // Dismissing the introduction before picking a name seeds an entry so the dismissal survives, but
  // that entry has no participant. Listed, it renders "Closes in 12 days · as " with nothing after
  // the "as", an accessible name that trails off, and a link with an empty ?id= that
  // consumeQueryParamId cannot strip because '' is falsy.
  describe('an entry seeded by an intro dismissal', () => {
    const seeded = {
      expiration: LIVE_EXPIRATION,
      lastSeen: NOW_MS,
      name: '',
      pollName: 'Sprint retro',
      seenIntro: true,
      sessionId: 'amber-harbor',
      userId: '',
    }

    it('is not listed as a poll, since nobody has joined it yet', () => {
      const storage = fakeStorage({ pat_recent_polls: JSON.stringify({ migrated: true, polls: [seeded] }) })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.polls).toEqual([])
    })

    it('still carries the dismissal it was written for', () => {
      const storage = fakeStorage({ pat_recent_polls: JSON.stringify({ migrated: true, polls: [seeded] }) })

      const { result } = renderHook(() => useRecentPolls(storage, now))

      expect(result.current.seenIntro('amber-harbor')).toBe(true)
    })

    it('appears once identity resolves and record fills it in', () => {
      const storage = fakeStorage({ pat_recent_polls: JSON.stringify({ migrated: true, polls: [seeded] }) })

      const { result } = renderHook(() => useRecentPolls(storage, now))
      act(() =>
        result.current.record({
          expiration: LIVE_EXPIRATION,
          name: 'Dave',
          pollName: 'Sprint retro',
          sessionId: 'amber-harbor',
          userId: 'u_7Qk2',
        }),
      )

      expect(result.current.polls.map((poll) => poll.name)).toEqual(['Dave'])
      expect(result.current.seenIntro('amber-harbor')).toBe(true)
    })
  })
})
