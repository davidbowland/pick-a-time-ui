import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import ResultsPhase from './index'
import { fetchOverlap, OverlapResponse } from '@services/api'
import { PollData, User } from '@types'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'

jest.mock('@services/api')
jest.mock('@utils/detectViewerTimezone')

describe('ResultsPhase', () => {
  beforeAll(() => {
    jest.mocked(detectViewerTimezone).mockReturnValue('America/Chicago')
  })

  const poll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04', '2025-09-05', '2025-09-06'],
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1200,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1234567890,
    participantCount: 3,
    slots: [
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 },
        { slotIndex: 1, startMinute: 1110, endMinute: 1170 },
        { slotIndex: 2, startMinute: 1140, endMinute: 1200 },
      ],
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 },
        { slotIndex: 1, startMinute: 1110, endMinute: 1170 },
        { slotIndex: 2, startMinute: 1140, endMinute: 1200 },
      ],
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 },
        { slotIndex: 1, startMinute: 1110, endMinute: 1170 },
        { slotIndex: 2, startMinute: 1140, endMinute: 1200 },
      ],
    ],
  }

  // A timed poll whose window resolves to exactly one slot — collapses to the same
  // no-header-row grid as datesOnlyPoll (see the `slotLabels` derivation in index.tsx), but
  // unlike datesOnlyPoll the organizer did pick a specific meeting time.
  const singleSlotTimedPoll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04', '2025-09-05', '2025-09-06'],
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1140,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1234567890,
    participantCount: 3,
    slots: [
      [{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }],
      [{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }],
      [{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }],
    ],
  }

  const datesOnlyPoll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04', '2025-09-05', '2025-09-06'],
    usesTimes: false,
    timezone: 'America/Chicago',
    expiration: 1234567890,
    participantCount: 3,
    slots: [
      [{ slotIndex: 0, startMinute: 0, endMinute: 1440 }],
      [{ slotIndex: 0, startMinute: 0, endMinute: 1440 }],
      [{ slotIndex: 0, startMinute: 0, endMinute: 1440 }],
    ],
  }

  const overlapResponse: OverlapResponse = {
    grid: {
      cells: [
        [
          {
            dateIndex: 0,
            slotIndex: 0,
            startMinute: 1080,
            endMinute: 1140,
            freeCount: 3,
            freeUserIds: ['a', 'b', 'c'],
          },
        ],
      ],
      bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 3 },
    },
    recommendedMeetings: [],
  }

  function renderWithClient(ui: React.ReactElement): ReturnType<typeof render> {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  it('should show the best slot from the overlap response', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce(overlapResponse)

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByText(/3 of 3/i)).toBeInTheDocument()
    expect(fetchOverlap).toHaveBeenCalledWith('amber-harbor')
  })

  it('should show a loading state while the overlap request is in flight', async () => {
    jest.mocked(fetchOverlap).mockReturnValueOnce(new Promise(() => {}))

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByRole('status')).toHaveTextContent(/loading/i)
  })

  it('should show an error with a way to retry when the overlap request fails', async () => {
    jest.mocked(fetchOverlap).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load the results/i)

    jest.mocked(fetchOverlap).mockResolvedValueOnce(overlapResponse)
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText(/3 of 3/i)).toBeInTheDocument()
  })

  it('should show a friendly empty state instead of "0 of 3 free" when nobody overlaps yet', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      grid: { ...overlapResponse.grid, bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0 } },
    })

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByText(/no overlap yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/of 3 free/i)).not.toBeInTheDocument()
  })

  it('should state the meeting time for a single-slot timed poll even before anyone has any overlap', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0 } },
      recommendedMeetings: [],
    })

    renderWithClient(<ResultsPhase poll={singleSlotTimedPoll} sessionId="amber-harbor" users={[]} />)

    // The "no overlap yet" empty state is the very first thing anyone sees on a freshly-created
    // poll — the meeting time has to be visible here too, not just once someone's overlapped.
    expect(await screen.findByText('Meeting time: 6:00–7:00 PM')).toBeInTheDocument()
    expect(screen.getByText(/no overlap yet/i)).toBeInTheDocument()
  })

  it('should not show a meeting-time line for a multi-slot timed poll or a dates-only poll', async () => {
    jest.mocked(fetchOverlap).mockResolvedValue({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0 } },
      recommendedMeetings: [],
    })

    const { unmount } = renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)
    await screen.findByText(/no overlap yet/i)
    expect(screen.queryByText(/meeting time/i)).not.toBeInTheDocument()
    unmount()

    renderWithClient(<ResultsPhase poll={datesOnlyPoll} sessionId="amber-harbor" users={[]} />)
    await screen.findByText(/no overlap yet/i)
    expect(screen.queryByText(/meeting time/i)).not.toBeInTheDocument()
  })

  it('should not render a "Suggested times" section when there are no recommended meetings', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce(overlapResponse)

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)
    await screen.findByText(/3 of 3/i)

    expect(screen.queryByRole('region', { name: /suggested times/i })).not.toBeInTheDocument()
  })

  it('should list recommended meetings with date, time, and free count for a timed poll', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      recommendedMeetings: [
        {
          dateIndex: 0,
          slotIndex: 0,
          date: '2025-09-04',
          startMinute: 1080,
          endMinute: 1140,
          freeCount: 3,
          freeUserIds: ['a', 'b', 'c'],
          excludedByCalendar: [],
        },
      ],
    })

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    const section = await screen.findByRole('region', { name: /suggested times/i })
    expect(within(section).getByText(/thu, sep 4/i)).toBeInTheDocument()
    expect(within(section).getByText(/6:00.*7:00 pm/i)).toBeInTheDocument()
    expect(within(section).getByText(/3 of 3 free/i)).toBeInTheDocument()
  })

  it('should show a date-only label with no time for a dates-only poll', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      grid: {
        cells: [
          [{ dateIndex: 0, slotIndex: 0, startMinute: 0, endMinute: 1440, freeCount: 3, freeUserIds: ['a', 'b', 'c'] }],
        ],
        bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 3 },
      },
      recommendedMeetings: [
        {
          dateIndex: 0,
          slotIndex: 0,
          date: '2025-09-04',
          startMinute: 0,
          endMinute: 1440,
          freeCount: 3,
          freeUserIds: ['a', 'b', 'c'],
          excludedByCalendar: [],
        },
      ],
    })

    renderWithClient(<ResultsPhase poll={datesOnlyPoll} sessionId="amber-harbor" users={[]} />)

    const section = await screen.findByRole('region', { name: /suggested times/i })
    expect(within(section).getByText('Thu, Sep 4')).toBeInTheDocument()
  })

  it('should explain a calendar-conflict exclusion in plain language', async () => {
    const users: User[] = [{ userId: 'bright-heron', name: 'Bright Heron', calendarStatus: 'connected' }]
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      recommendedMeetings: [
        {
          dateIndex: 0,
          slotIndex: 0,
          date: '2025-09-04',
          startMinute: 1080,
          endMinute: 1140,
          freeCount: 2,
          freeUserIds: ['a', 'b'],
          excludedByCalendar: ['bright-heron'],
        },
      ],
    })

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={users} />)

    const section = await screen.findByRole('region', { name: /suggested times/i })
    expect(within(section).getByText(/bright heron.s calendar shows a conflict/i)).toBeInTheDocument()
  })

  it('should rank recommended meetings in the order the server returns them', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      recommendedMeetings: [
        {
          dateIndex: 0,
          slotIndex: 0,
          date: '2025-09-04',
          startMinute: 1080,
          endMinute: 1140,
          freeCount: 3,
          freeUserIds: [],
          excludedByCalendar: [],
        },
        {
          dateIndex: 2,
          slotIndex: 1,
          date: '2025-09-06',
          startMinute: 1110,
          endMinute: 1170,
          freeCount: 2,
          freeUserIds: [],
          excludedByCalendar: [],
        },
      ],
    })

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    const section = await screen.findByRole('region', { name: /suggested times/i })
    const items = within(section).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText(/thu, sep 4/i)).toBeInTheDocument()
    expect(within(items[1]).getByText(/sat, sep 6/i)).toBeInTheDocument()
  })

  it('should reveal free participants by name when a heat-grid cell is activated', async () => {
    const users: User[] = [
      { userId: 'quiet-falcon', name: 'Quiet Falcon', calendarStatus: 'not_connected' },
      { userId: 'amber-tide', name: null, calendarStatus: 'not_connected' },
    ]
    // A full date x slot grid (3 dates x 3 slots, matching this poll's dates/slots) with one
    // populated cell — HeatGrid indexes cells[dateIndex][slotIndex] directly.
    const cells = [
      [
        { dateIndex: 0, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 0, freeUserIds: [] },
        { dateIndex: 0, slotIndex: 1, startMinute: 1110, endMinute: 1170, freeCount: 0, freeUserIds: [] },
        { dateIndex: 0, slotIndex: 2, startMinute: 1140, endMinute: 1200, freeCount: 0, freeUserIds: [] },
      ],
      [
        {
          dateIndex: 1,
          slotIndex: 0,
          startMinute: 1080,
          endMinute: 1140,
          freeCount: 2,
          freeUserIds: ['quiet-falcon', 'amber-tide'],
        },
        { dateIndex: 1, slotIndex: 1, startMinute: 1110, endMinute: 1170, freeCount: 0, freeUserIds: [] },
        { dateIndex: 1, slotIndex: 2, startMinute: 1140, endMinute: 1200, freeCount: 0, freeUserIds: [] },
      ],
      [
        { dateIndex: 2, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 0, freeUserIds: [] },
        { dateIndex: 2, slotIndex: 1, startMinute: 1110, endMinute: 1170, freeCount: 0, freeUserIds: [] },
        { dateIndex: 2, slotIndex: 2, startMinute: 1140, endMinute: 1200, freeCount: 0, freeUserIds: [] },
      ],
    ]
    jest.mocked(fetchOverlap).mockResolvedValueOnce({ ...overlapResponse, grid: { ...overlapResponse.grid, cells } })

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={users} />)

    await userEvent.click(await screen.findByRole('button', { name: /fri, sep 5.*6:00.*2 of 3 free/i }))

    expect(await screen.findByText(/quiet falcon/i)).toBeInTheDocument()
    expect(await screen.findByText(/^amber tide$/i)).toBeInTheDocument()
  })

  it('should fall back gracefully when the response has no grid/bestSlot', async () => {
    jest
      .mocked(fetchOverlap)
      .mockResolvedValueOnce({ ...overlapResponse, grid: undefined } as unknown as OverlapResponse)

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByText(/no overlap yet/i)).toBeInTheDocument()
  })

  it('should not render the literal word "undefined" when the best slot date index is out of range', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      grid: { ...overlapResponse.grid, bestSlot: { dateIndex: 99, slotIndex: 0, freeCount: 3 } },
    })

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByText(/3 of 3/i)).toBeInTheDocument()
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument()
  })

  it('shows slot header times converted to a different viewer timezone, flagged when the day shifts', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    jest.mocked(fetchOverlap).mockResolvedValueOnce(overlapResponse)

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByText('8:00–9:00 AM (next day for you)')).toBeInTheDocument()
  })

  it('converts the single-slot meeting-time note to the viewer timezone', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0 } },
      recommendedMeetings: [],
    })

    renderWithClient(<ResultsPhase poll={singleSlotTimedPoll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByText('Meeting time: 8:00–9:00 AM (next day for you)')).toBeInTheDocument()
  })

  it('converts suggested-time entries to the viewer timezone', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      recommendedMeetings: [
        {
          dateIndex: 0,
          slotIndex: 0,
          date: '2025-09-04',
          startMinute: 1080,
          endMinute: 1140,
          freeCount: 3,
          freeUserIds: ['a', 'b', 'c'],
          excludedByCalendar: [],
        },
      ],
    })

    renderWithClient(<ResultsPhase poll={poll} sessionId="amber-harbor" users={[]} />)

    const section = await screen.findByRole('region', { name: /suggested times/i })
    expect(within(section).getByText(/thu, sep 4/i)).toBeInTheDocument()
    expect(within(section).getByText(/8:00.*9:00 am/i)).toBeInTheDocument()
  })

  it('shows a union of slot labels spanning both windows when the poll has a per-date override', async () => {
    const overridePoll: PollData = {
      ...poll,
      dates: ['2025-09-04', '2025-09-06'],
      startMinute: 540,
      endMinute: 600,
      overrides: [{ dates: ['2025-09-06'], startMinute: 660, endMinute: 720 }],
      slots: [
        [{ slotIndex: 0, startMinute: 540, endMinute: 600 }],
        [{ slotIndex: 0, startMinute: 660, endMinute: 720 }],
      ],
    }
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      grid: {
        cells: [
          [{ dateIndex: 0, slotIndex: 0, startMinute: 540, endMinute: 600, freeCount: 0, freeUserIds: [] }],
          [{ dateIndex: 1, slotIndex: 0, startMinute: 660, endMinute: 720, freeCount: 0, freeUserIds: [] }],
        ],
        bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0 },
      },
      recommendedMeetings: [],
    })

    renderWithClient(<ResultsPhase poll={overridePoll} sessionId="amber-harbor" users={[]} />)

    expect(await screen.findByText('9:00–10:00 AM')).toBeInTheDocument()
    expect(screen.getByText('11:00 AM–12:00 PM')).toBeInTheDocument()
  })
})
