import Head from 'next/head'
import React from 'react'

import AppBar from '@components/app-bar'
import PlanCreate from '@components/plan-create'
import PrivacyLink from '@components/privacy-link'

const Index = (): React.ReactNode => (
  <>
    <Head>
      <title>Pick a Time</title>
    </Head>
    <AppBar />
    <main className="mx-auto max-w-[1060px] px-5 pt-10 pb-12">
      <div className="flex flex-col gap-10 md:grid md:grid-cols-[1fr_460px] md:gap-11 md:pt-4">
        <div className="flex flex-col justify-center gap-5">
          <h1 className="brand-display text-[clamp(64px,7.5vw,100px)] leading-[0.9] tracking-[0.04em] text-[#F5F5F5]">
            FIND THE
            <br />
            MINUTE
            <br />
            <span className="text-[#F59E0B]">EVERYONE&apos;S FREE</span>
          </h1>
          <p className="max-w-[320px] text-sm leading-[1.7] text-[#4B5563]">
            No accounts, no reply-all thread. Start a plan, send one link, and watch the free time appear where
            everyone&apos;s schedules overlap — for one afternoon, or a whole season of Thursday practices.
          </p>
        </div>
        <div>
          <PlanCreate />
        </div>
      </div>
    </main>
    <PrivacyLink />
  </>
)

export default Index
