import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import InstallPrompt from '@components/install-prompt'
import PollCreate from '@components/poll-create'
import PrivacyLink from '@components/privacy-link'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'
import { RecentPoll, useRecentPolls } from '@hooks/useRecentPolls'
import Index, { LANDING_VIEW_KEY, RECENT_POLLS_ATTRIBUTE, readLandingView, writeLandingView } from '@pages/index'
import { fetchConfig } from '@services/api'
import '@testing-library/jest-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
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

function renderPage({
  recents,
  returning = false,
  storyOpen = false,
}: { recents?: Partial<ReturnType<typeof useRecentPolls>>; returning?: boolean; storyOpen?: boolean } = {}): ReturnType<
  typeof render
> {
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

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Index />
    </QueryClientProvider>,
  )
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
