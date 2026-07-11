import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import PrivacyPolicy from './index'

describe('provacy-policy component', () => {
  it('should render privacy policy', async () => {
    render(<PrivacyPolicy />)

    expect(screen.queryAllByText(/privacy policy/i).length).toBeGreaterThan(0)
  })
})
