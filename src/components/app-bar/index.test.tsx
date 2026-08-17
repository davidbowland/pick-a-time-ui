import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import AppBar from './index'
import { useAuthContext } from '@components/auth-context'
import { clearSessionCookie } from '@hooks/useSessionCookie'
import { disconnectCalendar, fetchCalendarState } from '@services/api'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jsdom ships no PointerEvent, and react-aria falls back to mouse events when it is missing. On
// that fallback path user-event focuses the trigger after mousedown, the popover reads that as
// focus leaving itself, and the menu closes in the same tick it opened. Supplying PointerEvent
// puts react-aria on the same code path browsers use, so a click here behaves like a real click.
class PointerEventPolyfill extends MouseEvent {
  public pointerId: number
  public pointerType: string
  public width: number
  public height: number
  public pressure: number
  public isPrimary: boolean

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props)
    this.pointerId = props.pointerId ?? 1
    this.pointerType = props.pointerType ?? 'mouse'
    this.width = props.width ?? 1
    this.height = props.height ?? 1
    this.pressure = props.pressure ?? 0.5
    this.isPrimary = props.isPrimary ?? true
  }
}

global.PointerEvent = PointerEventPolyfill as never
Element.prototype.hasPointerCapture = (): boolean => false
Element.prototype.setPointerCapture = (): void => undefined
Element.prototype.releasePointerCapture = (): void => undefined

jest.mock('@components/auth-context')
jest.mock('@hooks/useSessionCookie')
jest.mock('@services/api', () => ({
  disconnectCalendar: jest.fn(),
  fetchCalendarState: jest.fn(),
}))

