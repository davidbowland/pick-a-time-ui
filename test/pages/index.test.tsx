import Index from '@pages/index'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'
import PlanCreate from '@components/plan-create'
import PrivacyLink from '@components/privacy-link'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-link')
jest.mock('@components/plan-create')

describe('Index page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<></>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
    jest.mocked(PlanCreate).mockReturnValue(<></>)
  })

  it('should render AppBar', () => {
    render(<Index />)
    expect(AppBar).toHaveBeenCalledTimes(1)
  })

  it('should render PlanCreate', () => {
    render(<Index />)
    expect(PlanCreate).toHaveBeenCalledTimes(1)
  })

  it('should render PrivacyLink', () => {
    render(<Index />)
    expect(PrivacyLink).toHaveBeenCalledTimes(1)
  })
})
