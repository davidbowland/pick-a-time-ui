import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import Poll, { PollGoneState, isPollGone } from './index'
import { useAuthContext } from '@components/auth-context'
import { useInstallPrompt } from '@hooks/useInstallPrompt'
import { RECENT_POLLS_KEY, RecentPoll } from '@hooks/useRecentPolls'
import { useSessionCookie } from '@hooks/useSessionCookie'
import {
  createUser,
  fetchAvailability,
  fetchConfig,
  fetchOverlap,
  fetchPoll,
  fetchUsers,
  patchAvailability,
} from '@services/api'
import '@testing-library/jest-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PollData, User } from '@types'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'
import { InstallCapability } from '@utils/install-capability'

jest.mock('@services/api')
jest.mock('@hooks/useInstallPrompt')
jest.mock('@hooks/useSessionCookie')
jest.mock('@utils/detectViewerTimezone')
jest.mock('@components/auth-context')

describe('Poll', () => {
  // Every render below injects this clock, so nothing in this file compares stored expirations
  // against the wall clock. It sits before the fixture poll's expiration and before the seeded
  // entry's, which is what keeps both of them "live" on any day this suite runs.
  const fixedNow = (): number => 1_700_000_000_000

  // What the install hook reports for the render under way. Only the two install tests change it,
  // and the teardown below puts it back — a leaked `ios-share` would put a banner into every later
  // test in this file.
  const installOffer = { capability: 'none' as InstallCapability }

  /** An in-memory `Storage`, so a test can read exactly what the component wrote. */
  function memoryStorage(seed: Record<string, string> = {}): Storage {
    const data = new Map<string, string>(Object.entries(seed))
    return {
      clear: () => data.clear(),
      getItem: (key: string) => data.get(key) ?? null,
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size
      },
      removeItem: (key: string) => {
        data.delete(key)
      },
      // A jest.fn so a test can count writes: "one entry" and "written once" are different claims,
      // and only the second catches a record that fires again on every refetch.
      setItem: jest.fn((key: string, value: string) => {
        data.set(key, value)
      }),
    }
  }

  const storedPolls = (storage: Storage): RecentPoll[] =>
    (JSON.parse(storage.getItem(RECENT_POLLS_KEY) ?? '{"polls":[]}') as { polls: RecentPoll[] }).polls
  const poll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04', '2025-09-05', '2025-09-06'], // Thu, Fri, Sat
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1200,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1725453600,
    participantCount: 1,
    // Two slots (not one) — a single-slot timed poll collapses to the same no-header-row
    // rendering as a dates-only poll (see painting/grid.tsx's `showSlotHeader`/results/index.tsx's
    // `slotLabels`, both keyed off the union column count via `buildUnionColumns(poll.slots)`),
    // which would make this smoke-test fixture exercise the wrong grid shape for a poll that's
    // supposed to be genuinely timed.
    slots: [
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 }, // 6:00-7:00 PM
        { slotIndex: 1, startMinute: 1140, endMinute: 1200 }, // 7:00-8:00 PM
      ],
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 },
        { slotIndex: 1, startMinute: 1140, endMinute: 1200 },
      ],
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 },
        { slotIndex: 1, startMinute: 1140, endMinute: 1200 },
      ],
    ],
  }
  const existingUser: User = { userId: 'quiet-falcon', name: 'Quiet Falcon' }
  const config = {
    maxPollDates: 90,
    pollNameMaxLength: 100,
    participantNameMaxLength: 50,
    allowedSlotMinutes: [15, 30, 60, 90, 120],
    defaultSlotMinutes: 60,
    startEndMinuteStep: 15,
    maxPollDateRangeDays: 365,
    maxPollOverrideGroups: 10,
    maxUsersPerSession: 20,
    sessionExpireHours: 336,
  }

  beforeAll(() => {
    jest.mocked(useSessionCookie).mockReturnValue({ userId: undefined, setUserId: jest.fn(), clearUserId: jest.fn() })
    // usePollOnboarding reads real window.localStorage. Three of the tests below reach the identity
    // phase using this poll's sessionId ("amber-harbor") and assert on the poll name via
    // `findByText` — they don't exercise onboarding, so mark it "already dismissed" here to keep
    // the first-visit intro overlay from duplicating that text. The two onboarding-specific tests
    // further down use their own distinct sessionId and never touch this entry.
    //
    // ADR-4 moved that flag out of its own `pat_onboarded_{sessionId}` key and into the recents
    // entry, so seeding the old key does nothing now. `expiration` is epoch SECONDS (see
    // src/utils/dates.ts) — passing milliseconds here reads as a date in the year 55000 and would
    // work by accident, which is worse than failing.
    window.localStorage.setItem(
      'pat_recent_polls',
      JSON.stringify({
        migrated: true,
        polls: [
          {
            expiration: 1_800_000_000,
            lastSeen: 1_700_000_000_000,
            name: 'Dave',
            pollName: 'Lunch with friends',
            seenIntro: true,
            sessionId: 'amber-harbor',
            userId: 'u_seed',
          },
        ],
      }),
    )
    jest.mocked(useInstallPrompt).mockImplementation(() => ({
      capability: installOffer.capability,
      dismiss: jest.fn(),
      isDismissed: false,
      prompt: jest.fn().mockResolvedValue(false),
    }))
    jest.mocked(detectViewerTimezone).mockReturnValue('America/Chicago')
    jest.mocked(fetchConfig).mockResolvedValue(config)
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoading: false,
      handleSignIn: jest.fn(),
      handleSignOut: jest.fn(),
    })
  })

  // Teardown, not arrangement: `clearMocks` clears calls but keeps implementations, so the offer
  // set by an install test would otherwise persist into every test after it.
  afterEach(() => {
    installOffer.capability = 'none'
  })

  function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  it('should show the identity phase once the poll and empty user list load', async () => {
    jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
    jest.mocked(fetchUsers).mockResolvedValueOnce([])

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()
  })

  it('should reach the active phase with a painting/results tab switch once an existing user is identified', async () => {
    // Identify via the ?id= query param (read once on mount) rather than mocking the cookie
    // hook's return value per-render: `useSessionCookie` is called on every render as queries
    // resolve, so a `mockReturnValueOnce` override only survives the first of several renders.
    window.history.pushState(null, '', `?id=${existingUser.userId}`)
    // Sticky (not -Once) mocks: opening the overlap tab invalidates and refetches poll and users.
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    jest.mocked(fetchUsers).mockResolvedValue([existingUser])
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()
    const paintingTab = screen.getByRole('tab', { name: 'Your hours' })
    const resultsTab = screen.getByRole('tab', { name: 'The overlap' })
    expect(paintingTab).toHaveAttribute('aria-selected', 'true')
    expect(resultsTab).toHaveAttribute('aria-selected', 'false')
    // The Share component is genuinely reachable in the active phase, once a real userId is
    // resolved — not orphaned/unmounted dead code (its Copy button carries an accessible name).
    expect(screen.getByLabelText('Copy link')).toBeInTheDocument()
    // Painting tab is showing the real grid, driven by the availability query.
    expect(await screen.findByText('Select all')).toBeInTheDocument()

    await userEvent.click(resultsTab)

    expect(paintingTab).toHaveAttribute('aria-selected', 'false')
    expect(resultsTab).toHaveAttribute('aria-selected', 'true')
    // Results tab is showing the real overlap panel, driven by the overlap query.
    expect(
      await screen.findByText(
        'No overlap yet. Once everybody paints their availability, the best time will show up here.',
      ),
    ).toBeInTheDocument()
  })

  it('should refetch the poll and users when opening the overlap tab, so participant totals are not stale', async () => {
    // The overlap query refetches on its own when ResultsPhase mounts; without these two
    // refetches a fresher overlap renders against a pre-join participantCount ("2 of 1 free").
    window.history.pushState(null, '', `?id=${existingUser.userId}`)
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    jest.mocked(fetchUsers).mockResolvedValue([existingUser])
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()
    expect(fetchPoll).toHaveBeenCalledTimes(1)
    expect(fetchUsers).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('tab', { name: 'The overlap' }))

    await waitFor(() => expect(fetchPoll).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(2))
  })

  it('should forward the fetched users down to the results phase so the heat-grid can show real names', async () => {
    // Proves `users` is actually threaded Poll -> ResultsPhase -> HeatGrid: this file mocks only
    // `@services/api` and renders the real ResultsPhase (unlike a mocked-child assertion), so the
    // only way to observe the forwarded prop is behaviorally — a real display name appearing once
    // a heat-grid cell naming this user is activated.
    // The free user is deliberately NOT the signed-in viewer: the viewer renders as "You"
    // (covered in heat-grid.test.tsx), and this test is about real names being forwarded.
    const otherUser: User = { userId: 'mellow-heron', name: 'Mellow Heron' }
    window.history.pushState(null, '', `?id=${existingUser.userId}`)
    // Sticky (not -Once) mocks: opening the overlap tab invalidates and refetches poll and users.
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    jest.mocked(fetchUsers).mockResolvedValue([existingUser, otherUser])
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: {
        cells: [
          [
            {
              dateIndex: 0,
              slotIndex: 0,
              startMinute: 1080,
              endMinute: 1140,
              freeCount: 1,
              freeUserIds: [otherUser.userId],
            },
          ],
        ],
        bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 1, freeUserIds: [] },
      },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'The overlap' }))

    // "1 of 2 free": the roster fetched two users, and the participant total honors the roster
    // over this fixture's (stale) participantCount of 1.
    // `Thu, Sep 4`: cell labels carry the long formatShortDate form, not the abbreviated row header.
    await userEvent.click(await screen.findByRole('button', { name: /thu, sep 4.*6:00.*1 of 2 free/i }))

    expect(within(screen.getByRole('dialog')).getByText('Mellow Heron')).toBeInTheDocument()
  })

  it('should show a loading indicator while the poll and users are still being fetched', async () => {
    let resolvePoll: (value: PollData) => void = () => {}
    jest.mocked(fetchPoll).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve
        }),
    )
    jest.mocked(fetchUsers).mockResolvedValueOnce([])

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByRole('status')).toBeInTheDocument()

    resolvePoll(poll)

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()
  })

  it('should show an error state with a retry option when the poll fails to load', async () => {
    jest.mocked(fetchPoll).mockRejectedValueOnce(new Error('network error'))
    jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
    jest.mocked(fetchUsers).mockResolvedValue([])

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load this poll/i)

    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()
  })

  it('should reach the active phase after auto-creating a new user in a brand-new (empty) poll', async () => {
    // This is the exact journey C1 broke: a first-time visitor lands on an empty poll,
    // IdentityPhase auto-creates a user, and the app must advance past the identity screen.
    // Reproducing it requires `useSessionCookie` to behave like the real hook — reflecting the
    // id passed to `setUserId` on the next render — rather than the shared no-op mock other
    // tests in this file use, since the whole bug was that a stale `users` list combined with a
    // cookie that never got read back would leave the phase machine stuck forever.
    window.history.replaceState(null, '', '/')
    const newUser: User = { userId: 'bright-heron', name: null }
    let currentUserId: string | undefined
    const setUserId = jest.fn((id: string) => {
      currentUserId = id
    })
    jest.mocked(useSessionCookie).mockImplementation(() => ({
      clearUserId: jest.fn(),
      setUserId,
      userId: currentUserId,
    }))

    jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
    // Second poll load: selecting a user invalidates the poll query too, so its
    // participantCount can't go stale against the fresher users/overlap data.
    jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
    // First load: the group is empty, which is what makes IdentityPhase auto-create a user.
    jest.mocked(fetchUsers).mockResolvedValueOnce([])
    // Second load: fired by the mandatory invalidateQueries in the fix — without it this
    // mock is never consumed and the test times out waiting on the active phase.
    jest.mocked(fetchUsers).mockResolvedValueOnce([newUser])
    jest.mocked(createUser).mockResolvedValueOnce(newUser)
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: newUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      recommendedMeetings: [],
      grid: { bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] }, cells: [] },
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()

    // The combined handler both sets the cookie and invalidates the users query.
    await waitFor(() => expect(setUserId).toHaveBeenCalledWith('bright-heron'))

    // The phase machine actually advances past `identity` into `active` — painting/results
    // tabs appear, which is the concrete, observable proof this is no longer stuck.
    expect(await screen.findByRole('tab', { name: 'Your hours' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'The overlap' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Your hours' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the first-visit intro above the identity step and hides it once dismissed', async () => {
    // usePollOnboarding's storage key is derived solely from sessionId, so using a session id
    // no other test in this file touches guarantees a fresh (undismissed) onboarding state
    // without reaching into localStorage directly.
    jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
    jest.mocked(fetchUsers).mockResolvedValueOnce([])

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor-onboarding-intro" />)

    expect(await screen.findByText(/no account needed/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /got it/i }))

    expect(screen.queryByText(/no account needed/i)).not.toBeInTheDocument()
  })

  it('keeps the header free of a What is this? affordance in the active phase', async () => {
    // The one-time intro card covers first-visit orientation and the overlap tab's
    // participation status line covers the live-overlap mechanic, so the header carries no
    // help toggle — its layout never shifts.
    window.history.pushState(null, '', `?id=${existingUser.userId}`)
    jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
    jest.mocked(fetchUsers).mockResolvedValueOnce([existingUser])
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor-onboarding-toggle" />)

    await screen.findByRole('tab', { name: 'Your hours' })

    expect(screen.queryByRole('button', { name: /what is this/i })).not.toBeInTheDocument()
  })

  it('shows the poll expiration as a plain fact in the header', async () => {
    const pollWithKnownExpiration: PollData = { ...poll, expiration: Date.UTC(2026, 7, 24, 17, 30) / 1000 }
    jest.mocked(fetchPoll).mockResolvedValueOnce(pollWithKnownExpiration)
    jest.mocked(fetchUsers).mockResolvedValueOnce([])

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByText('Closes Aug 24, 2026 at 12:30 PM')).toBeInTheDocument()
  })

  it("shows the current voter's identity control once the active phase is reached", async () => {
    window.history.pushState(null, '', `?id=${existingUser.userId}`)
    jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
    jest.mocked(fetchUsers).mockResolvedValueOnce([existingUser])
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByText('Lunch with friends')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "This isn't me" })).toBeInTheDocument()
  })

  it('clears the cookie and falls back to the identity phase when "This isn\'t me" is clicked', async () => {
    // Reset first: `consumeQueryParamId()` is only read once at mount, and it takes priority over
    // the cookie-based userId — a `?id=` param left behind by an earlier test in this file (they
    // don't clean up after themselves; see the "auto-creating" test above doing the same reset)
    // would make this test's "falls back to identity" assertion pass or fail depending on run order.
    window.history.replaceState(null, '', '/')
    let currentUserId: string | undefined = existingUser.userId
    const clearUserId = jest.fn(() => {
      currentUserId = undefined
    })
    jest.mocked(useSessionCookie).mockImplementation(() => ({
      clearUserId,
      setUserId: jest.fn(),
      userId: currentUserId,
    }))
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    jest.mocked(fetchUsers).mockResolvedValue([existingUser])
    jest.mocked(fetchAvailability).mockResolvedValue({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByRole('button', { name: "This isn't me" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: "This isn't me" }))

    expect(clearUserId).toHaveBeenCalled()
    expect(await screen.findByText('Who are you on this poll?')).toBeInTheDocument()
    expect(screen.getByText('· last used')).toBeInTheDocument()
    // Focus and screen-reader users must not be stranded on <body> once the active-phase
    // subtree (including the "This isn't me" button itself) unmounts and the picker swaps in.
    // Focus lands on the matching "last used" radio option directly, not the heading, so picking
    // yourself back is one Enter/Space press away.
    await waitFor(() => expect(screen.getByRole('radio', { name: /quiet falcon/i })).toHaveFocus())
  })

  it('resets to the "Your hours" tab after switching to a different user', async () => {
    // The tab state lives in the Poll component and survives the "This isn't me" -> identity ->
    // re-join round trip, so without an explicit reset a switched user inherits the previous
    // voter's "The overlap" tab instead of starting on their own hours.
    window.history.replaceState(null, '', '/')
    const otherUser: User = { userId: 'bold-otter', name: 'Bold Otter' }
    // Unlike the closure-variable mocks above, this flow needs the cookie hook to be genuinely
    // stateful: after "Continue" the refetched users list is structurally identical, so React
    // Query triggers no re-render — only the hook's own state change (as in the real hook)
    // makes the newly selected userId take effect.
    jest.mocked(useSessionCookie).mockImplementation(() => {
      const [userId, setUserId] = React.useState<string | undefined>(existingUser.userId)
      return { clearUserId: () => setUserId(undefined), setUserId, userId }
    })
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    jest.mocked(fetchUsers).mockResolvedValue([existingUser, otherUser])
    jest.mocked(fetchAvailability).mockResolvedValue({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    await userEvent.click(await screen.findByRole('tab', { name: 'The overlap' }))
    expect(screen.getByRole('tab', { name: 'The overlap' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('button', { name: "This isn't me" }))
    await userEvent.click(await screen.findByRole('radio', { name: /bold otter/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('tab', { name: 'Your hours' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'The overlap' })).toHaveAttribute('aria-selected', 'false')
  })

  it('falls back to the identity phase when "This isn\'t me" is clicked after being identified via a ?id= link', async () => {
    // Reach the active phase via the ?id= query param (not the cookie) exactly like the
    // "should reach the active phase..." test above. `queryParamId` is cached for the
    // component's whole lifetime and normally outranks the cookie-derived userId on every
    // render, so clicking "This isn't me" must stop the memo from honoring it going forward —
    // otherwise the click has no visible effect for anyone who arrived via a shared ?id= link.
    window.history.pushState(null, '', `?id=${existingUser.userId}`)
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    jest.mocked(fetchUsers).mockResolvedValue([existingUser])
    jest.mocked(fetchAvailability).mockResolvedValue({
      userId: existingUser.userId,
      free: [
        [false, false],
        [false, false],
        [false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
      recommendedMeetings: [],
    })

    renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

    expect(await screen.findByRole('button', { name: "This isn't me" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: "This isn't me" }))

    expect(await screen.findByText('Who are you on this poll?')).toBeInTheDocument()
  })

  describe('recording the poll on entry', () => {
    const activePhaseMocks = (): void => {
      jest.mocked(fetchPoll).mockResolvedValue(poll)
      jest.mocked(fetchUsers).mockResolvedValue([existingUser])
      jest.mocked(fetchAvailability).mockResolvedValue({
        userId: existingUser.userId,
        free: [
          [false, false],
          [false, false],
          [false, false],
        ],
        expiration: 1725453600,
      })
      jest.mocked(fetchOverlap).mockResolvedValue({
        grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0, freeUserIds: [] } },
        recommendedMeetings: [],
      })
    }

    it('writes the entry as soon as identity resolves, without waiting for availability to be marked', async () => {
      // ADR-4/AC-028. Somebody who opens a shared link and is pulled away before answering is
      // exactly the person who loses the way back, so the trigger is identity, not participation.
      window.history.pushState(null, '', `?id=${existingUser.userId}`)
      const storage = memoryStorage()
      activePhaseMocks()

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" storage={storage} />)

      await waitFor(() =>
        expect(storedPolls(storage)).toEqual([
          {
            expiration: poll.expiration,
            lastSeen: fixedNow(),
            name: 'Quiet Falcon',
            pollName: 'Lunch with friends',
            seenIntro: false,
            sessionId: 'amber-harbor',
            userId: existingUser.userId,
          },
        ]),
      )
      expect(patchAvailability).not.toHaveBeenCalled()
    })

    it('stores the expiration in epoch seconds, as the server sends it', async () => {
      // Milliseconds would read as a date in the year 55000 and prune nothing, ever, while looking
      // like it worked. The year is the observable difference.
      window.history.pushState(null, '', `?id=${existingUser.userId}`)
      const storage = memoryStorage()
      activePhaseMocks()

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" storage={storage} />)

      await waitFor(() => expect(storedPolls(storage)).toHaveLength(1))
      expect(new Date(storedPolls(storage)[0].expiration * 1000).getUTCFullYear()).toBe(2024)
    })

    it('writes once, not again on every refetch', async () => {
      window.history.pushState(null, '', `?id=${existingUser.userId}`)
      const storage = memoryStorage()
      activePhaseMocks()

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" storage={storage} />)

      await waitFor(() => expect(storedPolls(storage)).toHaveLength(1))
      // Opening the overlap tab invalidates and refetches both the poll and the users.
      await userEvent.click(screen.getByRole('tab', { name: 'The overlap' }))
      await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(2))

      expect(storage.setItem).toHaveBeenCalledTimes(1)
    })

    it('records nothing while identity is still unresolved', async () => {
      window.history.replaceState(null, '', '/')
      // Explicit, because earlier tests in this file install stateful `useSessionCookie`
      // implementations and `clearMocks` clears calls, not implementations.
      jest.mocked(useSessionCookie).mockReturnValue({ clearUserId: jest.fn(), setUserId: jest.fn(), userId: undefined })
      const storage = memoryStorage()
      jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
      jest.mocked(fetchUsers).mockResolvedValueOnce([existingUser])

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" storage={storage} />)

      expect(await screen.findByText('Who are you on this poll?')).toBeInTheDocument()
      expect(storage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('when the poll is gone', () => {
    // A plain object rather than `new ApiError(...)`: this file automocks `@services/api`, whose
    // mocked constructor never runs its body, so a real ApiError built here would carry no
    // `response` at all. What the component reads is the status, and that is what this carries.
    const notFound = Object.assign(new Error('Not found'), {
      response: { body: '', headers: {}, statusCode: 404 },
    })
    const entry: RecentPoll = {
      expiration: 1_800_000_000,
      lastSeen: 1_699_000_000_000,
      name: 'Dave',
      pollName: 'Sprint retro',
      seenIntro: true,
      sessionId: 'dim-lantern',
      userId: 'u_dave',
    }

    const seededStorage = (polls: RecentPoll[]): Storage =>
      memoryStorage({ [RECENT_POLLS_KEY]: JSON.stringify({ migrated: true, polls }) })

    const renderGone = (storage: Storage) => {
      window.history.replaceState(null, '', '/')
      jest.mocked(fetchPoll).mockRejectedValue(notFound)
      jest.mocked(fetchUsers).mockRejectedValue(notFound)
      return renderWithClient(<Poll now={fixedNow} sessionId="dim-lantern" storage={storage} />)
    }

    it('names the poll, says it is gone, and offers both ways on', async () => {
      const storage = seededStorage([entry])

      renderGone(storage)

      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent("Sprint retro isn't there anymore")
      expect(screen.getByText("The poll closed or was deleted, so it's no longer in your polls.")).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to your polls' })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: 'Start a poll' })).toHaveAttribute('href', '/')
    })

    it('removes the dead entry from the store rather than merely hiding it', async () => {
      const storage = seededStorage([entry])

      renderGone(storage)

      await screen.findByRole('heading', { level: 1 })
      await waitFor(() => expect(storedPolls(storage)).toEqual([]))
    })

    it('announces the removal', async () => {
      const storage = seededStorage([entry])

      renderGone(storage)

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Sprint retro is no longer available and has been removed from your polls.',
        ),
      )
    })

    it('keeps naming the poll after its entry is destroyed', async () => {
      // The name comes from the entry the state itself deletes, so a heading derived on every
      // render would blank a beat after it appeared.
      const storage = seededStorage([entry])

      renderGone(storage)

      await waitFor(() => expect(storedPolls(storage)).toEqual([]))
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Sprint retro isn't there anymore")
    })

    it('still explains itself on a dead link this device never recorded', async () => {
      const storage = seededStorage([])

      renderGone(storage)

      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent("This poll isn't there anymore")
    })

    it('falls back to the retryable error state when the failure is not a 404', async () => {
      window.history.replaceState(null, '', '/')
      const storage = seededStorage([entry])
      jest.mocked(fetchPoll).mockRejectedValue(new Error('network error'))
      jest.mocked(fetchUsers).mockRejectedValue(new Error('network error'))

      renderWithClient(<Poll now={fixedNow} sessionId="dim-lantern" storage={storage} />)

      expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load this poll/i)
      // A poll that could not be reached is not a poll that is gone: the entry survives.
      expect(storedPolls(storage)).toHaveLength(1)
    })
  })

  describe('PollGoneState', () => {
    it('renders its live region before the announcement has any text', () => {
      // A region that enters the DOM already populated is routinely announced by nothing at all,
      // so the element exists first and gains its text on a later render.
      render(<PollGoneState announcement="" pollName="Sprint retro" />)

      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })
  })

  describe('isPollGone', () => {
    it('is true for a 404', () => {
      expect(isPollGone({ response: { statusCode: 404 } })).toBe(true)
    })

    it('is false for any other status', () => {
      expect(isPollGone({ response: { statusCode: 500 } })).toBe(false)
    })

    it('is false for an error carrying no response', () => {
      expect(isPollGone(new Error('network error'))).toBe(false)
    })

    it('is false when there is no error at all', () => {
      expect(isPollGone(null)).toBe(false)
    })
  })

  describe('install offer', () => {
    it('offers installation one heading level below the poll title', async () => {
      installOffer.capability = 'ios-share'
      window.history.replaceState(null, '', '/')
      jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
      jest.mocked(fetchUsers).mockResolvedValueOnce([])

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

      expect(await screen.findByRole('heading', { level: 2, name: 'Install Pick a Time' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lunch with friends')
    })

    it('puts the offer after the person picker', async () => {
      installOffer.capability = 'ios-share'
      window.history.replaceState(null, '', '/')
      jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
      // A populated roster and no `?id=`: the poll stops on the picker rather than auto-creating.
      jest.mocked(fetchUsers).mockResolvedValueOnce([existingUser])

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

      const offer = await screen.findByRole('heading', { name: 'Install Pick a Time' })
      const picker = screen.getByRole('heading', { name: 'Who are you on this poll?' })

      expect(picker.compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('puts the offer after the calendar', async () => {
      installOffer.capability = 'ios-share'
      window.history.pushState(null, '', `?id=${existingUser.userId}`)
      jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
      jest.mocked(fetchUsers).mockResolvedValueOnce([existingUser])
      jest.mocked(fetchAvailability).mockResolvedValueOnce({
        userId: existingUser.userId,
        free: [
          [false, false],
          [false, false],
          [false, false],
        ],
        expiration: 1725453600,
      })

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

      const offer = await screen.findByRole('heading', { name: 'Install Pick a Time' })
      // The tab bar opens the calendar block, so anything following it follows the whole block.
      const tabs = screen.getByRole('tablist')

      expect(tabs.compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('offers nothing where the browser cannot install anything', async () => {
      window.history.replaceState(null, '', '/')
      jest.mocked(fetchPoll).mockResolvedValueOnce(poll)
      jest.mocked(fetchUsers).mockResolvedValueOnce([])

      renderWithClient(<Poll now={fixedNow} sessionId="amber-harbor" />)

      await screen.findByRole('heading', { level: 1 })
      expect(screen.queryByRole('heading', { name: 'Install Pick a Time' })).not.toBeInTheDocument()
    })
  })
})
