import { useQuery } from '@tanstack/react-query'
import Head from 'next/head'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import InstallPrompt from '@components/install-prompt'
import PrivacyLink from '@components/privacy-link'
import RecentPolls from '@components/recent-polls'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroStarter } from '@components/story/hero-starter'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'
import { defaultStorage, useRecentPolls } from '@hooks/useRecentPolls'
import { fetchConfig } from '@services/api'

const SCENE_CLASS = 'flex py-16 md:min-h-[100dvh] md:items-center md:py-28'

const TITLE = "Pick a Time — Find the minute everybody's free"
const DESCRIPTION =
  'Start a poll, send one link, and see the times everybody can make. No accounts, no reply-all threads.'
const OG_IMAGE_URL = `${process.env.NEXT_PUBLIC_ORIGIN}/og-image.png`
const PAGE_URL = `${process.env.NEXT_PUBLIC_ORIGIN}/`

// The one attribute the pre-paint script in `_document.tsx` sets, and the CSS hook both
// compositions hang off. Its presence is the boolean: set when at least one unexpired recents
// entry exists, deleted otherwise.
export const RECENT_POLLS_ATTRIBUTE = 'data-recent-polls'

// Both compositions are in the static HTML on every request. The swap is CSS keyed off the
// attribute above, which is why it happens before first paint and why a crawler — and any visitor
// whose script was blocked or threw — gets the seven-scene story (AC-043). Nothing here is
// conditional on client state, so there is nothing for React to mismatch on hydrate.
const FIRST_VISIT_CLASS = '[html[data-recent-polls=true]_&]:hidden'
const RETURNING_CLASS = 'hidden [html[data-recent-polls=true]_&]:block'

// This section owns the writer. Nothing else in the app reads or writes it.
export const LANDING_VIEW_KEY = 'pat_landing_view'
const STORY_OPEN = 'story-open'
const STORY_CLOSED = 'story-closed'

/** Whether the visitor left the story open last time. Any storage failure reads as "closed". */
export const readLandingView = (storage: Storage | undefined = defaultStorage()): boolean => {
  try {
    return storage?.getItem(LANDING_VIEW_KEY) === STORY_OPEN
  } catch {
    // Safari private browsing throws on read as well as write (AC-018).
    return false
  }
}

/** Remembers the disclosure's state. Losing the preference is acceptable; throwing is not. */
export const writeLandingView = (isOpen: boolean, storage: Storage | undefined = defaultStorage()): void => {
  try {
    storage?.setItem(LANDING_VIEW_KEY, isOpen ? STORY_OPEN : STORY_CLOSED)
  } catch {
    // Quota exceeded, or storage that throws on write (AC-018).
  }
}

/** Reads the pre-paint script's boolean back out of the DOM. Absent attribute means first visit. */
export const isReturningComposition = (root: HTMLElement | undefined = globalThis.document?.documentElement): boolean =>
  root?.getAttribute(RECENT_POLLS_ATTRIBUTE) === 'true'

