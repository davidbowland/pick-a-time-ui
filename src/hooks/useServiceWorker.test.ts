import { registerServiceWorker, useServiceWorker } from './useServiceWorker'
import { renderHook, waitFor } from '@testing-library/react'

/** A delay that never elapses, so the timeout never wins a race a test is not about. */
const never = (): Promise<void> => new Promise<void>(() => undefined)

/** A delay that has already elapsed, so the timeout always wins. */
const immediately = (): Promise<void> => Promise.resolve()

const fakeRegistration = (): ServiceWorkerRegistration =>
  ({ unregister: jest.fn().mockResolvedValue(true) }) as unknown as ServiceWorkerRegistration

const fakeWorker = (): ServiceWorker => ({}) as ServiceWorker

interface Harness {
  container: ServiceWorkerContainer
  dispatchControllerChange: () => void
  getRegistrations: jest.Mock<Promise<ServiceWorkerRegistration[]>, []>
  readyReads: () => number
  register: jest.Mock<Promise<ServiceWorkerRegistration>, [string]>
  takeControl: () => void
}

/**
 * A stand-in for `navigator.serviceWorker`, built on a real EventTarget so `addEventListener`'s
 * `once` option behaves as it does in a browser. Reading `ready` is counted rather than forbidden:
 * that promise never settles in a Firefox private window, so a test can assert nothing awaits it.
 */
const harness = (controller: ServiceWorker | null = null, registrations: ServiceWorkerRegistration[] = []): Harness => {
  const register = jest.fn<Promise<ServiceWorkerRegistration>, [string]>().mockResolvedValue(fakeRegistration())
  const getRegistrations = jest.fn<Promise<ServiceWorkerRegistration[]>, []>().mockResolvedValue(registrations)
  const reads = { ready: 0 }
  const target = Object.assign(new EventTarget(), { controller, getRegistrations, register })
  Object.defineProperty(target, 'ready', {
    get: () => {
      reads.ready += 1
      return new Promise<ServiceWorkerRegistration>(() => undefined)
    },
  })
  return {
    container: target as unknown as ServiceWorkerContainer,
    dispatchControllerChange: () => {
      target.dispatchEvent(new Event('controllerchange'))
    },
    getRegistrations,
    readyReads: () => reads.ready,
    register,
    takeControl: () => {
      target.controller = fakeWorker()
    },
  }
}

