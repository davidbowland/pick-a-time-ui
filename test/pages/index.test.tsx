/**
 * @jest-environment-options {"url": "https://pick-a-time.com/"}
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import React from 'react'

import InstallPrompt from '@components/install-prompt'
import { JOIN_COPY } from '@components/join-dialog/copy'
import PollCreate from '@components/poll-create'
import PrivacyLink from '@components/privacy-link'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'
import { useIsIntersecting } from '@hooks/useIsIntersecting'
import { useNarrowViewport } from '@hooks/useNarrowViewport'
import { RecentPoll, useRecentPolls } from '@hooks/useRecentPolls'
import Index, { LANDING_VIEW_KEY, RECENT_POLLS_ATTRIBUTE, readLandingView, writeLandingView } from '@pages/index'
import { fetchConfig, fetchPoll } from '@services/api'
import '@testing-library/jest-dom'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@components/story/sky-background')
jest.mock('@components/story/back-to-form-cta')
jest.mock('@components/story/scenes')
jest.mock('@components/story/create-scene')
jest.mock('@components/story/closing-footer')
jest.mock('@components/privacy-link')
jest.mock('@components/install-prompt')
jest.mock('@components/poll-create')
jest.mock('@services/api')
// The page never routes. The join dialog it now hosts calls `useRouter` on mount, and jsdom has no
// router mounted, so opening the dialog would throw "NextRouter was not mounted" before it rendered.
jest.mock('next/router', () => ({ useRouter: jest.fn() }))
// jsdom's IntersectionObserver is a deliberate no-op stub (`jest.setup-test-env.js`), so the hook is
// the only place a test can say where the page is scrolled to. The dock reads it for both doors.
jest.mock('@hooks/useIsIntersecting')
// Seeds `false` off `matchMedia` in the real thing, which jsdom answers `false` to for every query —
// so it is mocked here rather than left to a stub that can only ever report a wide viewport.
jest.mock('@hooks/useNarrowViewport')
jest.mock('@hooks/useRecentPolls', () => ({
  ...jest.requireActual('@hooks/useRecentPolls'),
  useRecentPolls: jest.fn(),
}))

// The scenes are module-mocked so their call counts stay assertable, but they run their REAL
// implementations. AC-048 is a claim about the levels the page actually emits, and a stub that
// renders `<></>` would have let both of the gaps D-30 and D-31 describe ship green.
const actualScenes = jest.requireActual<typeof import('@components/story/scenes')>('@components/story/scenes')
const actualCreateScene = jest.requireActual<typeof import('@components/story/create-scene')>(
  '@components/story/create-scene',
)
const actualClosingFooter = jest.requireActual<typeof import('@components/story/closing-footer')>(
  '@components/story/closing-footer',
)

const EXPIRATION_SECONDS = 4_102_444_800
const LAST_SEEN_MS = 1_700_000_000_000

const SPRINT_RETRO: RecentPoll = {
  expiration: EXPIRATION_SECONDS,
  lastSeen: LAST_SEEN_MS,
  name: 'Dave',
  pollName: 'Sprint retro',
  seenIntro: true,
  sessionId: 'abc123',
  userId: 'user-1',
}

const clear = jest.fn()
const record = jest.fn()
const remove = jest.fn()
const restore = jest.fn()
const setSeenIntro = jest.fn()

// The page calls the hook on every render, so a `mockReturnValueOnce` would be consumed by the
// first of several. Whole-result overrides are set for a describe and put back after it.
const recentPollsResult = (overrides: Partial<ReturnType<typeof useRecentPolls>> = {}) => ({
  clear,
  polls: [SPRINT_RETRO],
  prunedCount: 0,
  prunedPolls: [],
  record,
  remove,
  restore,
  seenIntro: () => true,
  setSeenIntro,
  ...overrides,
})

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'

/**
 * The heading levels a visitor in `composition` actually meets, in document order.
 *
 * Both compositions are in the DOM at once — that is the whole point of the CSS swap — and jsdom
 * applies no stylesheet, so the one that is `display: none` in a browser is still queryable here.
 * Filtering it out is what makes this the document-level sequence AC-048 is about, and it covers
 * shared regions rather than only the composition's own subtree.
 */
const headingLevels = (composition: 'first-visit' | 'returning'): string[] => {
  const hidden = screen.getByTestId(composition === 'returning' ? 'first-visit-composition' : 'returning-composition')
  return Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
    .filter((heading) => !hidden.contains(heading))
    .map((heading) => heading.tagName.toLowerCase())
}

/** What the page's two door observers report. One answer per ref, so the OR over them is reachable. */
type DoorObserver = typeof useIsIntersecting

const doorsOffScreen: DoorObserver = () => false
const doorsOnScreen: DoorObserver = () => true

/**
 * Reports whichever door ref is asked about first as on screen and the other as permanently off —
 * which is how the hidden composition really behaves, since `display: none` means its door never
 * intersects at all. Which of the two comes first does not matter: the page ORs them.
 */
const oneDoorOnScreen = (): DoorObserver => {
  const seen: unknown[] = []
  return (ref) => {
    const index = seen.indexOf(ref)
    return index === -1 ? seen.push(ref) === 1 : index === 0
  }
}

