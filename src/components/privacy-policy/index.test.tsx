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

    expect(screen.getByText(/without joining/i)).toBeInTheDocument()
    expect(screen.getByText(/guarded by its link and nothing else/i)).toBeInTheDocument()
  })

  it('should say other participants never see your email address', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/never see your email address/i)).toBeInTheDocument()
  })

  it('should say participants cannot tell which hours came from a calendar', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/nobody on the poll can tell which is which/i)).toBeInTheDocument()
  })

  it('should say we store the Google account identifier, not just the name', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/identifier for your account/i)).toBeInTheDocument()
  })

  it('should name the IP address in the request log and how long logs last', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/logs each request for 30 days, including your IP address/i)).toBeInTheDocument()
  })

  it('should state what the calendar permission cannot see', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/can.t return event titles, guests, or locations/i)).toBeInTheDocument()
  })

  it('should say we keep an encrypted key and the busy times themselves', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/we keep the answer and an encrypted key/i)).toBeInTheDocument()
  })

  it('should say reCAPTCHA never runs when you are signed in', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/Sign in first and reCAPTCHA never runs/i)).toBeInTheDocument()
  })

  it('should say a poll deletes itself 14 days after it is created', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/14 days after the poll is created/i)).toBeInTheDocument()
  })

  it('should disclose that calendar data outlives the poll and its clock restarts', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/outlives the poll/i)).toBeInTheDocument()
    expect(screen.getByText(/90 days/i)).toBeInTheDocument()
    expect(screen.getByText(/every check restarts that clock/i)).toBeInTheDocument()
  })

  it('should say disconnecting deletes what we saved but leaves hours marked busy', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/Disconnect and both go immediately/i)).toBeInTheDocument()
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

  it('should say the identity cookie is scoped to the one poll you joined', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/which participant you are on that one poll/i)).toBeInTheDocument()
  })

  it('should say the list of polls lives in the browser and name what an entry holds', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/that list lives in your browser/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /the poll's link, which participant you are on it, the name you typed there, the poll's name, when you last opened it, when it closes, and whether you dismissed its introduction/i,
      ),
    ).toBeInTheDocument()
  })

  it('should say an entry disappears when its poll closes and can be removed by hand', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/An entry drops off the list when its poll closes/i)).toBeInTheDocument()
    expect(screen.getByText(/remove one, or clear the whole list, whenever you like/i)).toBeInTheDocument()
  })

  it('should say clearing the list does not close the polls or revoke a link', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/Clearing the list only empties this device/i)).toBeInTheDocument()
    expect(screen.getByText(/anyone still holding a link can still read them/i)).toBeInTheDocument()
  })

  it('should disclose the two remembered choices the browser keeps', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/whether you kept the tour of how a poll works open on the home page/i)).toBeInTheDocument()
    expect(screen.getByText(/whether you dismissed the offer to install Pick a Time/i)).toBeInTheDocument()
  })

  it('should name the offline cache and say it holds nothing but the offline page', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/That offline cache holds nothing else/i)).toBeInTheDocument()
    expect(screen.getByText(/no poll, and nothing our servers send you/i)).toBeInTheDocument()
  })

  it('should say the choices and the offline page last until you clear site data', () => {
    render(<PrivacyPolicy />)

    expect(
      screen.getByText(/Those two choices and the offline page stay until you clear this site's data/i),
    ).toBeInTheDocument()
  })

  it('should say nothing kept on the device is sent to us or to other participants', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/None of this leaves your device/i)).toBeInTheDocument()
    expect(screen.getByText(/nobody else on your polls sees it/i)).toBeInTheDocument()
  })

  it('should not describe the onboarding keys this run removed', () => {
    const { container } = render(<PrivacyPolicy />)

    expect(container.textContent).not.toMatch(/pat_onboarded/i)
  })

  it('should carry the August 2026 effective date', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText('Effective August 10, 2026')).toBeInTheDocument()
  })
})
