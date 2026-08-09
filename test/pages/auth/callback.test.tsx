import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'

import { Hub } from '@config/amplify'
import AuthCallback from '@pages/auth/callback'
import { markSessionStored } from '@services/auth'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'

jest.mock('@config/amplify', () => ({ Hub: { listen: jest.fn() } }))
jest.mock('@services/auth')

const assign = jest.fn()
const unsubscribe = jest.fn()

const renderCallback = (search = ''): ReturnType<typeof render> => {
  window.location.search = search
  return render(<AuthCallback />)
}

const hubCallback = (): ((event: { payload: { event: string } }) => void) =>
  jest.mocked(Hub.listen).mock.calls[0][1] as unknown as (event: { payload: { event: string } }) => void

describe('AuthCallback page', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign, href: 'http://localhost/auth/callback', pathname: '/auth/callback', search: '' },
    })
    jest.mocked(Hub.listen).mockReturnValue(unsubscribe)
  })

  it('tells people what is happening while the code is exchanged', () => {
    renderCallback()

    expect(screen.getByText('Signing you in…')).toBeInTheDocument()
  })

  it('records the session and reloads the app at the saved path', () => {
    sessionStorage.setItem('pat_auth_return', '/p/amber-harbor')
    renderCallback()

    act(() => hubCallback()({ payload: { event: 'signedIn' } }))

    expect(jest.mocked(markSessionStored)).toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith('/p/amber-harbor')
    expect(sessionStorage.getItem('pat_auth_return')).toBe(null)
  })

  it('sends people home when no return path was saved', () => {
    sessionStorage.removeItem('pat_auth_return')
    renderCallback()

    act(() => hubCallback()({ payload: { event: 'signedIn' } }))

    expect(assign).toHaveBeenCalledWith('/')
  })

  // `//evil.com` is what window.location.pathname reports for `https://host//evil.com`, and
  // location.assign treats a protocol-relative path as another origin. router.replace used to
  // reject that for us, so the full-document navigation has to check it itself or a successful
  // sign-in hands the person to an attacker's site.
  it.each([
    ['//evil.com', 'a protocol-relative path'],
    ['/\\evil.com', 'a backslash the URL parser treats as a second slash'],
    ['https://evil.com/', 'an absolute URL'],
    ['javascript:alert(1)', 'a script URL'],
  ])('sends people home rather than to %s (%s)', (stored) => {
    sessionStorage.setItem('pat_auth_return', stored)
    renderCallback()

    act(() => hubCallback()({ payload: { event: 'signedIn' } }))

    expect(assign).toHaveBeenCalledWith('/')
  })

  // AuthProvider lives in _app and does not remount across a client-side transition. The useAuth
  // instance mounted on this page took the early exit -- the session flag was still false, because
  // this is the sign-in that sets it -- so a router.replace would carry a `user: null` provider all
  // the way to the destination and show a sign-in button to someone who just signed in. Asserting
  // on the source catches a reintroduced router.replace, which calling window.location.assign does
  // not rule out on its own.
  it('completes sign-in with a full-document navigation, not a route transition', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/auth/callback.tsx'), 'utf-8')

    expect(source).toMatch(/window\.location\.assign/)
    expect(source).not.toMatch(/useRouter|router\.replace\(/)
  })

  it('fails fast when Cognito redirects back with an error', () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    renderCallback('?error=invalid_scope&error_description=Nope')

    expect(screen.getByText('Sign-in failed. Please try again.')).toBeInTheDocument()
    expect(jest.mocked(Hub.listen)).not.toHaveBeenCalled()
    errorLog.mockRestore()
  })

  it('reports a failed code exchange without navigating', () => {
    renderCallback()

    act(() => hubCallback()({ payload: { event: 'signInWithRedirect_failure' } }))

    expect(screen.getByText('Sign-in failed. Please try again.')).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('stops listening when it unmounts', () => {
    const { unmount } = renderCallback()

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
