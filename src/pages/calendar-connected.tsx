import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useRef } from 'react'

import { Mark } from '@components/mark'
import { PillButton } from '@components/ui/pill-button'

const RETURN_KEY = 'pat_calendar_return'

const COPY: Record<string, { body: string; heading: string }> = {
  connected: {
    body: "We'll mark you busy wherever your calendar says you're booked. Disconnect anytime from the menu by your name.",
    heading: 'Calendar connected',
  },
  declined: {
    body: 'You can connect it later from any poll.',
    heading: 'Calendar not connected',
  },
  error: {
    body: "We couldn't connect your calendar. Try again from your poll.",
    heading: 'Something went wrong',
  },
}

const CalendarConnected = (): React.ReactNode => {
  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // This is a statically exported page, so the query string is not parsed on the first render --
  // `router.query` is empty until the router hydrates. Waiting for `isReady` keeps a successful
  // connection from flashing "Something went wrong", and keeps that wrong outcome out of the
  // announcement below, which fires once.
  const isReady = router.isReady
  const status = typeof router.query.status === 'string' ? router.query.status : undefined
  const copy = COPY[status ?? ''] ?? COPY.error

  // A full-page OAuth round trip lands here with focus at the top of a new document. Moving it to
  // the heading is what makes a screen reader announce the outcome instead of silence. The heading
  // renders `focus:outline-none` because this move is the only way it can ever take focus -- it is
  // out of the tab order -- and a fresh document with no pointer interaction makes Chrome treat
  // programmatic focus as `:focus-visible`, drawing a ring around a heading nobody focused.
  useEffect(() => {
    headingRef.current?.focus()
  }, [isReady])

  const handleContinue = (): void => {
    const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '/'
    sessionStorage.removeItem(RETURN_KEY)
    void router.replace(returnTo)
  }

  if (!isReady) {
    return (
      <>
        <Head>
          <title>Google Calendar | Pick a Time</title>
        </Head>
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <Mark className="animate-breathe" size={56} />
          <p className="text-sm text-[var(--slate)]">Finishing up…</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{copy.heading} | Pick a Time</title>
      </Head>
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Mark size={56} />
        <h1
          className="text-2xl text-[var(--bone)] focus:outline-none"
          ref={headingRef}
          style={{ fontFamily: 'var(--font-display)' }}
          tabIndex={-1}
        >
          {copy.heading}
        </h1>
        <p className="text-sm text-[var(--slate)]">{copy.body}</p>
        <PillButton label="Continue to poll" onPress={handleContinue} />
      </div>
    </>
  )
}

export default CalendarConnected
