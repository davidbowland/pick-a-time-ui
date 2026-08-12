import fs from 'fs'
import path from 'path'
import vm from 'vm'

const ORIGIN = 'https://pick-a-time.com'
const API_ORIGIN = 'https://pick-a-time-api.dbowland.com'

interface SwExports {
  isSameOrigin: (url: string) => boolean
  normalizePath: (url: string) => string
  offlineFallback: () => Promise<Response>
  respondToNavigation: (request: any, fetchImpl: (request: any) => Promise<Response>) => Promise<Response>
  shouldHandle: (request: any) => boolean
}

interface Harness {
  cache: { add: jest.Mock; match: jest.Mock }
  exports: SwExports
  listeners: Record<string, (event: any) => void>
  self: Record<string, any>
}

// A minimal stand-in for the platform Request. Undici's refuses both of the things the worker relies
// on: it rejects the relative '/offline.html' the install handler passes, and it throws outright for
// `mode: 'navigate'`, which is exactly the mode every interesting case here needs.
class FakeRequest {
  constructor(
    public url: string,
    public init: Record<string, unknown> = {},
  ) {}
}

// The worker is plain JS written for a ServiceWorkerGlobalScope, so it is evaluated in a VM against a
// stub `self` rather than imported. Both halves are exercised: the pure helpers it hangs off
// `self.__swTestExports`, and the real listeners it registers, captured here so the fetch handler can
// be fired with a fake event and asked whether it called respondWith at all.
const loadWorker = (overrides: Record<string, any> = {}): Harness => {
  const source = fs.readFileSync(path.join(__dirname, '../../scripts/sw-src.js'), 'utf8')
  const listeners: Record<string, (event: any) => void> = {}
  const cache = { add: jest.fn().mockResolvedValue(undefined), match: jest.fn().mockResolvedValue(undefined) }
  const self: Record<string, any> = {
    addEventListener: (type: string, listener: (event: any) => void) => {
      listeners[type] = listener
    },
    caches: {
      delete: jest.fn().mockResolvedValue(true),
      keys: jest.fn().mockResolvedValue([]),
      open: jest.fn().mockResolvedValue(cache),
    },
    clients: { claim: jest.fn().mockResolvedValue(undefined) },
    fetch: jest.fn().mockResolvedValue(undefined),
    location: { origin: ORIGIN },
    registration: {},
    Request: FakeRequest,
    Response,
    skipWaiting: jest.fn(),
    // `URL` is a Node global, not an ECMAScript intrinsic, so a bare VM context does not have it.
    // Without it every `new URL` throws, normalizePath collapses to '' for every input, and the
    // passthrough comparisons below would pass for the wrong reason.
    URL,
    ...overrides,
  }
  vm.createContext(self)
  self.self = self
  vm.runInContext(source, self)
  return { cache, exports: self.__swTestExports as SwExports, listeners, self }
}

const navigation = (url: string, extra: Record<string, unknown> = {}) => ({
  destination: 'document',
  method: 'GET',
  mode: 'navigate',
  url,
  ...extra,
})

const fetchEvent = (request: unknown) => ({ request, respondWith: jest.fn() })

const lifecycleEvent = () => {
  const pending: Promise<unknown>[] = []
  return { pending, waitUntil: (promise: Promise<unknown>) => pending.push(promise) }
}

