import React from 'react'

import PrivacyPolicy from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('provacy-policy component', () => {
  it('should render privacy policy', async () => {
    render(<PrivacyPolicy />)

    expect(screen.queryAllByText(/privacy policy/i).length).toBeGreaterThan(0)
  })

  it('should state what the calendar permission can and cannot see', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/busy and free times/i)).toBeInTheDocument()
    expect(screen.getByText(/event titles, guests, or locations/i)).toBeInTheDocument()
  })

  it('should say we store an encrypted token and cache the busy times', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/encrypted token/i)).toBeInTheDocument()
    expect(screen.getByText(/cache the busy time ranges/i)).toBeInTheDocument()
  })

  it('should say we store the Google account identifier, not just the name', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/account identifier/i)).toBeInTheDocument()
  })

  it('should disclose that calendar data outlives the poll', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/90 days/i)).toBeInTheDocument()
    expect(screen.getByText(/outlives the poll/i)).toBeInTheDocument()
    expect(screen.getByText(/disconnect.*delete/i)).toBeInTheDocument()
  })

  it('should say the clock restarts on every calendar check', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/restarts every time we check/i)).toBeInTheDocument()
  })

  it('should disclose that cached busy times span every poll you are in', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/combined date range of every poll/i)).toBeInTheDocument()
  })

  it('should say hours already marked busy survive a disconnect', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/hours we already marked busy stay busy/i)).toBeInTheDocument()
  })

  it('should say what a calendar check sends to Google', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/dates we.re asking about/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing about the poll or the other people on it goes to google/i)).toBeInTheDocument()
  })

  it('should say participants cannot tell which hours came from a calendar', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/can.t tell which of them came from your calendar/i)).toBeInTheDocument()
  })

  it('should carry the August 2026 effective date', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText('Effective August 1, 2026')).toBeInTheDocument()
  })
})
