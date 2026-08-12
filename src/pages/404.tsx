import Head from 'next/head'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import AppBar from '@components/app-bar'
import { JoinTrigger } from '@components/join-dialog'
import { FOCUS_RING } from '@components/ui/focus-ring'

const NotFound = (): React.ReactNode => {
  const [display404, setDisplay404] = useState(false)

  useEffect(() => {
    setDisplay404(window.location.pathname.match(/^\/p\/[^/]+$/) === null)
  }, [])

  if (display404) {
    return (
      <>
        <Head>
          <title>Page not found | Pick a Time</title>
          <meta content="noindex, nofollow" name="robots" />
        </Head>
        <AppBar />
        <div className="mx-auto mt-8 max-w-md px-4 text-center">
          <h1 className="mb-4 text-xl font-semibold">Page not found</h1>
          {/* "Expired" was a second word for what the rest of the app calls closed -- see
              GONE_COPY and the recents prune notice. And the outbound link named a piece of web
              furniture rather than its destination, which the poll-is-gone screen already knows
              better than to do (AC-050). */}
          <p className="mb-4 text-default-500">The link may be wrong, or the poll may have closed.</p>
          {/* Directly under the sentence it answers: the body says the link may be wrong, and this
              is the thing to do about it if you were told the two words as well as sent the link.
              The bordered pill (not the quiet sentence used beside a create affordance) because
              this page has nothing else on it -- and bordered rather than filled, because a typed
              code can still miss. The outbound link stays last: it is the exit for the larger
              group who arrive here with no code at all, so the page reads diagnosis, fix, exit. */}
          <div className="mb-6 flex justify-center">
            <JoinTrigger variant="pill" />
          </div>
          <Link className={`rounded-sm text-primary underline ${FOCUS_RING}`} href="/">
            Start a poll
          </Link>
        </div>
      </>
    )
  }
  return (
    <>
      <Head>
        <title>You&apos;re invited — Pick a Time</title>
        <meta content="noindex, nofollow" name="robots" />
      </Head>
    </>
  )
}

export default NotFound
