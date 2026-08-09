import {
  clearStoredSession,
  createAuthLoader,
  getIdToken,
  getSessionUser,
  hasStoredSession,
  markSessionStored,
} from './auth'

const FLAG_KEY = 'pat_has_session'

const fakeStorage = (entries: Record<string, string> = {}): Storage => {
  const map = new Map(Object.entries(entries))
  return {
    clear: () => {
      map.clear()
    },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  } as Storage
}

const throwingStorage = (): Storage =>
  ({
    getItem: () => {
      throw new Error('SecurityError')
    },
    key: () => {
      throw new Error('SecurityError')
    },
    get length(): number {
      throw new Error('SecurityError')
    },
    removeItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('SecurityError')
    },
  }) as unknown as Storage

const authModule = (overrides = {}) =>
  ({
    fetchAuthSession: jest
      .fn()
      .mockResolvedValue({ tokens: { idToken: { payload: { name: 'Ada' }, toString: () => 'jwt' } } }),
    getCurrentUser: jest.fn().mockResolvedValue({ userId: 'u1' }),
    ...overrides,
  }) as any

describe('hasStoredSession', () => {
  it('returns false when nothing is stored', () => {
    expect(hasStoredSession(fakeStorage())).toBe(false)
  })

  it('returns true for our own flag', () => {
    expect(hasStoredSession(fakeStorage({ [FLAG_KEY]: '1' }))).toBe(true)
  })

  it('returns false when the flag holds any other value', () => {
    expect(hasStoredSession(fakeStorage({ [FLAG_KEY]: 'true' }))).toBe(false)
  })

  it('returns true for a pre-existing Cognito session with no flag', () => {
    const storage = fakeStorage({ 'CognitoIdentityServiceProvider.abc123.LastAuthUser': 'ada' })
    expect(hasStoredSession(storage)).toBe(true)
  })

  it('returns false when storage access throws', () => {
    expect(hasStoredSession(throwingStorage())).toBe(false)
  })

  it('returns false when storage is unavailable', () => {
    expect(hasStoredSession(null)).toBe(false)
  })

  // The failure this module is built around: in some privacy modes reading the `localStorage`
  // property throws, before any method is called. The restore is in a finally because a failing
  // assertion would otherwise leak the throwing getter into every later test in this file, turning
  // one red test into a cascade.
  it('returns false when the localStorage property access itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError')
      },
    })

    try {
      expect(hasStoredSession()).toBe(false)
    } finally {
      Object.defineProperty(window, 'localStorage', original!)
    }
  })
})

describe('markSessionStored', () => {
  it('writes the flag', () => {
    const storage = fakeStorage()
    markSessionStored(storage)
    expect(storage.getItem(FLAG_KEY)).toBe('1')
  })

  it('does not throw when storage access throws', () => {
    expect(() => markSessionStored(throwingStorage())).not.toThrow()
  })
})

describe('clearStoredSession', () => {
  it('removes the flag', () => {
    const storage = fakeStorage({ [FLAG_KEY]: '1' })
    clearStoredSession(storage)
    expect(storage.getItem(FLAG_KEY)).toBe(null)
  })

  it('does not throw when storage access throws', () => {
    expect(() => clearStoredSession(throwingStorage())).not.toThrow()
  })
})

describe('createAuthLoader', () => {
  it('imports once across repeated calls', async () => {
    const importAuth = jest.fn().mockResolvedValue(authModule())
    const load = createAuthLoader(importAuth)
    await Promise.all([load(), load(), load()])
    expect(importAuth).toHaveBeenCalledTimes(1)
  })

  it('retries after a rejected import', async () => {
    const importAuth = jest.fn().mockRejectedValueOnce(new Error('chunk load failed')).mockResolvedValue(authModule())
    const load = createAuthLoader(importAuth)
    await expect(load()).rejects.toThrow('chunk load failed')
    await expect(load()).resolves.toBeDefined()
    expect(importAuth).toHaveBeenCalledTimes(2)
  })
})

