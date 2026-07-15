import Head from 'next/head'
import React, { useRef } from 'react'

import PrivacyLink from '@components/privacy-link'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'

const Index = (): React.ReactNode => {
  const createSceneRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)

  const scrollToCreateScene = (): void => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    createSceneRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <>
      <Head>
        <title>Pick a Time — find the minute everyone&apos;s actually free</title>
      </Head>
      <SkyBackground />
      <main className="relative z-10">
        <section className="flex min-h-[100dvh] items-center py-28">
          <HeroScene />
        </section>
        <section className="flex min-h-[100dvh] items-center py-28" ref={createSceneRef}>
          <CreateScene />
        </section>
        <section className="flex min-h-[100dvh] items-center py-28">
          <IdentityScene />
        </section>
        <section className="flex min-h-[100dvh] items-center py-28">
          <PaintingScene />
        </section>
        <section className="flex min-h-[100dvh] items-center py-28">
          <ResultsScene />
        </section>
        <section className="flex min-h-[100dvh] items-center py-28">
          <ShareScene />
        </section>
        <div ref={footerRef}>
          <ClosingFooter onBackToStart={scrollToCreateScene} />
        </div>
        <PrivacyLink />
      </main>
      <BackToFormCta footerRef={footerRef} formRef={createSceneRef} onJump={scrollToCreateScene} />
    </>
  )
}

export default Index
