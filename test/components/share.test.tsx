import React from 'react'

import Share from '@components/share'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Share', () => {
  const pollName = 'Lunch with friends'
  const sessionId = 'test-session'

  function setNavigatorShare(shareImpl: jest.Mock | undefined): void {
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: shareImpl })
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
    const user = userEvent.setup()
    const shareMock = jest.fn().mockResolvedValue(undefined)
    setNavigatorShare(shareMock)
    render(<Share pollName={pollName} sessionId={sessionId} />)
    await user.click(await screen.findByText('Share'))
    expect(shareMock).toHaveBeenCalledWith({ title: pollName, url: expect.stringContaining(`/p/${sessionId}`) })
  })

  it('copies the URL to the clipboard when Copy link is pressed', async () => {
    setNavigatorShare(undefined)
    const user = userEvent.setup()
    render(<Share pollName={pollName} sessionId={sessionId} />)
    const writeTextSpy = jest.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByLabelText('Copy link'))
    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining(`/p/${sessionId}`))
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
    writeTextSpy.mockRestore()
  })

  it('does not announce a copy when the clipboard write fails', async () => {
    setNavigatorShare(undefined)
    const user = userEvent.setup()
    render(<Share pollName={pollName} sessionId={sessionId} />)
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))
    await user.click(screen.getByLabelText('Copy link'))
    expect(await screen.findByLabelText('Copy link')).toBeInTheDocument()
    expect(screen.queryByText('Link copied')).not.toBeInTheDocument()
  })

  it('renders a QR code inside the QR modal', async () => {
    setNavigatorShare(undefined)
    const user = userEvent.setup()
    const { container } = render(<Share pollName={pollName} sessionId={sessionId} />)
    await user.click(screen.getByLabelText('Share via QR code'))
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(await screen.findByText('Scan to join')).toBeInTheDocument()
  })
})
