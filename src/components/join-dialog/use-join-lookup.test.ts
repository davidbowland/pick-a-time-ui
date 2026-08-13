import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import React from 'react'

import { JOIN_COPY } from './elements'
import { useJoinLookup } from './use-join-lookup'
import { fetchPoll } from '@services/api'
import { RenderHookResult, act, renderHook, waitFor } from '@testing-library/react'
import { PollData } from '@types'

// Only `fetchPoll` is replaced, matching the surface tests: `hasStatusCode` and `parseApiMessage`
// are pure, and this partial mock is what makes `instanceof ApiError` unreliable — which is why
// the hook reads the status structurally.
jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  fetchPoll: jest.fn(),
}))
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

const poll = { expiration: 1_800_000_000, name: 'Board meeting — Q3' } as PollData

/** The shape a failed request arrives in: a plain object, never an `ApiError` instance. */
const apiFailure = (statusCode: number, body = ''): unknown => ({ response: { body, headers: {}, statusCode } })

describe('useJoinLookup', () => {
  const push = jest.fn()

  function setup(): RenderHookResult<ReturnType<typeof useJoinLookup>, undefined> {
    push.mockResolvedValue(true)
    jest.mocked(useRouter).mockReturnValue({ push } as any)
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }): React.ReactNode =>
      React.createElement(QueryClientProvider, { client }, children)
    return renderHook(() => useJoinLookup(), { wrapper })
  }

  /** Type a value and submit it, the way every surface does. */
  async function attempt(result: { current: ReturnType<typeof useJoinLookup> }, value: string): Promise<void> {
    await act(async () => {
      result.current.onChange(value)
    })
    await act(async () => {
      result.current.submit()
    })
  }

  it('starts with nothing typed and nothing submitted', () => {
    const { result } = setup()

    expect(result.current.value).toBe('')
    expect(result.current.hasSubmitted).toBe(false)
    expect(result.current.error).toBeUndefined()
    expect(result.current.success).toBeUndefined()
  })

  it('keeps what was typed', async () => {
    const { result } = setup()

    await act(async () => {
      result.current.onChange('lazy giraffe')
    })

    expect(result.current.value).toBe('lazy giraffe')
  })

  it('records that a submit happened', async () => {
    const { result } = setup()

    await attempt(result, 'lazy giraffe')

    await waitFor(() => expect(result.current.hasSubmitted).toBe(true))
  })

  it('records a submit even when the value is refused before any request', async () => {
    const { result } = setup()

    await attempt(result, '100%')

    expect(result.current.hasSubmitted).toBe(true)
    expect(fetchPoll).not.toHaveBeenCalled()
  })

  it('stops a form submit from reloading the page', async () => {
    const { result } = setup()
    const preventDefault = jest.fn()

    await act(async () => {
      result.current.submit({ preventDefault } as unknown as React.FormEvent)
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('opens the poll the code names', async () => {
    const { result } = setup()

    await attempt(result, 'lazy giraffe')

    await waitFor(() => expect(push).toHaveBeenCalledWith('/p/lazy-giraffe'))
    expect(result.current.success).toEqual({ pollName: 'Board meeting — Q3', spokenCode: 'lazy giraffe' })
  })

  it('clears value, error and hasSubmitted on reset', async () => {
    const { result } = setup()
    jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

    await attempt(result, 'lazy giraffe')
    await waitFor(() => expect(result.current.error).toBeDefined())

    act(() => {
      result.current.reset()
    })

    expect(result.current.value).toBe('')
    expect(result.current.error).toBeUndefined()
    expect(result.current.hasSubmitted).toBe(false)
  })

  it('clears the success state on reset', async () => {
    const { result } = setup()

    await attempt(result, 'lazy giraffe')
    await waitFor(() => expect(result.current.success).toBeDefined())

    act(() => {
      result.current.reset()
    })

    expect(result.current.success).toBeUndefined()
  })

  it('escalates the copy when the same code misses twice', async () => {
    const { result } = setup()
    jest.mocked(fetchPoll).mockRejectedValue(apiFailure(404))

    await attempt(result, 'lazy giraffe')
    await waitFor(() => expect(result.current.error?.lines[0]).toBe(JOIN_COPY.firstMiss('lazy giraffe')))
    await attempt(result, 'Lazy-Giraffe')

    await waitFor(() => expect(result.current.error?.lines[0]).toBe(JOIN_COPY.secondMiss))
  })

  it('forgets the miss counter on reset, so a fresh visitor is not shouted at', async () => {
    const { result } = setup()
    jest.mocked(fetchPoll).mockRejectedValue(apiFailure(404))

    await attempt(result, 'lazy giraffe')
    await waitFor(() => expect(result.current.error?.lines[0]).toBe(JOIN_COPY.firstMiss('lazy giraffe')))

    act(() => {
      result.current.reset()
    })
    await attempt(result, 'lazy giraffe')

    await waitFor(() => expect(result.current.error?.lines[0]).toBe(JOIN_COPY.firstMiss('lazy giraffe')))
  })
})
