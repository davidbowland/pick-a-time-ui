import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import VoterIdentityControl, { VoterIdentityControlProps } from './index'
import { fetchConfig, patchUser } from '@services/api'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { User } from '@types'

jest.mock('@services/api')

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

const user: User = { userId: 'quiet-falcon', name: 'Quiet Falcon', calendarStatus: 'not_connected' }

function renderWithClient(props: Partial<VoterIdentityControlProps> = {}): { queryClient: QueryClient } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <VoterIdentityControl isSignedIn={false} onNotYou={jest.fn()} sessionId="amber-harbor" user={user} {...props} />
    </QueryClientProvider>,
  )
  return { queryClient }
}

// Renders a focusable sibling outside the control, so tests can move focus somewhere genuinely
// outside the whole name-edit widget (not just from the input to its own Cancel button, which is
// still "inside" and must not trigger a save — see the "tabbing ... to the Cancel button" test).
function renderWithClientAndOutsideFocusTarget(props: Partial<VoterIdentityControlProps> = {}): {
  queryClient: QueryClient
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <button type="button">Elsewhere</button>
      <VoterIdentityControl isSignedIn={false} onNotYou={jest.fn()} sessionId="amber-harbor" user={user} {...props} />
    </QueryClientProvider>,
  )
  return { queryClient }
}