describe('sw-src', () => {
  describe('shouldHandle', () => {
    const { exports } = loadWorker()

    it('should handle a same-origin navigation', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/p/fuzzy-penguin/`))).toEqual(true)
    })

    it('should handle a navigation that carries a query string of its own', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/p/fuzzy-penguin/?id=brave-tiger`))).toEqual(true)
    })

    // AC-002. The API call carries a bearer token and a whole poll: names, availability, calendar
    // state. It is `mode: 'cors'`, so it never reaches the fallback path at all.
    it('should leave the cross-origin API alone', () => {
      expect(
        exports.shouldHandle({
          destination: '',
          method: 'GET',
          mode: 'cors',
          url: `${API_ORIGIN}/polls/fuzzy-penguin`,
        }),
      ).toEqual(false)
    })

    it('should leave a mutation to the API alone', () => {
      expect(
        exports.shouldHandle({
          destination: '',
          method: 'POST',
          mode: 'cors',
          url: `${API_ORIGIN}/polls`,
        }),
      ).toEqual(false)
    })

    it('should leave the reCAPTCHA script alone', () => {
      expect(
        exports.shouldHandle({
          destination: 'script',
          method: 'GET',
          mode: 'no-cors',
          url: 'https://www.google.com/recaptcha/api.js',
        }),
      ).toEqual(false)
    })

    it('should leave build assets alone', () => {
      expect(
        exports.shouldHandle({
          destination: 'script',
          method: 'GET',
          mode: 'no-cors',
          url: `${ORIGIN}/_next/static/chunks/main-0f1a2b3c.js`,
        }),
      ).toEqual(false)
    })

    // A form post is a navigation, but answering it with a cached page would swallow the submission.
    it('should leave a non-GET navigation alone', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/p/fuzzy-penguin/`, { method: 'POST' }))).toEqual(false)
    })

    // AC-036. Gecko fetches the manifest from an idle callback with no error handling and discards it
    // entirely on any non-2xx, which turns an install offer into a bookmark with nothing logged.
    it('should leave the manifest alone by destination', () => {
      expect(
        exports.shouldHandle({
          destination: 'manifest',
          method: 'GET',
          mode: 'cors',
          url: `${ORIGIN}/site.webmanifest`,
        }),
      ).toEqual(false)
    })

    it('should leave the manifest alone by path even if it arrives as a navigation', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/site.webmanifest`))).toEqual(false)
    })

    // AC-004. These routes mean nothing without their query string: `/auth/callback/` completes the
    // OAuth code exchange, `/calendar-connected/` reports its outcome. `trailingSlash: true` means
    // the app links to the slash form, but a provider redirect may omit it, so both must match.
    it('should leave the OAuth callback alone', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/auth/callback/?code=abc123&state=xyz789`))).toEqual(false)
    })

    it('should leave the OAuth callback alone without its trailing slash', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/auth/callback?code=abc123&state=xyz789`))).toEqual(false)
    })

    it('should leave the calendar-connected route alone', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/calendar-connected/?status=success`))).toEqual(false)
    })

    it('should leave the calendar-connected route alone without its trailing slash', () => {
      expect(exports.shouldHandle(navigation(`${ORIGIN}/calendar-connected?status=success`))).toEqual(false)
    })

    // A navigation away to another origin is still dispatched to this worker. Answering a failed jump
    // to a Google consent screen with a Pick a Time offline page would blame this app for that outage.
    it('should leave a navigation to another origin alone', () => {
      expect(exports.shouldHandle(navigation('https://accounts.google.com/o/oauth2/v2/auth?client_id=1'))).toEqual(
        false,
      )
    })
  })

  describe('normalizePath', () => {
    const { exports } = loadWorker()

    it('should strip a trailing slash so both link forms are one route', () => {
      expect(exports.normalizePath(`${ORIGIN}/auth/callback/`)).toEqual(
        exports.normalizePath(`${ORIGIN}/auth/callback`),
      )
    })

    it('should keep the root path', () => {
      expect(exports.normalizePath(`${ORIGIN}/`)).toEqual('/')
    })

    it('should drop the query string', () => {
      expect(exports.normalizePath(`${ORIGIN}/calendar-connected/?status=success`)).toEqual('/calendar-connected')
    })

    // An unparseable URL must fail towards being handled normally, never towards silently joining the
    // passthrough list.
    it('should return nothing matchable for an unparseable url', () => {
      expect(exports.normalizePath('http://[')).toEqual('')
    })
  })

  describe('isSameOrigin', () => {
    const { exports } = loadWorker()

    it('should recognise this site', () => {
      expect(exports.isSameOrigin(`${ORIGIN}/p/fuzzy-penguin/`)).toEqual(true)
    })

    it('should reject another origin', () => {
      expect(exports.isSameOrigin('https://accounts.google.com/o/oauth2/v2/auth')).toEqual(false)
    })

    // Unlike normalizePath, an unparseable URL here fails towards NOT handling the request: the
    // worker cannot show a Pick a Time page for a URL it cannot even prove belongs to Pick a Time.
    it('should reject an unparseable url', () => {
      expect(exports.isSameOrigin('http://[')).toEqual(false)
    })
  })

  // AC-002 stated as the worker actually behaves: not "shouldHandle returned false" but "respondWith
  // was never called", which is what leaves the request reaching the network as the browser built it.
  describe('fetch listener', () => {
    it('should not respond to a cross-origin API request', () => {
      const { listeners } = loadWorker()
      const event = fetchEvent({ destination: '', method: 'GET', mode: 'cors', url: `${API_ORIGIN}/polls/abc` })

      listeners.fetch(event)

      expect(event.respondWith).not.toHaveBeenCalled()
    })

    it('should not respond to a build asset', () => {
      const { listeners } = loadWorker()
      const event = fetchEvent({
        destination: 'style',
        method: 'GET',
        mode: 'no-cors',
        url: `${ORIGIN}/_next/static/css/a1b2c3.css`,
      })

      listeners.fetch(event)

      expect(event.respondWith).not.toHaveBeenCalled()
    })

    it('should not respond to the manifest', () => {
      const { listeners } = loadWorker()
      const event = fetchEvent({
        destination: 'manifest',
        method: 'GET',
        mode: 'cors',
        url: `${ORIGIN}/site.webmanifest`,
      })

      listeners.fetch(event)

      expect(event.respondWith).not.toHaveBeenCalled()
    })

    it('should not respond to the OAuth callback in either slash form', () => {
      const { listeners } = loadWorker()
      const slashed = fetchEvent(navigation(`${ORIGIN}/auth/callback/?code=abc123&state=xyz789`))
      const bare = fetchEvent(navigation(`${ORIGIN}/auth/callback?code=abc123&state=xyz789`))

      listeners.fetch(slashed)
      listeners.fetch(bare)

      expect(slashed.respondWith).not.toHaveBeenCalled()
      expect(bare.respondWith).not.toHaveBeenCalled()
    })

    it('should not respond to the calendar-connected route in either slash form', () => {
      const { listeners } = loadWorker()
      const slashed = fetchEvent(navigation(`${ORIGIN}/calendar-connected/?status=success`))
      const bare = fetchEvent(navigation(`${ORIGIN}/calendar-connected?status=success`))

      listeners.fetch(slashed)
      listeners.fetch(bare)

      expect(slashed.respondWith).not.toHaveBeenCalled()
      expect(bare.respondWith).not.toHaveBeenCalled()
    })

    // The control for every assertion above: the listener does respond to the one thing it is for, so
    // a `return` accidentally placed at the top of the handler would not leave this suite green.
    it('should respond to a same-origin navigation', () => {
      const { listeners } = loadWorker()
      const event = fetchEvent(navigation(`${ORIGIN}/p/fuzzy-penguin/`))

      listeners.fetch(event)

      expect(event.respondWith).toHaveBeenCalledTimes(1)
    })
  })

  describe('respondToNavigation', () => {
    it('should return the network response while the network is there', async () => {
      const { exports, self } = loadWorker()
      const live = new Response('<html>live</html>')

      const result = await exports.respondToNavigation(navigation(`${ORIGIN}/`), () => Promise.resolve(live))

      expect(await result.text()).toEqual('<html>live</html>')
      // Network-first with nothing written back: a successful navigation never touches storage, which
      // is what makes AC-003 true by construction rather than by inspection.
      expect(jest.mocked(self.caches.open)).not.toHaveBeenCalled()
    })

    // The offline page's "Try again" calls `location.reload()`, which only re-requests the page the
    // visitor wanted while the URL is unchanged. A `Response.redirect` here would move them to
    // /offline.html and every retry from then on would retry the offline page forever.
    it('should answer a failed navigation with the cached page itself, not a redirect to it', async () => {
      const { cache, exports } = loadWorker()
      cache.match.mockResolvedValueOnce(new Response('<html>offline</html>', { status: 200 }))

      const result = await exports.respondToNavigation(navigation(`${ORIGIN}/p/fuzzy-penguin/`), () =>
        Promise.reject(new Error('network down')),
      )

      expect(result.status).toEqual(200)
      expect(result.redirected).toEqual(false)
      expect(result.headers.get('location')).toBeNull()
      expect(await result.text()).toEqual('<html>offline</html>')
    })
  })

  describe('offlineFallback', () => {
    it('should read the offline page out of the cache', async () => {
      const { cache, exports, self } = loadWorker()
      cache.match.mockResolvedValueOnce(new Response('<html>offline</html>'))

      const result = await exports.offlineFallback()

      expect(await result.text()).toEqual('<html>offline</html>')
      expect(cache.match).toHaveBeenCalledWith('/offline.html')
      expect(jest.mocked(self.caches.open)).toHaveBeenCalledTimes(1)
    })

    it('should return an error response when the page was never cached', async () => {
      const { exports } = loadWorker()

      expect((await exports.offlineFallback()).type).toEqual('error')
    })

    // AC-037. Safari private browsing rejects caches.open outright, and a rejection here must read the
    // same as a miss rather than escaping as an unhandled rejection.
    it('should treat blocked storage as a miss', async () => {
      const { exports, self } = loadWorker()
      jest.mocked(self.caches.open).mockRejectedValueOnce(new Error('storage blocked'))

      expect((await exports.offlineFallback()).type).toEqual('error')
    })
  })

  describe('install', () => {
    it('should cache the offline page from the network and take over immediately', async () => {
      const { cache, listeners, self } = loadWorker()
      const event = lifecycleEvent()

      listeners.install(event)
      await Promise.all(event.pending)

      // `cache: 'reload'` so a previous deploy's copy in the HTTP cache cannot survive the rebuild.
      expect(cache.add).toHaveBeenCalledWith(
        expect.objectContaining({ init: { cache: 'reload' }, url: '/offline.html' }),
      )
      expect(jest.mocked(self.skipWaiting)).toHaveBeenCalled()
    })

    // AC-037. A worker stuck in `installing` never reaches `activate`, so a rejection here would cost
    // far more than the offline page it failed to store.
    it('should still take over when storage is blocked', async () => {
      const { listeners, self } = loadWorker()
      jest.mocked(self.caches.open).mockRejectedValueOnce(new Error('storage blocked'))
      const event = lifecycleEvent()

      listeners.install(event)
      await Promise.all(event.pending)

      expect(jest.mocked(self.skipWaiting)).toHaveBeenCalled()
    })
    // The suite already covers `caches.open` rejecting. This covers `cache.add` rejecting, which is
    // the case that actually bites: installing while flaky-offline fails the fetch, and if that
    // await ever moved outside the try, the install waitUntil would reject, the browser would
    // discard the worker, and it would never reach `activate`. Without this test that mutation
    // leaves the suite green.
    it('should still take over when the offline page cannot be fetched', async () => {
      const { cache, listeners, self } = loadWorker()
      const event = lifecycleEvent()
      jest.mocked(cache.add).mockRejectedValueOnce(new Error('offline'))

      listeners.install(event)

      await expect(Promise.all(event.pending)).resolves.toBeDefined()
      expect(jest.mocked(self.skipWaiting)).toHaveBeenCalledTimes(1)
    })
  })

  describe('activate', () => {
    it('should delete every cache except the one it installed into, then claim', async () => {
      const { listeners, self } = loadWorker()
      const install = lifecycleEvent()
      listeners.install(install)
      await Promise.all(install.pending)
      // Read the kept name from the install rather than restating it, so a rename cannot leave this
      // asserting that activate preserves a cache nothing writes to.
      const [[keptCache]] = jest.mocked(self.caches.open).mock.calls
      jest.mocked(self.caches.keys).mockResolvedValueOnce([keptCache, 'pick-a-time-offline-v0'])
      const event = lifecycleEvent()

      listeners.activate(event)
      await Promise.all(event.pending)

      expect(jest.mocked(self.caches.delete).mock.calls).toEqual([['pick-a-time-offline-v0']])
      expect(jest.mocked(self.clients.claim)).toHaveBeenCalled()
    })

    // AC-037 again, and the reason it matters here: without the claim no open page ever reloads, so a
    // page rendered by the previous build keeps asking for hashed chunks the deploy has removed.
    it('should claim its clients even when the cache listing is unavailable', async () => {
      const { listeners, self } = loadWorker()
      jest.mocked(self.caches.keys).mockRejectedValueOnce(new Error('storage blocked'))
      const event = lifecycleEvent()

      listeners.activate(event)
      await Promise.all(event.pending)

      expect(jest.mocked(self.clients.claim)).toHaveBeenCalled()
    })
  })
})
