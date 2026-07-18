import React from 'react'

import AppBar from '@components/app-bar'
import Poll from '@components/poll'
import PrivacyLink from '@components/privacy-link'
import PollPage, { getStaticPaths, getStaticProps } from '@pages/p/[sessionId]/index'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-link')
jest.mock('@components/poll')

describe('Poll page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<>AppBar</>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
    jest.mocked(Poll).mockReturnValue(<></>)
  })

  function setup(pathname: string): void {
    Object.defineProperty(window, 'location', { value: { pathname }, writable: true })
  }

  it('should render AppBar', () => {
    setup('/p/amber-harbor/')
    render(<PollPage />)
    expect(AppBar).toHaveBeenCalled()
  })

  it('should render PrivacyLink', () => {
    setup('/p/amber-harbor/')
    render(<PollPage />)
    expect(PrivacyLink).toHaveBeenCalled()
  })

  it('should render Poll with sessionId from pathname', () => {
    setup('/p/amber-harbor/')
    render(<PollPage />)
    expect(Poll).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'amber-harbor' }), undefined)
  })

  it('should not render Poll when pathname has no sessionId', () => {
    setup('/')
    render(<PollPage />)
    expect(Poll).not.toHaveBeenCalled()
  })

  it('should return blocking fallback with empty paths in development', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
    expect(getStaticPaths({})).toEqual({ fallback: 'blocking', paths: [] })
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
  })

  it('should return placeholder path in production', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
    expect(getStaticPaths({})).toEqual({ fallback: false, paths: [{ params: { sessionId: '__placeholder__' } }] })
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
  })

  it('should return empty props from getStaticProps', async () => {
    expect(await getStaticProps({} as any)).toEqual({ props: {} })
  })
})
