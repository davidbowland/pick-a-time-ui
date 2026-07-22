import { useQuery } from '@tanstack/react-query'
import Head from 'next/head'
import React, { useCallback, useRef, useState } from 'react'

import PrivacyLink from '@components/privacy-link'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroStarter } from '@components/story/hero-starter'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'
import { fetchConfig } from '@services/api'

const SCENE_CLASS = 'flex py-16 md:min-h-[100dvh] md:items-center md:py-28'

const TITLE = "Pick a Time — Find the minute everybody's free"
const DESCRIPTION =
  'Start a poll, send one link, and see the times everybody can make. No accounts, no reply-all threads.'
const OG_IMAGE_URL = `${process.env.NEXT_PUBLIC_ORIGIN}/og-image.png`
const PAGE_URL = `${process.env.NEXT_PUBLIC_ORIGIN}/`

const Index = (): React.ReactNode => {
  const heroSceneRef = useRef<HTMLDivElement>(null)
  const createSceneRef = useRef<HTMLDivElement>(null)
  const pollFormRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const [pollName, setPollName] = useState('')
  const focusFormName = useRef<(() => void) | undefined>(undefined)
  const { data: config } = useQuery({ queryFn: fetchConfig, queryKey: ['config'], staleTime: Infinity })

  const scrollToCreateScene = (): void => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = pollFormRef.current ?? createSceneRef.current
    target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const handleHeroStart = (): void => {
    scrollToCreateScene()
    // Focus synchronously, still inside the click gesture — iOS Safari only opens the soft keyboard
    // for a focus() call that runs in the same user-gesture task, so no rAF/timeout here. The
    // registered handler focuses with `preventScroll: true`, so moving focus doesn't cancel the
    // smooth scroll we just started.
    focusFormName.current?.()
  }

  const registerFocusFormName = useCallback((fn: () => void): void => {
    focusFormName.current = fn
  }, [])

  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta content={DESCRIPTION} name="description" />
        <link href={PAGE_URL} rel="canonical" />

        <meta content="website" property="og:type" />
        <meta content={PAGE_URL} property="og:url" />
        <meta content="Pick a Time" property="og:site_name" />
        <meta content={TITLE} property="og:title" />
        <meta content={DESCRIPTION} property="og:description" />
        <meta content={OG_IMAGE_URL} property="og:image" />
        <meta content="image/png" property="og:image:type" />
        <meta content="1200" property="og:image:width" />
        <meta content="630" property="og:image:height" />
        <meta content={TITLE} property="og:image:alt" />
        <meta content="en_US" property="og:locale" />

        <meta content="summary_large_image" name="twitter:card" />
        <meta content={TITLE} name="twitter:title" />
        <meta content={DESCRIPTION} name="twitter:description" />
        <meta content={OG_IMAGE_URL} name="twitter:image" />
      </Head>
      <SkyBackground />
      <main className="relative z-10">
        <section className={SCENE_CLASS} ref={heroSceneRef}>
          <HeroScene
            action={
              <HeroStarter
                maxLength={config?.pollNameMaxLength}
                name={pollName}
                onNameChange={setPollName}
                onStart={handleHeroStart}
              />
            }
          />
        </section>
        <section className={SCENE_CLASS} ref={createSceneRef}>
          <CreateScene
            formRef={pollFormRef}
            name={pollName}
            onNameChange={setPollName}
            registerFocusName={registerFocusFormName}
          />
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
        <div className="flex min-h-[100dvh] flex-col" ref={footerRef}>
          <div className="flex flex-1 items-center">
            <div className="w-full">
              <ClosingFooter onBackToStart={scrollToCreateScene} />
            </div>
          </div>
          <PrivacyLink />
        </div>
      </main>
      <BackToFormCta
        footerRef={footerRef}
        formRef={createSceneRef}
        heroRef={heroSceneRef}
        onJump={scrollToCreateScene}
      />
    </>
  )
}

export default Index
