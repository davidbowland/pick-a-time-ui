import { Hub } from 'aws-amplify/utils'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'

const TIMEOUT_MS = 15_000

const AuthCallback = (): React.ReactNode => {
  const router = useRouter()
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
    const redirect = () => {
      const returnTo = sessionStorage.getItem('choosee_auth_return') ?? '/'
      sessionStorage.removeItem('choosee_auth_return')
      router.replace(returnTo)
    }

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        clearTimeout(timer)
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
  }, [router])

  return (
    <>
      <Head>
        <title>{failed ? 'Sign-in failed' : 'Signing in…'} | Choosee</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
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
