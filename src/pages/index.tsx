import { Utensils } from 'lucide-react'
import Head from 'next/head'
import React from 'react'

import AppBar from '@components/app-bar'
import PrivacyLink from '@components/privacy-link'
import SessionCreate from '@components/session-create'

const Index = (): React.ReactNode => (
  <>
    <Head>
      <title>Choosee | dbowland.com</title>
    </Head>
    <AppBar />
    <main className="mx-auto max-w-[1060px] px-5 pt-10 pb-12">
      <div className="flex flex-col gap-10 md:grid md:grid-cols-[1fr_460px] md:gap-11 md:pt-4">
        {/* Hero left column */}
        <div className="flex flex-col justify-center gap-5">
          <div className="arena-eyebrow flex items-center gap-2">
            <Utensils aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            Find your next restaurant
          </div>
          <h1 className="choosee-brand text-[clamp(64px,7.5vw,100px)] leading-[0.9] tracking-[0.04em] text-[#F5F5F5]">
            WHERE ARE
            <br />
            WE
            <br />
            <span className="text-[#F59E0B]">EATING?</span>
          </h1>
          <p className="max-w-[320px] text-sm leading-[1.7] text-[#4B5563]">
            Can&apos;t agree on where to eat? We&apos;ll line up restaurants near you, and your group votes until
            there&apos;s a winner.
          </p>
        </div>
        {/* Form right column */}
        <div>
          <SessionCreate />
        </div>
      </div>
    </main>
    <PrivacyLink />
  </>
)

export default Index
