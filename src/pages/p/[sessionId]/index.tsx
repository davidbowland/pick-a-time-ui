import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'

import AppBar from '@components/app-bar'
import Poll from '@components/poll'
import PrivacyLink from '@components/privacy-link'
import { ogImageUrl } from '@config/urls'

const TITLE = "You're invited — Pick a Time"
const DESCRIPTION = 'Mark the times that work for you and see where everybody overlaps. No account needed.'
// The production image, even from the test deploy. This page is `noindex`, so no canonical is
// wanted here, but the unfurl on a shared invite should not advertise the test host.
const OG_IMAGE_URL = ogImageUrl

/**
 * The poll code, read from the address bar rather than from `router.query`.
 *
 * The export serves every poll from one prerendered `__placeholder__` page, so the router's own
 * `sessionId` is that placeholder on a cold load and the real code only ever exists in the URL.
 *
 * Re-read on `asPath`, though, and not once at mount. Two polls are the SAME page component, so
 * `/p/a` → `/p/b` is a prop change and not a remount: a mount-only effect would leave this pinned
 * to whichever code the tab was first opened with while the address bar showed the other one. That
 * is not hypothetical — the join dialog's whole purpose is pushing a poll code from a page that is
 * already a poll page (the poll-is-gone screen carries a `JoinTrigger`), and the code entered there
 * would go to the URL and nowhere else. `asPath` is the router's own signal that the location moved,
 * and Next writes history before it re-renders, so `window.location` is already the new one here.
 */
function useSessionIdFromPath(): string | undefined {
  const { asPath } = useRouter()
  const [sessionId, setSessionId] = useState<string | undefined>()
  useEffect(() => {
    const match = window.location.pathname.match(/^\/p\/([^/]+)/)
    setSessionId(match ? decodeURIComponent(match[1]) : undefined)
  }, [asPath])
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
        {/* `key`, because moving between polls is a prop change rather than a remount, and almost
            everything `Poll` holds is about ONE poll: the captured gone-name, the announcement, the
            tab, the "not you" flag. Carried across, the second poll inherits the first one's — most
            visibly a dead link opened from a dead link, which would keep showing the first poll's
            name and never prune the second from recents. Remounting is the honest reset. */}
        <div className="flex-1">{sessionId ? <Poll key={sessionId} sessionId={sessionId} /> : null}</div>
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
