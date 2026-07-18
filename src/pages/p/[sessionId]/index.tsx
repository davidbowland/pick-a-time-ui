import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import React, { useEffect, useState } from 'react'

import AppBar from '@components/app-bar'
import Poll from '@components/poll'
import PrivacyLink from '@components/privacy-link'

const TITLE = "You're invited — Pick a Time"
const DESCRIPTION = 'Mark the times that work for you and see where everyone overlaps. No account needed.'
const OG_IMAGE_URL = `${process.env.NEXT_PUBLIC_ORIGIN}/og-image.png`

function useSessionIdFromPath(): string | undefined {
  const [sessionId, setSessionId] = useState<string | undefined>()
  useEffect(() => {
    const match = window.location.pathname.match(/^\/p\/([^/]+)/)
    if (match) setSessionId(decodeURIComponent(match[1]))
  }, [])
  return sessionId
}

const PollPage = (): React.ReactNode => {
  const sessionId = useSessionIdFromPath()

  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta content={DESCRIPTION} name="description" />
        <meta content="noindex, nofollow" name="robots" />

        <meta content="website" property="og:type" />
        <meta content="Pick a Time" property="og:site_name" />
        <meta content={TITLE} property="og:title" />
        <meta content={DESCRIPTION} property="og:description" />
        <meta content={OG_IMAGE_URL} property="og:image" />
        <meta content="image/png" property="og:image:type" />
        <meta content="1200" property="og:image:width" />
        <meta content="630" property="og:image:height" />
        <meta content={TITLE} property="og:image:alt" />
        <meta content="en_US" property="og:locale" />

        <meta content="summary_large_image" name="twitter:card" />
        <meta content={TITLE} name="twitter:title" />
        <meta content={DESCRIPTION} name="twitter:description" />
        <meta content={OG_IMAGE_URL} name="twitter:image" />
      </Head>
      <AppBar sessionId={sessionId} />
      <main className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col gap-6 px-4 py-6">
        <div className="flex-1">{sessionId ? <Poll sessionId={sessionId} /> : null}</div>
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

export default PollPage
