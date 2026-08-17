import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import PaintingPhase from './index'
import {
  CalendarSyncResult,
  connectCalendar,
  fetchAvailability,
  fetchAvailabilityAuthed,
  fetchCalendarState,
  patchAvailability,
  syncCalendar,
} from '@services/api'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvailabilityRecord, OwnerAvailabilityRecord, PollData } from '@types'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'

jest.mock('@services/api')
jest.mock('@utils/detectViewerTimezone')

describe('PaintingPhase', () => {
  // PaintingPhase debounces its PATCH by 1250ms (PATCH_DEBOUNCE_MS in index.tsx) so a burst of
  // quick individual picks coalesces into one request. Fake timers make that deterministic;
  // `waitFor`/`findBy*` detect Jest's fake timers and advance them automatically, but their
  // default 1000ms timeout is shorter than the debounce, so assertions that wait on a PATCH pass
  // an explicit longer timeout via DEBOUNCE_WAIT.
  const DEBOUNCE_WAIT = { timeout: 2000 }

  beforeAll(() => {
    jest.useFakeTimers()
    jest.mocked(detectViewerTimezone).mockReturnValue('America/Chicago')
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  // Two dates x three 60-minute slots sliding across a 6-9pm window — same total cell count
  // (6) as the pre-migration fixture this test replaces, just transposed: dates are now rows,
  // slots are now columns.
  const poll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04', '2025-09-05'], // Thu, Fri
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1260,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1725453600,
    participantCount: 1,
    slots: [
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 }, // 6:00-7:00 PM
        { slotIndex: 1, startMinute: 1140, endMinute: 1200 }, // 7:00-8:00 PM
        { slotIndex: 2, startMinute: 1200, endMinute: 1260 }, // 8:00-9:00 PM
      ],
      [
        { slotIndex: 0, startMinute: 1080, endMinute: 1140 },
        { slotIndex: 1, startMinute: 1140, endMinute: 1200 },
        { slotIndex: 2, startMinute: 1200, endMinute: 1260 },
      ],
    ],
  }

  // A timed poll whose window resolves to exactly one slot — collapses to the same
  // no-header-row grid as datesOnlyPoll, but (unlike datesOnlyPoll) the organizer did pick a
  // specific meeting time, which needs to be visible somewhere on this screen.
  const singleSlotTimedPoll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04', '2025-09-05'],
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1140,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1725453600,
    participantCount: 1,
    slots: [
      [{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }],
      [{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }],
    ], // 6:00-7:00 PM
  }

  // One date, three slots — the shape this collapse exists for. Every grid column is a time slot,
  // so the date moves out of the sticky column and above the grid.
  const singleDatePoll: PollData = { ...poll, dates: ['2025-09-04'], slots: [poll.slots[0]] }

  // One date AND one slot: both notes would fire, so they combine into one line.
  const singleDateSingleSlotPoll: PollData = {
    ...singleSlotTimedPoll,
    dates: ['2025-09-04'],
    slots: [singleSlotTimedPoll.slots[0]],
  }

  const datesOnlyPoll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04', '2025-09-05'],
    usesTimes: false,
    timezone: 'America/Chicago',
    expiration: 1725453600,
    participantCount: 1,
    slots: [[{ slotIndex: 0, startMinute: 0, endMinute: 1440 }], [{ slotIndex: 0, startMinute: 0, endMinute: 1440 }]],
  }

  function renderWithClient(ui: React.ReactElement): { queryClient: QueryClient } & ReturnType<typeof render> {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) }
  }

  function mockEmptyAvailability(): void {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [false, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })
  }

  // Signed in, the availability read goes through the authenticated route -- the only one that can
  // carry a busy layer (AC-003) -- so a signed-in test has to mock that one instead.
  function mockEmptyOwnerAvailability(): void {
    jest.mocked(fetchAvailabilityAuthed).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [false, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })
  }

  it('should render an empty grid once availability loads', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  // `Thu, Sep 4`, not the `Thu Sep 4` the row header shows: the visible row label drops the month
  // on rows after the first, and a cell's aria-label is exactly the out-of-context announcement
  // where that month matters most.
  it('should label each cell with its date and time so screen readers can announce it', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findByRole('button', { name: 'Thu, Sep 4, 6:00–7:00 PM' })).toBeInTheDocument()
  })

  it('should state the slot cadence once, since the column headers omit end times', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findByText('Each column is a 1-hour slot.')).toBeInTheDocument()
  })

  it('should PATCH the painted cell on pointer up', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith(
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
  })

  it('should PATCH exactly once when a real mouse click drives the whole pointer/click sequence', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(cells[0])

    await waitFor(() => expect(patchAvailability).toHaveBeenCalledTimes(1), DEBOUNCE_WAIT)
    expect(patchAvailability).toHaveBeenCalledWith(
      'amber-harbor',
      'quiet-falcon',
      {
        cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
      },
      false,
    )
  })

  it('should coalesce several quick individual clicks into a single PATCH instead of one per click', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, true, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    // Two separate click gestures, close enough together to both land inside one debounce window.
    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    act(() => {
      jest.advanceTimersByTime(500)
      cells[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[1].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith(
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [
              { dateIndex: 0, slotIndex: 0, value: true },
              { dateIndex: 0, slotIndex: 1, value: true },
            ],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
    expect(patchAvailability).toHaveBeenCalledTimes(1)
  })

  it('should toggle a cell from the keyboard, so painting does not require a pointer', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })
    cells[0].focus()

    expect(cells[0]).toHaveFocus()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.keyboard('{Enter}')

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith(
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
    expect(await screen.findByRole('button', { name: 'Thu, Sep 4, 6:00–7:00 PM', pressed: true })).toBeInTheDocument()
  })

  it('should PATCH every cell as filled when "Select all" is pressed', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, true, true],
        [true, true, true],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(await screen.findByRole('button', { name: 'Select all' }))

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith(
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [
              { dateIndex: 0, slotIndex: 0, value: true },
              { dateIndex: 0, slotIndex: 1, value: true },
              { dateIndex: 0, slotIndex: 2, value: true },
              { dateIndex: 1, slotIndex: 0, value: true },
              { dateIndex: 1, slotIndex: 1, value: true },
              { dateIndex: 1, slotIndex: 2, value: true },
            ],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
  })

  it('should PATCH every cell as cleared when "Clear all" is pressed', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, true, true],
        [true, true, true],
      ],
      expiration: 1725453600,
    })
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [false, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(await screen.findByRole('button', { name: 'Clear all' }))

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith(
          'amber-harbor',
          'quiet-falcon',
          {
            cells: expect.arrayContaining([{ dateIndex: 0, slotIndex: 0, value: false }]),
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
  })

  // Dispatches a pointer event whose `target` is fixed at `target` (mirroring a touch pointer's
  // implicit capture, which pins every event's target to the origin element for the whole
  // gesture) but whose `clientX` carries the coordinate a real finger would be at. The
  // component under test must resolve the actual cell via `document.elementFromPoint(clientX, …)`
  // rather than trusting `target`.
  function dispatchCapturedPointerEvent(type: string, target: Element, clientX: number): void {
    act(() => {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX }))
    })
  }

  it('should PATCH all three cells from one drag, even though touch pins every event target to the origin cell', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, true, true],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })
    // (0,0)=Thu 6-7p, (0,1)=Thu 7-8p, (0,2)=Thu 8-9p — same date, three consecutive slots.
    const [cellA, cellB, cellC] = cells

    const originalElementFromPoint = document.elementFromPoint
    document.elementFromPoint = jest.fn((x: number) => {
      if (x === 100) return cellB
      if (x === 200) return cellC
      return cellA
    }) as typeof document.elementFromPoint

    dispatchCapturedPointerEvent('pointerdown', cellA, 0)
    dispatchCapturedPointerEvent('pointermove', cellA, 100)
    dispatchCapturedPointerEvent('pointermove', cellA, 200)
    dispatchCapturedPointerEvent('pointerup', cellA, 200)

    document.elementFromPoint = originalElementFromPoint

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith(
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [
              { dateIndex: 0, slotIndex: 0, value: true },
              { dateIndex: 0, slotIndex: 1, value: true },
              { dateIndex: 0, slotIndex: 2, value: true },
            ],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
    expect(patchAvailability).toHaveBeenCalledTimes(1)
  })

  it('should not leave the gesture stuck after a pointercancel (e.g. the browser interpreting a drag as a page scroll)', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, true, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenNthCalledWith(
          1,
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )

    act(() => {
      cells[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[1].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenNthCalledWith(
          2,
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [{ dateIndex: 0, slotIndex: 1, value: true }],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
    expect(patchAvailability).toHaveBeenCalledTimes(2)
  })

  it('should keep the painted cell shown as on while its PATCH is still in flight, with no revert-then-reapply flicker', async () => {
    mockEmptyAvailability()
    let resolvePatch: (value: AvailabilityRecord) => void = () => {}
    jest.mocked(patchAvailability).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve
        }),
    )

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    // The cell shows on right away from the optimistic update, before the debounced PATCH even fires.
    await waitFor(() => expect(cells[0]).toHaveAttribute('aria-pressed', 'true'))

    // Advance past the debounce so the PATCH actually goes out (still unresolved at this point).
    await waitFor(() => expect(patchAvailability).toHaveBeenCalledTimes(1), DEBOUNCE_WAIT)
    expect(cells[0]).toHaveAttribute('aria-pressed', 'true')

    resolvePatch({
      userId: 'quiet-falcon',
      free: [
        [true, false, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })
    await waitFor(() => expect(cells[0]).toHaveAttribute('aria-pressed', 'true'))
  })

  it('should not revert a newer paint when an earlier PATCH resolves while that paint is unsaved', async () => {
    mockEmptyAvailability()
    let resolveFirstPatch: (value: AvailabilityRecord) => void = () => {}
    jest.mocked(patchAvailability).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstPatch = resolve
        }),
    )
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [true, true, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    // First PATCH goes out after the debounce and stays in flight.
    await waitFor(() => expect(patchAvailability).toHaveBeenCalledTimes(1), DEBOUNCE_WAIT)

    // Paint a second cell while the first PATCH is still pending. Advance timers just far enough
    // (< the 1250ms debounce) for the gesture overlay to clear, so the cell's pressed state comes
    // from the cached record — the state a stale PATCH response could clobber — not the overlay.
    act(() => {
      cells[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[1].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(cells[1]).toHaveAttribute('aria-pressed', 'true')

    // The first PATCH's response knows nothing about the second cell — it must not clobber the
    // newer optimistic paint (the revert-then-reapply flicker seen when painting quickly on mobile).
    await act(async () => {
      resolveFirstPatch({
        userId: 'quiet-falcon',
        free: [
          [true, false, false],
          [false, false, false],
        ],
        expiration: 1725453600,
      })
    })
    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(cells[1]).toHaveAttribute('aria-pressed', 'true')
    expect(cells[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('should keep a newer paint on screen when an earlier PATCH fails while that paint is unsaved', async () => {
    mockEmptyAvailability()
    let rejectFirstPatch: (reason: Error) => void = () => {}
    jest.mocked(patchAvailability).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirstPatch = reject
        }),
    )
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [
        [false, true, false],
        [false, false, false],
      ],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(() => expect(patchAvailability).toHaveBeenCalledTimes(1), DEBOUNCE_WAIT)

    act(() => {
      cells[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[1].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(cells[1]).toHaveAttribute('aria-pressed', 'true')

    // Rolling back the failed batch must not wipe the second cell's optimistic paint — its own
    // PATCH is still pending and will reconcile the record.
    await act(async () => {
      rejectFirstPatch(new Error('network error'))
    })
    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(cells[1]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save your availability")
  })

  it('should roll back the cell and show an error message when the PATCH fails', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    expect(await screen.findByRole('alert', {}, DEBOUNCE_WAIT)).toHaveTextContent("Couldn't save your availability")
    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  // A refused save is not a flaky network -- retrying paints the same grid into somebody else's
  // record forever. It gets the reason instead of the retry.
  it('should name the account mismatch when a save is refused', async () => {
    mockEmptyOwnerAvailability()
    jest.mocked(patchAvailability).mockRejectedValueOnce({ response: { statusCode: 403 } })

    renderWithClient(<PaintingPhase isSignedIn poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    expect(await screen.findByRole('alert', {}, DEBOUNCE_WAIT)).toHaveTextContent(
      "You're signed in with a different Google account",
    )
  })

  it('should send the save through the authenticated route when signed in', async () => {
    mockEmptyOwnerAvailability()

    renderWithClient(<PaintingPhase isSignedIn poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(
      () => expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', expect.anything(), true),
      DEBOUNCE_WAIT,
    )
  })

  it('should roll back every cell from a coalesced batch, not just the last one, when the merged PATCH fails', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    act(() => {
      jest.advanceTimersByTime(500)
      cells[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[1].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    expect(await screen.findByRole('alert', {}, DEBOUNCE_WAIT)).toHaveTextContent("Couldn't save your availability")
    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('should roll back and show an error when "Select all" fails to save', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(await screen.findByRole('button', { name: 'Select all' }))

    expect(await screen.findByRole('alert', {}, DEBOUNCE_WAIT)).toHaveTextContent("Couldn't save your availability")
    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('should collapse to one plain toggle per date, with no time label, for a dates-only poll', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false], [false]],
      expiration: 1725453600,
    })
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[true], [false]],
      expiration: 1725453600,
    })

    renderWithClient(
      <PaintingPhase isSignedIn={false} poll={datesOnlyPoll} sessionId="amber-harbor" userId="quiet-falcon" />,
    )

    const cells = await screen.findAllByRole('button', { pressed: false })
    expect(cells).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Thu, Sep 4' })).toBeInTheDocument()
    // No slot-range text (an en dash between two clock times) anywhere — there's only one
    // implicit all-day slot, so there's nothing meaningful to label a header column with.
    expect(screen.queryByText(/–/)).not.toBeInTheDocument()

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith(
          'amber-harbor',
          'quiet-falcon',
          {
            cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
          },
          false,
        ),
      DEBOUNCE_WAIT,
    )
  })

  it('should state the meeting time even though the grid itself has no header for a single-slot timed poll', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false], [false]],
      expiration: 1725453600,
    })

    renderWithClient(
      <PaintingPhase isSignedIn={false} poll={singleSlotTimedPoll} sessionId="amber-harbor" userId="quiet-falcon" />,
    )

    expect(await screen.findByText('Meeting time: 6:00–7:00 PM')).toBeInTheDocument()
    // The grid still collapses to a plain per-date toggle, same as a dates-only poll — the
    // meeting time is stated once above it, not repeated per cell.
    expect(screen.getByRole('button', { name: 'Thu, Sep 4' })).toBeInTheDocument()
  })

  it('should not show a meeting-time line for a dates-only poll', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false], [false]],
      expiration: 1725453600,
    })

    renderWithClient(
      <PaintingPhase isSignedIn={false} poll={datesOnlyPoll} sessionId="amber-harbor" userId="quiet-falcon" />,
    )

    await screen.findByRole('button', { name: 'Thu, Sep 4' })
    expect(screen.queryByText(/meeting time/i)).not.toBeInTheDocument()
  })

  it('should state the date above the grid for a single-date poll, which renders no date column', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false, false, false]],
      expiration: 1725453600,
    })

    renderWithClient(
      <PaintingPhase isSignedIn={false} poll={singleDatePoll} sessionId="amber-harbor" userId="quiet-falcon" />,
    )

    expect(await screen.findByText('Date: Thu, Sep 4')).toBeInTheDocument()
    expect(screen.queryByRole('rowheader')).not.toBeInTheDocument()
  })

  it('should combine the date and the meeting time into one line when the poll has one of each', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false]],
      expiration: 1725453600,
    })

    renderWithClient(
      <PaintingPhase
        isSignedIn={false}
        poll={singleDateSingleSlotPoll}
        sessionId="amber-harbor"
        userId="quiet-falcon"
      />,
    )

    expect(await screen.findByText('Meeting time: Thu, Sep 4, 6:00–7:00 PM')).toBeInTheDocument()
    expect(screen.queryByText(/^Date:/)).not.toBeInTheDocument()
  })

  it('shows slot header times converted to the viewer timezone', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    // The header now *displays* an abbreviation (`8a` plus a `+1` marker) and carries the full
    // converted range as its accessible name, so read it by role rather than by visible text.
    expect(await screen.findByRole('columnheader', { name: '8:00–9:00 AM (next day for you)' })).toBeInTheDocument()
  })

  // The `+1` on an offset column header is aria-hidden, so sighted users get a bare symbol with no
  // explanation anywhere on the page. This line is the explanation, and it appears only when a
  // column actually carries the marker.
  it('explains the day-offset markers when some column falls on another day', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findByText('+1 means the next day in your time zone.')).toBeInTheDocument()
  })

  it('omits the day-offset legend when every column is on the same day', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    await screen.findAllByRole('button', { pressed: false })
    expect(screen.queryByText(/in your time zone/)).not.toBeInTheDocument()
  })

  it('shows the meeting-time note converted to the viewer timezone, flagged when the day shifts', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false], [false]],
      expiration: 1725453600,
    })

    renderWithClient(
      <PaintingPhase isSignedIn={false} poll={singleSlotTimedPoll} sessionId="amber-harbor" userId="quiet-falcon" />,
    )

    expect(await screen.findByText('Meeting time: 8:00–9:00 AM (next day for you)')).toBeInTheDocument()
  })

  it('renders a disabled, non-tappable placeholder for a date whose own window does not include a shared column', async () => {
    const overridePoll: PollData = {
      sessionId: 'amber-harbor',
      name: 'Lunch with friends',
      dates: ['2025-09-04', '2025-09-06'], // Thu (default window), Sat (override)
      usesTimes: true,
      startMinute: 540,
      endMinute: 600,
      slotMinutes: 60,
      overrides: [{ dates: ['2025-09-06'], startMinute: 660, endMinute: 720 }],
      timezone: 'America/Chicago',
      expiration: 1725453600,
      participantCount: 1,
      slots: [
        [{ slotIndex: 0, startMinute: 540, endMinute: 600 }], // Thu: 9:00-10:00 AM
        [{ slotIndex: 0, startMinute: 660, endMinute: 720 }], // Sat: 11:00 AM-12:00 PM
      ],
    }
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false], [false]],
      expiration: 1725453600,
    })

    renderWithClient(
      <PaintingPhase isSignedIn={false} poll={overridePoll} sessionId="amber-harbor" userId="quiet-falcon" />,
    )

    // Union of the two dates' windows is two columns (9-10am, 11am-12pm). Each date only has a
    // real slot for one of them, so there are exactly 2 tappable buttons, not 4.
    const cells = await screen.findAllByRole('button', { pressed: false })
    expect(cells).toHaveLength(2)
  })

  describe('calendar', () => {
    const redirectTo = jest.fn()
    // Injected rather than read off the clock: the strip renders "Checked <ago>" from a real epoch,
    // so a test asserting that string must not depend on the day it runs.
    const now = (): number => 1_754_006_400_000
    const CHECKED_AT = 1_754_006_400
    const BUSY_WINDOW = { end: '2025-09-05', start: '2025-09-04' }

    const NOTHING = [
      [false, false, false],
      [false, false, false],
    ]
    // Thu 7-8 PM is the one hour this participant's calendar has booked.
    const THU_SEVEN_BOOKED = [
      [false, true, false],
      [false, false, false],
    ]
    const THU_SIX_AND_SEVEN_BOOKED = [
      [true, true, false],
      [false, false, false],
    ]

    function ownerRecord(free: boolean[][], busy: boolean[][]): OwnerAvailabilityRecord {
      return {
        busy,
        busyWindow: BUSY_WINDOW,
        calendarStatus: 'connected',
        expiration: 1725453600,
        free,
        userId: 'quiet-falcon',
      }
    }

    function mockOwnerAvailability(free: boolean[][], busy: boolean[][]): void {
      jest.mocked(fetchAvailabilityAuthed).mockResolvedValueOnce(ownerRecord(free, busy))
    }

    // What the authenticated read resolves with when it refused and fell back to the open one: the
    // participant's record and nothing whatever about a calendar (AC-044).
    function mockUnlinkedAvailability(free: boolean[][] = NOTHING): void {
      jest.mocked(fetchAvailabilityAuthed).mockResolvedValueOnce({
        expiration: 1725453600,
        free,
        userId: 'quiet-falcon',
      })
    }

    function syncResult(busy: boolean[][]): CalendarSyncResult {
      return { busy, busyWindow: BUSY_WINDOW, calendarStatus: 'connected', lastSyncedAt: CHECKED_AT }
    }

    // What a PATCH answers with: the open availability shape, carrying no busy layer at all. Every
    // write of one into the cache is a chance to strip the layer off the grid.
    function patchResponse(free: boolean[][]): AvailabilityRecord {
      return { expiration: 1725453600, free, userId: 'quiet-falcon' }
    }

    beforeAll(() => {
      jest.mocked(fetchCalendarState).mockResolvedValue({ lastSyncedAt: null, status: 'connected' })
      jest.mocked(syncCalendar).mockResolvedValue(syncResult(NOTHING))
      jest.mocked(connectCalendar).mockResolvedValue({ alreadyConnected: false, authUrl: 'https://auth' })
    })

    function renderSignedIn(): ReturnType<typeof renderWithClient> {
      return renderWithClient(
        <PaintingPhase
          isSignedIn
          now={now}
          poll={poll}
          redirectTo={redirectTo}
          sessionId="amber-harbor"
          userId="quiet-falcon"
        />,
      )
    }

    const liveText = (): string => screen.getByTestId('calendar-strip-detail').textContent ?? ''
    const setupUser = (): ReturnType<typeof userEvent.setup> =>
      userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const reasonFor = (control: HTMLElement): HTMLElement | null =>
      document.getElementById(control.getAttribute('aria-describedby') ?? '')

    it('should read availability through the authenticated route when signed in', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)

      renderSignedIn()

      await screen.findAllByRole('button', { pressed: false })
      expect(fetchAvailabilityAuthed).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon')
      expect(fetchAvailability).not.toHaveBeenCalled()
    })

    // AC-003. The read is the check: the server refreshes the cached intervals when it serves this
    // route, so a second client-side check on mount would only ask the same question twice.
    it('should draw the busy layer with no button pressed', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)

      renderSignedIn()

      expect(await screen.findByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked' })).toBeInTheDocument()
      expect(syncCalendar).not.toHaveBeenCalled()
    })

    // AC-044: a signed-in participant whose record is not linked yet gets a grid, not a blank.
    it('should render a calendar-less grid when the authenticated read learned nothing', async () => {
      mockUnlinkedAvailability()

      renderSignedIn()

      expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
      expect(screen.queryByRole('button', { name: /booked/ })).not.toBeInTheDocument()
      expect(screen.queryByText("We couldn't reach Google Calendar")).not.toBeInTheDocument()
    })

    it('should claim nothing about booked time it never saw', async () => {
      mockUnlinkedAvailability()

      renderSignedIn()

      await screen.findAllByRole('button', { pressed: false })
      expect(liveText()).toBe('Checked just now')
    })

    it('should render no strip when signed out', async () => {
      mockEmptyAvailability()

      renderWithClient(<PaintingPhase isSignedIn={false} poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

      await screen.findAllByRole('button', { pressed: false })
      expect(screen.queryByText(/google calendar/i)).not.toBeInTheDocument()
      expect(fetchCalendarState).not.toHaveBeenCalled()
    })

    // AC-019, AC-035: an entry per treatment on screen, and none for a treatment nobody can see.
    it('should explain both treatments in the key when both are on screen', async () => {
      mockOwnerAvailability(THU_SEVEN_BOOKED, THU_SIX_AND_SEVEN_BOOKED)

      renderSignedIn()

      await screen.findByRole('list', { name: 'Key' })
      expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Booked on your calendar',
        'Marked free, but booked',
      ])
    })

    it('should render no key when the calendar has nothing on screen', async () => {
      mockOwnerAvailability(NOTHING, NOTHING)

      renderSignedIn()

      await screen.findAllByRole('button', { pressed: false })
      expect(screen.queryByRole('list', { name: 'Key' })).not.toBeInTheDocument()
    })

    it('should state what the check covers while the layer is drawn', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)

      renderSignedIn()

      expect(
        await screen.findByText('We only check your primary calendar, and only the dates in this poll.'),
      ).toBeInTheDocument()
    })

    // AC-034: an empty result is a completed check, named and scoped -- not an error.
    it('should report an empty calendar as a completed check', async () => {
      mockOwnerAvailability(NOTHING, NOTHING)

      renderSignedIn()

      await screen.findAllByRole('button', { pressed: false })
      expect(liveText()).toBe('Checked just now · nothing booked on your primary calendar, Sep 4–5')
      expect(screen.getByRole('button', { name: "Fill in what's free" })).toBeEnabled()
    })

    // The window the server sends back is its syncedRange, which is unioned across every poll this
    // person is in so that moving between two of them does not re-fetch on each open. The count
    // behind "nothing booked" only ever looked at THIS poll's slots, so naming the whole window
    // would vouch for months nobody inspected -- and a December poll can be full while this one is
    // clear. Only the overlap is reported.
    it('should name only the part of the synced window this poll covers', async () => {
      jest.mocked(fetchAvailabilityAuthed).mockResolvedValueOnce({
        busy: NOTHING,
        busyWindow: { end: '2025-12-03', start: '2025-08-20' },
        calendarStatus: 'connected',
        expiration: 1725453600,
        free: NOTHING,
        userId: 'quiet-falcon',
      })

      renderSignedIn()

      await screen.findAllByRole('button', { pressed: false })
      expect(liveText()).toBe('Checked just now · nothing booked on your primary calendar, Sep 4–5')
    })

    // AC-030 and AC-042. The layer is in the record and is deliberately withheld: a name claiming
    // `booked` for something the reader cannot see is worse than saying nothing.
    it('should draw no busy treatment when the record reports a failed check', async () => {
      jest.mocked(fetchAvailabilityAuthed).mockResolvedValueOnce({
        busy: THU_SEVEN_BOOKED,
        busyWindow: null,
        calendarStatus: 'error',
        expiration: 1725453600,
        free: NOTHING,
        userId: 'quiet-falcon',
      })

      renderSignedIn()

      expect(await screen.findByText("We couldn't reach Google Calendar")).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /booked/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Key' })).not.toBeInTheDocument()
      expect(
        screen.queryByText('We only check your primary calendar, and only the dates in this poll.'),
      ).not.toBeInTheDocument()
    })

    it('should ask for a reconnect, not a retry, when the record reports a revoked grant', async () => {
      jest.mocked(fetchAvailabilityAuthed).mockResolvedValueOnce({
        busy: THU_SEVEN_BOOKED,
        busyWindow: null,
        calendarStatus: 'revoked',
        expiration: 1725453600,
        free: NOTHING,
        userId: 'quiet-falcon',
      })

      renderSignedIn()

      expect(await screen.findByText('Reconnect Google Calendar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
      // Same rule as a failed check: the layer is in the record and stays withheld, because a broken
      // connection's last-good intervals cannot be told apart from current ones.
      expect(screen.queryByRole('button', { name: /booked/ })).not.toBeInTheDocument()
    })

    // A check is how somebody with a healthy-looking connection first finds out. The API answers this
    // 200 rather than a failure -- Google replied perfectly promptly, it just replied that the grant is
    // gone -- so the strip has to read the status out of a SUCCESSFUL check and swap the retry it just
    // offered for a Reconnect.
    it('should ask for a reconnect when a check comes back reporting a revoked grant', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)
      jest
        .mocked(syncCalendar)
        .mockResolvedValueOnce({ busy: NOTHING, busyWindow: null, calendarStatus: 'revoked', lastSyncedAt: CHECKED_AT })

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Check again' }))

      expect(await screen.findByText('Reconnect Google Calendar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument()
      // Not an outage, and never described as one: nothing failed and no retry is on offer.
      expect(screen.queryByText("We couldn't reach Google Calendar")).not.toBeInTheDocument()
    })

    it('should say on screen why the fill is inert while the grant is revoked', async () => {
      jest.mocked(fetchAvailabilityAuthed).mockResolvedValueOnce({
        busy: NOTHING,
        busyWindow: null,
        calendarStatus: 'revoked',
        expiration: 1725453600,
        free: THU_SEVEN_BOOKED,
        userId: 'quiet-falcon',
      })

      renderSignedIn()

      const fill = await screen.findByRole('button', { name: "Fill in what's free" })
      expect(fill).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByText("You can fill in what's free once you reconnect your calendar.")).toBeInTheDocument()
    })

    it('should say the check failed and that the grid is untouched', async () => {
      mockOwnerAvailability(THU_SEVEN_BOOKED, NOTHING)
      jest.mocked(syncCalendar).mockRejectedValueOnce(new Error('network error'))

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Check again' }))

      expect(await screen.findByText("We couldn't reach Google Calendar")).toBeInTheDocument()
      expect(liveText()).toBe('Nothing on your grid changed. Booked squares are hidden until we can check again.')
      // One cell arrived painted, and a failed check leaves it exactly as it found it.
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
    })

    // AC-032: inert, still reachable, and the reason is on screen rather than implied.
    it('should say on screen why the fill is inert after a failed check', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)
      jest.mocked(syncCalendar).mockRejectedValueOnce(new Error('network error'))

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Check again' }))

      const fill = await screen.findByRole('button', { name: "Fill in what's free" })
      expect(fill).toHaveAttribute('aria-disabled', 'true')
      expect(reasonFor(fill)).toHaveTextContent("You can fill in what's free once we reach your calendar.")
    })

    // AC-031: nothing on the grid moves while a check runs, and the live region says why.
    it('should keep the layer drawn while a check is running and say where it came from', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)
      jest.mocked(syncCalendar).mockImplementationOnce(() => new Promise(() => {}))

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Check again' }))

      expect(screen.getByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked' })).toBeInTheDocument()
      expect(liveText()).toBe('Checking your calendar… The booked squares on screen are from the last check.')
      const fill = screen.getByRole('button', { name: "Fill in what's free" })
      expect(reasonFor(fill)).toHaveTextContent("You can fill in what's free once the check finishes.")
    })

    it('should force a check when Check again is pressed', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Check again' }))

      await waitFor(() => expect(syncCalendar).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', true))
    })

    it('should merge a fresh check into the record without dropping what is painted', async () => {
      mockOwnerAvailability(
        [
          [true, false, false],
          [false, false, false],
        ],
        NOTHING,
      )
      jest.mocked(syncCalendar).mockResolvedValueOnce(syncResult(THU_SEVEN_BOOKED))

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Check again' }))

      expect(await screen.findByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Thu, Sep 4, 6:00–7:00 PM', pressed: true })).toBeInTheDocument()
    })

    it('should say so when a check finds the same booked time as the last one', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)
      jest.mocked(syncCalendar).mockResolvedValueOnce(syncResult(THU_SEVEN_BOOKED))

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Check again' }))

      await waitFor(() => expect(liveText()).toBe("Checked just now · your booked time hasn't changed"))
    })

    // AC-020, AC-021, AC-022, AC-037. Additive only: the batch carries no false, so nothing the
    // participant painted can come off, and it persists through the same PATCH painting uses.
    it('should paint every unbooked slot and leave the booked ones alone', async () => {
      mockOwnerAvailability(
        [
          [true, false, false],
          [false, false, false],
        ],
        THU_SEVEN_BOOKED,
      )
      jest.mocked(patchAvailability).mockResolvedValueOnce(
        patchResponse([
          [true, false, true],
          [true, true, true],
        ]),
      )

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: "Fill in what's free" }))

      await waitFor(
        () =>
          expect(patchAvailability).toHaveBeenCalledWith(
            'amber-harbor',
            'quiet-falcon',
            {
              cells: [
                { dateIndex: 0, slotIndex: 2, value: true },
                { dateIndex: 1, slotIndex: 0, value: true },
                { dateIndex: 1, slotIndex: 1, value: true },
                { dateIndex: 1, slotIndex: 2, value: true },
              ],
            },
            true,
          ),
        DEBOUNCE_WAIT,
      )
    })

    it('should never unpaint anything from the fill', async () => {
      mockOwnerAvailability(
        [
          [true, false, false],
          [false, false, false],
        ],
        THU_SEVEN_BOOKED,
      )
      jest.mocked(patchAvailability).mockResolvedValueOnce(
        patchResponse([
          [true, false, true],
          [true, true, true],
        ]),
      )

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: "Fill in what's free" }))

      await waitFor(() => expect(patchAvailability).toHaveBeenCalled(), DEBOUNCE_WAIT)
      const { cells } = jest.mocked(patchAvailability).mock.calls[0][2]
      expect(cells.filter((cell) => cell.value === false)).toEqual([])
    })

    it('should ask for no confirmation before filling', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: "Fill in what's free" }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await screen.findAllByRole('button', { pressed: true })).toHaveLength(5)
    })

    // AC-024: the count of what it painted, in the strip's live region.
    it('should report what the fill did', async () => {
      mockOwnerAvailability(
        [
          [true, false, false],
          [false, false, false],
        ],
        THU_SEVEN_BOOKED,
      )

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: "Fill in what's free" }))

      expect(liveText()).toBe('Marked 4 slots free · skipped 1 booked slot')
    })

    // AC-040. Two slots are booked; one of them was already painted free and kept, so the fill
    // leaves exactly one booked slot unpainted. The reported figure is that one, not the two.
    it('should report the booked slots the fill actually skipped, not the total booked', async () => {
      mockOwnerAvailability(
        [
          [false, true, false],
          [false, false, false],
        ],
        THU_SIX_AND_SEVEN_BOOKED,
      )

      renderSignedIn()
      const user = setupUser()
      await user.click(await screen.findByRole('button', { name: 'Keep it' }))
      await user.click(screen.getByRole('button', { name: "Fill in what's free" }))

      expect(liveText()).toBe('Marked 4 slots free · skipped 1 booked slot')
    })

    // AC-029
    it('should state the number of unresolved conflicts', async () => {
      mockOwnerAvailability(
        [
          [true, true, false],
          [false, false, false],
        ],
        THU_SIX_AND_SEVEN_BOOKED,
      )

      renderSignedIn()

      // Asserted through the resolution control rather than the title: the title and the key entry
      // are deliberately the same words, so the title alone is not a unique handle on this state.
      expect(await screen.findByRole('button', { name: 'Clear these 2' })).toBeInTheDocument()
      expect(liveText()).toBe('2 slots you marked free are booked on your calendar.')
    })

    // AC-027: one batch, the conflicts only, and nothing else on the grid touched.
    it('should clear every conflict in one batch and alter no other paint', async () => {
      mockOwnerAvailability(
        [
          [true, true, false],
          [true, false, false],
        ],
        THU_SIX_AND_SEVEN_BOOKED,
      )
      jest.mocked(patchAvailability).mockResolvedValueOnce(
        patchResponse([
          [false, false, false],
          [true, false, false],
        ]),
      )

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Clear these 2' }))

      await waitFor(
        () =>
          expect(patchAvailability).toHaveBeenCalledWith(
            'amber-harbor',
            'quiet-falcon',
            {
              cells: [
                { dateIndex: 0, slotIndex: 0, value: false },
                { dateIndex: 0, slotIndex: 1, value: false },
              ],
            },
            true,
          ),
        DEBOUNCE_WAIT,
      )
      expect(screen.getByRole('button', { name: 'Fri, Sep 5, 6:00–7:00 PM', pressed: true })).toBeInTheDocument()
      expect(liveText()).toBe('Cleared 2 slots · nothing you marked is booked now')
    })

    // AC-028: keeping writes nothing at all -- which conflicts somebody chose to live with is a
    // decision about their calendar, and it stays out of the poll record.
    it('should keep every conflict without writing anything', async () => {
      mockOwnerAvailability(THU_SEVEN_BOOKED, THU_SEVEN_BOOKED)

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Keep it' }))

      expect(patchAvailability).not.toHaveBeenCalled()
      expect(liveText()).toBe("Kept 1 slot · we won't ask again unless you change it")
      expect(
        screen.getByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked', pressed: true }),
      ).toBeInTheDocument()
    })

    it('should stop asking about a conflict once it is kept', async () => {
      mockOwnerAvailability(THU_SEVEN_BOOKED, THU_SEVEN_BOOKED)

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Keep it' }))

      expect(screen.queryByRole('button', { name: 'Keep it' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear this one' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
      // The treatment stays on the cell, so the key still has to explain it.
      expect(screen.getByRole('listitem')).toHaveTextContent('Marked free, but booked')
    })

    // AC-028's tail: the decision was about those slots, not about the calendar in general.
    it('should ask again when a new conflict appears after a keep', async () => {
      mockOwnerAvailability(
        [
          [false, true, false],
          [false, false, false],
        ],
        THU_SIX_AND_SEVEN_BOOKED,
      )

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Keep it' }))

      const booked = screen.getByRole('button', { name: 'Thu, Sep 4, 6:00–7:00 PM, booked' })
      act(() => {
        booked.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
        booked.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
      })

      expect(await screen.findByRole('button', { name: 'Clear this one' })).toBeInTheDocument()
      expect(liveText()).toBe('1 slot you marked free is booked on your calendar.')
    })

    // The keep was a decision about that slot as it stood. Clearing it by hand and painting it
    // again is a new decision about the same slot, so the strip is entitled to ask about it again.
    it('should ask again when a kept slot is repainted by hand', async () => {
      mockOwnerAvailability(THU_SEVEN_BOOKED, THU_SEVEN_BOOKED)

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Keep it' }))
      const booked = screen.getByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked' })
      act(() => {
        booked.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
        booked.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
      })
      act(() => {
        booked.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
        booked.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
      })

      expect(await screen.findByRole('button', { name: 'Clear this one' })).toBeInTheDocument()
    })

    // AC-002: the calendar reports, it does not decide.
    it('should keep a booked slot painted free once the save lands', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)
      jest.mocked(patchAvailability).mockResolvedValueOnce(patchResponse(THU_SEVEN_BOOKED))

      renderSignedIn()
      const booked = await screen.findByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked' })
      act(() => {
        booked.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
        booked.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
      })

      await waitFor(() => expect(patchAvailability).toHaveBeenCalled(), DEBOUNCE_WAIT)
      expect(
        await screen.findByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked', pressed: true }),
      ).toBeInTheDocument()
    })

    // The busy layer rides the same cache entry as `free` (D-9), and a PATCH answers with a record
    // that has no busy in it. Written straight into the cache it would take the layer off the grid.
    it('should keep the busy layer when a save response lands', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)
      jest.mocked(patchAvailability).mockResolvedValueOnce(
        patchResponse([
          [true, false, false],
          [false, false, false],
        ]),
      )

      renderSignedIn()
      const cells = await screen.findAllByRole('button', { pressed: false })
      act(() => {
        cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
        cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
      })

      await waitFor(() => expect(patchAvailability).toHaveBeenCalled(), DEBOUNCE_WAIT)
      expect(screen.getByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked' })).toBeInTheDocument()
    })

    it('should keep the busy layer when a failed save rolls the grid back', async () => {
      mockOwnerAvailability(NOTHING, THU_SEVEN_BOOKED)
      jest.mocked(patchAvailability).mockRejectedValueOnce(new Error('network error'))

      renderSignedIn()
      const cells = await screen.findAllByRole('button', { pressed: false })
      act(() => {
        cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
        cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
      })

      expect(await screen.findByRole('alert', {}, DEBOUNCE_WAIT)).toHaveTextContent("Couldn't save your availability")
      expect(
        screen.getByRole('button', { name: 'Thu, Sep 4, 7:00–8:00 PM, booked', pressed: false }),
      ).toBeInTheDocument()
    })

    it('should store the return path and redirect when connecting', async () => {
      mockUnlinkedAvailability()
      jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'not_connected' })
      sessionStorage.clear()

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Connect' }))

      await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://auth'))
      expect(sessionStorage.getItem('pat_calendar_return')).toEqual('/')
    })

    it('should not redirect when the calendar is already connected', async () => {
      mockUnlinkedAvailability()
      jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'not_connected' })
      jest.mocked(connectCalendar).mockResolvedValueOnce({ alreadyConnected: true })

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Connect' }))

      await waitFor(() => expect(connectCalendar).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon'))
      // No consent screen to send them to: the refreshed calendar state is what moves the strip.
      await screen.findByRole('button', { name: 'Check again' })
      expect(redirectTo).not.toHaveBeenCalled()
    })

    // A failed connect used to do nothing at all -- no redirect, no message, a button that looked
    // ignored. The 403 case is the one worth naming: the API answers it only when the participant
    // belongs to a different Google account, which "try again" will never fix.
    it('should name the account mismatch when the connect is refused', async () => {
      mockUnlinkedAvailability()
      jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'not_connected' })
      jest.mocked(connectCalendar).mockRejectedValueOnce({ response: { statusCode: 403 } })

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Connect' }))

      expect(
        await screen.findByText(
          "You're signed in with a different Google account than the one that joined this poll. Sign out, then sign in with that account.",
        ),
      ).toBeInTheDocument()
      expect(redirectTo).not.toHaveBeenCalled()
    })

    it('should report a connect that failed for any other reason', async () => {
      mockUnlinkedAvailability()
      jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'not_connected' })
      jest.mocked(connectCalendar).mockRejectedValueOnce({ response: { statusCode: 500 } })

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Connect' }))

      expect(await screen.findByText("Couldn't connect Google Calendar. Please try again.")).toBeInTheDocument()
    })

    it('should hide the invitation once it is dismissed', async () => {
      mockUnlinkedAvailability()
      jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'not_connected' })

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Not now' }))

      expect(screen.queryByText(/google calendar/i)).not.toBeInTheDocument()
    })

    it('should say it is connecting while the hand-off is in flight', async () => {
      mockUnlinkedAvailability()
      jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'not_connected' })
      jest.mocked(connectCalendar).mockImplementationOnce(() => new Promise(() => {}))

      renderSignedIn()
      await setupUser().click(await screen.findByRole('button', { name: 'Connect' }))

      expect(await screen.findByText('Connecting to Google Calendar…')).toBeInTheDocument()
    })

    it('should refuse a second connect while the first is still in flight', async () => {
      mockUnlinkedAvailability()
      jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'not_connected' })
      jest.mocked(connectCalendar).mockImplementationOnce(() => new Promise(() => {}))

      renderSignedIn()
      const user = setupUser()
      await user.click(await screen.findByRole('button', { name: 'Connect' }))
      await user.click(await screen.findByRole('button', { name: 'Connecting…' }))

      expect(connectCalendar).toHaveBeenCalledTimes(1)
    })
  })
})
