import Head from 'next/head'
import React from 'react'

import AppBar from '@components/app-bar'
import PrivacyPolicy from '@components/privacy-policy'

const PrivacyPage = (): React.ReactNode => {
  return (
    <>
      <Head>
        <title>Privacy Policy | dbowland.com</title>
      </Head>
      <AppBar />
      <div className="mx-auto max-w-2xl">
        <PrivacyPolicy />
      </div>
    </>
  )
}

export default PrivacyPage
