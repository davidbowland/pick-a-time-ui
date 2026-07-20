import Head from 'next/head'
import Link from 'next/link'
import React from 'react'

import AppBar from '@components/app-bar'

const BadRequest = (): React.ReactNode => {
  return (
    <>
      <Head>
        <title>Something went wrong | Pick a Time</title>
      </Head>
      <AppBar />
      <div className="mx-auto mt-8 max-w-md px-4 text-center">
        <h1 className="mb-4 text-xl font-semibold">Something went wrong</h1>
        <p className="mb-4 text-default-500">We couldn&apos;t process that. Try going back and starting over.</p>
        <Link className="text-primary underline" href="/">
          Go home
        </Link>
      </div>
    </>
  )
}

export default BadRequest
