import React from 'react'

import Share from '@components/share'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Share', () => {
  const pollName = 'Lunch with friends'
  const sessionId = 'lazy-giraffe'

  beforeAll(() => {
    // The confirmation chip reverts on a 2s setTimeout the component owns.
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  function setNavigatorShare(shareImpl: jest.Mock | undefined): void {
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: shareImpl })
  }

  // userEvent schedules its own work on timers, so it has to be told which clock is running.
  function setupUser(): ReturnType<typeof userEvent.setup> {
    return userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  }

  async function openQrModal(id = sessionId): Promise<ReturnType<typeof userEvent.setup>> {
    setNavigatorShare(undefined)
    const user = setupUser()
    render(<Share pollName={pollName} sessionId={id} />)
    await user.click(screen.getByLabelText('Show the QR code and poll code'))
    await screen.findByText('Share this poll')
    return user
  }

  it('renders a Share button when the Web Share API is supported', async () => {
    setNavigatorShare(jest.fn().mockResolvedValue(undefined))
    render(<Share pollName={pollName} sessionId={sessionId} />)
    expect(await screen.findByText('Share')).toBeInTheDocument()
  })

  it('does not render a Share button when the Web Share API is unsupported', async () => {
    setNavigatorShare(undefined)
    render(<Share pollName={pollName} sessionId={sessionId} />)
    await screen.findByLabelText('Copy link')
    expect(screen.queryByText('Share')).not.toBeInTheDocument()
  })

  it('calls navigator.share with the poll name and URL when Share is pressed', async () => {
    const user = setupUser()
    const shareMock = jest.fn().mockResolvedValue(undefined)
    setNavigatorShare(shareMock)
    render(<Share pollName={pollName} sessionId={sessionId} />)
    await user.click(await screen.findByText('Share'))
    expect(shareMock).toHaveBeenCalledWith({ title: pollName, url: expect.stringContaining(`/p/${sessionId}`) })
  })

  it('encodes the identifier in the shared URL', async () => {
    const user = setupUser()
    const shareMock = jest.fn().mockResolvedValue(undefined)
    setNavigatorShare(shareMock)
    render(<Share pollName={pollName} sessionId="lazy/giraffe?x" />)
    await user.click(await screen.findByText('Share'))
    expect(shareMock).toHaveBeenCalledWith({ title: pollName, url: expect.stringContaining('/p/lazy%2Fgiraffe%3Fx') })
  })

  it('copies the URL to the clipboard when Copy link is pressed', async () => {
    setNavigatorShare(undefined)
    const user = setupUser()
    render(<Share pollName={pollName} sessionId={sessionId} />)
    const writeTextSpy = jest.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByLabelText('Copy link'))
    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining(`/p/${sessionId}`))
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
    writeTextSpy.mockRestore()
  })

  it('does not announce a copy when the clipboard write fails', async () => {
    setNavigatorShare(undefined)
    const user = setupUser()
    render(<Share pollName={pollName} sessionId={sessionId} />)
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))
    await user.click(screen.getByLabelText('Copy link'))
    expect(await screen.findByLabelText('Copy link')).toBeInTheDocument()
    expect(screen.queryByText('Link copied')).not.toBeInTheDocument()
  })

  it('renders a QR code inside the QR modal', async () => {
    setNavigatorShare(undefined)
    const user = setupUser()
    const { container } = render(<Share pollName={pollName} sessionId={sessionId} />)
    await user.click(screen.getByLabelText('Show the QR code and poll code'))
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(await screen.findByText('Share this poll')).toBeInTheDocument()
    expect(await screen.findByText('Scan to join')).toBeInTheDocument()
  })

  it('shows the poll code as space-separated words', async () => {
    await openQrModal()
    expect(await screen.findByText('Poll code')).toBeInTheDocument()
    expect(await screen.findByText('lazy giraffe')).toBeInTheDocument()
  })

  it('shows the poll URL as text', async () => {
    await openQrModal()
    expect(await screen.findByText('Poll link')).toBeInTheDocument()
    expect(await screen.findByText(`http://localhost/p/${sessionId}`)).toBeInTheDocument()
  })

  it('writes the identifier alone to the clipboard when Copy code is pressed', async () => {
    const user = await openQrModal()
    const writeTextSpy = jest.spyOn(navigator.clipboard, 'writeText')
    await user.click(await screen.findByText('Copy code'))
    expect(writeTextSpy).toHaveBeenCalledWith('lazy-giraffe')
    writeTextSpy.mockRestore()
  })

  it('announces the copied code in a live region', async () => {
    const user = await openQrModal()
    // Mounted empty: a live region that arrives already populated is announced by nothing.
    const liveRegions = Array.from(document.querySelectorAll('[aria-live="polite"]'))
    expect(liveRegions).not.toHaveLength(0)
    expect(liveRegions.map((region) => region.textContent).join('')).toBe('')

    await user.click(await screen.findByText('Copy code'))

    const confirmation = await screen.findByText('Code copied')
    expect(confirmation).toBeInTheDocument()
    expect(confirmation).toHaveAttribute('aria-live', 'polite')
  })

  it('withdraws the copied confirmation after two seconds', async () => {
    const user = await openQrModal()
    await user.click(await screen.findByText('Copy code'))
    expect(await screen.findByText('Code copied')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(screen.queryByText('Code copied')).not.toBeInTheDocument()
  })

  it('claims no success and keeps the code on screen when the code copy fails', async () => {
    const user = await openQrModal()
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))

    await user.click(await screen.findByText('Copy code'))

    expect(screen.queryByText('Code copied')).not.toBeInTheDocument()
    expect(await screen.findByText('lazy giraffe')).toBeInTheDocument()
  })

  it('reopens with the confirmation cleared, so the live region is empty again', async () => {
    // The guarantee the whole empty-then-populate arrangement exists for, and the one case it is
    // easiest to lose: a chip left true across a close would put the announcement back into the DOM
    // already populated on the next open, where screen readers say nothing at all.
    const user = await openQrModal()
    await user.click(await screen.findByText('Copy code'))
    expect(await screen.findByText('Code copied')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(screen.getByLabelText('Show the QR code and poll code'))

    await screen.findByText('Share this poll')
    expect(screen.queryByText('Code copied')).not.toBeInTheDocument()
  })
})
