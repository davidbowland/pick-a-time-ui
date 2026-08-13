import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import { JoinTrigger } from '@components/join-dialog'
// From `./copy` and not from `./elements`, which opens with HeroUI's `Modal` -- a static import of
// that here would put the whole react-aria overlay tree in `/`'s first-paint chunk.
import { JOIN_COPY } from '@components/join-dialog/copy'
import PrivacyLink from '@components/privacy-link'
import RecentPolls from '@components/recent-polls'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { DoorPair } from '@components/story/door-pair'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'
import { useIsIntersecting } from '@hooks/useIsIntersecting'
import { useNarrowViewport } from '@hooks/useNarrowViewport'
import { defaultStorage, useRecentPolls } from '@hooks/useRecentPolls'
import { fetchConfig } from '@services/api'
import { extractPollLinkCode } from '@utils/poll-link'

// The offer renders nothing at all on a browser that cannot install, and nothing it does render is
// in the prerendered HTML, so its HeroUI Modal has no business in the first-paint download. Not
// prefetched: 2.9 KB gzip is below the threshold where warming it would pay for itself.
//
// `ssr: false` costs no markup — the banner is gated on `beforeinstallprompt` and a capability
// check that only exist in a browser, so the export never rendered it either.
const InstallPrompt = dynamic(() => import('@components/install-prompt'), { ssr: false })

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
  const hasReadStore = useRef(false)

  // One flag per composition, not one shared between them. Both compositions are always in the DOM
  // -- the swap is CSS keyed off `data-recent-polls` -- so a single flag would open both doors at
  // once, mounting two panels with duplicate ids and two live regions on the same page.
  const [firstVisitJoinOpen, setFirstVisitJoinOpen] = useState(false)
  const [returningJoinOpen, setReturningJoinOpen] = useState(false)

  // The dock: the way in for everyone who has scrolled past the hero's door. One observer per
  // composition, pointed at that composition's own door row.
  const firstVisitDoorRef = useRef<HTMLDivElement>(null)
  const returningDoorRef = useRef<HTMLDivElement>(null)
  const firstVisitDoorInView = useIsIntersecting(firstVisitDoorRef)
  const returningDoorInView = useIsIntersecting(returningDoorRef)
  const [isDockOpen, setIsDockOpen] = useState(false)
  const isNarrowViewport = useNarrowViewport()

  // ORed, not picked. Both compositions are always in the DOM and the swap is `display: none` keyed
  // off `data-recent-polls`, so the hidden one's door never intersects and reports `false` forever;
  // the visible one's `true` absorbs it. That is what lets the dock decide without ever READING the
  // attribute, which is what keeps it clear of the page's pre-paint layout contract.
  const doorInView = firstVisitDoorInView || returningDoorInView

  // `useIsIntersecting` starts `false` and only corrects on its observer's first callback, which
  // never fires during the static export. Without this gate `!doorInView` is true in the served HTML
  // and on the first client render, so the dock would ship VISIBLE over the hero. Suppressed has to
  // be the INITIAL state, so the dock waits for proof the door was ever on screen. Held here rather
  // than inside the hook: every other caller wants the plain "is it on screen now?" answer.
  const hasObservedDoor = useRef(false)
  if (doorInView) hasObservedDoor.current = true

  // Open wins. A visitor who opened the dock and then scrolled back to the hero keeps the panel they
  // are typing in; unmounting it under them would throw away the code they had entered.
  const isDockVisible = isDockOpen || (hasObservedDoor.current && !doorInView)

  // The paste reach. One piece of state carries both halves of it -- the code to seed the field with
  // and, by its presence, the notice that explains why a panel the visitor never opened is on screen
  // holding it. Clearing it therefore clears both, which is what the dock's close has to do.
  const [pastePrefill, setPastePrefill] = useState<string | undefined>(undefined)

  // One join surface at a time, on every path -- not only the paste reach. Both compositions stay
  // mounted and the dock is independent of them, so without this a visitor can press the door, scroll,
  // and press the dock: two panels, two fields both named "Poll code or link", two alert regions and
  // two status regions on one page, and a code typed into a panel that has scrolled out of sight.
  const handleDoorOpenChange = (setOpen: (open: boolean) => void) => (open: boolean) => {
    setOpen(open)
    if (!open) return
    setIsDockOpen(false)
    if (setOpen !== setFirstVisitJoinOpen) setFirstVisitJoinOpen(false)
    if (setOpen !== setReturningJoinOpen) setReturningJoinOpen(false)
  }

  const handleDockOpenChange = (open: boolean): void => {
    setIsDockOpen(open)
    if (open) {
      setFirstVisitJoinOpen(false)
      setReturningJoinOpen(false)
    }
    // The reach is a one-shot. Left set, the next open of the dock -- pressed deliberately, by
    // someone who wants to type -- would arrive pre-filled with a code from minutes ago and a notice
    // explaining a displacement that is no longer happening.
    if (!open) setPastePrefill(undefined)

    // Closing the dock can UNMOUNT it in the same commit: `isDockVisible` is only true through the
    // `isDockOpen` disjunct whenever the door is on screen, which is every close at scroll 0 and
    // every close after scrolling back up to the hero. Effects do not run on unmounting components,
    // so `JoinTrigger`'s own focus return never fires and the browser parks focus on `<body>` --
    // a keyboard visitor is dropped at the top of the page.
    //
    // The dock is not the right place to send focus anyway when it is about to vanish. The door is
    // the same control by another name, and it is on screen precisely when this happens.
    if (open || !doorInView) return
    const container = firstVisitDoorInView ? firstVisitDoorRef.current : returningDoorRef.current
    // The door is the only control in the pair carrying `aria-expanded`; Start does not.
    container?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus()
  }

  useEffect(() => {
    setIsStoryOpen(readLandingView())
  }, [])

  // Someone is holding a poll link that will not open for them -- an installed PWA that hands taps
  // back to the browser, a link that landed on the wrong device, a message with the link intact but
  // no way to follow it. Pasting it onto this page is the obvious next thing to try, and until now
  // it did nothing at all.
  //
  // The gate is PROVENANCE, never shape (`extractPollLinkCode`). Shape would fire on every two-word
  // paste on the page, `lazy giraffe` included -- and that is also a poll NAME, so the reach must
  // stay silent for it: no flicker, no notice, nothing.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      // Legitimately null in some browsers, so it is read defensively rather than trusted.
      const text = event.clipboardData?.getData('text')
      if (!text) return
      // A paste into the open panel is the visitor using the field it opened. The field handles it,
      // and no notice renders -- the panel would otherwise explain a displacement that did not
      // happen. A paste into "Name your poll" DOES fire: that visitor is unambiguously lost.
      const target = event.target instanceof Element ? event.target : undefined
      if (target?.closest('[data-join-panel]')) return
      // Already open, so there is nothing to explain and nowhere to put the code: the panel applies
      // its prefill on mount only, deliberately, so that a later one cannot overwrite what the
      // visitor has typed. Reaching again would render a notice promising a code over an empty
      // field. The visitor has the field in front of them; let them paste into it.
      if (isDockOpen) return
      const code = extractPollLinkCode(text)
      if (!code) return
      // The reach is taking over, so the paste must not also land where it was aimed. Without this,
      // the documented case -- someone pastes their poll link into "Name your poll" -- ends with the
      // create form pre-named `https://pick-a-time.com/p/lazy-giraffe`, which is the name they get
      // if they abandon the join and press Start. On a phone this is the ONLY way a paste happens
      // at all, since there is no non-editable paste target.
      if (target?.closest('input, textarea, [contenteditable]')) event.preventDefault()
      // Spoken form, because that is the form the panel's own hint, placeholder and error copy all
      // use -- the field says `lazy giraffe`, never `lazy-giraffe`.
      setPastePrefill(code.replace(/-/g, ' '))
      // The DOCK's panel, at any scroll position, never the door's. `isDockOpen` also makes the dock
      // visible, so this works at scroll 0 with the door still in view. The door's anchor is
      // reserved for a visitor who deliberately pressed the door.
      setIsDockOpen(true)
      // One surface at a time. Closing the door's panel here is a PAGE-driven close, which is
      // exactly why `JoinTrigger`'s focus return is guarded on focus having actually been lost --
      // without that guard this rips the caret out of the field being pasted into.
      setFirstVisitJoinOpen(false)
      setReturningJoinOpen(false)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [isDockOpen])

  // The pre-paint script owns FIRST PAINT and nothing else. It runs once per full document load, so
  // on a client-side navigation -- tapping the brand link from a poll you just answered, or either
  // CTA on the poll-is-gone screen -- it never runs again and its attribute is stale or absent. A
  // respondent would land on the marketing story with their brand-new entry invisible until a hard
  // reload, which is precisely the person P-1 is about.
  //
  // So React owns every truth after that first paint: the store's own contents decide, and the
  // attribute is written back so the CSS swap follows. Both directions matter -- clearing the last
  // poll has to put the story back.
  useEffect(() => {
    // The attribute is consulted on the first pass ONLY. After that the store is the sole truth, or
    // the attribute perpetuates itself: `polls.length > 0 || attribute` can never go false once the
    // script has set it, so clearing the last poll would leave the recents composition on screen
    // with nothing in it.
    const returning = hasReadStore.current ? polls.length > 0 : polls.length > 0 || isReturningComposition()
    hasReadStore.current = true
    setIsReturning(returning)
    const root = globalThis.document?.documentElement
    if (!root) return
    if (returning) root.setAttribute(RECENT_POLLS_ATTRIBUTE, 'true')
    else root.removeAttribute(RECENT_POLLS_ATTRIBUTE)
  }, [polls.length])

  // The reduced-motion branch must be 'instant', not 'auto': `html { scroll-behavior: smooth }` in
  // index.css is the site-wide default, and 'auto' means "defer to CSS" — so 'auto' animated the
  // scroll for exactly the people who asked for no animation. Only 'instant' overrides the CSS.
  const scrollTo = (target: HTMLElement | null | undefined): void => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' })
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

  // Both ways in as one node, because `SceneLayout` renders `action` as a single node and the
  // page's own test reads `action.props.onStart` -- which is why `onStart` is a direct prop of
  // `DoorPair` rather than a field on an options object. The open flag is passed in rather than
  // owned here so each composition keeps its own.
  const waysIn = (
    onStart: () => void,
    isJoinOpen: boolean,
    onJoinOpenChange: (open: boolean) => void,
    containerRef: React.RefObject<HTMLDivElement | null>,
  ): React.ReactNode => (
    <DoorPair
      containerRef={containerRef}
      isJoinOpen={isJoinOpen}
      maxLength={config?.pollNameMaxLength}
      name={pollName}
      onJoinOpenChange={onJoinOpenChange}
      onNameChange={setPollName}
      onStart={onStart}
    />
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
            {/* Beneath the list: someone who came back for a poll that isn't in the list is
                looking here, and joining has to answer them before they reach a form for starting a
                new one. That worry was about SEQUENCE, and the pair settles it -- join now sits
                level with the starter rather than after it, so there is no longer an order to get
                wrong. Two blocks became one, in the slot the join sentence used to hold. It ships
                in the markup with no gate of its own, so it inherits this wrapper's visibility and
                stays out of the pre-paint contract above. */}
            <div className="mt-8">
              {waysIn(handleTourStart, returningJoinOpen, handleDoorOpenChange(setReturningJoinOpen), returningDoorRef)}
            </div>
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
            <HeroScene
              action={waysIn(
                handleHeroStart,
                firstVisitJoinOpen,
                handleDoorOpenChange(setFirstVisitJoinOpen),
                firstVisitDoorRef,
              )}
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
          {/* Inside the wrapper on purpose: it is `fixed`, so nothing but a hidden ancestor takes it
              off screen, and its three refs all point into this composition. */}
          <BackToFormCta
            footerRef={footerRef}
            formRef={createSceneRef}
            heroRef={heroSceneRef}
            onJump={scrollToCreateScene}
            // Below `md` the two bottom corners are close enough that the open panel and this button
            // overlap by 56x4px, and the button then reads as a control inside the panel's corner
            // notch. `useNarrowViewport` seeds `false` during the export, so it is only ever safe
            // ANDed with client state -- `isDockOpen`, which seeds `false` too, is that state.
            suppressed={isDockOpen && isNarrowViewport}
          />
        </div>
        {/* A sibling of both composition wrappers, not inside either. The swap is `display: none` on
            the wrappers, which takes the whole subtree with it including `position: fixed`
            descendants -- which is exactly why the FAB above is inside its wrapper on purpose. Out
            here the dock has no hidden ancestor, so it can serve whichever composition is showing.
            It mounts and unmounts rather than hiding: a hidden-but-present dock would be a phantom
            tab stop. No transition -- `BackToFormCta` is the prior art and it appears instantly. */}
        {isDockVisible ? (
          <div className="fixed bottom-5 left-5 z-40">
            <JoinTrigger
              isOpen={isDockOpen}
              // The notice rides the same state as the prefill rather than a flag of its own: they
              // are one fact -- "this panel opened because you pasted a link" -- and two flags could
              // drift into a notice with nothing beneath it to explain.
              notice={pastePrefill ? JOIN_COPY.pasteNotice : undefined}
              onOpenChange={handleDockOpenChange}
              prefill={pastePrefill}
              variant="dock"
            />
          </div>
        ) : null}
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
