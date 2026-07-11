import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import ResultsPhase from './index'
import { fetchOverlap } from '@services/api'
import { PlanData } from '@types'

jest.mock('@services/api')

describe('ResultsPhase', () => {
  const plan: PlanData = {
    sessionId: 'amber-harbor',
    name: 'Fall rec soccer practice',
    weekdays: [4, 5, 6],
    startDate: '2025-09-04',
    weekCount: 6,
    startHour: 18,
    endHour: 20,
    timezone: 'America/Chicago',
    participantCount: 3,
  }

  const overlapResponse = {
    mode: 'pattern' as const,
    weekIndex: null,
    grid: {
      cells: [[{ hourIndex: 0, dayIndex: 1, freeCount: 3, freeUserIds: ['a', 'b', 'c'] }]],
      bestSlot: { hourIndex: 0, dayIndex: 1, freeCount: 3 },
    },
    exceptions: [],
  }

  function renderWithClient(ui: React.ReactElement): ReturnType<typeof render> {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  it('should show the best slot from the pattern view by default', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByText(/3 of 3/i)).toBeInTheDocument()
    expect(fetchOverlap).toHaveBeenCalledWith('amber-harbor', 'pattern')
  })

  it('should refetch a specific week when the By-week tab is selected', async () => {
    jest.mocked(fetchOverlap).mockResolvedValue(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)
    await screen.findByText(/3 of 3/i)
    await userEvent.click(screen.getByRole('tab', { name: /by week/i }))

    await waitFor(() => expect(fetchOverlap).toHaveBeenCalledWith('amber-harbor', 0))
  })

  it('should mark the selected tab so its state is not conveyed by color alone', async () => {
    jest.mocked(fetchOverlap).mockResolvedValue(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)
    await screen.findByText(/3 of 3/i)

    expect(screen.getByRole('tab', { name: /pattern/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /by week/i })).toHaveAttribute('aria-selected', 'false')

    await userEvent.click(screen.getByRole('tab', { name: /by week/i }))

    expect(screen.getByRole('tab', { name: /by week/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /pattern/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('should switch tabs from the keyboard, without requiring a pointer', async () => {
    jest.mocked(fetchOverlap).mockResolvedValue(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)
    await screen.findByText(/3 of 3/i)

    act(() => {
      screen.getByRole('tab', { name: /pattern/i }).focus()
    })
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: /by week/i })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(fetchOverlap).toHaveBeenCalledWith('amber-harbor', 0))
  })

  it('should show a loading state while the overlap request is in flight', async () => {
    jest.mocked(fetchOverlap).mockReturnValueOnce(new Promise(() => {}))

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByRole('status')).toHaveTextContent(/loading/i)
  })

  it('should show an error with a way to retry when the overlap request fails', async () => {
    jest.mocked(fetchOverlap).mockRejectedValueOnce(new Error('network error'))

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load the results/i)

    jest.mocked(fetchOverlap).mockResolvedValueOnce(overlapResponse)
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText(/3 of 3/i)).toBeInTheDocument()
  })

  it('should show a friendly empty state instead of "0 of 3 free" when nobody overlaps yet', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      grid: { ...overlapResponse.grid, bestSlot: { hourIndex: 0, dayIndex: 1, freeCount: 0 } },
    })

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByText(/no overlap yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/of 3 free/i)).not.toBeInTheDocument()
  })

  it('should list exceptions when the server reports any', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      exceptions: [{ weekIndex: 2, hourIndex: 0, dayIndex: 1, description: 'Bright Heron is out week 3' }],
    })

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByText('Bright Heron is out week 3')).toBeInTheDocument()
  })

  it('should let people page through weeks in the By-week view', async () => {
    jest.mocked(fetchOverlap).mockResolvedValue(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)
    await screen.findByText(/3 of 3/i)
    await userEvent.click(screen.getByRole('tab', { name: /by week/i }))
    await screen.findByText('Week 1 of 6')

    expect(screen.getByRole('button', { name: /previous week/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /next week/i }))

    await waitFor(() => expect(fetchOverlap).toHaveBeenCalledWith('amber-harbor', 1))
    expect(await screen.findByText('Week 2 of 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous week/i })).toBeEnabled()
  })

  it('should keep WeekNav mounted and interactive while the next week is still loading', async () => {
    jest.mocked(fetchOverlap).mockResolvedValue(overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)
    await screen.findByText(/3 of 3/i)
    await userEvent.click(screen.getByRole('tab', { name: /by week/i }))
    await screen.findByText('Week 1 of 6')

    // Control exactly when the week-2 fetch resolves so the mid-flight render can be observed —
    // a test that only awaits the final result can't see this class of bug (the panel blanking
    // to a spinner and taking the nav buttons with it).
    let resolveNextWeek: (value: typeof overlapResponse) => void = () => {}
    const pendingFetch = new Promise<typeof overlapResponse>((resolve) => {
      resolveNextWeek = resolve
    })
    jest.mocked(fetchOverlap).mockReturnValueOnce(pendingFetch)

    await userEvent.click(screen.getByRole('button', { name: /next week/i }))

    // Mid-flight: the fetch for week 2 hasn't resolved yet, but the nav must still be present,
    // showing the new week, and interactive — not replaced by a full-panel loading spinner.
    expect(screen.getByText('Week 2 of 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous week/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /next week/i })).toBeEnabled()
    expect(screen.queryByText(/loading everyone/i)).not.toBeInTheDocument()

    resolveNextWeek(overlapResponse)

    await waitFor(() => expect(screen.queryByText(/updating/i)).not.toBeInTheDocument())
    expect(screen.getByText('Week 2 of 6')).toBeInTheDocument()
  })

  it('should fall back gracefully when the response has no grid/bestSlot', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      grid: undefined,
    } as unknown as typeof overlapResponse)

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByText(/no overlap yet/i)).toBeInTheDocument()
  })

  it('should not render the literal word "undefined" when the best slot day index is out of range', async () => {
    jest.mocked(fetchOverlap).mockResolvedValueOnce({
      ...overlapResponse,
      grid: { ...overlapResponse.grid, bestSlot: { hourIndex: 0, dayIndex: 99, freeCount: 3 } },
    })

    renderWithClient(<ResultsPhase plan={plan} sessionId="amber-harbor" />)

    expect(await screen.findByText(/3 of 3/i)).toBeInTheDocument()
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument()
  })
})
