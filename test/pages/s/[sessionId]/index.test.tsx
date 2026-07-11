import SessionPage, { getStaticPaths, getStaticProps } from '@pages/s/[sessionId]/index'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'
import PrivacyLink from '@components/privacy-link'
import Session from '@components/session'

jest.mock('@components/app-bar')
jest.mock('@components/privacy-link')
jest.mock('@components/session')

describe('Session page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<>AppBar</>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
    jest.mocked(Session).mockReturnValue(<></>)
  })

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/s/aeio/' },
      writable: true,
    })
  })

  it('should render AppBar', () => {
    render(<SessionPage />)
    expect(AppBar).toHaveBeenCalled()
  })

  it('should render PrivacyLink', () => {
    render(<SessionPage />)
    expect(PrivacyLink).toHaveBeenCalled()
  })

  it('should render Session with sessionId from pathname', () => {
    render(<SessionPage />)
    expect(Session).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'aeio' }), undefined)
  })

  it('should not render Session when pathname has no sessionId', () => {
    Object.defineProperty(window, 'location', { value: { pathname: '/' }, writable: true })
    render(<SessionPage />)
    expect(Session).not.toHaveBeenCalled()
  })

  it('should return blocking fallback with empty paths in development', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
    const result = getStaticPaths({})
    expect(result).toEqual({ fallback: 'blocking', paths: [] })
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
  })

  it('should return placeholder path in production', () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
    const result = getStaticPaths({})
    expect(result).toEqual({
      fallback: false,
      paths: [{ params: { sessionId: '__placeholder__' } }],
    })
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true })
  })

  it('should return empty props from getStaticProps', async () => {
    const result = await getStaticProps({} as any)
    expect(result).toEqual({ props: {} })
  })
})
