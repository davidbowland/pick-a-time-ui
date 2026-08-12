import Head from 'next/head'
import Link from 'next/link'
import React from 'react'

import AppBar from '@components/app-bar'
import { FOCUS_RING } from '@components/ui/focus-ring'

const Forbidden = (): React.ReactNode => {
  return (
    <>
      <Head>
        <title>You don&apos;t have access | Pick a Time</title>
        <meta content="noindex, nofollow" name="robots" />
      </Head>
      <AppBar />
      <div className="mx-auto mt-8 max-w-md px-4 text-center">
        <h1 className="mb-4 text-xl font-semibold">You don&apos;t have access</h1>
        <p className="mb-4 text-default-500">You&apos;re not allowed to view this page. Try signing in, or go home.</p>
        <Link className={`rounded-sm text-primary underline ${FOCUS_RING}`} href="/">
          Go home
        </Link>
      </div>
    </>
  )
}

export default Forbidden
