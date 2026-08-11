import React from 'react'

import PrivacyPolicy from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('privacy-policy component', () => {
  it('should render privacy policy', async () => {
    render(<PrivacyPolicy />)

    expect(screen.queryAllByText(/privacy policy/i).length).toBeGreaterThan(0)
  })

  it('should say anyone with the link can read the poll without joining it', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/don.t have to join first/i)).toBeInTheDocument()
    expect(screen.getByText(/guarded by its link and nothing else/i)).toBeInTheDocument()
  })

  it('should say other participants never see your email or Google account', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/never see your email address or which Google account/i)).toBeInTheDocument()
  })

  it('should say participants cannot tell which hours came from a calendar', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/Nobody on the poll can tell which is which/i)).toBeInTheDocument()
  })

  it('should say we store the Google account identifier, not just the name', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/identifier for your account/i)).toBeInTheDocument()
  })

  it('should state what the calendar permission cannot see', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/can.t return event titles, guests, or locations/i)).toBeInTheDocument()
  })

  it('should say we keep an encrypted key and the busy times themselves', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/we keep the answer, and we keep an encrypted key/i)).toBeInTheDocument()
  })

  it('should say what a calendar check sends to Google', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/the poll.s name and the other people on it never reach Google/i)).toBeInTheDocument()
  })

  it('should say reCAPTCHA starts before you submit and never runs when signed in', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/starts watching as soon as you begin filling the form in/i)).toBeInTheDocument()
    expect(screen.getByText(/Sign in first and reCAPTCHA never runs/i)).toBeInTheDocument()
  })

  it('should disclose that calendar data outlives the poll', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/90 days/i)).toBeInTheDocument()
    expect(screen.getByText(/outlives the poll/i)).toBeInTheDocument()
  })

  it('should say the clock restarts on every calendar check', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/every check restarts that clock/i)).toBeInTheDocument()
  })

  it('should disclose that saved busy times span every poll you are in', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/combined date range of every poll/i)).toBeInTheDocument()
  })

  it('should say disconnecting deletes the key and the saved busy times', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/both the key and the saved busy times go immediately/i)).toBeInTheDocument()
  })

  it('should say hours already marked busy survive a disconnect', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/hours we already marked busy stay busy/i)).toBeInTheDocument()
  })

  it('should say the sign-in record outlives every poll until you ask us to delete it', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/stays until you ask us to delete it/i)).toBeInTheDocument()
  })

  it('should carry the Limited Use disclosure in the wording Google looks for', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/including the Limited Use requirements/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Google API Services User Data Policy/i })).toHaveAttribute(
      'href',
      'https://developers.google.com/terms/api-services-user-data-policy',
    )
  })

  it('should say Google data does nothing beyond sign-in and marking you busy', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/nothing else, and nobody else/i)).toBeInTheDocument()
  })

  it('should point at the Google page that revokes our access', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByRole('link', { name: /Google account permissions page/i })).toHaveAttribute(
      'href',
      'https://myaccount.google.com/permissions',
    )
  })

  it('should carry the August 2026 effective date', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText('Effective August 1, 2026')).toBeInTheDocument()
  })
})
