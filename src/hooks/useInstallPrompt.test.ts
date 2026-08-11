import {
  BeforeInstallPromptEvent,
  INSTALL_DISMISSED_KEY,
  createInstallPromptStore,
  installPromptStore,
  readInstallDismissed,
  useInstallPrompt,
  writeInstallDismissed,
} from './useInstallPrompt'
import { act, renderHook, waitFor } from '@testing-library/react'
import { InstallEnv } from '@utils/install-capability'

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

const envOf = (overrides: Partial<InstallEnv> = {}): (() => InstallEnv) => {
  const env: InstallEnv = {
    matchesMedia: () => false,
    maxTouchPoints: 0,
    standalone: false,
    userAgent: ANDROID_CHROME,
    ...overrides,
  }
  return () => env
}

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial))
  return {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  } as Storage
}

/** Safari in private browsing throws on both reads and writes. */
function throwingStorage(): Storage {
  return {
    clear: () => undefined,
    getItem: () => {
      throw new Error('SecurityError')
    },
    key: () => null,
    length: 0,
    removeItem: () => undefined,
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  } as unknown as Storage
}

/**
 * A stand-in for Chromium's `beforeinstallprompt`. `cancelable` matters: the store calls
 * `preventDefault`, and a non-cancelable event would swallow that silently.
 */
