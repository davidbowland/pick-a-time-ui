import { useCallback, useEffect, useState } from 'react'

import { clearStoredSession, getSessionUser, hasStoredSession, loadAuth, SessionUser } from '@services/auth'

export type AuthUser = SessionUser

export interface AuthState {
  isSignedIn: boolean
  user: AuthUser | null
  isLoading: boolean
  handleSignIn: () => Promise<void>
  handleSignOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // getSessionUser rejects only when the auth chunk itself cannot be fetched. Either way isLoading
  // has to end up false: this hook backs the app bar and the identity controls, and leaving it true
  // parks a signed-in visitor on a spinner with nothing left to flip it.
  const checkUser = useCallback(async () => {
    try {
      setUser(await getSessionUser())
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // The flag is read HERE, not in a useState initializer: localStorage does not exist during the
  // static export's prerender, so a synchronous read would render isLoading=true on the server and
  // false on the client's first pass -- a hydration mismatch.
  useEffect(() => {
    if (!hasStoredSession()) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    loadAuth()
      .then(({ Hub }) => {
        if (cancelled) return
        unsubscribe = Hub.listen('auth', ({ payload }) => {
          if (payload.event === 'signedIn' || payload.event === 'signedOut' || payload.event === 'tokenRefresh') {
            void checkUser()
          }
        })
        void checkUser()
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [checkUser])

  // signInWithRedirect triggers a full page navigation -- it never resolves. The path is saved
  // synchronously, before the await, so a slow chunk fetch cannot lose it.
  const handleSignIn = useCallback(async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pat_auth_return', window.location.pathname + window.location.search)
    }
    const { signInWithRedirect } = await loadAuth()
    void signInWithRedirect({ provider: 'Google' })
  }, [])

  // The flag is cleared first because signOut() navigates away to the Cognito logout endpoint and
  // nothing after it runs. If that call fails instead, hasStoredSession's Cognito-key rule notices
  // the tokens are still present.
  const handleSignOut = useCallback(async () => {
    clearStoredSession()
    const { signOut } = await loadAuth()
    void signOut()
  }, [])

  return {
    handleSignIn,
    handleSignOut,
    isLoading,
    isSignedIn: user !== null,
    user,
  }
}
