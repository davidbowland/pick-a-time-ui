import Head from 'next/head'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import AppBar from '@components/app-bar'

const NotFound = (): React.ReactNode => {
  const [display404, setDisplay404] = useState(false)

  useEffect(() => {
    setDisplay404(window.location.pathname.match(/^\/s\/[^/]+$/) === null)
  }, [])

  if (display404) {
    return (
      <>
        <Head>
          <title>404: Not Found | dbowland.com</title>
        </Head>
        <AppBar />
        <div className="mx-auto mt-8 max-w-md px-4 text-center">
          <h1 className="mb-4 text-xl font-semibold">Page not found</h1>
          <p className="mb-4 text-default-500">That link may have expired or been mistyped.</p>
          <Link className="text-primary underline" href="/">
            Go home
          </Link>
        </div>
      </>
    )
  }
  return (
    <>
      <Head>
        <title>404: Not Found | dbowland.com</title>
      </Head>
    </>
  )
}

export default NotFound
