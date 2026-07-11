import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import FeedbackMessage from '@components/feedback-message'

describe('FeedbackMessage', () => {
  describe('with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should render message when provided', () => {
      render(<FeedbackMessage message="Something went wrong" onClose={jest.fn()} severity="error" />)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should not render when message is undefined', () => {
      render(<FeedbackMessage message={undefined} onClose={jest.fn()} severity="error" />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should auto-hide after autoHideDuration', () => {
      const onClose = jest.fn()
      render(<FeedbackMessage autoHideDuration={3000} message="Test" onClose={onClose} severity="error" />)
      expect(screen.getByText('Test')).toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      expect(onClose).toHaveBeenCalled()
    })

    it('should hide when message changes to undefined', () => {
      const onClose = jest.fn()
      const { rerender } = render(<FeedbackMessage message="Test" onClose={onClose} severity="error" />)
      expect(screen.getByText('Test')).toBeInTheDocument()

      rerender(<FeedbackMessage message={undefined} onClose={onClose} severity="error" />)
      expect(screen.queryByText('Test')).not.toBeInTheDocument()
    })
  })

  describe('with real timers', () => {
    it('should call onClose when close button is pressed', async () => {
      const onClose = jest.fn()
      const user = userEvent.setup()
      render(<FeedbackMessage autoHideDuration={60000} message="Test" onClose={onClose} severity="error" />)
      const closeBtn = screen.getByLabelText('Close notification')
      await user.click(closeBtn)
      expect(onClose).toHaveBeenCalled()
    })
  })
})