const beforeInstallPromptEvent = (outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEvent => {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent
  return Object.assign(event, {
    prompt: jest.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  })
}

describe('useInstallPrompt', () => {
  describe('createInstallPromptStore', () => {
    it('should hold nothing before the browser fires the event', () => {
      const store = createInstallPromptStore()

      expect(store.getState()).toEqual({ isInstalled: false, isCaptured: false, isSpent: false })
    })

    it('should capture the event and stop the browser handling it itself', () => {
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      const event = beforeInstallPromptEvent()

      target.dispatchEvent(event)

      expect(event.defaultPrevented).toEqual(true)
      expect(store.getState()).toEqual({ isInstalled: false, isCaptured: true, isSpent: false })
    })

    it('should tell subscribers when the event arrives', () => {
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      const listener = jest.fn()
      store.subscribe(listener)

      target.dispatchEvent(beforeInstallPromptEvent())

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should stop telling a subscriber that unsubscribed', () => {
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      const listener = jest.fn()
      store.subscribe(listener)()

      target.dispatchEvent(beforeInstallPromptEvent())

      expect(listener).not.toHaveBeenCalled()
    })

    it('should attach only one listener however many times it is started', () => {
      // `_app` starts it, and every consumer starts it again. A second listener would capture the
      // same event twice and call preventDefault on an already-consumed event.
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      store.start(target)
      const listener = jest.fn()
      store.subscribe(listener)

      target.dispatchEvent(beforeInstallPromptEvent())

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should do nothing where there is no event target, as during the static export', () => {
      const store = createInstallPromptStore()

      store.start(undefined)

      expect(store.getState()).toEqual({ isInstalled: false, isCaptured: false, isSpent: false })
    })

    it('should report accepted when the visitor installs from the browser sheet', async () => {
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      const event = beforeInstallPromptEvent('accepted')
      target.dispatchEvent(event)

      await expect(store.prompt()).resolves.toEqual(true)

      expect(event.prompt).toHaveBeenCalled()
    })

    it('should report the prompt spent, not absent, when the visitor backs out of the sheet', async () => {
      // The whole reason `spent` exists: this must not read as "this browser cannot install".
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      target.dispatchEvent(beforeInstallPromptEvent('dismissed'))

      await expect(store.prompt()).resolves.toEqual(false)

      expect(store.getState()).toEqual({ isInstalled: false, isCaptured: false, isSpent: true })
    })

    it('should use the captured event only once', async () => {
      // Chromium throws on a second prompt() call, which a double tap would otherwise produce.
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      const event = beforeInstallPromptEvent()
      target.dispatchEvent(event)

      await store.prompt()
      await expect(store.prompt()).resolves.toEqual(false)

      expect(event.prompt).toHaveBeenCalledTimes(1)
    })

    it('should report false rather than throw when the browser rejects the prompt', async () => {
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      const event = beforeInstallPromptEvent()
      jest.mocked(event.prompt).mockRejectedValueOnce(new Error('NotAllowedError'))
      target.dispatchEvent(event)

      await expect(store.prompt()).resolves.toEqual(false)

      expect(store.getState()).toEqual({ isInstalled: false, isCaptured: false, isSpent: true })
    })

    it('should report false where no event was ever captured', async () => {
      await expect(createInstallPromptStore().prompt()).resolves.toEqual(false)
    })

    it('should clear the spent flag when the browser fires a fresh event', async () => {
      // A reload produces a genuinely usable event, so the offer becomes live again.
      const target = new EventTarget()
      const store = createInstallPromptStore()
      store.start(target)
      target.dispatchEvent(beforeInstallPromptEvent())
      await store.prompt()

      target.dispatchEvent(beforeInstallPromptEvent())

      expect(store.getState()).toEqual({ isInstalled: false, isCaptured: true, isSpent: false })
    })

    it('should expose an app-wide instance for the app shell to start', () => {
      expect(installPromptStore.getState()).toEqual({ isInstalled: false, isCaptured: false, isSpent: false })
    })
  })

  describe('dismissal storage', () => {
    it('should report no dismissal on a device that has never dismissed', () => {
      expect(readInstallDismissed(fakeStorage())).toEqual(false)
    })

    it('should read a stored dismissal', () => {
      expect(readInstallDismissed(fakeStorage({ [INSTALL_DISMISSED_KEY]: 'true' }))).toEqual(true)
    })

    it('should write the dismissal under the disclosed key', () => {
      const storage = fakeStorage()

      writeInstallDismissed(storage)

      expect(storage.getItem(INSTALL_DISMISSED_KEY)).toEqual('true')
    })

    it('should report no dismissal where reading storage throws', () => {
      // Safari private browsing throws on the read itself.
      expect(readInstallDismissed(throwingStorage())).toEqual(false)
    })

    it('should not throw out of a click handler where writing storage throws', () => {
      expect(() => writeInstallDismissed(throwingStorage())).not.toThrow()
    })

    it('should default to the device storage', () => {
      writeInstallDismissed()

      expect(readInstallDismissed()).toEqual(true)
      window.localStorage.removeItem(INSTALL_DISMISSED_KEY)
    })
  })

  describe('useInstallPrompt', () => {
    const setup = (env = envOf(), storage: Storage = fakeStorage()) => {
      const store = createInstallPromptStore()
      return { rendered: renderHook(() => useInstallPrompt(store, storage, env)), storage }
    }

    it('should offer nothing on a browser that never fires the event', async () => {
      const { rendered } = setup()

      await waitFor(() => expect(rendered.result.current.capability).toEqual('none'))
    })

    it('should report ios-share on iPhone Safari', async () => {
      const { rendered } = setup(envOf({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI }))

      await waitFor(() => expect(rendered.result.current.capability).toEqual('ios-share'))
    })

    it('should report installed and ignore a stored dismissal', async () => {
      // Dismissing the offer must never make the installed app report itself uninstalled.
      const storage = fakeStorage({ [INSTALL_DISMISSED_KEY]: 'true' })
      const { rendered } = setup(envOf({ standalone: true }), storage)

      await waitFor(() => expect(rendered.result.current.capability).toEqual('installed'))
      expect(rendered.result.current.isDismissed).toEqual(true)
    })

    it('should become promptable when the event arrives after mount', async () => {
      // The event fires early but not necessarily before first render, so the offer has to appear
      // when the browser says so rather than only if it beat the mount.
      const store = createInstallPromptStore()
      const target = new EventTarget()
      store.start(target)
      const rendered = renderHook(() => useInstallPrompt(store, fakeStorage(), envOf()))

      act(() => {
        target.dispatchEvent(beforeInstallPromptEvent())
      })

      await waitFor(() => expect(rendered.result.current.capability).toEqual('promptable'))
    })

    it('should report an event captured before mount, which is when Chromium fires it', async () => {
      // `_app` starts the store at first render; a banner mounted later still sees the capture.
      const store = createInstallPromptStore()
      const target = new EventTarget()
      store.start(target)
      target.dispatchEvent(beforeInstallPromptEvent())

      const rendered = renderHook(() => useInstallPrompt(store, fakeStorage(), envOf()))

      await waitFor(() => expect(rendered.result.current.capability).toEqual('promptable'))
    })

    it('should report spent once the prompt has been used', async () => {
      const store = createInstallPromptStore()
      const target = new EventTarget()
      store.start(target)
      target.dispatchEvent(beforeInstallPromptEvent('dismissed'))
      const rendered = renderHook(() => useInstallPrompt(store, fakeStorage(), envOf()))

      await act(async () => {
        await rendered.result.current.prompt()
      })

      await waitFor(() => expect(rendered.result.current.capability).toEqual('spent'))
    })

    it('should report the visitor accepted the browser sheet', async () => {
      const store = createInstallPromptStore()
      const target = new EventTarget()
      store.start(target)
      target.dispatchEvent(beforeInstallPromptEvent('accepted'))
      const rendered = renderHook(() => useInstallPrompt(store, fakeStorage(), envOf()))

      const accepted = await act(async () => rendered.result.current.prompt())

      expect(accepted).toEqual(true)
    })

    it('should suppress the offer once dismissed and persist the dismissal', async () => {
      const storage = fakeStorage()
      const { rendered } = setup(envOf({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI }), storage)
      await waitFor(() => expect(rendered.result.current.capability).toEqual('ios-share'))

      act(() => rendered.result.current.dismiss())

      expect(rendered.result.current.capability).toEqual('none')
      expect(rendered.result.current.isDismissed).toEqual(true)
      expect(storage.getItem(INSTALL_DISMISSED_KEY)).toEqual('true')
    })

    it('should stay suppressed on the next visit', async () => {
      const storage = fakeStorage({ [INSTALL_DISMISSED_KEY]: 'true' })
      const { rendered } = setup(envOf({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI }), storage)

      await waitFor(() => expect(rendered.result.current.isDismissed).toEqual(true))
      expect(rendered.result.current.capability).toEqual('none')
    })

    it('should keep working where storage throws', async () => {
      const { rendered } = setup(envOf({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI }), throwingStorage())
      await waitFor(() => expect(rendered.result.current.capability).toEqual('ios-share'))

      act(() => rendered.result.current.dismiss())

      expect(rendered.result.current.capability).toEqual('none')
    })

    it('should stop listening to the store when it unmounts', async () => {
      const store = createInstallPromptStore()
      const target = new EventTarget()
      store.start(target)
      const rendered = renderHook(() => useInstallPrompt(store, fakeStorage(), envOf()))
      await waitFor(() => expect(rendered.result.current.capability).toEqual('none'))

      rendered.unmount()
      target.dispatchEvent(beforeInstallPromptEvent())

      expect(store.getState()).toEqual({ isInstalled: false, isCaptured: true, isSpent: false })
    })

    it('should default to the app-wide store, the ambient storage, and the real browser', async () => {
      const rendered = renderHook(() => useInstallPrompt())

      await waitFor(() => expect(rendered.result.current.capability).toEqual('none'))
      expect(rendered.result.current.isDismissed).toEqual(false)
    })
  })
})
