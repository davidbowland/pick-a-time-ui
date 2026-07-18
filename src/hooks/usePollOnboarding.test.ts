import { usePollOnboarding } from './usePollOnboarding'
import { act, renderHook } from '@testing-library/react'

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    },
  } as Storage
}

describe('usePollOnboarding', () => {
  it('shows the intro on a first visit to this poll', () => {
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', fakeStorage()))
    expect(result.current.showIntro).toBe(true)
  })

  it('does not show the intro once this poll was already dismissed', () => {
    const { result } = renderHook(() =>
      usePollOnboarding('amber-harbor', fakeStorage({ pat_onboarded_amber_harbor: 'true' })),
    )
    expect(result.current.showIntro).toBe(false)
  })

  it('is scoped per poll — dismissing one poll does not hide the intro for a different one', () => {
    const { result } = renderHook(() =>
      usePollOnboarding('other-poll', fakeStorage({ pat_onboarded_amber_harbor: 'true' })),
    )
    expect(result.current.showIntro).toBe(true)
  })

  it('persists dismissal to storage and hides the intro', () => {
    const storage = fakeStorage()
    const { result } = renderHook(() => usePollOnboarding('amber-harbor', storage))

    act(() => result.current.dismissIntro())

    expect(result.current.showIntro).toBe(false)
    expect(storage.getItem('pat_onboarded_amber_harbor')).toBe('true')
  })
})
