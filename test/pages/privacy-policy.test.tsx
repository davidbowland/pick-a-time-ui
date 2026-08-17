import React from 'react'

import AppBar from '@components/app-bar'
import PrivacyPolicy from '@components/privacy-policy'
import PrivacyPage from '@pages/privacy-policy'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-policy')

const ActualPrivacyPolicy = jest.requireActual<{ default: typeof PrivacyPolicy }>('@components/privacy-policy').default

describe('Privacy page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<nav data-testid="app-bar" />)
    jest.mocked(PrivacyPolicy).mockReturnValue(<div data-testid="privacy-policy" />)
  })

  it('should render AppBar', () => {
    render(<PrivacyPage />)
    expect(AppBar).toHaveBeenCalled()
  })

  it('should render PrivacyPolicy', () => {
    render(<PrivacyPage />)
    expect(PrivacyPolicy).toHaveBeenCalled()
  })
})

// The page a reader actually loads is the thing AC-043 constrains, so the real policy is swapped
// back in here rather than mocked away.
describe('Privacy page copy', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<nav data-testid="app-bar" />)
    jest.mocked(PrivacyPolicy).mockImplementation(ActualPrivacyPolicy)
  })

  it('should publish no claim the calendar decides your hours', () => {
    render(<PrivacyPage />)

    expect(screen.queryByText(/marked busy by your calendar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/which is which/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/the busy times we've saved, for 90 days/i)).not.toBeInTheDocument()
  })

  it('should publish what the stored record keeps', () => {
    render(<PrivacyPage />)

    expect(screen.getByText(/we keep no record of which hours came from your calendar/i)).toBeInTheDocument()
    expect(screen.getByText(/a year's worth of your busy times, for 90 days/i)).toBeInTheDocument()
  })
})
