import React from 'react'

import PrivacyPolicy from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('privacy-policy component', () => {
  it('should render the page under a level-one heading', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
  })

  it('should nest every section heading below the page heading', () => {
    render(<PrivacyPolicy />)

    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('should link back to the app', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByRole('link', { name: /back to pick a time/i })).toHaveAttribute('href', '/')
  })

  it('should give a working address for data requests', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByRole('link', { name: 'privacy@dbowland.com' })).toHaveAttribute(
      'href',
      'mailto:privacy@dbowland.com',
    )
  })

  it('should link to the Google page that revokes our access', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByRole('link', { name: /Google account permissions page/i })).toHaveAttribute(
      'href',
      'https://myaccount.google.com/permissions',
    )
  })

  // Google's OAuth reviewers check for the Limited Use statement close to verbatim, and the app's
  // sensitive-scope verification fails without it. This is the one piece of wording on the page
  // that is a compliance contract rather than our own copy, so it is pinned on purpose.
  it('should carry the Limited Use disclosure in the wording Google looks for', () => {
    render(<PrivacyPolicy />)

    expect(screen.getByText(/including the Limited Use requirements/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Google API Services User Data Policy/i })).toHaveAttribute(
      'href',
      'https://developers.google.com/terms/api-services-user-data-policy',
    )
  })
})
