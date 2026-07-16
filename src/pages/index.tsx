import Head from 'next/head'
import React, { useRef } from 'react'

import PrivacyLink from '@components/privacy-link'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'

const SCENE_CLASS = 'flex py-16 md:min-h-[100dvh] md:items-center md:py-28'

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
        <section className={SCENE_CLASS}>
          <HeroScene />
        </section>
        <section className={SCENE_CLASS} ref={createSceneRef}>
          <CreateScene />
        </section>
        <section className={SCENE_CLASS}>
          <IdentityScene />
        </section>
        <section className={SCENE_CLASS}>
          <PaintingScene />
        </section>
        <section className={SCENE_CLASS}>
          <ResultsScene />
        </section>
        <section className={SCENE_CLASS}>
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
