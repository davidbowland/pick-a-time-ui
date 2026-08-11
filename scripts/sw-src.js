/*
 * Pick a Time service worker: one offline page, nothing else.
 *
 * SOURCE FILE — `scripts/build-sw.js` copies this to `out/sw.js` during postbuild. There is
 * deliberately no `public/sw.js`: the served worker is a build output, not a checked-in asset,
 * which keeps the kill-switch procedure (see sw-killswitch.js) a one-file swap.
 *
 * This caches exactly ONE page (ADR-1). Pick a Time is entirely live data — `/` fetches its config,
 * a poll page drops to its error phase the moment the API is unreachable, and React Query persists
 * nothing — so a precached app shell would buy a *faster path to an error screen* and bring every
 * stale-build bug with it. One honest offline page beats our own chrome wrapped around a broken one.
 */

const CACHE_NAME = 'pick-a-time-offline-v1'
const OFFLINE_URL = '/offline.html'

// The web manifest. Gecko fetches it from an idle callback with no error handling and discards it
// entirely on any non-2xx, so a worker that answered it could silently downgrade an install offer to
// a bookmark (AC-036). It is not a navigation, so the mode check below already excludes it; this
// constant and the check that uses it exist so that stays true if the mode check is ever loosened.
const MANIFEST_PATH = '/site.webmanifest'

// Routes whose meaning lives in the query string, not the path: `/auth/callback/?code=&state=`
// completes the OAuth exchange, `/calendar-connected/?status=` reports its outcome. Substituting any
// cached HTML for these loses the exchange (AC-004). Stored without a trailing slash because
// `normalizePath` strips one — `next.config.mjs` sets `trailingSlash: true`, so the app links to
// `/auth/callback/` while a hand-typed or provider-issued URL may arrive without the slash, and both
// forms must be recognised.
const PASSTHROUGH_PATHS = ['/auth/callback', '/calendar-connected']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        // `cache: 'reload'` so the offline page comes from the network rather than the HTTP cache,
        // which would otherwise let a previous deploy's copy survive a rebuild.
        await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      } catch {
        // Storage is unavailable — `caches.open` rejects outright in Safari private browsing — or
        // the page could not be fetched. Activate anyway: losing the offline page is acceptable,
        // failing to activate is not, because a worker stuck in `installing` never reaches the
        // `activate` handler that cleans up after the previous one (AC-037).
      }
    })(),
  )
  // A new worker is `waiting` until every tab of the origin closes. Without this the fix ships and
  // does not take effect on the visit that delivered it.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      } catch {
        // Nothing to clean up, or no storage. Take over regardless.
      }
      // Claiming fires `controllerchange`, which src/hooks/useServiceWorker.ts turns into exactly one
      // reload — that is how a page rendered by the previous build stops asking for hashed chunks the
      // deploy has already deleted (AC-007).
      //
      // Caught for the same reason the cache calls above are: this is inside the `activate`
      // waitUntil, so an unhandled rejection here surfaces as an unhandled rejection on the worker
      // rather than anything useful. Failing to claim costs one deploy's staleness; throwing costs
      // a confusing log with no actor.
      try {
        await self.clients.claim()
      } catch {
        // Nothing to do. The next navigation gets the new worker regardless.
      }
    })(),
  )
})

// Resolve a URL to its path with any trailing slash removed, so `/auth/callback/` and
// `/auth/callback` are the same route. Returns '' for a URL that cannot be parsed, which matches
// nothing and therefore fails towards handling the request normally rather than towards excluding
// it — never the other way round, since an unparseable URL must not silently become a passthrough.
const normalizePath = (url) => {
  try {
    return new URL(url, self.location.origin).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return ''
  }
}

const isSameOrigin = (url) => {
  try {
    return new URL(url, self.location.origin).origin === self.location.origin
  } catch {
    return false
  }
}

/*
 * The whole decision. False means the worker calls no `respondWith` at all and the request reaches
 * the network exactly as the browser built it — headers, credentials, and all (AC-002).
 *
 * Order matters and each step is load-bearing:
 *
 *  1. Navigations only. Everything else — every cross-origin call to the API with its bearer token,
 *     the reCAPTCHA script from www.google.com, every `/_next/*` asset — leaves here untouched. This
 *     is also what makes AC-003 true by construction: nothing but the offline page is ever stored,
 *     because the only response this worker ever puts in a cache is the one it adds on install.
 *  2. Same origin only — defence in depth, not a live requirement. A navigation is matched against
 *     the TARGET url's registration scope, so a jump away to an OAuth consent screen never reaches
 *     this worker in the first place. The guard costs nothing and means a future scope change
 *     cannot quietly make us answer for another site's outage. Stated plainly because a guard
 *     justified by a wrong reason is one somebody deletes on the strength of a right one.
 *  3. Not the manifest (AC-036).
 *  4. Not a query-string-critical route (AC-004).
 */
const shouldHandle = (request) => {
  if (request.method !== 'GET' || request.mode !== 'navigate') {
    return false
  }
  if (!isSameOrigin(request.url)) {
    return false
  }
  if (request.destination === 'manifest') {
    return false
  }
  const path = normalizePath(request.url)
  return path !== MANIFEST_PATH && !PASSTHROUGH_PATHS.includes(path)
}

// The cached offline page, or an error response when there is nothing to serve. Never a redirect:
// the page's "Try again" button calls `location.reload()`, which only re-requests the page the
// visitor actually wanted while the URL is unchanged. `Response.redirect('/offline.html')` would
// move the address bar to the offline page, and every retry from then on would retry the offline
// page forever.
const offlineFallback = async () => {
  try {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(OFFLINE_URL)
    if (cached) {
      return cached
    }
  } catch {
    // `caches.open` rejects outright where site data is blocked (Safari private browsing). A
    // rejection reads the same as a miss (AC-037).
  }
  return Response.error()
}

// Network-first, and only network-first. A cache-first navigation would serve yesterday's HTML
// against today's hashed `_next` URLs, and nothing here ever writes a response to a cache.
const respondToNavigation = (request, fetchImpl) => fetchImpl(request).catch(offlineFallback)

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (!shouldHandle(request)) {
    return
  }
  event.respondWith(respondToNavigation(request, fetch))
})

// Test seam. `self.__swTestExports` is read by test/scripts/sw-src.test.ts, which evaluates this
// file in a VM; it is inert in a real ServiceWorkerGlobalScope.
self.__swTestExports = { isSameOrigin, normalizePath, offlineFallback, respondToNavigation, shouldHandle }