const Index = (): React.ReactNode => {
  const heroSceneRef = useRef<HTMLDivElement>(null)
  const createSceneRef = useRef<HTMLDivElement>(null)
  const pollFormRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const tourFormRef = useRef<HTMLDivElement>(null)
  const [pollName, setPollName] = useState('')
  const focusFormName = useRef<(() => void) | undefined>(undefined)
  const focusTourFormName = useRef<(() => void) | undefined>(undefined)
  const { data: config } = useQuery({ queryFn: fetchConfig, queryKey: ['config'], staleTime: Infinity })
  const storyId = useId()
  const storyHintId = useId()

  // Exactly one mount. Two `useRecentPolls` instances do not share state — the second reports
  // `prunedCount: 0`, and one list goes stale the moment the other removes a row — so this page
  // owns the hook and hands the pieces down as props.
  const { clear, polls, prunedCount, prunedPolls, remove, restore } = useRecentPolls()

  // Both of these are read in an effect rather than in a lazy `useState`, because both come from
  // localStorage and the static HTML was built without it. Reading them during the hydrating render
  // would produce a tree that does not match the served markup. Neither changes anything visible at
  // scroll offset 0 — `SkyBackground` is already at night there — so the deferred read costs
  // nothing on screen.
  const [isReturning, setIsReturning] = useState(false)
  const [isStoryOpen, setIsStoryOpen] = useState(false)
  const [startRequests, setStartRequests] = useState(0)

  useEffect(() => {
    setIsReturning(isReturningComposition())
    setIsStoryOpen(readLandingView())
  }, [])

  const scrollTo = (target: HTMLElement | null | undefined): void => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const scrollToCreateScene = (): void => {
    scrollTo(pollFormRef.current ?? createSceneRef.current)
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

  const registerFocusTourFormName = useCallback((fn: () => void): void => {
    focusTourFormName.current = fn
  }, [])

  const setStoryOpen = (isOpen: boolean): void => {
    setIsStoryOpen(isOpen)
    writeLandingView(isOpen)
  }

  // The returning composition's create form lives inside the collapsed story, so Start has to open
  // the disclosure before there is anything to scroll to. That makes the focus call land one commit
  // after the gesture, which is the one place iOS will not open the soft keyboard for us — the
  // alternative was a second always-mounted copy of the create form, which is worse.
  const handleTourStart = (): void => {
    setStoryOpen(true)
    setStartRequests((count) => count + 1)
  }

  useEffect(() => {
    if (startRequests === 0 || !isStoryOpen) return
    scrollTo(tourFormRef.current)
    focusTourFormName.current?.()
  }, [startRequests, isStoryOpen])

  const starter = (onStart: () => void): React.ReactNode => (
    <HeroStarter maxLength={config?.pollNameMaxLength} name={pollName} onNameChange={setPollName} onStart={onStart} />
  )

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
      {/* Pinned while the returning composition is showing a collapsed story: the night -> day -> night
          arc needs six scenes of scrolling to read as an arc, and a page that ends just past the fold
          would strobe the whole palette instead. Opening the story restores the scroll it needs. */}
      <SkyBackground pinned={isReturning && !isStoryOpen} />
      <main className="relative z-10">
        <div className={RETURNING_CLASS} data-testid="returning-composition">
          <div className="mx-auto w-full max-w-[640px] px-5 pt-16 pb-8">
            {/* Before mount the store has not been read, and the exported HTML was built with an
                empty one -- so rendering RecentPolls here would prerender its EmptyState ("No polls
                on this device yet") inside the wrapper the pre-paint script is about to reveal. The
                visitor this feature exists for would read that their polls were gone, then watch
                them appear. The attribute the script set already guarantees at least one live
                entry, so the slot reserves itself and says nothing until there is something true to
                say. */}
            {isReturning ? (
              <RecentPolls
                onClear={clear}
                onRemove={remove}
                onRestore={restore}
                polls={polls}
                prunedCount={prunedCount}
                prunedPolls={prunedPolls}
              />
            ) : (
              <div aria-busy="true" className="min-h-[18rem]" />
            )}
            <div className="mt-10">{starter(handleTourStart)}</div>
            <div className="mt-10 border-t border-[var(--bone)]/10 pt-8">
              {/* The control carries the heading, not just a button. With recents at `h1` and the
                  scenes below dropped to `h3`, a bare `<button>` here would leave the document
                  skipping h1 -> h3 (AC-048, D-31). */}
              <h2 className="text-lg font-semibold text-[var(--bone)]">
                <button
                  aria-controls={storyId}
                  aria-describedby={storyHintId}
                  aria-expanded={isStoryOpen}
                  className="cursor-pointer text-left underline underline-offset-4"
                  onClick={() => setStoryOpen(!isStoryOpen)}
                  type="button"
                >
                  {/* Rendered from the same deferred read as the composition. A visitor who left
                      the story open saw "Show how it works" first and then watched it flip -- the
                      flash this section exists to remove, reintroduced one control lower down. */}
                  {isStoryOpen ? 'Hide how it works' : 'Show how it works'}
                </button>
              </h2>
              <p className="mt-2 text-sm text-[var(--bone)]/70" id={storyHintId}>
                A short tour of how a poll works. Open it and it stays open next time.
              </p>
            </div>
          </div>
          <div id={storyId}>
            {isStoryOpen && (
              <>
                <section className={SCENE_CLASS}>
                  <HeroScene headingLevel="h3" />
                </section>
                <section className={SCENE_CLASS}>
                  <CreateScene
                    formRef={tourFormRef}
                    headingLevel="h3"
                    name={pollName}
                    onNameChange={setPollName}
                    registerFocusName={registerFocusTourFormName}
                  />
                </section>
                <section className={SCENE_CLASS}>
                  <IdentityScene headingLevel="h3" />
                </section>
                <section className={SCENE_CLASS}>
                  <PaintingScene headingLevel="h3" />
                </section>
                <section className={SCENE_CLASS}>
                  <ResultsScene headingLevel="h3" />
                </section>
                <section className={SCENE_CLASS}>
                  <ShareScene headingLevel="h3" />
                </section>
                <ClosingFooter headingLevel="h3" onBackToStart={handleTourStart} />
              </>
            )}
          </div>
          <PrivacyLink />
        </div>
        <div className={FIRST_VISIT_CLASS} data-testid="first-visit-composition">
          <section className={SCENE_CLASS} ref={heroSceneRef}>
            <HeroScene action={starter(handleHeroStart)} />
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
          {/* Inside the wrapper on purpose: it is `fixed`, so nothing but a hidden ancestor takes it
              off screen, and its three refs all point into this composition. */}
          <BackToFormCta
            footerRef={footerRef}
            formRef={createSceneRef}
            heroRef={heroSceneRef}
            onJump={scrollToCreateScene}
          />
        </div>
        {/* Shared by both compositions, and deliberately outside them. Mounted inside the
            returning one, a first-visit visitor -- the large majority of visitors -- would never
            see an install offer at all, and AC-023/AC-032/AC-034 are about offering installation
            in the first place. It goes last because an `h2` ahead of the story's `h1` would open
            the document at level 2. */}
        <div className="mx-auto w-full max-w-[640px] px-5 pb-16">
          <InstallPrompt />
        </div>
      </main>
    </>
  )
}

export default Index
