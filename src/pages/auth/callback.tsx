import Head from 'next/head'
import React, { useEffect, useState } from 'react'

import { Mark } from '@components/mark'
// Static, not lazy: the OAuth listener this import registers must exist before Amplify sees the
// ?code= in the URL. This page is the only route Cognito redirects to and is never a cold entry
// point except mid-sign-in, so the cost lands only on people already waiting on a redirect. Every
// other module reaches Amplify through the dynamic import in @services/auth.
import { Hub } from '@config/amplify'
import { markSessionStored } from '@services/auth'

const TIMEOUT_MS = 15_000

const AuthCallback = (): React.ReactNode => {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // If Cognito redirected back with an error (e.g. invalid_scope), fail
    // immediately instead of waiting for a Hub event that will never fire.
    const params = new URLSearchParams(window.location.search)
    if (params.has('error')) {
      console.error('OAuth callback error:', params.get('error'), params.get('error_description'))
      setFailed(true)
      return
    }

    // Amplify automatically exchanges the authorization code in the URL for tokens.
    // We wait for the Hub 'signedIn' event to confirm the exchange is complete
    // before redirecting, so we don't navigate away and lose the code.
    //
    // A full-document navigation, not router.replace. AuthProvider lives in _app and does not
    // remount across a client-side transition, so the useAuth instance that returned early on this
    // page -- the session flag was false when it mounted, because this is the sign-in that sets it
    // -- would stay mounted with user: null all the way to the destination, and the app bar would
    // offer to sign in someone who just did.
    const redirect = () => {
      const returnTo = sessionStorage.getItem('pat_auth_return') ?? '/'
      sessionStorage.removeItem('pat_auth_return')
      window.location.assign(returnTo)
    }

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        clearTimeout(timer)
        // Set from the same event the navigation hangs off, so the flag is written before the
        // destination's AuthProvider mounts and reads it.
        markSessionStored()
        redirect()
      }
      if (payload.event === 'signInWithRedirect_failure') {
        clearTimeout(timer)
        setFailed(true)
      }
    })

    const timer = setTimeout(() => setFailed(true), TIMEOUT_MS)

    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <Head>
        <title>{failed ? 'Sign-in failed' : 'Signing in…'} | Pick a Time</title>
        <meta content="noindex, nofollow" name="robots" />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Mark className={failed ? undefined : 'animate-breathe'} size={56} />
        {failed ? (
          <>
            <p className="text-default-500">Sign-in failed. Please try again.</p>
            <a className="text-sm text-primary underline" href="/">
              Go home
            </a>
          </>
        ) : (
          <p className="text-default-500">Signing you in…</p>
        )}
      </div>
    </>
  )
}

export default AuthCallback
