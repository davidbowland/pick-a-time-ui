import { collectLegacyKeys, runRecentPollsMigration } from './recent-polls-migration'
import { RecentPoll } from '@hooks/useRecentPolls'

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
    clear: jest.fn(),
    getItem: () => null,
    key: () => {
      throw new Error('storage unavailable')
    },
    length: 3,
    removeItem: jest.fn(),
    setItem: jest.fn(),
  } as unknown as Storage
}

const entry: RecentPoll = {
  expiration: 1_700_086_400,
  lastSeen: 1_699_999_000_000,
  name: 'Dana',
  pollName: 'Amber Harbor',
  seenIntro: true,
  sessionId: 'amber-harbor',
  userId: 'user-amber',
}

function keysOf(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_unused, index) => storage.key(index) as string)
}

describe('recent-polls-migration', () => {
  describe('collectLegacyKeys', () => {
    it('collects every legacy key before anything is removed, including adjacent ones', () => {
      const storage = fakeStorage({
        pat_onboarded_four: 'true',
        pat_onboarded_one: 'true',
        pat_onboarded_three: 'true',
        pat_onboarded_two: 'true',
      })

      expect(collectLegacyKeys(storage)).toHaveLength(4)
    })

    it('matches the prefix anchored, so no other pat_ key is collected', () => {
      const storage = fakeStorage({
        my_pat_onboarded_spoof: 'true',
        pat_install_dismissed: 'true',
        pat_landing_view: 'recents',
        pat_onboarded: 'true',
        pat_onboardedno_underscore: 'true',
        pat_recent_polls: '{}',
        pat_user_amber: 'user-amber',
      })

      expect(collectLegacyKeys(storage)).toEqual([])
    })
  })

  describe('runRecentPollsMigration', () => {
    it('removes every legacy key, including the adjacent pairs a delete-while-iterating sweep would skip', () => {
      const storage = fakeStorage({
        pat_onboarded_four: 'true',
        pat_onboarded_one: 'true',
        pat_onboarded_three: 'true',
        pat_onboarded_two: 'true',
      })

      expect(runRecentPollsMigration(storage)).toBe(true)
      expect(keysOf(storage).filter((key) => key.startsWith('pat_onboarded_'))).toEqual([])
    })

    it('leaves pat_recent_polls and the userIds it holds intact', () => {
      const storage = fakeStorage({
        pat_onboarded_amber_harbor: 'true',
        pat_recent_polls: JSON.stringify({ migrated: false, polls: [entry] }),
        pat_onboarded_other: 'true',
      })

      runRecentPollsMigration(storage)

      expect(JSON.parse(storage.getItem('pat_recent_polls') as string)).toEqual({ migrated: true, polls: [entry] })
    })

    it('leaves every other pat_ key untouched', () => {
      const storage = fakeStorage({
        pat_install_dismissed: 'true',
        pat_landing_view: 'recents',
        pat_onboarded_amber_harbor: 'true',
        pat_user_amber: 'user-amber',
      })

      runRecentPollsMigration(storage)

      expect(keysOf(storage).sort()).toEqual([
        'pat_install_dismissed',
        'pat_landing_view',
        'pat_recent_polls',
        'pat_user_amber',
      ])
    })

    it('records that it ran, inside pat_recent_polls rather than in a key of its own', () => {
      const storage = fakeStorage({ pat_onboarded_amber_harbor: 'true' })

      runRecentPollsMigration(storage)

      expect(keysOf(storage)).toEqual(['pat_recent_polls'])
      expect(JSON.parse(storage.getItem('pat_recent_polls') as string).migrated).toBe(true)
    })

    it('runs once — a second call sweeps nothing', () => {
      const storage = fakeStorage({ pat_onboarded_amber_harbor: 'true' })

      runRecentPollsMigration(storage)
      storage.setItem('pat_onboarded_written_after', 'true')

      expect(runRecentPollsMigration(storage)).toBe(false)
      expect(storage.getItem('pat_onboarded_written_after')).toBe('true')
    })

    it('sweeps a device that has no legacy keys at all without error', () => {
      const storage = fakeStorage()

      expect(runRecentPollsMigration(storage)).toBe(true)
      expect(keysOf(storage)).toEqual(['pat_recent_polls'])
    })

    it('does not mark itself done when storage throws part-way, so the next load retries', () => {
      const storage = throwingStorage()

      expect(runRecentPollsMigration(storage)).toBe(false)
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('does nothing when reading window.localStorage itself throws', () => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage') as PropertyDescriptor
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => {
          throw new Error('access denied')
        },
      })

      try {
        expect(runRecentPollsMigration()).toBe(false)
      } finally {
        Object.defineProperty(window, 'localStorage', descriptor)
      }
    })

    it('falls back to window.localStorage when no storage is injected', () => {
      window.localStorage.clear()
      window.localStorage.setItem('pat_onboarded_amber_harbor', 'true')

      try {
        expect(runRecentPollsMigration()).toBe(true)
        expect(window.localStorage.getItem('pat_onboarded_amber_harbor')).toBeNull()
      } finally {
        window.localStorage.clear()
      }
    })
  })

  // Regression: readStore collapses "nothing stored" and "could not read what is stored" to the
  // same empty result. Writing on the second clobbers a real store AND sets the one-shot flag, so a
  // single transient read failure would permanently empty the list and never retry.
  it('does not clobber the store when the stored value cannot be parsed', () => {
    const storage = fakeStorage({ pat_recent_polls: '{ not json' })

    const swept = runRecentPollsMigration(storage)

    expect(swept).toBe(false)
    expect(storage.getItem('pat_recent_polls')).toBe('{ not json')
  })

  it('does not sweep or mark itself done when reading throws', () => {
    const storage = fakeStorage({})
    jest.spyOn(storage, 'getItem').mockImplementationOnce(() => {
      throw new Error('SecurityError')
    })

    expect(runRecentPollsMigration(storage)).toBe(false)
    expect(storage.getItem('pat_recent_polls')).toBeNull()
  })
})
