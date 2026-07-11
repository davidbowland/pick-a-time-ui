import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import PaintingPhase from './index'
import { fetchAvailability, patchAvailability } from '@services/api'
import { AvailabilityRecord, PlanData } from '@types'

jest.mock('@services/api')

describe('PaintingPhase', () => {
  const plan: PlanData = {
    sessionId: 'amber-harbor',
    name: 'Fall rec soccer practice',
    weekdays: [4, 5, 6],
    startDate: '2025-09-04',
    weekCount: 6,
    startHour: 18,
    endHour: 20,
    timezone: 'America/Chicago',
    participantCount: 1,
  }

  function renderWithClient(ui: React.ReactElement): ReturnType<typeof render> {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  function mockEmptyAvailability(): void {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [false, false, false],
        [false, false, false],
      ],
      overrides: {},
    })
  }

  it('should render an empty grid once availability loads', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('should label each cell with its hour and day so screen readers can announce it', async () => {
    mockEmptyAvailability()

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)

    expect(await screen.findByRole('button', { name: '6p, Thu' })).toBeInTheDocument()
  })

  it('should PATCH the painted cell on pointer up', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, false, false],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: [{ hourIndex: 0, dayIndex: 0, value: true }],
        resetToPattern: false,
      }),
    )
  })

  it('should PATCH exactly once when a real mouse click drives the whole pointer/click sequence', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, false, false],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    // userEvent.click dispatches the full pointerdown/pointerup/click sequence a real mouse
    // click produces — this guards against the click handler's keyboard-only branch
    // double-toggling a cell that a mouse already painted via the pointer handlers.
    await userEvent.click(cells[0])

    await waitFor(() => expect(patchAvailability).toHaveBeenCalledTimes(1))
    expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
      weekIndex: null,
      cells: [{ hourIndex: 0, dayIndex: 0, value: true }],
      resetToPattern: false,
    })
  })

  it('should toggle a cell from the keyboard, so painting does not require a pointer', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, false, false],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })
    cells[0].focus()

    expect(cells[0]).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: [{ hourIndex: 0, dayIndex: 0, value: true }],
        resetToPattern: false,
      }),
    )
    expect(await screen.findByRole('button', { name: '6p, Thu', pressed: true })).toBeInTheDocument()
  })

  it('should PATCH every cell as filled when "Mark all day" is pressed', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, true, true],
        [true, true, true],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all day' }))

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: [
          { hourIndex: 0, dayIndex: 0, value: true },
          { hourIndex: 0, dayIndex: 1, value: true },
          { hourIndex: 0, dayIndex: 2, value: true },
          { hourIndex: 1, dayIndex: 0, value: true },
          { hourIndex: 1, dayIndex: 1, value: true },
          { hourIndex: 1, dayIndex: 2, value: true },
        ],
        resetToPattern: false,
      }),
    )
  })

  it('should PATCH every cell as cleared when "Clear all" is pressed', async () => {
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, true, true],
        [true, true, true],
      ],
      overrides: {},
    })
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [false, false, false],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Clear all' }))

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: expect.arrayContaining([{ hourIndex: 0, dayIndex: 0, value: false }]),
        resetToPattern: false,
      }),
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
      template: [
        [true, true, true],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })
    const [cellA, cellB, cellC] = cells // (0,0)=6p,Thu  (0,1)=6p,Fri  (0,2)=6p,Sat

    // Simulate real touch semantics: elementFromPoint(0)->A, (100)->B, (200)->C, but every
    // event is dispatched with `target: cellA` to reproduce touch's implicit pointer capture.
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

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenCalledWith('amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: [
          { hourIndex: 0, dayIndex: 0, value: true },
          { hourIndex: 0, dayIndex: 1, value: true },
          { hourIndex: 0, dayIndex: 2, value: true },
        ],
        resetToPattern: false,
      }),
    )
    expect(patchAvailability).toHaveBeenCalledTimes(1)
  })

  it('should not leave the gesture stuck after a pointercancel (e.g. the browser interpreting a drag as a page scroll)', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, false, false],
        [false, false, false],
      ],
      overrides: {},
    })
    jest.mocked(patchAvailability).mockResolvedValueOnce({
      userId: 'quiet-falcon',
      template: [
        [true, true, false],
        [false, false, false],
      ],
      overrides: {},
    })

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    // First gesture gets cancelled mid-drag (no pointerup at all) — this must still commit
    // what was painted so far (matching the un-cancelled pointerup path) and, crucially, must
    // not leave `paintingRef` stuck `true` for the next, unrelated gesture.
    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }))
    })

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenNthCalledWith(1, 'amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: [{ hourIndex: 0, dayIndex: 0, value: true }],
        resetToPattern: false,
      }),
    )

    // A brand-new gesture on a different cell must paint only that cell — proving the
    // cancelled gesture's state was fully reset rather than leaking into this one.
    act(() => {
      cells[1].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[1].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    await waitFor(() =>
      expect(patchAvailability).toHaveBeenNthCalledWith(2, 'amber-harbor', 'quiet-falcon', {
        weekIndex: null,
        cells: [{ hourIndex: 0, dayIndex: 1, value: true }],
        resetToPattern: false,
      }),
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

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    // The PATCH above is still unresolved here. If the overlay were cleared before the
    // optimistic cache write landed, the grid would fall back to the stale pre-patch server
    // data and this cell would render as unpainted for a beat.
    await waitFor(() => expect(cells[0]).toHaveAttribute('aria-pressed', 'true'))

    resolvePatch({
      userId: 'quiet-falcon',
      template: [
        [true, false, false],
        [false, false, false],
      ],
      overrides: {},
    })
    await waitFor(() => expect(patchAvailability).toHaveBeenCalledTimes(1))
  })

  it('should roll back the cell and show an error message when the PATCH fails', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    const cells = await screen.findAllByRole('button', { pressed: false })

    act(() => {
      cells[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      cells[0].dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your availability")
    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('should roll back and show an error when "Mark all day" fails to save', async () => {
    mockEmptyAvailability()
    jest.mocked(patchAvailability).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<PaintingPhase plan={plan} sessionId="amber-harbor" userId="quiet-falcon" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your availability")
    expect(await screen.findAllByRole('button', { pressed: false })).toHaveLength(6)
  })
})
