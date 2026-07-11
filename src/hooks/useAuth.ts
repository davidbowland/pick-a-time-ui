import { fetchAuthSession, signInWithRedirect, signOut, getCurrentUser } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { useCallback, useEffect, useState } from 'react'

export interface AuthUser {
  name: string | null
  phone: string | null
}

export interface AuthState {
  isSignedIn: boolean
  user: AuthUser | null
  isLoading: boolean
  handleSignIn: () => void
  handleSignOut: () => void
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkUser = useCallback(async () => {
    try {
      await getCurrentUser()
      const session = await fetchAuthSession()
      const idToken = session.tokens?.idToken
      if (idToken) {
        const claims = idToken.payload
        setUser({
          name: (claims['name'] as string) ?? null,
          phone: (claims['phone_number'] as string) ?? null,
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkUser()
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'signedOut' || payload.event === 'tokenRefresh') {
        checkUser()
      }
    })
    return unsubscribe
  }, [checkUser])

  // signInWithRedirect triggers a full page navigation — it never resolves.
  // We save the current path so the callback page can redirect back.
  const handleSignIn = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('choosee_auth_return', window.location.pathname + window.location.search)
    }
    void signInWithRedirect({ provider: 'Google' })
  }, [])

  // With OAuth configured, signOut() redirects to the Cognito logout endpoint
  // and then back to redirectSignOut. The page navigates away, so code after
  // this call never executes.
  const handleSignOut = useCallback(() => {
    void signOut()
  }, [])

  return {
    isSignedIn: user !== null,
    user,
    isLoading,
    handleSignIn,
    handleSignOut,
  }
}