describe('getIdToken', () => {
  it('returns null without loading Amplify when no session is stored', async () => {
    window.localStorage.clear()
    const loader = jest.fn()
    expect(await getIdToken({ loader })).toBe(null)
    expect(loader).not.toHaveBeenCalled()
  })

  it('returns the token when a session resolves', async () => {
    markSessionStored()
    expect(await getIdToken({ loader: async () => authModule() })).toBe('jwt')
  })

  // Seeded with a Cognito key rather than the flag, so the assertion can only pass if getIdToken
  // wrote the flag itself. Every other success case above pre-seeds it via markSessionStored, which
  // means deleting getIdToken's own write would leave them all green.
  it('sets the flag when a token resolves for a pre-existing Cognito session', async () => {
    window.localStorage.clear()
    window.localStorage.setItem('CognitoIdentityServiceProvider.abc.LastAuthUser', 'ada')

    expect(await getIdToken({ loader: async () => authModule() })).toBe('jwt')
    expect(window.localStorage.getItem(FLAG_KEY)).toBe('1')
  })

  it('passes forceRefresh through', async () => {
    markSessionStored()
    const auth = authModule()
    await getIdToken({ forceRefresh: true, loader: async () => auth })
    expect(auth.fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true })
  })

  // clear() before every assertion on hasStoredSession being false: a sibling test seeds a
  // CognitoIdentityServiceProvider key, and rule 2 reports true off that key alone.
  it('clears the flag when the session has no token', async () => {
    window.localStorage.clear()
    markSessionStored()
    const auth = authModule({ fetchAuthSession: jest.fn().mockResolvedValue({ tokens: undefined }) })

    expect(await getIdToken({ loader: async () => auth })).toBe(null)
    expect(hasStoredSession()).toBe(false)
  })

  // Amplify rejects only for transient failures -- offline, 5xx, rate limit -- and preserves its
  // own tokens through them. A dead session resolves with tokens: undefined instead (covered
  // above). Clearing the flag here would sign people out for losing signal.
  it('keeps the flag when the session rejects, because that means transient, not signed out', async () => {
    window.localStorage.clear()
    markSessionStored()
    const auth = authModule({ fetchAuthSession: jest.fn().mockRejectedValue(new Error('network')) })

    expect(await getIdToken({ loader: async () => auth })).toBe(null)
    expect(hasStoredSession()).toBe(true)
  })

  it('leaves the flag alone when the import itself fails', async () => {
    window.localStorage.clear()
    markSessionStored()

    await expect(getIdToken({ loader: () => Promise.reject(new Error('offline')) })).rejects.toThrow('offline')
    expect(hasStoredSession()).toBe(true)
  })
})

describe('getSessionUser', () => {
  it('returns null without loading Amplify when no session is stored', async () => {
    window.localStorage.clear()
    const loader = jest.fn()
    expect(await getSessionUser(loader)).toBe(null)
    expect(loader).not.toHaveBeenCalled()
  })

  it('returns the name claim and sets the flag', async () => {
    window.localStorage.clear()
    window.localStorage.setItem('CognitoIdentityServiceProvider.abc.LastAuthUser', 'ada')
    expect(await getSessionUser(async () => authModule())).toEqual({ name: 'Ada' })
    expect(window.localStorage.getItem(FLAG_KEY)).toBe('1')
  })

  it('returns a null name when the claim is absent', async () => {
    window.localStorage.clear()
    markSessionStored()
    const auth = authModule({
      fetchAuthSession: jest.fn().mockResolvedValue({ tokens: { idToken: { payload: {}, toString: () => 'jwt' } } }),
    })
    expect(await getSessionUser(async () => auth)).toEqual({ name: null })
  })

  // The clear() matters throughout this describe: an earlier test seeded a
  // CognitoIdentityServiceProvider key, and hasStoredSession's rule 2 would still report true off
  // that key alone, passing these assertions for the wrong reason.
  it('clears the flag when the session resolves without tokens', async () => {
    window.localStorage.clear()
    markSessionStored()
    const auth = authModule({ fetchAuthSession: jest.fn().mockResolvedValue({ tokens: undefined }) })

    expect(await getSessionUser(async () => auth)).toBe(null)
    expect(hasStoredSession()).toBe(false)
  })

  it('keeps the flag when the session rejects, because that means transient, not signed out', async () => {
    window.localStorage.clear()
    markSessionStored()
    const auth = authModule({ fetchAuthSession: jest.fn().mockRejectedValue(new Error('network')) })

    expect(await getSessionUser(async () => auth)).toBe(null)
    expect(hasStoredSession()).toBe(true)
  })

  it('propagates an import failure rather than reporting signed out', async () => {
    window.localStorage.clear()
    markSessionStored()

    await expect(getSessionUser(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline')
    expect(hasStoredSession()).toBe(true)
  })

  it('returns a null name when the claim is not a string', async () => {
    window.localStorage.clear()
    markSessionStored()
    const auth = authModule({
      fetchAuthSession: jest.fn().mockResolvedValue({ tokens: { idToken: { payload: { name: 42 } } } }),
    })

    expect(await getSessionUser(async () => auth)).toEqual({ name: null })
  })
})
