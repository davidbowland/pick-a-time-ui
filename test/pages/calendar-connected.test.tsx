import { useRouter } from 'next/router'
import React from 'react'

import CalendarConnected from '@pages/calendar-connected'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/router', () => ({ useRouter: jest.fn() }))

describe('calendar-connected page', () => {
  const replace = jest.fn()

  beforeAll(() => {
    jest.mocked(useRouter).mockReturnValue({ isReady: true, query: { status: 'connected' }, replace } as never)
  })

  it('should announce a successful connection', () => {
    render(<CalendarConnected />)

    expect(screen.getByRole('heading', { name: 'Calendar connected' })).toBeInTheDocument()
    expect(screen.getByText(/we'll mark you busy wherever your calendar says you're booked/i)).toBeInTheDocument()
    expect(screen.getByText(/disconnect anytime from the menu by your name/i)).toBeInTheDocument()
  })

  it('should report a declined connection without a second ask', () => {
    jest.mocked(useRouter).mockReturnValueOnce({ isReady: true, query: { status: 'declined' }, replace } as never)

    render(<CalendarConnected />)

    expect(screen.getByRole('heading', { name: 'Calendar not connected' })).toBeInTheDocument()
    expect(screen.getByText('You can connect it later from any poll.')).toBeInTheDocument()
  })

  it('should report an error', () => {
    jest.mocked(useRouter).mockReturnValueOnce({ isReady: true, query: { status: 'error' }, replace } as never)

    render(<CalendarConnected />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText("We couldn't connect your calendar. Try again from your poll.")).toBeInTheDocument()
  })

  it('should fall back to the error copy for an unrecognized status', () => {
    jest.mocked(useRouter).mockReturnValueOnce({ isReady: true, query: { status: 'banana' }, replace } as never)

    render(<CalendarConnected />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  })

  it('should fall back to the error copy when status is missing', () => {
    jest.mocked(useRouter).mockReturnValueOnce({ isReady: true, query: {}, replace } as never)

    render(<CalendarConnected />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  })

  it('should fall back to the error copy for a repeated status parameter', () => {
    jest
      .mocked(useRouter)
      .mockReturnValueOnce({ isReady: true, query: { status: ['connected', 'error'] }, replace } as never)

    render(<CalendarConnected />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  })

  it('should move focus to the heading so the outcome is announced', () => {
    render(<CalendarConnected />)

    expect(screen.getByRole('heading', { name: 'Calendar connected' })).toHaveFocus()
  })

  it('should show no outcome until the router has parsed the query string', () => {
    jest.mocked(useRouter).mockReturnValueOnce({ isReady: false, query: {}, replace } as never)

    render(<CalendarConnected />)

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue to poll/i })).not.toBeInTheDocument()
  })

  it('should return to the stored poll and clear the key', async () => {
    sessionStorage.setItem('pat_calendar_return', '/p/spring-owl/')

    render(<CalendarConnected />)
    await userEvent.click(screen.getByRole('button', { name: /continue to poll/i }))

    expect(replace).toHaveBeenCalledWith('/p/spring-owl/')
    expect(sessionStorage.getItem('pat_calendar_return')).toBeNull()
  })

  it('should fall back to the home page when no return path was stored', async () => {
    sessionStorage.removeItem('pat_calendar_return')

    render(<CalendarConnected />)
    await userEvent.click(screen.getByRole('button', { name: /continue to poll/i }))

    expect(replace).toHaveBeenCalledWith('/')
  })

  it('should exclude the page from search indexes', () => {
    render(<CalendarConnected />)

    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  })

  it('should exclude the page from search indexes before the router is ready', () => {
    jest.mocked(useRouter).mockReturnValueOnce({ isReady: false, query: {}, replace } as never)

    render(<CalendarConnected />)

    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  })
})
