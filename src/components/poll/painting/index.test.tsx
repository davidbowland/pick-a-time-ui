import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import PaintingPhase from './index'
import { fetchAvailability, patchAvailability } from '@services/api'
import { AvailabilityRecord, PollData } from '@types'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'

jest.mock('@services/api')
jest.mock('@utils/detectViewerTimezone')

describe('PaintingPhase', () => {
  // PaintingPhase debounces its PATCH by 1250ms (PATCH_DEBOUNCE_MS in index.tsx) so a burst of
  // quick individual picks coalesces into one request. Fake timers make that deterministic;
  // `waitFor`/`findBy*` detect Jest's fake timers and advance them automatically, but their
  // default 1000ms timeout is shorter than the debounce, so assertions that wait on a PATCH pass
  // an explicit longer timeout via DEBOUNCE_WAIT.
  const PATCH_DEBOUNCE_MS = 1250
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

  it('should render an empty grid once availability loads', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('should label each cell with its date and time so screen readers can announce it', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findByRole('button', { name: 'Thu, Sep 4, 6:00–7:00 PM' })).toBeInTheDocument()
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
          cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
        }),
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(cells[0])

    await waitFor(() => expect(patchAvailability).toHaveBeenCalledTimes(1), DEBOUNCE_WAIT)
    expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
      cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
    })
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
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
        expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
          cells: [
            { dateIndex: 0, slotIndex: 0, value: true },
            { dateIndex: 0, slotIndex: 1, value: true },
          ],
        }),
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })
    cells[0].focus()

    expect(cells[0]).toHaveFocus()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.keyboard('{Enter}')

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
          cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
        }),
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(await screen.findByRole('button', { name: 'Select all' }))

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
          cells: [
            { dateIndex: 0, slotIndex: 0, value: true },
            { dateIndex: 0, slotIndex: 1, value: true },
            { dateIndex: 0, slotIndex: 2, value: true },
            { dateIndex: 1, slotIndex: 0, value: true },
            { dateIndex: 1, slotIndex: 1, value: true },
            { dateIndex: 1, slotIndex: 2, value: true },
          ],
        }),
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(await screen.findByRole('button', { name: 'Clear all' }))

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
          cells: expect.arrayContaining([{ dateIndex: 0, slotIndex: 0, value: false }]),
        }),
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
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
        expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
          cells: [
            { dateIndex: 0, slotIndex: 0, value: true },
            { dateIndex: 0, slotIndex: 1, value: true },
            { dateIndex: 0, slotIndex: 2, value: true },
          ],
        }),
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenNthCalledWith(1, 'amber-harbor', 'quiet-falcon', {
          cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
        }),
      DEBOUNCE_WAIT,
    )

    act(() => {
      cells[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[1].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(
      () =>
        expect(patchAvailability).toHaveBeenNthCalledWith(2, 'amber-harbor', 'quiet-falcon', {
          cells: [{ dateIndex: 0, slotIndex: 1, value: true }],
        }),
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    expect(await screen.findByRole('alert', {}, DEBOUNCE_WAIT)).toHaveTextContent("Couldn't save your availability")
    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('should roll back every cell from a coalesced batch, not just the last one, when the merged PATCH fails', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
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

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)
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

    renderWithClient(<PaintingPhase poll={datesOnlyPoll} sessionId="amber-harbor" userId="quiet-falcon" />)

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
        expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
          cells: [{ dateIndex: 0, slotIndex: 0, value: true }],
        }),
      DEBOUNCE_WAIT,
    )
  })

  it('should state the meeting time even though the grid itself has no header for a single-slot timed poll', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false], [false]],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase poll={singleSlotTimedPoll} sessionId="amber-harbor" userId="quiet-falcon" />)

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

    renderWithClient(<PaintingPhase poll={datesOnlyPoll} sessionId="amber-harbor" userId="quiet-falcon" />)

    await screen.findByRole('button', { name: 'Thu, Sep 4' })
    expect(screen.queryByText(/meeting time/i)).not.toBeInTheDocument()
  })

  it('shows slot header times converted to the viewer timezone', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase poll={poll} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findByText('8:00–9:00 AM (next day for you)')).toBeInTheDocument()
  })

  it('shows the meeting-time note converted to the viewer timezone, flagged when the day shifts', async () => {
    jest.mocked(detectViewerTimezone).mockReturnValueOnce('Asia/Tokyo')
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      free: [[false], [false]],
      expiration: 1725453600,
    })

    renderWithClient(<PaintingPhase poll={singleSlotTimedPoll} sessionId="amber-harbor" userId="quiet-falcon" />)

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

    renderWithClient(<PaintingPhase poll={overridePoll} sessionId="amber-harbor" userId="quiet-falcon" />)

    // Union of the two dates' windows is two columns (9-10am, 11am-12pm). Each date only has a
    // real slot for one of them, so there are exactly 2 tappable buttons, not 4.
    const cells = await screen.findAllByRole('button', { pressed: false })
    expect(cells).toHaveLength(2)
  })
})
