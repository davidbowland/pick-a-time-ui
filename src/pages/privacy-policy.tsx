import Head from 'next/head'
import React from 'react'

import AppBar from '@components/app-bar'
import PrivacyPolicy from '@components/privacy-policy'
import { siteUrl } from '@config/urls'

const PrivacyPage = (): React.ReactNode => {
  return (
    <>
      <Head>
        <title>Privacy Policy | Pick a Time</title>
        {/* Production, from both deploys -- see the note in `@config/urls`. */}
        <link href={`${siteUrl}/privacy-policy/`} rel="canonical" />
      </Head>
      <AppBar />
      <div className="mx-auto max-w-2xl">
        <PrivacyPolicy />
      </div>
    </>
  )
}

export default PrivacyPage
