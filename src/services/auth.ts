// Everything Amplify-shaped is behind a dynamic import here, and every read of it is behind
// hasStoredSession(). The point is the *static* module graph: aws-amplify is 78 KB gzip, and a
// signed-out visitor -- which is nearly everyone arriving at the landing page -- has no use for a
// byte of it. Nothing outside this module may read or write the session flag.
import type * as AmplifyAuth from '@config/amplify'

type AuthModule = typeof AmplifyAuth
type AuthLoader = () => Promise<AuthModule>

export interface SessionUser {
  name: string | null
}

const FLAG_KEY = 'pat_has_session'
const FLAG_VALUE = '1'
const COGNITO_KEY_PREFIX = 'CognitoIdentityServiceProvider.'

// Accessing localStorage at all throws in some privacy modes -- not on read, on the property
// access itself. Every entry point below therefore treats storage as optional and failure as
// "signed out", which is also the ceiling in those browsers: Amplify cannot persist tokens there
// either.
const defaultStorage = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const storageKeys = (storage: Storage): string[] =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? '')

/**
 * Answers "might this person be signed in?" without loading Amplify.
 *
 * Two rules, and the difference between them is the failure direction. Rule 1 is a key we own, so
 * it cannot drift. Rule 2 sniffs Amplify's own storage, which sounds like exactly the coupling
 * rule 1 exists to avoid -- but rule 2 only ever *adds* true results, so if Amplify's key format
 * changes it degrades to rule 1, which is already correct for anyone who signed in on this build.
 * It fails open; a steady-state check that failed closed would silently sign everyone out.
 *
 * Rule 2 earns its place twice. On upgrade, everyone already signed in has Cognito tokens and no
 * flag, and every path that sets the flag sits behind the flag -- without rule 2 they are signed
 * out permanently. And if signOut() rejects after we have cleared the flag, rule 2 is what notices
 * the tokens are still there.
 *
 * Rule 2 may be deleted once pre-change sessions have aged past the Cognito refresh-token lifetime.
 */
export const hasStoredSession = (storage = defaultStorage()): boolean => {
  try {
    if (!storage) return false
    if (storage.getItem(FLAG_KEY) === FLAG_VALUE) return true
    return storageKeys(storage).some((key) => key.startsWith(COGNITO_KEY_PREFIX))
  } catch {
    return false
  }
}

export const markSessionStored = (storage = defaultStorage()): void => {
  try {
    storage?.setItem(FLAG_KEY, FLAG_VALUE)
  } catch {
    // Storage blocked. The person stays signed in for this page load and no longer.
  }
}

export const clearStoredSession = (storage = defaultStorage()): void => {
  try {
    storage?.removeItem(FLAG_KEY)
  } catch {
    // Storage blocked; nothing was persisted to clear.
  }
}

/**
 * Memoizes the dynamic import so N callers share one chunk fetch. The memo is dropped when the
 * import rejects: caching a rejected promise would turn one transient chunk-load failure into a
 * permanently broken sign-in for the life of the page.
 */
export const createAuthLoader = (importAuth: AuthLoader): AuthLoader => {
  let pending: Promise<AuthModule> | null = null
  return () => {
    pending ??= importAuth().catch((error) => {
      pending = null
      throw error
    })
    return pending
  }
}

export const loadAuth = createAuthLoader(() => import('@config/amplify'))

/**
 * The single entry point for a bearer token, and the only place the flag is reconciled with what
 * Cognito actually says. An import failure propagates untouched -- that is a network problem, not
 * evidence about the session, and clearing the flag on it would sign people out for being offline.
 */
export const getIdToken = async ({
  forceRefresh = false,
  loader = loadAuth,
}: { forceRefresh?: boolean; loader?: AuthLoader } = {}): Promise<string | null> => {
  if (!hasStoredSession()) return null
  const { fetchAuthSession } = await loader()
  try {
    const session = await fetchAuthSession({ forceRefresh })
    const token = session.tokens?.idToken?.toString()
    if (token) {
      markSessionStored()
      return token
    }
  } catch {
    // No session -- expired refresh token, revoked grant, cleared storage.
  }
  clearStoredSession()
  return null
}

export const getSessionUser = async (loader: AuthLoader = loadAuth): Promise<SessionUser | null> => {
  if (!hasStoredSession()) return null
  const { fetchAuthSession, getCurrentUser } = await loader()
  try {
    await getCurrentUser()
    const session = await fetchAuthSession({})
    const idToken = session.tokens?.idToken
    if (idToken) {
      markSessionStored()
      return { name: (idToken.payload['name'] as string) ?? null }
    }
  } catch {
    // Not signed in.
  }
  clearStoredSession()
  return null
}
