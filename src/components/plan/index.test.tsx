import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import Plan from './index'
import { useSessionCookie } from '@hooks/useSessionCookie'
import { createUser, fetchAvailability, fetchOverlap, fetchPlan, fetchUsers } from '@services/api'
import { PlanData, User } from '@types'

jest.mock('@services/api')
jest.mock('@hooks/useSessionCookie')
jest.mock('@components/auth-context', () => ({ useAuthContext: () => ({ isSignedIn: false, isLoading: false }) }))

describe('Plan', () => {
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
  const existingUser: User = { userId: 'quiet-falcon', name: 'Quiet Falcon', phone: null, textsSent: 0 }

  beforeAll(() => {
    jest.mocked(useSessionCookie).mockReturnValue({ userId: undefined, setUserId: jest.fn(), clearUserId: jest.fn() })
  })

  function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }

  it('should show the identity phase once the plan and empty user list load', async () => {
    jest.mocked(fetchPlan).mockResolvedValueOnce(plan)
    jest.mocked(fetchUsers).mockResolvedValueOnce([])

    renderWithClient(<Plan sessionId="amber-harbor" />)

    expect(await screen.findByText('Fall rec soccer practice')).toBeInTheDocument()
  })

  it('should reach the active phase with a painting/results tab switch once an existing user is identified', async () => {
    // Identify via the ?id= query param (read once on mount) rather than mocking the cookie
    // hook's return value per-render: `useSessionCookie` is called on every render as queries
    // resolve, so a `mockReturnValueOnce` override only survives the first of several renders.
    window.history.pushState(null, '', `?id=${existingUser.userId}`)
    jest.mocked(fetchPlan).mockResolvedValueOnce(plan)
    jest.mocked(fetchUsers).mockResolvedValueOnce([existingUser])
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      userId: existingUser.userId,
      template: [
        [false, false, false],
        [false, false, false],
      ],
      overrides: {},
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      mode: 'pattern',
      weekIndex: null,
      grid: { cells: [], bestSlot: { hourIndex: 0, dayIndex: 0, freeCount: 0 } },
      exceptions: [],
    })

    renderWithClient(<Plan sessionId="amber-harbor" />)

    expect(await screen.findByText('Fall rec soccer practice')).toBeInTheDocument()
    const paintingTab = screen.getByRole('tab', { name: 'Your hours' })
    const resultsTab = screen.getByRole('tab', { name: 'The overlap' })
    expect(paintingTab).toHaveAttribute('aria-selected', 'true')
    expect(resultsTab).toHaveAttribute('aria-selected', 'false')
    // The Share component is genuinely reachable in the active phase, once a real userId is
    // resolved — not orphaned/unmounted dead code (its trigger button reads "Invite").
    expect(screen.getByText('Invite')).toBeInTheDocument()
    // Painting tab is showing the real grid, driven by the availability query.
    expect(await screen.findByText('Mark all day')).toBeInTheDocument()

    await userEvent.click(resultsTab)

    expect(paintingTab).toHaveAttribute('aria-selected', 'false')
    expect(resultsTab).toHaveAttribute('aria-selected', 'true')
    // Results tab is showing the real overlap panel, driven by the overlap query.
    expect(
      await screen.findByText(
        'No overlap yet. Once everyone paints their availability, the best time will show up here.',
      ),
    ).toBeInTheDocument()
  })

  it('should show a loading indicator while the plan and users are still being fetched', async () => {
    let resolvePlan: (value: PlanData) => void = () => {}
    jest.mocked(fetchPlan).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePlan = resolve
        }),
    )
    jest.mocked(fetchUsers).mockResolvedValueOnce([])

    renderWithClient(<Plan sessionId="amber-harbor" />)

    expect(await screen.findByRole('status')).toBeInTheDocument()

    resolvePlan(plan)

    expect(await screen.findByText('Fall rec soccer practice')).toBeInTheDocument()
  })

  it('should show an error state with a retry option when the plan fails to load', async () => {
    jest.mocked(fetchPlan).mockRejectedValueOnce(new Error('network error'))
    jest.mocked(fetchPlan).mockResolvedValueOnce(plan)
    jest.mocked(fetchUsers).mockResolvedValue([])

    renderWithClient(<Plan sessionId="amber-harbor" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load this plan/i)

    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Fall rec soccer practice')).toBeInTheDocument()
  })

  it('should reach the active phase after auto-creating a new user in a brand-new (empty) plan', async () => {
    // This is the exact journey C1 broke: a first-time visitor lands on an empty plan,
    // IdentityPhase auto-creates a user, and the app must advance past the identity screen.
    // Reproducing it requires `useSessionCookie` to behave like the real hook — reflecting the
    // id passed to `setUserId` on the next render — rather than the shared no-op mock other
    // tests in this file use, since the whole bug was that a stale `users` list combined with a
    // cookie that never got read back would leave the phase machine stuck forever.
    window.history.replaceState(null, '', '/')
    const newUser: User = { userId: 'bright-heron', name: null, phone: null, textsSent: 0 }
    let currentUserId: string | undefined
    const setUserId = jest.fn((id: string) => {
      currentUserId = id
    })
    jest.mocked(useSessionCookie).mockImplementation(() => ({
      clearUserId: jest.fn(),
      setUserId,
      userId: currentUserId,
    }))

    jest.mocked(fetchPlan).mockResolvedValueOnce(plan)
    // First load: the group is empty, which is what makes IdentityPhase auto-create a user.
    jest.mocked(fetchUsers).mockResolvedValueOnce([])
    // Second load: fired by the mandatory invalidateQueries in the fix — without it this
    // mock is never consumed and the test times out waiting on the active phase.
    jest.mocked(fetchUsers).mockResolvedValueOnce([newUser])
    jest.mocked(createUser).mockResolvedValueOnce(newUser)
    jest.mocked(fetchAvailability).mockResolvedValueOnce({
      overrides: {},
      template: [
        [false, false, false],
        [false, false, false],
      ],
      userId: newUser.userId,
    })
    jest.mocked(fetchOverlap).mockResolvedValue({
      exceptions: [],
      grid: { bestSlot: { dayIndex: 0, freeCount: 0, hourIndex: 0 }, cells: [] },
      mode: 'pattern',
      weekIndex: null,
    })

    renderWithClient(<Plan sessionId="amber-harbor" />)

    expect(await screen.findByText('Fall rec soccer practice')).toBeInTheDocument()

    // The combined handler both sets the cookie and invalidates the users query.
    await waitFor(() => expect(setUserId).toHaveBeenCalledWith('bright-heron'))

    // The phase machine actually advances past `identity` into `active` — painting/results
    // tabs appear, which is the concrete, observable proof this is no longer stuck.
    expect(await screen.findByRole('tab', { name: 'Your hours' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'The overlap' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Your hours' })).toHaveAttribute('aria-selected', 'true')
  })
})
