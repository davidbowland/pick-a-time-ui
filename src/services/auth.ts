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
 * Rule 2 is deletable only when BOTH of its jobs are obsolete, and only the first one ages out.
 * First: pre-change sessions must have aged past the Cognito refresh-token lifetime. Second, and
 * permanent: handleSignOut clears the flag before awaiting the auth chunk, because signOut()
 * navigates away and nothing after it runs -- so a signOut() that never happens leaves the flag
 * false with valid tokens on disk, and rule 2 is the only thing that notices. Deleting rule 2 means
 * moving that clear to after a confirmed sign-out first.
 *
 * Before deleting it, also check that nothing has started clearing the flag on a *transient* failure --
 * see getIdToken. Rule 2 currently masks that class of mistake, so removing it would turn one into
 * a permanent sign-out rather than a wasted round trip.
 *
 * Rule 2 also matches Amplify's in-flight OAuth keys (inflightOAuth/oauthState/oauthPKCE), so
 * abandoning a sign-in redirect costs one wasted chunk download on the next load. The listener
 * registered by @config/amplify clears those keys when it finds no ?code=, so it self-heals after
 * exactly one.
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
 *
 * fetchAuthSession draws that same line for us, and the two branches below are exactly it.
 * Amplify's TokenOrchestrator clears its own tokens and RESOLVES with `tokens: undefined` for a
 * definitively dead session (NotAuthorizedException, TokenRevokedException, UserNotFoundException),
 * and REJECTS for anything transient -- offline, 5xx, rate limit -- where it deliberately preserves
 * the tokens so the next call can retry. So a rejection is never evidence the session is gone, and
 * clearing the flag on one is the same mistake as clearing it on a failed import.
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
    // Transient. Amplify kept its tokens; keep the flag so the next call retries.
    return null
  }
  // Resolved without a token: the session is genuinely gone.
  clearStoredSession()
  return null
}

/**
 * Like getIdToken, an import failure propagates rather than resolving to null -- useAuth's effect
 * has to be able to tell "no session" from "could not load", and only the latter is worth retrying.
 * The resolve-versus-reject split is the same one documented on getIdToken above.
 */
export const getSessionUser = async (loader: AuthLoader = loadAuth): Promise<SessionUser | null> => {
  if (!hasStoredSession()) return null
  const { fetchAuthSession } = await loader()
  try {
    // Deliberately no getCurrentUser() call ahead of this. It rejects with
    // UserUnAuthenticatedException for a genuinely signed-out person -- a *definitive* answer
    // arriving through the same channel Amplify uses for transient ones, which would leave the
    // catch below unable to tell them apart and the flag set forever. fetchAuthSession alone
    // carries everything this function needs, and carries it unambiguously.
    const session = await fetchAuthSession()
    const idToken = session.tokens?.idToken
    if (idToken) {
      markSessionStored()
      // A JWT claim is JsonValue, not string. A provider mapping that yields a non-string `name`
      // would otherwise be handed to callers typed as one.
      const name = idToken.payload['name']
      return { name: typeof name === 'string' ? name : null }
    }
  } catch {
    // Transient, per the note on getIdToken. Leave the flag for the next attempt.
    return null
  }
  clearStoredSession()
  return null
}
