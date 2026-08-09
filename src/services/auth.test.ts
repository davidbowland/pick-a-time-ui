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

  it('passes forceRefresh through', async () => {
    markSessionStored()
    const auth = authModule()
    await getIdToken({ forceRefresh: true, loader: async () => auth })
    expect(auth.fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true })
  })

  it('clears the flag when the session has no token', async () => {
    markSessionStored()
    const auth = authModule({ fetchAuthSession: jest.fn().mockResolvedValue({ tokens: undefined }) })
    expect(await getIdToken({ loader: async () => auth })).toBe(null)
    expect(hasStoredSession()).toBe(false)
  })

  it('clears the flag when the session rejects', async () => {
    markSessionStored()
    const auth = authModule({ fetchAuthSession: jest.fn().mockRejectedValue(new Error('expired')) })
    expect(await getIdToken({ loader: async () => auth })).toBe(null)
    expect(hasStoredSession()).toBe(false)
  })

  it('leaves the flag alone when the import itself fails', async () => {
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

  // The clear() matters: the test above seeded a CognitoIdentityServiceProvider key, and
  // hasStoredSession's rule 2 would still report true off that key alone, passing this assertion
  // for the wrong reason.
  it('clears the flag and returns null when getCurrentUser rejects', async () => {
    window.localStorage.clear()
    markSessionStored()
    const auth = authModule({ getCurrentUser: jest.fn().mockRejectedValue(new Error('no user')) })
    expect(await getSessionUser(async () => auth)).toBe(null)
    expect(hasStoredSession()).toBe(false)
  })
})
