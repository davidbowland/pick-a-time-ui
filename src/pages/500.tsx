import Head from 'next/head'
import Link from 'next/link'
import React from 'react'

import AppBar from '@components/app-bar'

const InternalServerError = (): React.ReactNode => {
  return (
    <>
      <Head>
        <title>500: Internal Server Error | dbowland.com</title>
      </Head>
      <AppBar />
      <div className="mx-auto mt-8 max-w-md px-4 text-center">
        <h1 className="mb-4 text-xl font-semibold">Something went wrong on our end</h1>
        <p className="mb-4 text-default-500">It&apos;s not you — we hit an error. Try again in a moment.</p>
        <Link className="text-primary underline" href="/">
          Go home
        </Link>
      </div>
    </>
  )
}

export default InternalServerError
