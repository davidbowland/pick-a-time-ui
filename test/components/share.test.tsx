import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// @ts-expect-error — mock-only export from __mocks__/index.tsx
import { mockSetAuthState } from '@components/auth-context'
import Share from '@components/share'
import { shareSession } from '@services/api'

jest.mock('@components/auth-context')
jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  shareSession: jest.fn(),
}))

const mockShareSession = jest.mocked(shareSession)

const PHONE_PLACEHOLDER = '+1 (555) 123-4567'

describe('Share', () => {
  const sessionId = 'test-session'
  const userId = 'test-user'

  beforeEach(() => {
    mockSetAuthState({ isSignedIn: true })
  })

  async function renderWithModalOpen() {
    const user = userEvent.setup()
    render(<Share sessionId={sessionId} userId={userId} />)
    await user.click(screen.getByText('Invite'))
    return user
  }

  it('should render the copy URL button', async () => {
    await renderWithModalOpen()
    expect(screen.getByText('Copy URL')).toBeInTheDocument()
  })

  it('should copy URL to clipboard when copy button is pressed', async () => {
    const user = userEvent.setup()
    render(<Share sessionId={sessionId} userId={userId} />)
    const writeTextSpy = jest.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByText('Invite'))
    await user.click(screen.getByText('Copy URL'))
    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining(`/s/${sessionId}`))
    writeTextSpy.mockRestore()
  })

  it('should render a QR code', async () => {
    const user = userEvent.setup()
    const { container } = render(<Share sessionId={sessionId} userId={userId} />)
    await user.click(screen.getByText('Invite'))
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should render phone input and send button', async () => {
    await renderWithModalOpen()
    expect(screen.getByPlaceholderText(PHONE_PLACEHOLDER)).toBeInTheDocument()
    expect(screen.getByText('Send invite')).toBeInTheDocument()
  })

  it('should call shareSession on send invite', async () => {
    mockShareSession.mockResolvedValueOnce({ userId })
    const user = await renderWithModalOpen()

    const input = screen.getByPlaceholderText(PHONE_PLACEHOLDER)
    await user.type(input, '2125551234')

    await user.click(screen.getByText('Send invite'))

    expect(mockShareSession).toHaveBeenCalledWith(sessionId, userId, '+12125551234')
    await waitFor(() => {
      expect(screen.getByText('Invite sent')).toBeInTheDocument()
    })
  })

  it('should show rate limit error on 429', async () => {
    const { ApiError } = jest.requireActual('aws-amplify/api') as { ApiError: any }
    const error = new ApiError({ message: 'Too Many Requests', name: 'ApiError', recoverySuggestion: '' })
    Object.defineProperty(error, '_response', {
      value: { statusCode: 429, headers: {}, body: '{}' },
    })
    mockShareSession.mockRejectedValueOnce(error)
    const user = await renderWithModalOpen()

    const input = screen.getByPlaceholderText(PHONE_PLACEHOLDER)
    await user.type(input, '2125551234')
    await user.click(screen.getByText('Send invite'))

    await waitFor(() => {
      expect(screen.getByText("You're going a bit fast — try again in a minute.")).toBeInTheDocument()
    })
  })

  it('should show server message on 400', async () => {
    const { ApiError } = jest.requireActual('aws-amplify/api') as { ApiError: any }
    const error = new ApiError({ message: 'Bad Request', name: 'ApiError', recoverySuggestion: '' })
    Object.defineProperty(error, '_response', {
      value: {
        statusCode: 400,
        headers: {},
        body: JSON.stringify({ message: 'You must set your phone number before sharing' }),
      },
    })
    mockShareSession.mockRejectedValueOnce(error)
    const user = await renderWithModalOpen()

    const input = screen.getByPlaceholderText(PHONE_PLACEHOLDER)
    await user.type(input, '2125551234')
    await user.click(screen.getByText('Send invite'))

    await waitFor(() => {
      expect(screen.getByText('You must set your phone number before sharing')).toBeInTheDocument()
    })
  })

  it('should show fallback message on 400 with unparseable body', async () => {
    const { ApiError } = jest.requireActual('aws-amplify/api') as { ApiError: any }
    const error = new ApiError({ message: 'Bad Request', name: 'ApiError', recoverySuggestion: '' })
    Object.defineProperty(error, '_response', {
      value: { statusCode: 400, headers: {}, body: 'not json' },
    })
    mockShareSession.mockRejectedValueOnce(error)
    const user = await renderWithModalOpen()

    const input = screen.getByPlaceholderText(PHONE_PLACEHOLDER)
    await user.type(input, '2125551234')
    await user.click(screen.getByText('Send invite'))

    await waitFor(() => {
      expect(screen.getByText("That didn't work. Try again.")).toBeInTheDocument()
    })
  })

  it('should show error when clipboard write fails', async () => {
    // Override writeText after userEvent.setup() installs its clipboard
    const user = userEvent.setup()
    render(<Share sessionId={sessionId} userId={userId} />)
    await user.click(screen.getByText('Invite'))
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))
    await user.click(screen.getByText('Copy URL'))
    await waitFor(() => {
      expect(screen.getByText('Failed to copy URL to clipboard.')).toBeInTheDocument()
    })
  })

  it('should show generic error on non-429 failure', async () => {
    mockShareSession.mockRejectedValueOnce(new Error('Network error'))
    const user = await renderWithModalOpen()

    const input = screen.getByPlaceholderText(PHONE_PLACEHOLDER)
    await user.type(input, '2125551234')
    await user.click(screen.getByText('Send invite'))

    await waitFor(() => {
      expect(screen.getByText('Failed to send invite. Please try again.')).toBeInTheDocument()
    })
  })

  it('should not send when phone is empty', async () => {
    await renderWithModalOpen()
    // Send invite button should be disabled when phone is empty
    const sendBtn = screen.getByText('Send invite')
    expect(sendBtn).toBeDisabled()
  })

  describe('when not signed in', () => {
    beforeEach(() => {
      mockSetAuthState({ isSignedIn: false, handleSignIn: jest.fn() })
    })

    it('should show auth gate instead of SMS form', async () => {
      await renderWithModalOpen()
      expect(screen.getByText('Sign in with Google to invite people by text')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText(PHONE_PLACEHOLDER)).not.toBeInTheDocument()
      expect(screen.queryByText('Send invite')).not.toBeInTheDocument()
    })

    it('should still show copy URL and QR code', async () => {
      await renderWithModalOpen()
      expect(screen.getByText('Copy URL')).toBeInTheDocument()
    })
  })
})
