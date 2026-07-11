import PrivacyPage from '@pages/privacy-policy'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'
import PrivacyPolicy from '@components/privacy-policy'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-policy')

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
