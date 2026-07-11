import Index from '@pages/index'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'
import PrivacyLink from '@components/privacy-link'
import SessionCreate from '@components/session-create'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-link')
jest.mock('@components/session-create')

describe('Index page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<></>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
    jest.mocked(SessionCreate).mockReturnValue(<></>)
  })

  it('should render AppBar', () => {
    render(<Index />)
    expect(AppBar).toHaveBeenCalledTimes(1)
  })

  it('should render SessionCreate', () => {
    render(<Index />)
    expect(SessionCreate).toHaveBeenCalledTimes(1)
  })

  it('should render PrivacyLink', () => {
    render(<Index />)
    expect(PrivacyLink).toHaveBeenCalledTimes(1)
  })
})
