import { useAuth } from './useAuth'
import { clearStoredSession, getSessionUser, hasStoredSession, loadAuth } from '@services/auth'
import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@services/auth')

const hubListen = jest.fn().mockReturnValue(jest.fn())
const signInWithRedirect = jest.fn()
const signOut = jest.fn()

const authModule = () =>
  ({
    Hub: { listen: hubListen },
    signInWithRedirect,
    signOut,
  }) as any

const hubCallback = (): ((event: { payload: { event: string } }) => void) => hubListen.mock.calls[0][1]

describe('useAuth', () => {
  beforeAll(() => {
    jest.mocked(hasStoredSession).mockReturnValue(true)
    jest.mocked(getSessionUser).mockResolvedValue({ name: 'Ada' })
    jest.mocked(loadAuth).mockImplementation(async () => authModule())
  })

  it('reports signed out without loading Amplify when no session is stored', async () => {
    jest.mocked(hasStoredSession).mockReturnValueOnce(false)

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSignedIn).toBe(false)
    expect(result.current.user).toBe(null)
    expect(jest.mocked(loadAuth)).not.toHaveBeenCalled()
    expect(jest.mocked(getSessionUser)).not.toHaveBeenCalled()
  })

  it('restores the user when a session is stored', async () => {
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSignedIn).toBe(true)
    expect(result.current.user).toEqual({ name: 'Ada' })
  })

  it('subscribes to Hub auth events when a session is stored', async () => {
    renderHook(() => useAuth())

    await waitFor(() => expect(hubListen).toHaveBeenCalledWith('auth', expect.any(Function)))
  })

  it('re-reads the session when Hub reports an auth event', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    jest.mocked(getSessionUser).mockResolvedValueOnce({ name: 'Grace' })
    act(() => hubCallback()({ payload: { event: 'signedIn' } }))

    await waitFor(() => expect(result.current.user).toEqual({ name: 'Grace' }))
  })

  it('ignores Hub events that cannot change the session', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => hubCallback()({ payload: { event: 'signInWithRedirect' } }))

    expect(jest.mocked(getSessionUser)).toHaveBeenCalledTimes(1)
  })

  // Without this, a signed-in visitor on a flaky connection waits on a spinner forever: the flag
  // says "might be signed in", so the effect does not take the early exit, and a rejected import
  // would leave isLoading true with nothing left to flip it.
  it('stops loading when the auth chunk fails to load', async () => {
    jest.mocked(loadAuth).mockRejectedValueOnce(new Error('offline'))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSignedIn).toBe(false)
  })

  // getSessionUser propagates a rejected import rather than resolving null, so the same hazard
  // exists one call deeper.
  it('stops loading when reading the session rejects', async () => {
    jest.mocked(getSessionUser).mockRejectedValueOnce(new Error('offline'))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSignedIn).toBe(false)
  })

  it('does not subscribe when it unmounts before the auth chunk arrives', async () => {
    let deliver: (module: any) => void = () => undefined
    jest.mocked(loadAuth).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deliver = resolve
        }),
    )

    const { unmount } = renderHook(() => useAuth())
    unmount()
    await act(async () => deliver(authModule()))

    expect(hubListen).not.toHaveBeenCalled()
  })

  it('unsubscribes from Hub when it unmounts', async () => {
    const unsubscribe = jest.fn()
    hubListen.mockReturnValueOnce(unsubscribe)

    const { result, unmount } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('saves the return path and redirects on sign in', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await result.current.handleSignIn()

    expect(sessionStorage.getItem('pat_auth_return')).toBe('/')
    expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' })
  })

  it('clears the stored session before signing out', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await result.current.handleSignOut()

    expect(jest.mocked(clearStoredSession)).toHaveBeenCalled()
    expect(signOut).toHaveBeenCalled()
  })
})