describe('useServiceWorker', () => {
  describe('registerServiceWorker', () => {
    it('should do nothing where the browser has no service worker container', async () => {
      // http:// origins and some private windows leave `navigator.serviceWorker` undefined (AC-005).
      await expect(registerServiceWorker(undefined, '/sw.js', true, jest.fn(), never)).resolves.toBeUndefined()
    })

    it('should register the worker in production', async () => {
      const { container, register } = harness()

      await registerServiceWorker(container, '/sw.js', true, jest.fn(), never)

      expect(register).toHaveBeenCalledWith('/sw.js')
    })

    it('should register /sw.js by default', async () => {
      const { container, register } = harness()

      await registerServiceWorker(container, undefined, true, jest.fn(), never)

      expect(register).toHaveBeenCalledWith('/sw.js')
    })

    it('should return the registration the browser gives back', async () => {
      const { container, register } = harness()
      const registration = fakeRegistration()
      register.mockResolvedValueOnce(registration)

      await expect(registerServiceWorker(container, '/sw.js', true, jest.fn(), never)).resolves.toBe(registration)
    })

    it('should survive a registration that throws, as it does in a Firefox private window', async () => {
      // AC-005: no error reaches the caller, so the app renders normally.
      const { container, register } = harness()
      register.mockRejectedValueOnce(new Error('SecurityError'))

      await expect(registerServiceWorker(container, '/sw.js', true, jest.fn(), never)).resolves.toBeUndefined()
    })

    it('should stop waiting on a registration that never settles', async () => {
      // AC-037. Without the timeout this test does not fail with a message, it hangs.
      const { container, register } = harness()
      register.mockReturnValueOnce(new Promise<ServiceWorkerRegistration>(() => undefined))

      await expect(registerServiceWorker(container, '/sw.js', true, jest.fn(), immediately)).resolves.toBeUndefined()
    })

    it('should read the environment itself when nothing is injected', async () => {
      // NODE_ENV is `test` under jest, so the default resolves to development.
      const { container, getRegistrations, register } = harness()

      await registerServiceWorker(container, undefined, undefined, jest.fn(), never)

      expect(getRegistrations).toHaveBeenCalled()
      expect(register).not.toHaveBeenCalled()
    })

    it('should never read serviceWorker.ready, which never settles in a Firefox private window', async () => {
      const { container, readyReads } = harness()

      await registerServiceWorker(container, '/sw.js', true, jest.fn(), never)

      expect(readyReads()).toEqual(0)
    })
  })

  describe('reload on takeover', () => {
    it('should reload the page once when a new worker takes control of a controlled page', async () => {
      // AC-007: the page was rendered by the previous build and holds hashed chunk URLs the deploy
      // has already deleted.
      const reload = jest.fn()
      const { container, dispatchControllerChange } = harness(fakeWorker())
      await registerServiceWorker(container, '/sw.js', true, reload, never)

      dispatchControllerChange()

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('should reload only once when the browser fires controllerchange twice', async () => {
      // Chrome does. A second reload would interrupt the first one landing.
      const reload = jest.fn()
      const { container, dispatchControllerChange } = harness(fakeWorker())
      await registerServiceWorker(container, '/sw.js', true, reload, never)

      dispatchControllerChange()
      dispatchControllerChange()

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('should catch a takeover that happens while register() is still settling', async () => {
      // The listener has to be subscribed BEFORE register(). A worker can install, skipWaiting and
      // claim inside that promise, and a listener added afterwards misses the event entirely.
      const reload = jest.fn()
      const { container, dispatchControllerChange, register } = harness(fakeWorker())
      register.mockImplementationOnce(async () => {
        dispatchControllerChange()
        return fakeRegistration()
      })

      await registerServiceWorker(container, '/sw.js', true, reload, never)

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('should not reload a first visit, where registering is what made the worker the controller', async () => {
      // THE HAZARD. The page started uncontrolled, so nothing on screen came from a worker and there
      // is no stale URL to escape. Reading `controller` after register() sees the claim that register()
      // itself produced and throws away a page that had just finished loading.
      const reload = jest.fn()
      const { container, dispatchControllerChange, register, takeControl } = harness(null)
      register.mockImplementationOnce(async () => {
        takeControl()
        return fakeRegistration()
      })

      await registerServiceWorker(container, '/sw.js', true, reload, never)
      dispatchControllerChange()

      expect(reload).not.toHaveBeenCalled()
    })

    it('should not reload the load after the kill switch ran, which starts uncontrolled', async () => {
      // The loop this guard exists to break: register → claim → controllerchange → reload →
      // unregister → register. Each iteration is a SEPARATE page load, so a per-load "reload once"
      // flag is reborn every time and cannot stop it. This is that next load — the kill switch
      // unregistered the previous worker, so the page arrives with no controller.
      const reload = jest.fn()
      const { container, dispatchControllerChange, takeControl } = harness(null)

      await registerServiceWorker(container, '/sw.js', true, reload, never)
      takeControl()
      dispatchControllerChange()

      expect(reload).not.toHaveBeenCalled()
    })

    it('should not reload in development, where nothing is registered at all', async () => {
      const reload = jest.fn()
      const { container, dispatchControllerChange } = harness(fakeWorker())

      await registerServiceWorker(container, '/sw.js', false, reload, never)
      dispatchControllerChange()

      expect(reload).not.toHaveBeenCalled()
    })
  })

  describe('development', () => {
    it('should not register outside production', async () => {
      // AC-006: `next dev` rewrites /_next/static/* in place, so a cached worker serves a stale chunk
      // after every edit.
      const { container, register } = harness()

      await expect(registerServiceWorker(container, '/sw.js', false, jest.fn(), never)).resolves.toBeUndefined()

      expect(register).not.toHaveBeenCalled()
    })

    it('should remove a worker left behind by a production build', async () => {
      // AC-038. Skipping registration is not enough — connections-ui had to unregister to escape an
      // endless reload loop on localhost.
      const stale = fakeRegistration()
      const { container } = harness(fakeWorker(), [stale])

      await registerServiceWorker(container, '/sw.js', false, jest.fn(), never)

      expect(jest.mocked(stale.unregister)).toHaveBeenCalledTimes(1)
    })

    it('should remove every registration, not only the first', async () => {
      const [first, second] = [fakeRegistration(), fakeRegistration()]
      const { container } = harness(null, [first, second])

      await registerServiceWorker(container, '/sw.js', false, jest.fn(), never)

      expect(jest.mocked(first.unregister)).toHaveBeenCalledTimes(1)
      expect(jest.mocked(second.unregister)).toHaveBeenCalledTimes(1)
    })

    it('should survive a browser that refuses to list its registrations', async () => {
      const { container, getRegistrations } = harness()
      getRegistrations.mockRejectedValueOnce(new Error('SecurityError'))

      await expect(registerServiceWorker(container, '/sw.js', false, jest.fn(), never)).resolves.toBeUndefined()
    })

    it('should survive an unregister that rejects', async () => {
      const stale = fakeRegistration()
      jest.mocked(stale.unregister).mockRejectedValueOnce(new Error('InvalidStateError'))
      const { container } = harness(null, [stale])

      await expect(registerServiceWorker(container, '/sw.js', false, jest.fn(), never)).resolves.toBeUndefined()
    })

    it('should stop waiting on a registration list that never arrives', async () => {
      // AC-037 again: no wait here is unbounded either.
      const { container, getRegistrations } = harness()
      getRegistrations.mockReturnValueOnce(new Promise<ServiceWorkerRegistration[]>(() => undefined))

      await expect(registerServiceWorker(container, '/sw.js', false, jest.fn(), immediately)).resolves.toBeUndefined()
    })

    it('should stop waiting on an unregister that never settles', async () => {
      const stale = fakeRegistration()
      jest.mocked(stale.unregister).mockReturnValueOnce(new Promise<boolean>(() => undefined))
      const { container } = harness(null, [stale])

      await expect(registerServiceWorker(container, '/sw.js', false, jest.fn(), immediately)).resolves.toBeUndefined()
    })
  })

  describe('useServiceWorker', () => {
    const current: { container: ServiceWorkerContainer | undefined } = { container: undefined }

    beforeAll(() => {
      // jsdom ships no `navigator.serviceWorker`, so the hook's own default lookup has nothing to find.
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => current.container })
    })

    afterAll(() => {
      Reflect.deleteProperty(navigator, 'serviceWorker')
    })

    const setup = (controller: ServiceWorker | null = null): Harness => {
      const created = harness(controller)
      current.container = created.container
      return created
    }

    it('should register the worker in production', async () => {
      const { register } = setup()

      renderHook(() => useServiceWorker(true))

      await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'))
    })

    it('should unregister rather than register outside production', async () => {
      const { getRegistrations, register } = setup()

      renderHook(() => useServiceWorker(false))

      await waitFor(() => expect(getRegistrations).toHaveBeenCalled())
      expect(register).not.toHaveBeenCalled()
    })

    // Firefox with cookies or site data blocked, and any sandboxed iframe, makes reading
    // `navigator.serviceWorker` THROW rather than return undefined. That read is a default
    // parameter, so it evaluates before registerServiceWorker's own try -- unguarded, it rejects
    // the promise the hook does not await, giving an unhandled rejection on every load in exactly
    // the browser AC-005 exists for. Stubbing the container as `undefined`, which every other test
    // here does, cannot reach this.
    it('should survive a navigator.serviceWorker getter that throws', async () => {
      const onRejection = jest.fn()
      process.on('unhandledRejection', onRejection)
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        get: () => {
          throw new Error('SecurityError')
        },
      })

      expect(() => renderHook(() => useServiceWorker(true, jest.fn(), () => new Promise(() => {})))).not.toThrow()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onRejection).not.toHaveBeenCalled()

      process.off('unhandledRejection', onRejection)
      // Restored explicitly rather than left to afterAll: this describe's other tests read the
      // shared getter, and a throwing one left in place fails them for the wrong reason.
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => current.container })
    })

    it('should read the environment itself when nothing is injected', async () => {
      // NODE_ENV is `test` under jest, so the default resolves to development.
      const { getRegistrations, register } = setup()

      renderHook(() => useServiceWorker())

      await waitFor(() => expect(getRegistrations).toHaveBeenCalled())
      expect(register).not.toHaveBeenCalled()
    })
  })
})
