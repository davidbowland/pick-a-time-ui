import { usePollOnboarding } from './usePollOnboarding'
import { RecentPoll } from './useRecentPolls'
import { act, renderHook } from '@testing-library/react'

// `expiration` is epoch SECONDS (the server's own value); the injected clock is milliseconds.
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

function seeded(polls: RecentPoll[]): Storage {
  return fakeStorage({ pat_recent_polls: JSON.stringify({ migrated: true, polls }) })
}

function storedPolls(storage: Storage): RecentPoll[] {
  return JSON.parse(storage.getItem('pat_recent_polls') as string).polls
}

describe('usePollOnboarding', () => {
  it('shows the intro on a first visit to this poll', () => {
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', fakeStorage(), now))
    expect(result.current.showIntro).toBe(true)
  })

  it('does not show the intro once this poll was already dismissed', () => {
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', seeded([entry({ seenIntro: true })]), now))
    expect(result.current.showIntro).toBe(false)
  })

  it('is scoped per poll — dismissing one poll does not hide the intro for a different one', () => {
    const { result } = renderHook(() => usePollOnboarding('other-poll', seeded([entry({ seenIntro: true })]), now))
    expect(result.current.showIntro).toBe(true)
  })

  it('ignores the legacy pat_onboarded_ key the sweep removes', () => {
    const storage = fakeStorage({ pat_onboarded_amber_harbor: 'true' })

    const { result } = renderHook(() => usePollOnboarding('amber-harbor', storage, now))

    expect(result.current.showIntro).toBe(true)
  })

  it('shows the intro again once the poll has expired, so no record of viewing it outlives it', () => {
    const storage = seeded([entry({ expiration: EXPIRED_EXPIRATION, seenIntro: true })])

    const { result } = renderHook(() => usePollOnboarding('amber-harbor', storage, now))

    expect(result.current.showIntro).toBe(true)
  })

  it('persists dismissal onto the poll entry and hides the intro', () => {
    const storage = seeded([entry()])
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', storage, now))

    act(() => result.current.dismissIntro())

    expect(result.current.showIntro).toBe(false)
    expect(storedPolls(storage)[0].seenIntro).toBe(true)
  })

  it('writes no onboarding key of its own', () => {
    const storage = seeded([entry()])
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', storage, now))

    act(() => result.current.dismissIntro())

    expect(storage.getItem('pat_onboarded_amber_harbor')).toBeNull()
  })

  it('hides the intro for the session, storing nothing, when the poll has no entry yet', () => {
    const storage = fakeStorage()
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', storage, now))

    act(() => result.current.dismissIntro())

    expect(result.current.showIntro).toBe(false)
    expect(storedPolls(storage)).toEqual([])
  })

  it('survives storage that throws, showing the intro rather than breaking the page', () => {
    const storage = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => {
        throw new Error('storage unavailable')
      },
    } as unknown as Storage
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', storage, now))

    act(() => result.current.dismissIntro())

    expect(result.current.showIntro).toBe(false)
  })

  it('falls back to window.localStorage and the real clock when neither is injected', () => {
    window.localStorage.clear()

    try {
      const { result } = renderHook(() => usePollOnboarding('amber-harbor'))
      expect(result.current.showIntro).toBe(true)
    } finally {
      window.localStorage.clear()
    }
  })
})