/** Scrolls both doors out of view on the next render. Pair it with `rerenderPage`. */
const scrollDoorsAway = (): void => {
  jest.mocked(useIsIntersecting).mockImplementation(doorsOffScreen)
}

/** Scrolls both doors back into view on the next render. Pair it with `rerenderPage`. */
const scrollDoorsBack = (): void => {
  jest.mocked(useIsIntersecting).mockImplementation(doorsOnScreen)
}

const page = (): React.ReactElement => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <Index />
  </QueryClientProvider>
)

/**
 * Re-renders the same tree rather than mounting a fresh one, so the page keeps the component
 * instance — and with it the has-observed-door flag, which is a ref and would otherwise reset.
 */
const rerenderPage = (rerender: ReturnType<typeof render>['rerender']): void => rerender(page())

function renderPage({
  narrowViewport = false,
  observeDoors = doorsOffScreen,
  recents,
  returning = false,
  storyOpen = false,
}: {
  narrowViewport?: boolean
  observeDoors?: DoorObserver
  recents?: Partial<ReturnType<typeof useRecentPolls>>
  returning?: boolean
  storyOpen?: boolean
} = {}): ReturnType<typeof render> {
  // Off screen by default, which is the state the static export renders in: the observer's first
  // callback has not run, so nothing has been seen yet and the dock stays away.
  jest.mocked(useIsIntersecting).mockImplementation(observeDoors)
  jest.mocked(useNarrowViewport).mockReturnValue(narrowViewport)
  // Reset on every render, never set only when true, so no test inherits another's document state.
  // Absence is the false case in production — the script deletes the attribute rather than writing
  // "false" — so the first-visit path here is the same state a blocked or thrown script leaves.
  const attributeValues = returning ? ['true'] : []
  document.documentElement.removeAttribute(RECENT_POLLS_ATTRIBUTE)
  attributeValues.forEach((value) => document.documentElement.setAttribute(RECENT_POLLS_ATTRIBUTE, value))
  // The store drives the composition too, not only the attribute. The pre-paint script owns first
  // paint and cannot run again on a client-side navigation, so after mount the store's contents are
  // what decide. Setting only the attribute here would test a coupling the app no longer has -- and
  // that gap is exactly how the client-side-navigation defect survived sixteen section reviews.
  jest.mocked(useRecentPolls).mockReturnValue(recentPollsResult(recents ?? (returning ? {} : { polls: [] })))
  window.localStorage.setItem(LANDING_VIEW_KEY, storyOpen ? 'story-open' : 'story-closed')

  return render(page())
}

/**
 * A paste, the only way jsdom allows one to be made.
 *
 * jsdom implements neither `ClipboardEvent` nor `DataTransfer`, so a real paste event cannot be
 * constructed — a plain `Event` with a `clipboardData` stand-in bolted on is the whole of what is
 * available. `userEvent.paste()` covers the in-field case only, which is why the target is a
 * parameter: the page's own listener is on `document`, and the exclusion it applies depends entirely
 * on where the paste landed.
 */
const pasteOn = (target: EventTarget, text: string): void => {
  const event = Object.assign(new Event('paste', { bubbles: true }), { clipboardData: { getData: () => text } })
  act(() => {
    target.dispatchEvent(event)
  })
}

/** A paste that landed on the page at large — no field, no panel. */
const pasteOnDocument = (text: string): void => pasteOn(document, text)

/**
 * Two animation frames. The panel shows its notice one frame after mount and selects the prefill one
 * frame after that, so a negative assertion made any sooner would pass for the wrong reason.
 */
const settlePanel = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))))
  })
}

