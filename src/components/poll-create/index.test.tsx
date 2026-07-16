import { CalendarDate } from '@internationalized/date'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from 'aws-amplify/api'
import { useRouter } from 'next/router'
import React from 'react'

import PollCreate from './index'
import { useAuthContext } from '@components/auth-context'
import { setSessionCookie } from '@hooks/useSessionCookie'
import { createPoll, createPollAuthed, createUser, fetchConfig, patchUser } from '@services/api'

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@components/auth-context')
jest.mock('@hooks/useSessionCookie')
jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  createPoll: jest.fn(),
  createPollAuthed: jest.fn(),
  createUser: jest.fn(),
  patchUser: jest.fn(),
  fetchConfig: jest.fn(),
}))
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

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

// Thursday, 2026-07-16 — fixed so date-picker cell testids and generated pattern dates are
// deterministic across tests, per the project's no-live-Date.now()-in-tests rule.
const fixedNow = (): CalendarDate => new CalendarDate(2026, 7, 16)

function renderWithClient(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PollCreate now={fixedNow} />
    </QueryClientProvider>,
  )
}

const continueButton = (): HTMLElement => screen.getByRole('button', { name: /^continue$/i })

describe('PollCreate', () => {
  afterAll(() => {
    delete (global as any).grecaptcha
  })

  beforeAll(() => {
    jest.mocked(fetchConfig).mockResolvedValue(config)
  })

  function setup(): { push: jest.Mock } {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ push } as any)
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoading: false,
      handleSignIn: jest.fn(),
      handleSignOut: jest.fn(),
    })
    jest
      .mocked(createUser)
      .mockResolvedValue({ userId: 'clever-fox', name: null, calendarStatus: 'not_connected' as const })
    ;(global as any).grecaptcha = { ready: (cb: () => void) => cb(), execute: jest.fn().mockResolvedValue('token') }
    return { push }
  }

  it('shows the Days & times section as locked until the Name section is continued past', () => {
    setup()
    renderWithClient()

    // Both "Days & times" and "Review & create" are locked at this point — scope to the
    // "Days & times" section specifically rather than asserting a single match overall.
    const daysTimesTitle = screen.getByText('Days & times')
    const daysTimesSection = daysTimesTitle.parentElement?.parentElement as HTMLElement
    expect(within(daysTimesSection).getByText(/unlocks once you finish the step above/i)).toBeInTheDocument()
    expect(screen.queryByText(/how many weeks/i)).not.toBeInTheDocument()
  })

  it('collapses the Name section to a summary with a working Edit link once continued past', async () => {
    setup()
    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())

    expect(screen.queryByLabelText(/poll name/i)).not.toBeInTheDocument()
    expect(screen.getByText('Lunch with friends')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^edit name$/i }))

    expect(screen.getByLabelText(/poll name/i)).toHaveValue('Lunch with friends')
  })

  it('scrolls the newly-opened section to the top of the viewport when advancing, but not on initial render', async () => {
    setup()
    renderWithClient()

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()

    await userEvent.click(continueButton())

    // `block: 'start'` (rather than 'nearest' on the whole multi-section card) is what actually
    // fixes this: Name -> Days & times *grows* the card well past the viewport, so a 'nearest'
    // scroll of the whole card can find its top edge already onscreen and do nothing, stranding
    // the view mid-scroll in the newly-revealed section instead of at its top.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
  })

  it('scrolls the calendar into view when a quick-fill preset is applied, so the result is visible', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')

    // Advancing to this section already triggers one scrollIntoView call (see the section-scroll
    // test above) — assert the preset tap causes an *additional* call, rather than asserting from
    // zero, and without manually clearing the shared jsdom scrollIntoView mock mid-test.
    const callsBeforePreset = jest.mocked(Element.prototype.scrollIntoView).mock.calls.length

    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))

    expect(jest.mocked(Element.prototype.scrollIntoView).mock.calls.length).toBeGreaterThan(callsBeforePreset)
  })

  it('shows the required reCAPTCHA attribution once Review & create is reached', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())

    expect(screen.getByText(/protected by reCAPTCHA/i)).toBeInTheDocument()
  })

  it('should show a loading state before config has loaded', async () => {
    setup()
    jest.mocked(fetchConfig).mockReturnValueOnce(new Promise(() => {}))

    renderWithClient()
    await userEvent.click(continueButton())

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('should show the week-count stepper immediately once in Days & times, without needing to open any disclosure', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')

    expect(screen.getByText(/how many weeks/i)).toBeInTheDocument()
  })

  it('should show a validation message when the poll name is empty, and reopen the Name section to show it', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(await screen.findByText(/name your poll/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/poll name/i)).toBeInTheDocument()
    expect(createPoll).not.toHaveBeenCalled()
  })

  it('should disable Continue in Days & times until at least one date is selected', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')

    expect(continueButton()).toBeDisabled()

    await userEvent.click(screen.getByTestId('date-2026-07-16'))

    expect(continueButton()).toBeEnabled()
  })

  it('should populate the calendar immediately when the Weekday lunch preset is tapped, and submit a timed poll', async () => {
    const { push } = setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lunch with friends',
        dates: ['2026-07-16', '2026-07-17', '2026-07-20', '2026-07-21', '2026-07-22'],
        usesTimes: true,
        startMinute: 690,
        endMinute: 810,
        slotMinutes: 60,
      }),
      'token',
    )
    expect(push).toHaveBeenCalledWith('/p/amber-harbor')
  })

  it('should add another week of dates automatically when the week count is bumped after a preset is applied', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekends Brunch' }))
    await userEvent.click(screen.getByRole('button', { name: /more weeks/i }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: ['2026-07-18', '2026-07-19', '2026-07-25', '2026-07-26'],
      }),
      'token',
    )
  })

  it('should not re-add a manually-removed pattern date when the week count changes afterward', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))
    // Manually remove today (2026-07-16, a Thursday) from the generated week-1 set.
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(screen.getByRole('button', { name: /more weeks/i }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: [
          '2026-07-17',
          '2026-07-20',
          '2026-07-21',
          '2026-07-22',
          '2026-07-23',
          '2026-07-24',
          '2026-07-27',
          '2026-07-28',
          '2026-07-29',
        ],
      }),
      'token',
    )
  })

  it('should preserve a manually-added date outside the pattern when the pattern regenerates', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekends Brunch' }))
    // 2026-07-21 is a Tuesday — outside the Sat/Sun pattern.
    await userEvent.click(screen.getByTestId('date-2026-07-21'))
    await userEvent.click(screen.getByRole('button', { name: /more weeks/i }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: ['2026-07-18', '2026-07-19', '2026-07-21', '2026-07-25', '2026-07-26'],
      }),
      'token',
    )
  })

  it('should submit a dates-only poll from the "Weekdays, no time" preset', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays No time' }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: ['2026-07-16', '2026-07-17', '2026-07-20', '2026-07-21', '2026-07-22'],
        usesTimes: false,
      }),
      'token',
    )
  })

  it('should submit a dates-only poll from the new "Weekends, no time" preset', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekends No time' }))
    await userEvent.click(screen.getByRole('button', { name: /more weeks/i }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: ['2026-07-18', '2026-07-19', '2026-07-25', '2026-07-26'],
        usesTimes: false,
      }),
      'token',
    )
  })

  it('shows a plain-language summary of the day pattern and reveals the day picker only once expanded', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')

    expect(screen.getByText('Not set yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^thursday$/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))
    expect(screen.getByText('Mon–Fri')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /edit which days/i }))
    expect(screen.getByRole('button', { name: /^thursday$/i })).toBeInTheDocument()
  })

  it('shows "Custom" for Which days once a calendar date is manually toggled after a preset was applied', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))
    expect(screen.getByText('Mon–Fri')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('date-2026-07-16'))

    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('discards a manually-excluded date when the day-of-week selection is edited directly, not just when a preset is applied', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))
    // Manually exclude today (2026-07-16, a Thursday) — reaches "Custom".
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    expect(screen.getByText('Custom')).toBeInTheDocument()
    // Now edit the day-of-week selection directly via the "Which days" editor: add Sunday to the
    // set. Thursday stays selected, so if the stale exclusion survived, 2026-07-16 would still be
    // missing even though the label no longer says "Custom".
    await userEvent.click(screen.getByRole('button', { name: /edit which days/i }))
    await userEvent.click(screen.getByRole('button', { name: /^sunday$/i }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: expect.arrayContaining(['2026-07-16']),
      }),
      'token',
    )
  })

  it('shows "Dates only" as the time summary until times are enabled, then the resolved window and duration', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')

    expect(screen.getByText('Dates only')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))

    expect(screen.getByText('11:30 AM–1:30 PM · 1 hr')).toBeInTheDocument()
  })

  it('should clamp the pattern to maxPollDates and explain what happened, instead of silently overshooting the cap', async () => {
    setup()
    jest.mocked(fetchConfig).mockResolvedValueOnce({ ...config, maxPollDates: 1 })

    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    // "Weekday lunch" generates 5 dates for the current week — more than this test's 1-date cap.
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))

    expect(await screen.findByText(/kept the earliest 1/i)).toBeInTheDocument()
    expect(await screen.findByText('1 of 1 selected')).toBeInTheDocument()
  })

  it('should warn and skip dates beyond the planning window when a pattern reaches too far out, instead of silently dropping them', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })
    jest.mocked(fetchConfig).mockResolvedValueOnce({ ...config, maxPollDateRangeDays: 3 })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    // Mon-Fri from Thu 2026-07-16: 07-16 and 07-17 fall within a 3-day window (through 07-19);
    // 07-20, 07-21, 07-22 do not.
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))

    expect(await screen.findByText("3 dates beyond the 3-day planning window weren't added.")).toBeInTheDocument()

    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(expect.objectContaining({ dates: ['2026-07-16', '2026-07-17'] }), 'token')
  })

  it('should reset excluded dates and regenerate the full pattern when the same preset is tapped again', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))
    // Manually remove today (2026-07-16) from the generated set.
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    // Re-tap the same preset — should fully reset the pattern, including the excluded date.
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: ['2026-07-16', '2026-07-17', '2026-07-20', '2026-07-21', '2026-07-22'],
      }),
      'token',
    )
  })

  it('should show both the range-drop and cap-drop messages, as separate sentences, when a pattern hits both limits at once', async () => {
    setup()
    jest.mocked(fetchConfig).mockResolvedValueOnce({ ...config, maxPollDateRangeDays: 3, maxPollDates: 1 })

    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))

    expect(await screen.findByText(/3 dates beyond the 3-day planning window weren't added\./)).toBeInTheDocument()
    expect(
      screen.getByText(
        /That pattern generates more dates than this poll allows \(max 1\) — kept the earliest 1 and dropped the rest\./,
      ),
    ).toBeInTheDocument()
    expect(await screen.findByText('1 of 1 selected')).toBeInTheDocument()
  })

  it('should show an inline error and not submit when the time window is shorter than the meeting length', async () => {
    setup()
    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(screen.getByRole('button', { name: /edit when/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Dates & times' }))
    await userEvent.click(screen.getByRole('button', { name: '2 hr' }))
    // Pull the end thumb in to 9:15 AM, 15 minutes after the 9:00 AM default start — shorter
    // than the 2-hour (120 min) meeting length just selected.
    fireEvent.change(screen.getByLabelText(/to \(time\)/i), { target: { value: '555' } })
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(await screen.findByText(/pick a longer time window/i)).toBeInTheDocument()
    expect(createPoll).not.toHaveBeenCalled()
  })

  it('does not show the weekday/weekend toggle when every selected date is a weekday', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16')) // Thursday
    await userEvent.click(screen.getByRole('button', { name: /edit when/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Dates & times' }))

    expect(screen.queryByText('Same hours every day?')).not.toBeInTheDocument()
  })

  it('shows the weekday/weekend toggle once both a weekday and a weekend date are selected, and submits an override for just the weekend dates', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16')) // Thursday
    await userEvent.click(screen.getByTestId('date-2026-07-18')) // Saturday
    await userEvent.click(screen.getByRole('button', { name: /edit when/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Dates & times' }))

    expect(screen.getByText('Same hours every day?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Weekends differ' }))
    expect(screen.getAllByRole('group', { name: /time window|weekdays|weekends/i }).length).toBeGreaterThanOrEqual(1)

    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        dates: ['2026-07-16', '2026-07-18'],
        usesTimes: true,
        overrides: [{ dates: ['2026-07-18'], startMinute: 540, endMinute: 1260 }],
      }),
      'token',
    )
  })

  it('hides the toggle again and omits overrides when the only weekend date is removed after enabling it', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16')) // Thursday
    await userEvent.click(screen.getByTestId('date-2026-07-18')) // Saturday
    await userEvent.click(screen.getByRole('button', { name: /edit when/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Dates & times' }))
    await userEvent.click(screen.getByRole('button', { name: 'Weekends differ' }))
    // Remove the only weekend date.
    await userEvent.click(screen.getByTestId('date-2026-07-18'))

    expect(screen.queryByText('Same hours every day?')).not.toBeInTheDocument()

    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(createPoll).toHaveBeenCalledWith(expect.not.objectContaining({ overrides: expect.anything() }), 'token')
  })

  it('shows a separate inline error under the weekend window when it is shorter than the meeting length', async () => {
    setup()
    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16')) // Thursday
    await userEvent.click(screen.getByTestId('date-2026-07-18')) // Saturday
    await userEvent.click(screen.getByRole('button', { name: /edit when/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Dates & times' }))
    await userEvent.click(screen.getByRole('button', { name: 'Weekends differ' }))
    await userEvent.click(screen.getByRole('button', { name: '2 hr' }))
    // Pull the weekend end thumb to 15 minutes after its (seeded-from-weekday) 9:00 AM start.
    const toThumbs = screen.getAllByLabelText(/to \(time\)/i)
    fireEvent.change(toThumbs[toThumbs.length - 1], { target: { value: '555' } })
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(await screen.findByText(/pick a longer time window/i)).toBeInTheDocument()
    expect(createPoll).not.toHaveBeenCalled()
  })

  it('reflects the split window in the "When" summary once weekends differ', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16')) // Thursday
    await userEvent.click(screen.getByTestId('date-2026-07-18')) // Saturday
    await userEvent.click(screen.getByRole('button', { name: /edit when/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Dates & times' }))
    await userEvent.click(screen.getByRole('button', { name: 'Weekends differ' }))

    expect(screen.getByText('9:00 AM–9:00 PM weekdays, 9:00 AM–9:00 PM weekends · 1 hr')).toBeInTheDocument()
  })

  it('should surface the api message when poll creation fails with a 400', async () => {
    setup()
    const error = Object.assign(new Error('bad request'), {
      response: {
        statusCode: 400,
        headers: {},
        body: JSON.stringify({ message: 'One of those dates has already passed.' }),
      },
    })
    Object.setPrototypeOf(error, ApiError.prototype)
    jest.mocked(createPoll).mockRejectedValueOnce(error)

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(await screen.findByText('One of those dates has already passed.')).toBeInTheDocument()
  })

  it('should show a generic error message when poll creation fails with a 403 (recaptcha)', async () => {
    setup()
    const error = Object.assign(new Error('forbidden'), { response: { statusCode: 403, headers: {}, body: '' } })
    Object.setPrototypeOf(error, ApiError.prototype)
    jest.mocked(createPoll).mockRejectedValueOnce(error)

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(await screen.findByText(/going a bit fast/i)).toBeInTheDocument()
  })

  it('keeps the Days & times section showing as done (not locked) when navigating back to edit the Name section', async () => {
    setup()
    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    // Now in Review & create. Go back and edit the Name section.
    await userEvent.click(screen.getByRole('button', { name: /^edit name$/i }))

    // Scope to the "Days & times" section specifically: the Review & create section is the
    // terminal step and its `isDone` is intentionally always false (per design, unrelated to this
    // fix), so it legitimately still renders its own "Unlocks once..." placeholder once you've
    // navigated away from it — that's expected and not what this test is checking.
    const daysTimesTitle = screen.getByText('Days & times')
    const daysTimesSection = daysTimesTitle.parentElement?.parentElement as HTMLElement
    expect(within(daysTimesSection).queryByText(/unlocks once you finish the step above/i)).not.toBeInTheDocument()
    expect(within(daysTimesSection).getByText(/1 date/)).toBeInTheDocument()
  })

  it('moves focus to the poll name field when submitting with an empty name', async () => {
    setup()
    renderWithClient()
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    expect(screen.getByLabelText(/poll name/i)).toHaveFocus()
  })

  it('shows "Your name" when not signed in, and submits via /sessions with recaptcha', async () => {
    const { push } = setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()

    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    await waitFor(() => expect(createPoll).toHaveBeenCalled())
    expect(createPollAuthed).not.toHaveBeenCalled()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/p/amber-harbor'))
  })

  it('creates the voter and patches the trimmed "Your name" after poll creation succeeds', async () => {
    setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.type(screen.getByLabelText(/your name/i), '  Alex  ')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    await waitFor(() => expect(createUser).toHaveBeenCalledWith('amber-harbor', false))
    await waitFor(() =>
      expect(patchUser).toHaveBeenCalledWith(
        'amber-harbor',
        'clever-fox',
        [{ op: 'replace', path: '/name', value: 'Alex' }],
        false,
      ),
    )
    expect(setSessionCookie).toHaveBeenCalledWith('amber-harbor', 'clever-fox')
  })

  it('hides "Your name" and uses the authenticated endpoint with no recaptcha when already signed in', async () => {
    const { push } = setup()
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: true,
      user: { name: 'Alex', phone: null },
      isLoading: false,
      handleSignIn: jest.fn(),
      handleSignOut: jest.fn(),
    })
    jest.mocked(createPollAuthed).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()

    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    await waitFor(() =>
      expect(createPollAuthed).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lunch with friends' })),
    )
    expect(createPoll).not.toHaveBeenCalled()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/p/amber-harbor'))
  })

  it('still redirects when the post-creation voter setup fails', async () => {
    const { push } = setup()
    jest.mocked(createPoll).mockResolvedValueOnce({ sessionId: 'amber-harbor' })
    jest.mocked(createUser).mockRejectedValueOnce(new Error('network error'))

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/poll name/i), 'Lunch with friends')
    await userEvent.click(continueButton())
    await screen.findByTestId('date-2026-07-16')
    await userEvent.click(screen.getByTestId('date-2026-07-16'))
    await userEvent.click(continueButton())
    await userEvent.click(screen.getByRole('button', { name: /create poll/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/p/amber-harbor'))
  })
})
