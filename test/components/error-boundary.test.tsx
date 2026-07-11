import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import ErrorBoundary from '@components/error-boundary'

const ThrowingChild = (): React.ReactNode => {
  throw new Error('Test error')
}

describe('ErrorBoundary', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <p>Hello</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should render error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('should render a link back to home when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('link', { name: /go back to the home page/i })).toHaveAttribute('href', '/')
  })
})
