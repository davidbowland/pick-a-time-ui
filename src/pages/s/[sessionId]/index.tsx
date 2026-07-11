import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import React, { useEffect, useState } from 'react'

import AppBar from '@components/app-bar'
import PrivacyLink from '@components/privacy-link'
import Session from '@components/session'

function useSessionIdFromPath(): string | undefined {
  const [sessionId, setSessionId] = useState<string | undefined>()
  useEffect(() => {
    // URL pattern: /s/<sessionId>/
    const match = window.location.pathname.match(/^\/s\/([^/]+)/)
    if (match) setSessionId(decodeURIComponent(match[1]))
  }, [])
  return sessionId
}

const SessionPage = (): React.ReactNode => {
  const sessionId = useSessionIdFromPath()

  return (
    <>
      <Head>
        <title>Choosee | dbowland.com</title>
      </Head>
      <AppBar />
      <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-4 py-6">
        <div className="flex-1">{sessionId ? <Session sessionId={sessionId} /> : null}</div>
        <PrivacyLink />
      </main>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = () => {
  if (process.env.NODE_ENV === 'development') {
    return { fallback: 'blocking', paths: [] }
  }
  return { fallback: false, paths: [{ params: { sessionId: '__placeholder__' } }] }
}

export const getStaticProps: GetStaticProps = () => ({ props: {} })

export default SessionPage
