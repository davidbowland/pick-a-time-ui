import Head from 'next/head'
import Link from 'next/link'
import React from 'react'

import AppBar from '@components/app-bar'

const Forbidden = (): React.ReactNode => {
  return (
    <>
      <Head>
        <title>403: Forbidden | dbowland.com</title>
      </Head>
      <AppBar />
      <div className="mx-auto mt-8 max-w-md px-4 text-center">
        <h1 className="mb-4 text-xl font-semibold">You don&apos;t have access</h1>
        <p className="mb-4 text-default-500">You&apos;re not allowed to view this page. Try signing in, or go home.</p>
        <Link className="text-primary underline" href="/">
          Go home
        </Link>
      </div>
    </>
  )
}

export default Forbidden