describe('VoterIdentityControl', () => {
  beforeAll(() => {
    jest.mocked(fetchConfig).mockResolvedValue(config)
  })

  it('shows the current display name', () => {
    renderWithClient()

    expect(screen.getByText('Quiet Falcon')).toBeInTheDocument()
  })

  it('labels the name with "Voting as" so a bare name cannot be misread as a content heading', () => {
    renderWithClient()

    expect(screen.getByText(/voting as/i)).toBeInTheDocument()
  })

  it('shows the "This isn\'t me" button when not signed in, and calls onNotYou on click', async () => {
    const onNotYou = jest.fn()
    renderWithClient({ onNotYou })

    await userEvent.click(screen.getByRole('button', { name: "This isn't me" }))

    expect(onNotYou).toHaveBeenCalled()
  })

  it('hides the "This isn\'t me" button when signed in', () => {
    renderWithClient({ isSignedIn: true })

    expect(screen.queryByRole('button', { name: "This isn't me" })).not.toBeInTheDocument()
  })

  it('saves a trimmed new name on blur and invalidates the users query', async () => {
    jest.mocked(patchUser).mockResolvedValueOnce({ ...user, name: 'Q' })
    const { queryClient } = renderWithClientAndOutsideFocusTarget()
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, '  Q  ')
    await userEvent.click(screen.getByText('Elsewhere'))

    await waitFor(() =>
      expect(patchUser).toHaveBeenCalledWith(
        'amber-harbor',
        'quiet-falcon',
        [{ op: 'replace', path: '/name', value: 'Q' }],
        false,
      ),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'amber-harbor'] })
  })

  it('does not save on blur when the draft is empty', async () => {
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = screen.getByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.click(screen.getByText('Elsewhere'))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel editing name' })).not.toBeInTheDocument())
    expect(screen.getByText('Quiet Falcon')).toBeInTheDocument()
    expect(patchUser).not.toHaveBeenCalled()
  })

  it('does not save on blur when the draft is unchanged', async () => {
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = screen.getByDisplayValue('Quiet Falcon')
    await userEvent.click(input)
    await userEvent.click(screen.getByText('Elsewhere'))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel editing name' })).not.toBeInTheDocument())
    expect(screen.getByText('Quiet Falcon')).toBeInTheDocument()
    expect(patchUser).not.toHaveBeenCalled()
  })

  it('cancels via the X button without saving, even though clicking it blurs the input', async () => {
    renderWithClient()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel editing name' }))

    expect(screen.getByText('Quiet Falcon')).toBeInTheDocument()
    expect(patchUser).not.toHaveBeenCalled()
  })

  it('tabbing from the input to the Cancel button keeps editing open without saving or losing focus', async () => {
    renderWithClient()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'Cancel editing name' })).toHaveFocus()
    expect(screen.getByDisplayValue('New Name')).toBeInTheDocument()
    expect(patchUser).not.toHaveBeenCalled()
  })

  it('does not trigger a second save while one is already pending', async () => {
    let resolvePatch: (value: User) => void = () => {}
    jest.mocked(patchUser).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve
        }),
    )
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByText('Elsewhere'))
    await waitFor(() => expect(patchUser).toHaveBeenCalledTimes(1))

    await userEvent.click(input)
    await userEvent.click(screen.getByText('Elsewhere'))

    expect(patchUser).toHaveBeenCalledTimes(1)
    resolvePatch({ ...user, name: 'New Name' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel editing name' })).not.toBeInTheDocument())
  })

  it('disables the input while a save is pending, so a second edit cannot be silently dropped', async () => {
    let resolvePatch: (value: User) => void = () => {}
    jest.mocked(patchUser).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve
        }),
    )
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByText('Elsewhere'))
    await waitFor(() => expect(patchUser).toHaveBeenCalledTimes(1))

    expect(screen.getByDisplayValue('New Name')).toBeDisabled()

    resolvePatch({ ...user, name: 'New Name' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel editing name' })).not.toBeInTheDocument())
  })

  it('ignores Escape while a blur-triggered save is still pending, so it cannot appear to cancel', async () => {
    let resolvePatch: (value: User) => void = () => {}
    jest.mocked(patchUser).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve
        }),
    )
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByText('Elsewhere'))
    await waitFor(() => expect(patchUser).toHaveBeenCalledTimes(1))

    await userEvent.click(input)
    await userEvent.type(input, '{Escape}')

    expect(screen.getByDisplayValue('New Name')).toBeInTheDocument()

    resolvePatch({ ...user, name: 'New Name' })
    await waitFor(() => expect(screen.queryByDisplayValue('New Name')).not.toBeInTheDocument())
  })

  it('cancels editing on Escape without saving', async () => {
    renderWithClient()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = screen.getByDisplayValue('Quiet Falcon')
    await userEvent.type(input, '{Escape}')

    expect(screen.queryByDisplayValue('Quiet Falcon')).not.toBeInTheDocument()
    expect(screen.getByText('Quiet Falcon')).toBeInTheDocument()
    expect(patchUser).not.toHaveBeenCalled()
  })

  it('shows an error and keeps the form open when a blur-triggered save fails', async () => {
    jest.mocked(patchUser).mockRejectedValueOnce(new Error('Network error'))
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByText('Elsewhere'))

    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument()
    expect(screen.getByDisplayValue('New Name')).toBeInTheDocument()
  })

  it('clears the save error once the user starts typing again', async () => {
    jest.mocked(patchUser).mockRejectedValueOnce(new Error('Network error'))
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByText('Elsewhere'))
    await screen.findByText("Couldn't save. Try again.")

    await userEvent.type(input, '!')

    expect(screen.queryByText("Couldn't save. Try again.")).not.toBeInTheDocument()
  })

  it('still returns focus to the Edit name button on Escape after an earlier failed blur-save', async () => {
    jest.mocked(patchUser).mockRejectedValueOnce(new Error('Network error'))
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.click(screen.getByText('Elsewhere'))
    await screen.findByText("Couldn't save. Try again.")

    await userEvent.type(input, '{Escape}')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit name' })).toHaveFocus())
  })

  it('moves focus to the Edit name button after cancelling with Escape', async () => {
    renderWithClient()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = screen.getByDisplayValue('Quiet Falcon')
    await userEvent.type(input, '{Escape}')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit name' })).toHaveFocus())
  })

  it('does not steal focus back to the Edit name button after a successful blur-triggered save', async () => {
    jest.mocked(patchUser).mockResolvedValueOnce({ ...user, name: 'Q' })
    renderWithClientAndOutsideFocusTarget()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = await screen.findByDisplayValue('Quiet Falcon')
    await userEvent.clear(input)
    await userEvent.type(input, 'Q')
    await userEvent.click(screen.getByText('Elsewhere'))

    await waitFor(() => expect(patchUser).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Edit name' })).not.toHaveFocus()
  })
})
