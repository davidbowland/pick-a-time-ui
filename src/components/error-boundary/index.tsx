import React from 'react'

import { ErrorAlert, ErrorContainer } from './elements'

// Extracted so it can be replaced with a real error reporter (e.g. Sentry) later
const logRenderError = (error: Error, errorInfo: React.ErrorInfo): void => {
  // eslint-disable-next-line no-console
  console.error('ErrorBoundary caught:', error, errorInfo)
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    void logRenderError(error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <ErrorAlert />
        </ErrorContainer>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