describe('Index page', () => {
  beforeAll(() => {
    jest.mocked(fetchConfig).mockResolvedValue({
      allowedSlotMinutes: [15, 30, 60, 90, 120],
      defaultSlotMinutes: 60,
      maxPollDateRangeDays: 365,
      maxPollDates: 90,
      maxPollOverrideGroups: 10,
      maxUsersPerSession: 20,
      participantNameMaxLength: 50,
      pollNameMaxLength: 100,
      sessionExpireHours: 336,
      startEndMinuteStep: 15,
    })
    jest.mocked(SkyBackground).mockReturnValue(<></>)
    jest.mocked(BackToFormCta).mockReturnValue(<></>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
    jest.mocked(PollCreate).mockReturnValue(<div data-testid="poll-create" />)
    // Stands in for the real banner's own `h2` (install-prompt/elements.tsx:99), so the sequence
    // below covers the slot this page puts the offer in rather than skipping over it.
    jest.mocked(InstallPrompt).mockReturnValue(<h2>Install Pick a Time</h2>)
    jest.mocked(HeroScene).mockImplementation(actualScenes.HeroScene)
    jest.mocked(IdentityScene).mockImplementation(actualScenes.IdentityScene)
    jest.mocked(PaintingScene).mockImplementation(actualScenes.PaintingScene)
    jest.mocked(ResultsScene).mockImplementation(actualScenes.ResultsScene)
    jest.mocked(ShareScene).mockImplementation(actualScenes.ShareScene)
    jest.mocked(CreateScene).mockImplementation(actualCreateScene.CreateScene)
    jest.mocked(ClosingFooter).mockImplementation(actualClosingFooter.ClosingFooter)
    jest.mocked(useRecentPolls).mockReturnValue(recentPollsResult())
    jest.mocked(useRouter).mockReturnValue({ push: jest.fn() } as never)
  })

  it('renders the sky background and the back-to-form CTA', () => {
    renderPage()
    expect(SkyBackground).toHaveBeenCalled()
    expect(BackToFormCta).toHaveBeenCalled()
  })

  it('renders all six scenes in order, with the real CreateScene as Scene 2', () => {
    renderPage()
    expect(HeroScene).toHaveBeenCalledTimes(1)
    expect(CreateScene).toHaveBeenCalledTimes(1)
    expect(IdentityScene).toHaveBeenCalledTimes(1)
    expect(PaintingScene).toHaveBeenCalledTimes(1)
    expect(ResultsScene).toHaveBeenCalledTimes(1)
    expect(ShareScene).toHaveBeenCalledTimes(1)
  })

  it('renders a closing footer and a privacy link in each composition', () => {
    renderPage()
    expect(ClosingFooter).toHaveBeenCalledTimes(1)
    expect(PrivacyLink).toHaveBeenCalledTimes(2)
  })

  it('scrolls to the form and focuses its name field synchronously when the hero starts', () => {
    const focusName = jest.fn()
    let onStart: () => void = () => undefined
    jest.mocked(HeroScene).mockImplementationOnce(({ action }: any) => {
      onStart = action.props.onStart
      return <></>
    })
    jest.mocked(CreateScene).mockImplementationOnce(({ registerFocusName }: any) => {
      registerFocusName?.(focusName)
      return <></>
    })

    renderPage()
    onStart()

    // scrollIntoView is polyfilled as a jest.fn() in the test env.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    // Focus fires synchronously inside the gesture (no rAF/timeout) so iOS opens the keyboard.
    expect(focusName).toHaveBeenCalledTimes(1)
  })

  describe('heading order (AC-048)', () => {
    it('emits h1 then only h2s in the first-visit composition', () => {
      renderPage()
      // Hero, Create, Identity, Painting, Results, Share, ClosingFooter, then the shared install
      // offer, which trails both compositions.
      expect(headingLevels('first-visit')).toEqual(['h1', 'h2', 'h2', 'h2', 'h2', 'h2', 'h2', 'h2'])
    })

    it('emits recents h1, the story control, then the shared install offer', () => {
      renderPage({ returning: true })
      expect(headingLevels('returning')).toEqual(['h1', 'h2', 'h2'])
    })

    it('drops the whole story to h3 under the disclosure control when it is open', () => {
      renderPage({ returning: true, storyOpen: true })
      // h1 recents, h2 disclosure, the seven scenes one level deeper, then the shared install offer
      // back at h2. Climbing back up a level is always legal; only skipping DOWN a level is not.
      expect(headingLevels('returning')).toEqual(['h1', 'h2', 'h3', 'h3', 'h3', 'h3', 'h3', 'h3', 'h3', 'h2'])
    })

    it('puts exactly one h1 in each composition', () => {
      renderPage({ returning: true, storyOpen: true })
      expect(headingLevels('first-visit').filter((level) => level === 'h1')).toEqual(['h1'])
      expect(headingLevels('returning').filter((level) => level === 'h1')).toEqual(['h1'])
    })

    it('lets recents own the h1 and does not render a second one for it', () => {
      renderPage({ returning: true })
      const returningComposition = screen.getByTestId('returning-composition')
      expect(within(returningComposition).getByRole('heading', { level: 1 })).toHaveTextContent('Your polls')
    })
  })

  describe('the pre-paint script fallback (AC-043)', () => {
    it('keeps the marketing heading in the markup when the attribute is absent', () => {
      renderPage()
      const firstVisit = screen.getByTestId('first-visit-composition')
      expect(within(firstVisit).getByRole('heading', { level: 1 })).toHaveTextContent(
        "Find the minute everybody's free.",
      )
    })

    it('still ships the marketing heading when the attribute selects the returning composition', () => {
      renderPage({ returning: true })
      const firstVisit = screen.getByTestId('first-visit-composition')
      expect(within(firstVisit).getByRole('heading', { level: 1 })).toHaveTextContent(
        "Find the minute everybody's free.",
      )
    })
  })

  // Every query below is scoped to one composition on purpose. Both compositions are in the DOM at
  // once -- the swap is CSS keyed off `data-recent-polls`, and jsdom applies no stylesheet -- so
  // there are two doors on the page and a bare `getByRole` would throw "found multiple".
  describe('the join-a-poll door', () => {
    const doorIn = (composition: 'first-visit-composition' | 'returning-composition'): HTMLElement =>
      within(screen.getByTestId(composition)).getByRole('button', { name: 'Join a poll' })

    it('offers a way into an existing poll on a first visit (AC-001)', () => {
      renderPage()
      expect(doorIn('first-visit-composition')).toBeEnabled()
    })

    it('offers the same control to a returning visitor, once (AC-002)', () => {
      renderPage({ returning: true })
      const composition = within(screen.getByTestId('returning-composition'))
      expect(composition.getByRole('button', { name: 'Join a poll' })).toBeEnabled()
      // The sentence the door replaced. Two ways in, not three.
      expect(composition.queryByRole('button', { name: 'Enter it and join a poll' })).not.toBeInTheDocument()
    })

    // The control is in the served markup, not added once the store has been read. Rendering with an
    // empty store and no attribute is the state the export was built in, and both compositions
    // carry it there -- so nothing about it can land a frame late and shift the page (AC-004,
    // AC-037).
    it('is in both compositions before anything is known about the device (AC-004)', () => {
      renderPage({ recents: { polls: [] } })
      expect(doorIn('first-visit-composition')).toBeInTheDocument()
      expect(doorIn('returning-composition')).toBeInTheDocument()
    })

    it('stays in both compositions once the device is known to have polls (AC-003)', () => {
      renderPage({ returning: true })
      expect(doorIn('first-visit-composition')).toBeInTheDocument()
      expect(doorIn('returning-composition')).toBeInTheDocument()
    })

    // Not a dialog, deliberately: the panel promises no modality, so it takes neither the role nor
    // the focus trap that role would claim.
    it('opens the join surface from the first-visit composition', async () => {
      renderPage()
      await userEvent.click(doorIn('first-visit-composition'))
      expect(await screen.findByLabelText('Poll code or link')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens the join surface from the returning composition', async () => {
      renderPage({ returning: true })
      await userEvent.click(doorIn('returning-composition'))
      expect(await screen.findByLabelText('Poll code or link')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // One composition's door does not open the other's panel -- they are always both mounted, so a
    // single shared flag would put two panels, two field ids and two live regions on one page.
    it('opens exactly one panel, in the composition whose door was pressed', async () => {
      renderPage({ recents: { polls: [] } })
      await userEvent.click(doorIn('first-visit-composition'))
      expect(await screen.findByLabelText('Poll code or link')).toBeInTheDocument()
      expect(screen.getAllByLabelText('Poll code or link')).toHaveLength(1)
      expect(doorIn('returning-composition')).toHaveAttribute('aria-expanded', 'false')
    })

    // The door is a button, not a heading, and the page's outline is unchanged by it.
    it('leaves the heading sequence alone', () => {
      renderPage({ returning: true })
      expect(headingLevels('returning')).toEqual(['h1', 'h2', 'h2'])
      expect(headingLevels('first-visit')).toEqual(['h1', 'h2', 'h2', 'h2', 'h2', 'h2', 'h2', 'h2'])
    })
  })

  // The dock is a sibling of both compositions, so unlike the doors there is only ever one of it and
  // the queries below are unscoped on purpose.
  describe('the join dock', () => {
    const DOCK_NAME = 'Have a poll code? Enter it and join a poll'

    const dock = (): HTMLElement | null => screen.queryByRole('button', { name: DOCK_NAME })

    const openDock = async (): Promise<void> => {
      await userEvent.click(screen.getByRole('button', { name: DOCK_NAME }))
      await screen.findByLabelText('Poll code or link')
    }

    const suppression = (): boolean | undefined => jest.mocked(BackToFormCta).mock.calls.at(-1)?.[0].suppressed

    // The one that matters most. `useIsIntersecting` starts false and its observer never runs during
    // the static export, so without the has-observed gate `!doorInView` is true in the served HTML
    // and the dock ships visible over the hero.
    it('stays off the page until a door has actually been observed', () => {
      renderPage()
      expect(dock()).not.toBeInTheDocument()
    })

    it('stays off the page while the door is in view', () => {
      renderPage({ observeDoors: doorsOnScreen })
      expect(dock()).not.toBeInTheDocument()
    })

    it('arrives once the door has scrolled away', () => {
      const { rerender } = renderPage({ observeDoors: doorsOnScreen })
      scrollDoorsAway()
      rerenderPage(rerender)
      expect(dock()).toBeInTheDocument()
    })

    // One door on screen has to be proof enough. Both compositions are always in the DOM and the
    // hidden one is `display: none`, so its door reports false forever — ANDing the two observers
    // would mean nothing was ever observed and the dock would never arrive at all.
    it('takes a single door on screen as proof the door was seen', () => {
      const { rerender } = renderPage({ observeDoors: oneDoorOnScreen() })
      scrollDoorsAway()
      rerenderPage(rerender)
      expect(dock()).toBeInTheDocument()
    })

    it('serves a returning visitor the same way', () => {
      const { rerender } = renderPage({ observeDoors: doorsOnScreen, returning: true })
      scrollDoorsAway()
      rerenderPage(rerender)
      expect(dock()).toBeInTheDocument()
    })

    it('opens its own join surface, which is not a dialog', async () => {
      const { rerender } = renderPage({ observeDoors: doorsOnScreen })
      scrollDoorsAway()
      rerenderPage(rerender)
      await openDock()
      expect(screen.getByLabelText('Poll code or link')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Scrolling back to the hero while the panel is open would otherwise unmount it and throw away
    // the code the visitor had already typed.
    it('keeps an open panel when the door scrolls back into view', async () => {
      const { rerender } = renderPage({ observeDoors: doorsOnScreen })
      scrollDoorsAway()
      rerenderPage(rerender)
      await openDock()

      scrollDoorsBack()
      rerenderPage(rerender)

      expect(screen.getByLabelText('Poll code or link')).toBeInTheDocument()
    })

    it('leaves the back-to-form button alone while it is only a closed pill', () => {
      const { rerender } = renderPage({ narrowViewport: true, observeDoors: doorsOnScreen })
      scrollDoorsAway()
      rerenderPage(rerender)
      expect(suppression()).toBe(false)
    })

    it('takes the bottom edge from the back-to-form button below md', async () => {
      const { rerender } = renderPage({ narrowViewport: true, observeDoors: doorsOnScreen })
      scrollDoorsAway()
      rerenderPage(rerender)
      await openDock()
      expect(suppression()).toBe(true)
    })

    it('shares the bottom edge above md, where the two corners do not meet', async () => {
      const { rerender } = renderPage({ observeDoors: doorsOnScreen })
      scrollDoorsAway()
      rerenderPage(rerender)
      await openDock()
      expect(suppression()).toBe(false)
    })
  })

  // Someone holding a poll link that will not open for them — an installed PWA that hands taps back
  // to the browser, a link that landed on another device — pastes it onto this page. The gate is
  // PROVENANCE, never shape: `parseSessionCode` alone accepts `lazy giraffe`, so gating on it would
  // fire on every two-word paste on the page, and two words are also a poll NAME.
  describe('the paste reach', () => {
    it('hands focus to the door when closing the dock also removes it', async () => {
      // Closing at scroll 0 unmounts the dock in the same commit, so its own focus return cannot
      // run. Without the page stepping in, the browser drops focus to <body> and a keyboard visitor
      // restarts the page from the top.
      // Doors on screen: this is scroll 0, where the paste reach actually happens, and where the
      // dock exists ONLY through `isDockOpen` -- so closing it removes it.
      renderPage({ observeDoors: doorsOnScreen })
      pasteOnDocument('https://pick-a-time.com/p/lazy-giraffe')
      await settlePanel()

      await userEvent.click(screen.getByRole('button', { name: 'Close' }))

      expect(document.body).not.toHaveFocus()
      expect(
        within(screen.getByTestId('first-visit-composition')).getByRole('button', { name: 'Join a poll' }),
      ).toHaveFocus()
    })

    it('never leaves two join panels open at once', async () => {
      // Both compositions stay mounted and the dock is independent of them, so without an explicit
      // rule a visitor can end up with two fields both named "Poll code or link", two alert regions
      // and two status regions on one page -- and a code typed into whichever one scrolled away.
      renderPage({ observeDoors: doorsOnScreen })
      pasteOnDocument('https://pick-a-time.com/p/lazy-giraffe')
      await settlePanel()
      expect(await screen.findByLabelText('Poll code or link')).toBeInTheDocument()

      await userEvent.click(
        within(screen.getByTestId('first-visit-composition')).getByRole('button', { name: 'Join a poll' }),
      )
      await settlePanel()

      expect(screen.getAllByLabelText('Poll code or link')).toHaveLength(1)
    })

    it('ignores a paste that arrives while the panel is already open', async () => {
      // The panel applies its prefill on mount only -- deliberately, so a later one cannot overwrite
      // what the visitor has typed. So a reach into an ALREADY-OPEN panel would render a notice
      // promising "here's the code to join it" over a field that never receives one: a promise the
      // surface then fails to keep, announced to a screen reader as part of the field's description.
      renderScrolledPast()
      // Opened deliberately, by pressing the DOCK -- so the field starts empty. Pressing the door
      // would open the door's panel instead, which the reach is entitled to close.
      await userEvent.click(screen.getByRole('button', { name: /^Have a poll code\?/ }))
      await settlePanel()
      expect(await screen.findByLabelText('Poll code or link')).toHaveValue('')

      pasteOnDocument('https://pick-a-time.com/p/lazy-giraffe')
      await settlePanel()

      expect(screen.queryByText("That link goes to a poll — here's the code to join it.")).not.toBeInTheDocument()
    })

    it('keeps the pasted URL out of the poll name it was aimed at', async () => {
      // The reach takes over, so the paste must not also land in "Name your poll" -- that value is
      // lifted into the mid-page create form, and would become the poll's name.
      renderPage()
      const nameField = within(screen.getByTestId('first-visit-composition')).getByLabelText('Name your poll')
      nameField.focus()
      const event = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), {
        clipboardData: { getData: () => 'https://pick-a-time.com/p/lazy-giraffe' },
      })
      act(() => {
        nameField.dispatchEvent(event)
      })
      await settlePanel()

      expect(event.defaultPrevented).toBe(true)
      expect(nameField).toHaveValue('')
    })

    const DOCK_NAME = 'Have a poll code? Enter it and join a poll'

    const field = (): HTMLElement => screen.getByLabelText('Poll code or link')

    const doorIn = (composition: 'first-visit-composition' | 'returning-composition'): HTMLElement =>
      within(screen.getByTestId(composition)).getByRole('button', { name: 'Join a poll' })

    /** The page with both doors on screen — the state the reach has to work in anyway. */
    const renderAtTheTop = (): ReturnType<typeof render> => renderPage({ observeDoors: doorsOnScreen })

    /** The page scrolled past the doors, so the dock survives being closed. */
    const renderScrolledPast = (): ReturnType<typeof render> => {
      const rendered = renderPage({ observeDoors: doorsOnScreen })
      scrollDoorsAway()
      rerenderPage(rendered.rerender)
      return rendered
    }

    it('reaches for someone who pasted a poll link', async () => {
      renderAtTheTop()
      pasteOnDocument('https://pick-a-time.com/p/lazy-giraffe')

      expect(await screen.findByLabelText('Poll code or link')).toHaveValue('lazy giraffe')
      expect(await screen.findByText(JOIN_COPY.pasteNotice)).toBeInTheDocument()
    })

    // The dock, never the door — at any scroll position, including this one, where the door is still
    // on screen and would otherwise be the closer surface. The door's anchor is reserved for a
    // visitor who deliberately pressed it.
    it('opens the dock even with the door still in view', async () => {
      renderAtTheTop()
      pasteOnDocument('https://pick-a-time.com/p/lazy-giraffe')

      await screen.findByLabelText('Poll code or link')
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
      expect(doorIn('first-visit-composition')).toHaveAttribute('aria-expanded', 'false')
    })

    // The host is discarded by the gate, so a link claiming any origin at all resolves to a code this
    // origin will route — never to somewhere else entirely.
    // Stricter than the join FIELD's rule, deliberately. Typing a code into the field is a considered
    // act, so taking the segment from any host is right there. This listener pre-empts the visitor's
    // own paste, and every `.../p/...` URL on the web has the shape of a poll link -- so a foreign
    // host here would swallow an Instagram paste and announce a poll that does not exist.
    it("stays out of the way of a poll-shaped link on somebody else's host", async () => {
      renderAtTheTop()
      pasteOnDocument('https://www.instagram.com/p/DAbc_123/')
      await settlePanel()

      expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument()
      expect(screen.queryByText(JOIN_COPY.pasteNotice)).not.toBeInTheDocument()
    })

    it('does not swallow a paste it has declined', async () => {
      renderAtTheTop()
      const nameField = within(screen.getByTestId('first-visit-composition')).getByLabelText('Name your poll')
      nameField.focus()
      const event = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), {
        clipboardData: { getData: () => 'https://www.instagram.com/p/DAbc_123/' },
      })
      act(() => {
        nameField.dispatchEvent(event)
      })
      await settlePanel()

      expect(event.defaultPrevented).toBe(false)
    })

    // The one that decides the design. Nothing at all — no panel, no flicker, no notice.
    it('stays silent for two words, which are also a poll name', async () => {
      renderAtTheTop()
      pasteOnDocument('lazy giraffe')
      await settlePanel()

      expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument()
      expect(screen.queryByText(JOIN_COPY.pasteNotice)).not.toBeInTheDocument()
    })

    it('refuses text carrying two poll paths, because it names no single poll', async () => {
      renderAtTheTop()
      pasteOnDocument('/p/one and /p/two')
      await settlePanel()

      expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument()
    })

    // Legitimately null in some real browsers.
    it('survives a paste event carrying no clipboard at all', async () => {
      renderAtTheTop()
      act(() => {
        document.dispatchEvent(new Event('paste', { bubbles: true }))
      })
      await settlePanel()

      expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument()
    })

    // The field handles it, and explaining a displacement that did not happen would be nonsense.
    it('renders no notice for a paste inside the open panel', async () => {
      renderScrolledPast()
      await userEvent.click(screen.getByRole('button', { name: DOCK_NAME }))
      await screen.findByLabelText('Poll code or link')

      pasteOn(field(), 'https://pick-a-time.com/p/lazy-giraffe')
      await settlePanel()

      expect(screen.queryByText(JOIN_COPY.pasteNotice)).not.toBeInTheDocument()
    })

    // A visitor who was already typing into "Name your poll" is unambiguously lost, so this one DOES
    // fire — and the door's panel closes with it, because one surface is open at a time.
    it('fires for a paste into the create form and closes the door it displaced', async () => {
      renderAtTheTop()
      await userEvent.click(doorIn('first-visit-composition'))
      await screen.findByLabelText('Poll code or link')

      pasteOn(screen.getAllByLabelText('Name your poll')[0], 'https://pick-a-time.com/p/lazy-giraffe')

      expect(await screen.findByText(JOIN_COPY.pasteNotice)).toBeInTheDocument()
      expect(screen.getAllByLabelText('Poll code or link')).toHaveLength(1)
      expect(doorIn('first-visit-composition')).toHaveAttribute('aria-expanded', 'false')
    })

    // Inference opens a door; it never walks through it. The visitor still presses Join poll.
    it('never submits on the visitor’s behalf', async () => {
      renderAtTheTop()
      pasteOnDocument('https://pick-a-time.com/p/lazy-giraffe')
      await screen.findByText(JOIN_COPY.pasteNotice)

      expect(jest.mocked(fetchPoll)).not.toHaveBeenCalled()
    })

    // A one-shot. The next deliberate press of the dock is someone who wants to type, and a code from
    // minutes ago sitting in the field under a notice explaining a displacement that is over would be
    // a worse start than an empty one.
    it('forgets the prefill and the notice once the dock is closed', async () => {
      renderScrolledPast()
      pasteOnDocument('https://pick-a-time.com/p/lazy-giraffe')
      await screen.findByText(JOIN_COPY.pasteNotice)

      await userEvent.click(screen.getByRole('button', { name: 'Close' }))
      await userEvent.click(screen.getByRole('button', { name: DOCK_NAME }))
      await screen.findByLabelText('Poll code or link')
      await settlePanel()

      expect(field()).toHaveValue('')
      expect(screen.queryByText(JOIN_COPY.pasteNotice)).not.toBeInTheDocument()
    })
  })

  describe('recents wiring', () => {
    it('mounts one useRecentPolls and passes its list down', () => {
      renderPage({ returning: true })
      expect(screen.getByRole('link', { name: /Sprint retro/ })).toBeInTheDocument()
    })

    it('hands removal back to the single hook instance', async () => {
      renderPage({ returning: true })
      await userEvent.click(screen.getByRole('button', { name: 'Remove Sprint retro from your polls' }))
      expect(remove).toHaveBeenCalledWith('abc123')
    })

    it('hands undo back to the single hook instance', async () => {
      renderPage({ returning: true })
      await userEvent.click(screen.getByRole('button', { name: 'Remove Sprint retro from your polls' }))
      await userEvent.click(screen.getByRole('button', { name: 'Undo removing Sprint retro' }))
      expect(restore).toHaveBeenCalledWith(SPRINT_RETRO)
    })
  })

  describe('recents wiring when the read pruned entries', () => {
    // Passed per render rather than set in beforeAll: renderPage now drives the store as well as
    // the attribute, because the page derives its composition from the store after mount.
    const prunedRecents = {
      prunedCount: 2,
      prunedPolls: [
        { ...SPRINT_RETRO, pollName: 'Cabin trip', sessionId: 'gone-1' },
        { ...SPRINT_RETRO, pollName: 'Design crit', sessionId: 'gone-2' },
      ],
    }

    it('passes the prune result down rather than recomputing it', () => {
      renderPage({ recents: prunedRecents, returning: true })
      expect(screen.getByText("2 polls closed, so they're no longer in your polls.")).toBeInTheDocument()
      expect(screen.getByText('Cabin trip and Design crit')).toBeInTheDocument()
    })

    it('leaves the heading sequence alone when a prune notice is on screen', () => {
      renderPage({ recents: prunedRecents, returning: true })
      expect(headingLevels('returning')).toEqual(['h1', 'h2', 'h2'])
    })
  })

  describe('the story disclosure and pat_landing_view', () => {
    it('offers the story collapsed, with the approved label and hint', () => {
      renderPage({ returning: true })
      const control = screen.getByRole('button', { name: 'Show how it works' })
      expect(control).toHaveAttribute('aria-expanded', 'false')
      expect(
        screen.getByText('A short tour of how a poll works. Open it and it stays open next time.'),
      ).toBeInTheDocument()
    })

    it('remembers an opened story', async () => {
      renderPage({ returning: true })
      await userEvent.click(screen.getByRole('button', { name: 'Show how it works' }))
      expect(window.localStorage.getItem(LANDING_VIEW_KEY)).toBe('story-open')
      expect(screen.getByRole('button', { name: 'Hide how it works' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('remembers a closed story', async () => {
      renderPage({ returning: true, storyOpen: true })
      await userEvent.click(screen.getByRole('button', { name: 'Hide how it works' }))
      expect(window.localStorage.getItem(LANDING_VIEW_KEY)).toBe('story-closed')
    })

    it('reopens the story on arrival when that is the stored preference', () => {
      renderPage({ returning: true, storyOpen: true })
      expect(screen.getByRole('button', { name: 'Hide how it works' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('names the control by the disclosure hint', () => {
      renderPage({ returning: true })
      expect(screen.getByRole('button', { name: 'Show how it works' })).toHaveAccessibleDescription(
        'A short tour of how a poll works. Open it and it stays open next time.',
      )
    })

    it('opens the story and reaches its create form when the returning starter starts', async () => {
      renderPage({ returning: true })
      const starters = screen.getAllByRole('button', { name: 'Start' })
      await userEvent.click(starters[0])
      expect(window.localStorage.getItem(LANDING_VIEW_KEY)).toBe('story-open')
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })

  describe('the returning starter', () => {
    const focusTourName = jest.fn()

    beforeAll(() => {
      jest.mocked(PollCreate).mockImplementation(({ registerFocusName }) => {
        registerFocusName?.(focusTourName)
        return <div data-testid="poll-create" />
      })
    })

    afterAll(() => {
      jest.mocked(PollCreate).mockReturnValue(<div data-testid="poll-create" />)
    })

    it('focuses the create form inside the story it just revealed', async () => {
      renderPage({ returning: true, storyOpen: true })
      await userEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])
      expect(focusTourName).toHaveBeenCalled()
    })
  })

  describe('pat_landing_view (AC-018)', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    } as unknown as Storage

    it('reads a closed story when storage throws', () => {
      expect(readLandingView(throwingStorage)).toBe(false)
    })

    it('loses the preference rather than the page when a write throws', () => {
      expect(() => writeLandingView(true, throwingStorage)).not.toThrow()
    })

    it('writes the preference under the one key this page owns', () => {
      writeLandingView(true, window.localStorage)
      expect(window.localStorage.getItem(LANDING_VIEW_KEY)).toBe('story-open')
      writeLandingView(false, window.localStorage)
      expect(window.localStorage.getItem(LANDING_VIEW_KEY)).toBe('story-closed')
    })
  })

  describe('the sky background', () => {
    it('is unpinned on the render that has to match the served markup', () => {
      renderPage({ returning: true })
      expect(jest.mocked(SkyBackground).mock.calls[0][0]).toEqual({ pinned: false })
    })

    it('pins the sky once the returning composition is known and the story is collapsed', () => {
      renderPage({ returning: true })
      expect(jest.mocked(SkyBackground).mock.calls.at(-1)?.[0]).toEqual({ pinned: true })
    })

    it('lets the sky arc again when the story is open', () => {
      renderPage({ returning: true, storyOpen: true })
      expect(jest.mocked(SkyBackground).mock.calls.at(-1)?.[0]).toEqual({ pinned: false })
    })

    it('lets the sky arc for a first visit', () => {
      renderPage()
      expect(jest.mocked(SkyBackground).mock.calls.at(-1)?.[0]).toEqual({ pinned: false })
    })
  })

  describe('the install offer', () => {
    it('puts exactly one on the page, because nothing else in the app mounts it', () => {
      renderPage({ returning: true })
      expect(screen.getAllByText('Install Pick a Time')).toHaveLength(1)
    })

    // Mounted inside the returning composition, a first-visit visitor -- the large majority --
    // would never see an install offer at all, and AC-023/AC-032/AC-034 are about offering
    // installation in the first place, not about offering it to people who already came back.
    it('is offered in both compositions, from a single shared mount', () => {
      renderPage()
      expect(screen.getAllByText('Install Pick a Time')).toHaveLength(1)
      expect(screen.getByTestId('first-visit-composition').contains(screen.getByText('Install Pick a Time'))).toBe(
        false,
      )

      cleanup()
      renderPage({ returning: true })
      expect(screen.getByTestId('returning-composition').contains(screen.getByText('Install Pick a Time'))).toBe(false)
    })
  })

  // The export is built with an empty store, so anything rendered from that store lands in the
  // shipped HTML -- and the pre-paint script reveals the returning wrapper before paint. Rendering
  // RecentPolls unconditionally therefore ships "No polls on this device yet" to exactly the
  // visitor who has polls. The attribute already proves there is at least one live entry.
  describe('first paint for a returning visitor', () => {
    it('reserves the recents slot rather than prerendering an empty state', () => {
      jest.mocked(useRecentPolls).mockReturnValue(recentPollsResult({ polls: [] }))
      renderPage()

      expect(screen.queryByText('No polls on this device yet.')).not.toBeInTheDocument()

      jest.mocked(useRecentPolls).mockReturnValue(recentPollsResult())
    })
  })

  // The pre-paint script runs once per full document load. Tapping the brand link from a poll you
  // just answered is a client-side navigation, so it never runs again and its attribute is absent —
  // and the entry written moments earlier would be invisible until a hard reload. That is the P-1
  // population exactly. Sixteen section reviews missed it because the harness set the attribute by
  // hand while the store was mocked, so the two were never wired together.
  describe('arriving by client-side navigation, with no fresh script run', () => {
    it('shows the recents list from the store when the attribute is absent', () => {
      renderPage({ recents: { polls: [SPRINT_RETRO] }, returning: false })

      expect(screen.getByText('Sprint retro')).toBeInTheDocument()
    })

    it('writes the attribute back so the CSS swap follows', () => {
      renderPage({ recents: { polls: [SPRINT_RETRO] }, returning: false })

      expect(document.documentElement.getAttribute(RECENT_POLLS_ATTRIBUTE)).toEqual('true')
    })

    // A rerender, not a fresh render: clearing happens to a page already showing a list, and the
    // attribute must not perpetuate itself once the store has been read.
    it('puts the story back when the last poll is cleared', () => {
      const { rerender } = renderPage({ recents: { polls: [SPRINT_RETRO] }, returning: true })
      jest.mocked(useRecentPolls).mockReturnValue(recentPollsResult({ polls: [] }))

      rerender(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Index />
        </QueryClientProvider>,
      )

      expect(document.documentElement.getAttribute(RECENT_POLLS_ATTRIBUTE)).toBeNull()
    })
  })
})