describe('AppBar', () => {
  const handleSignOut = jest.fn()
  const handleSignIn = jest.fn()

  // Fixed clock: the menu prints a relative time, and reading the wall clock would rot this
  // assertion within a minute.
  const now = (): number => 1_754_006_400_000
  const lastSyncedAt = 1_754_006_280

  beforeAll(() => {
    jest.mocked(fetchCalendarState).mockResolvedValue({ lastSyncedAt: null, status: 'not_connected' })
    jest.mocked(disconnectCalendar).mockResolvedValue(undefined)
  })

  function renderAppBar(sessionId?: string): ReturnType<typeof render> {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <AppBar now={now} sessionId={sessionId} />
      </QueryClientProvider>,
    )
  }

  function setupSignedIn(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: true,
      user: { name: 'Alex' },
      isLoading: false,
      handleSignIn,
      handleSignOut,
    })
  }

  function setupSignedOut(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoading: false,
      handleSignIn,
      handleSignOut,
    })
  }

  function setupConnected(): void {
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt, status: 'connected' })
  }

  function trigger(): HTMLElement {
    return screen.getByRole('button', { name: /alex/i })
  }

  // `.focus()` moves react-aria's focus state, so it has to run inside act like any other update.
  async function focusTrigger(): Promise<void> {
    await act(async () => {
      trigger().focus()
    })
  }

  async function openMenu(): Promise<void> {
    await userEvent.click(trigger())
  }

  async function openConfirmDialog(): Promise<void> {
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: /disconnect/i }))
  }

  it('clears the poll cookie and signs out when a sessionId is present', async () => {
    setupSignedIn()

    renderAppBar('amber-harbor')
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: /sign out/i }))

    expect(clearSessionCookie).toHaveBeenCalledWith('amber-harbor')
    expect(handleSignOut).toHaveBeenCalled()
  })

  it('signs out without touching any cookie when no sessionId is present', async () => {
    setupSignedIn()

    renderAppBar()
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: /sign out/i }))

    expect(clearSessionCookie).not.toHaveBeenCalled()
    expect(handleSignOut).toHaveBeenCalled()
  })

  it('shows the Google sign-in button when signed out', () => {
    setupSignedOut()

    renderAppBar()

    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('does not ask for calendar state when signed out', () => {
    setupSignedOut()

    renderAppBar()

    expect(fetchCalendarState).not.toHaveBeenCalled()
  })

  it('should show the calendar as connected in the menu', async () => {
    setupConnected()

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Google Calendar')).toBeInTheDocument()
    expect(screen.getByText('Connected · checked 2 minutes ago')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument()
  })

  it('should read a check under a minute old as just now', async () => {
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: 1_754_006_370, status: 'connected' })

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Connected · checked just now')).toBeInTheDocument()
  })

  it('should count the wait in hours once it passes an hour', async () => {
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: 1_754_002_800, status: 'connected' })

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Connected · checked 1 hour ago')).toBeInTheDocument()
  })

  it('should count the wait in days once it passes a day', async () => {
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: 1_753_920_000, status: 'connected' })

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Connected · checked 1 day ago')).toBeInTheDocument()
  })

  it('should claim no check time when the calendar has never been checked', async () => {
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: null, status: 'connected' })

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('should claim no check time for the never-synced sentinel the API actually sends', async () => {
    // Connecting stamps lastSyncedAt: 0, which reaches this menu unchanged. Read as a timestamp it
    // dates the check to 1970 and prints "checked 20663 days ago" from the moment OAuth completes.
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt: 0, status: 'connected' })

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.queryByText(/days ago/)).not.toBeInTheDocument()
  })

  it('should offer no action when the calendar is not connected', async () => {
    setupSignedIn()

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Not connected')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /disconnect/i })).not.toBeInTheDocument()
  })

  it('should never offer to connect, which needs a poll to come back to', async () => {
    setupSignedIn()

    renderAppBar()
    await openMenu()

    await screen.findByText('Not connected')
    expect(screen.queryByRole('menuitem', { name: /connect/i })).not.toBeInTheDocument()
  })

  it('should still offer disconnect when the last check failed', async () => {
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt, status: 'error' })

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Connected · last check failed')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument()
  })

  // Never "Connected": a revoked grant reads nothing, and saying otherwise leaves someone waiting for
  // booked squares that are not coming. Disconnect has to stay reachable -- it is how a dead record
  // gets cleared so it can be connected again.
  it('should say to reconnect, and still offer disconnect, when Google dropped the permission', async () => {
    setupSignedIn()
    jest.mocked(fetchCalendarState).mockResolvedValueOnce({ lastSyncedAt, status: 'revoked' })

    renderAppBar()
    await openMenu()

    expect(await screen.findByText('Reconnect from any poll')).toBeInTheDocument()
    expect(screen.queryByText(/^Connected/)).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument()
  })

  it('should name the blast radius before disconnecting', async () => {
    setupConnected()

    renderAppBar()
    await openConfirmDialog()

    expect(await screen.findByRole('heading', { name: 'Disconnect Google Calendar?' })).toBeInTheDocument()
    expect(screen.getByText(/We'll delete your calendar data and stop checking it/i)).toBeInTheDocument()
    expect(screen.getByText(/Hours we already marked busy stay busy/i)).toBeInTheDocument()
    expect(screen.getByText(/This applies to every poll you're in/i)).toBeInTheDocument()
    expect(disconnectCalendar).not.toHaveBeenCalled()
  })

  it('should disconnect only after confirmation', async () => {
    setupConnected()

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    await waitFor(() => expect(disconnectCalendar).toHaveBeenCalled())
  })

  it('should not disconnect when canceled', async () => {
    setupConnected()

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(disconnectCalendar).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('should cancel the disconnect on Escape and return focus to the trigger', async () => {
    setupConnected()

    renderAppBar()
    await openConfirmDialog()
    await screen.findByRole('heading', { name: 'Disconnect Google Calendar?' })
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(disconnectCalendar).not.toHaveBeenCalled()
    await waitFor(() => expect(trigger()).toHaveFocus())
  })

  it('should open the menu from the keyboard and focus its first item', async () => {
    setupSignedIn()

    renderAppBar()
    await focusTrigger()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('menuitem', { name: /sign out/i })).toHaveFocus()
  })

  it('should open the menu on Space', async () => {
    setupSignedIn()

    renderAppBar()
    await focusTrigger()
    await userEvent.keyboard(' ')

    expect(await screen.findByRole('menu')).toBeInTheDocument()
  })

  it('should close the menu on Escape and return focus to the trigger', async () => {
    setupSignedIn()

    renderAppBar()
    await openMenu()
    await screen.findByRole('menu')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger()).toHaveFocus())
  })

  it('should say it is disconnecting while the request is in flight', async () => {
    setupConnected()
    jest.mocked(disconnectCalendar).mockImplementationOnce(() => new Promise(() => {}))

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    expect(await screen.findByRole('button', { name: 'Disconnecting…' })).toBeInTheDocument()
  })

  // Drawn on the button AND spoken through the live region. A label that changes under a screen
  // reader's cursor is not reliably announced on its own.
  it('should announce that the disconnect is under way', async () => {
    setupConnected()
    jest.mocked(disconnectCalendar).mockImplementationOnce(() => new Promise(() => {}))

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    const live = document.querySelector('[aria-live="polite"]')
    await waitFor(() => expect(live).toHaveTextContent('Disconnecting…'))
  })

  it('should hold the dialog open for the duration rather than closing on press', async () => {
    // Closing first would put the only progress this action has behind a menu the person has to
    // reopen, and would make a failure arrive with nothing on screen it obviously belongs to.
    setupConnected()
    jest.mocked(disconnectCalendar).mockImplementationOnce(() => new Promise(() => {}))

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    expect(await screen.findByRole('heading', { name: 'Disconnect Google Calendar?' })).toBeInTheDocument()
  })

  it('should refuse a second disconnect while the first is still in flight', async () => {
    setupConnected()
    jest.mocked(disconnectCalendar).mockImplementationOnce(() => new Promise(() => {}))

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnecting…' }))

    expect(disconnectCalendar).toHaveBeenCalledTimes(1)
  })

  // This used to fail in total silence: the dialog closed, the cache was never invalidated, and the
  // menu went on reporting the calendar as connected -- so the only reading available to the person
  // was that they had disconnected it. They had not.
  it('should say so when the disconnect fails', async () => {
    setupConnected()
    jest.mocked(disconnectCalendar).mockRejectedValueOnce(new Error('network error'))

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))

    expect(await screen.findByText("Couldn't disconnect Google Calendar. Please try again.")).toBeInTheDocument()
  })

  it('should keep reporting the calendar as connected when the disconnect fails', async () => {
    setupConnected()
    jest.mocked(disconnectCalendar).mockRejectedValueOnce(new Error('network error'))

    renderAppBar()
    await openConfirmDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
    await screen.findByText("Couldn't disconnect Google Calendar. Please try again.")
    await openMenu()

    expect(await screen.findByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument()
  })
})
