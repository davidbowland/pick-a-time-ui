import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from 'aws-amplify/api'
import { useRouter } from 'next/router'
import React from 'react'

import PlanCreate from './index'
import { createPlan } from '@services/api'

jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  createPlan: jest.fn(),
}))
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

function renderWithClient(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanCreate />
    </QueryClientProvider>,
  )
}

describe('PlanCreate', () => {
  afterAll(() => {
    delete (global as any).grecaptcha
  })

  function setup(): { push: jest.Mock } {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ push } as any)
    ;(global as any).grecaptcha = { ready: (cb: () => void) => cb(), execute: jest.fn().mockResolvedValue('token') }
    return { push }
  }

  it('should show a validation message when the plan name is empty', async () => {
    setup()
    renderWithClient()

    await userEvent.click(screen.getByRole('button', { name: /start a plan/i }))

    expect(await screen.findByText(/name your plan/i)).toBeInTheDocument()
    expect(createPlan).not.toHaveBeenCalled()
  })

  it('should submit the selected weekdays, week count, and hour range', async () => {
    const { push } = setup()
    jest.mocked(createPlan).mockResolvedValueOnce({ sessionId: 'amber-harbor' })

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/plan name/i), 'Fall rec soccer practice')
    await userEvent.click(screen.getByRole('checkbox', { name: /^thu/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^fri/i }))
    await userEvent.click(screen.getByRole('button', { name: /start a plan/i }))

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fall rec soccer practice', weekdays: expect.arrayContaining([4, 5]) }),
      'token',
    )
    expect(push).toHaveBeenCalledWith('/p/amber-harbor')
  })

  it('should submit a startDate on the first selected weekday even when today is a different weekday', async () => {
    const { push } = setup()
    jest.mocked(createPlan).mockResolvedValueOnce({ sessionId: 'amber-harbor' })
    jest.useFakeTimers()
    try {
      jest.setSystemTime(new Date(2026, 6, 14)) // Tuesday, 2026-07-14 (local) — not a Thursday
      const user = userEvent.setup({ delay: null })

      renderWithClient()
      await user.type(screen.getByLabelText(/plan name/i), 'Fall rec soccer practice')
      await user.click(screen.getByRole('checkbox', { name: /^thu/i }))
      await user.click(screen.getByRole('checkbox', { name: /^fri/i }))
      await user.click(screen.getByRole('button', { name: /start a plan/i }))

      expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-07-16' }), 'token')
      expect(push).toHaveBeenCalledWith('/p/amber-harbor')
    } finally {
      jest.useRealTimers()
    }
  })

  it('should surface the api message when plan creation fails with a 400', async () => {
    setup()
    const error = Object.assign(new Error('bad request'), {
      response: {
        statusCode: 400,
        headers: {},
        body: JSON.stringify({ message: 'startDate must fall on the first selected weekday.' }),
      },
    })
    Object.setPrototypeOf(error, ApiError.prototype)
    jest.mocked(createPlan).mockRejectedValueOnce(error)

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/plan name/i), 'Fall rec soccer practice')
    await userEvent.click(screen.getByRole('checkbox', { name: /^thu/i }))
    await userEvent.click(screen.getByRole('button', { name: /start a plan/i }))

    expect(await screen.findByText('startDate must fall on the first selected weekday.')).toBeInTheDocument()
  })

  it('should show an inline error and not submit when the end hour is not after the start hour', async () => {
    setup()

    renderWithClient()
    await userEvent.type(screen.getByLabelText(/plan name/i), 'Fall rec soccer practice')
    await userEvent.click(screen.getByRole('checkbox', { name: /^thu/i }))
    const endHourInput = screen.getByLabelText(/to \(hour\)/i)
    fireEvent.change(endHourInput, { target: { value: '16' } })
    await userEvent.click(screen.getByRole('button', { name: /start a plan/i }))

    expect(await screen.findByText(/end time must be after the start time/i)).toBeInTheDocument()
    expect(createPlan).not.toHaveBeenCalled()
  })
})
