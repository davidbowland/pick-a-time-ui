import { Amplify } from 'aws-amplify'

jest.mock('aws-amplify', () => ({ Amplify: { configure: jest.fn() } }))
jest.mock('aws-amplify/auth/enable-oauth-listener', () => ({}))

describe('config/amplify', () => {
  // One test, not several: the module is a singleton, so only the first import evaluates its body.
  // A second `await import('./amplify')` in a later test hits the module cache and finds the
  // configure call already forgotten by clearMocks.
  //
  // The assertions together are the point of re-exporting the auth surface from here rather than
  // importing 'aws-amplify/auth' at each call site: no binding is reachable without the module
  // body -- and so Amplify.configure -- having already run.
  it('configures Amplify before exposing the auth surface', async () => {
    const amplifyConfig = await import('./amplify')

    expect(jest.mocked(Amplify.configure)).toHaveBeenCalledTimes(1)
    expect(typeof amplifyConfig.fetchAuthSession).toBe('function')
    expect(typeof amplifyConfig.getCurrentUser).toBe('function')
    expect(typeof amplifyConfig.signInWithRedirect).toBe('function')
    expect(typeof amplifyConfig.signOut).toBe('function')
    expect(typeof amplifyConfig.Hub.listen).toBe('function')

    // The OAuth code can only ever land on the callback page, which is what makes it safe for the
    // enable-oauth-listener import above to live here instead of on every page via _app.
    const config = jest.mocked(Amplify.configure).mock.calls[0][0] as any
    expect(config.Auth.Cognito.loginWith.oauth.redirectSignIn).toEqual([
      `${process.env.NEXT_PUBLIC_ORIGIN}/auth/callback/`,
    ])
  })
})
