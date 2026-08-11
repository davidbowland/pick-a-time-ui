import { useEffect } from 'react'

// Nothing here ever touches `navigator.serviceWorker.ready`: in a Firefox private window that promise
// never settles, so awaiting it would park a pending promise for the life of the tab. The two waits
// that do exist are raced against this budget, because `register()` in that same window can hang
// rather than reject (AC-037). Timing out does not cancel the registration — the browser carries on
// with it — it only stops us waiting on an answer that may never come.
const REGISTRATION_TIMEOUT_MS = 10_000

const SCRIPT_URL = '/sw.js'

type Delay = (milliseconds: number) => Promise<void>

// `navigator.serviceWorker` is a GETTER, and in Firefox with cookies or site data blocked -- and
// inside a sandboxed iframe -- reading it throws SecurityError rather than returning undefined.
// This runs as a default parameter, so it evaluates outside registerServiceWorker's try and would
// reject the promise the hook does not await. That is an unhandled rejection on every single load
// in exactly the browser AC-005 exists for, and a test that stubs the container as `undefined`
// cannot see it.
const resolveContainer = (): ServiceWorkerContainer | undefined => {
  /* istanbul ignore next -- SSR guard: `navigator` is always defined under jsdom */
  if (typeof navigator === 'undefined') return undefined
  try {
    return navigator.serviceWorker
  } catch {
    return undefined
  }
}

/* istanbul ignore next -- the real page reload cannot run inside jsdom */
const reloadWindow = (): void => window.location.reload()

/* istanbul ignore next -- a ten-second wall-clock wait cannot run inside a test */
const wait: Delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

// Resolves to `undefined` if `work` has not settled in time. The caller treats that exactly like a
// failed registration, which is the honest reading: we do not know the outcome.
const withTimeout = async <T>(work: Promise<T>, delay: Delay): Promise<T | undefined> => {
  // The loser of a Promise.race keeps running. Without settling the work first, a ten-second timer
  // outlives every registration and keeps a handle alive -- harmless in a browser, but it is what
  // leaves uncancelled timers behind in a test run.
  const settled = work.then((value) => ({ value }))
  const timedOut = delay(REGISTRATION_TIMEOUT_MS).then(() => undefined)
  const result = await Promise.race([settled, timedOut])
  return result?.value
}

// Development gets an ACTIVE removal, not merely a skipped registration (AC-038). A worker installed
// by a production build keeps serving that build's hashed chunks on localhost, and `next dev` rewrites
// `/_next/static/*` in place rather than content-hashing it, so the cached and the live copy share a
// URL. connections-ui reached an endless reload loop this way (commit 0a1efb7) and only unregistering
// got them out of it.
const unregisterAll = async (swContainer: ServiceWorkerContainer, delay: Delay): Promise<void> => {
  try {
    const registrations = await withTimeout(swContainer.getRegistrations(), delay)
    await withTimeout(Promise.all((registrations ?? []).map((registration) => registration.unregister())), delay)
  } catch {
    // Nothing was registered, or the browser refuses to say. Either way development proceeds with no
    // worker, which is the outcome this function exists to produce.
  }
}

// The worker calls skipWaiting and then clients.claim, so a new build can take control of a page the
// previous build rendered. That page holds its route chunks by content hash and the deploy has already
// removed them from the origin, so the first not-yet-loaded route would 404. Reloading retires those
// URLs along with the page holding them (AC-007).
//
// `wasControlled` is captured by the caller BEFORE register() and is the whole safety property:
//
//  · On a first-ever visit the page is uncontrolled. The worker installs, calls skipWaiting and
//    claims, and `controllerchange` fires — but nothing on screen came from a worker, so there is no
//    stale URL to escape and a reload would discard a page that had just finished loading.
//  · After the kill switch ships, an uncontrolled load that reloaded would go register → claim →
//    controllerchange → reload → unregister → register, forever. A "reload only once" flag cannot stop
//    that: each iteration is a separate page load and the flag is reborn with it. Only refusing to
//    reload a load that began uncontrolled does.
const reloadOnTakeover = (swContainer: ServiceWorkerContainer, wasControlled: boolean, reload: () => void): void => {
  if (!wasControlled) {
    return
  }
  // `once` rather than a mutable flag: Chrome can fire controllerchange more than once, and a second
  // reload would interrupt the first one landing.
  swContainer.addEventListener('controllerchange', () => reload(), { once: true })
}

export const registerServiceWorker = async (
  swContainer: ServiceWorkerContainer | undefined = resolveContainer(),
  scriptUrl: string = SCRIPT_URL,
  isProduction: boolean = process.env.NODE_ENV === 'production',
  reload: () => void = reloadWindow,
  delay: Delay = wait,
): Promise<ServiceWorkerRegistration | undefined> => {
  // Absent on http:// origins and in some private windows. The app renders normally without it (AC-005).
  if (!swContainer) {
    return undefined
  }
  if (!isProduction) {
    await unregisterAll(swContainer, delay)
    return undefined
  }
  // Read BEFORE register(), because register() itself can make a worker the controller. See
  // reloadOnTakeover for what reading it afterwards costs.
  const wasControlled = Boolean(swContainer.controller)
  // Subscribed BEFORE register(), not after: a worker can install and claim while that promise is
  // still settling, and a listener added afterwards misses the takeover it exists to catch.
  reloadOnTakeover(swContainer, wasControlled, reload)
  try {
    return await withTimeout(swContainer.register(scriptUrl), delay)
  } catch {
    // register() throws outright in a Firefox private window. A failed registration must not break the
    // app: the site keeps working exactly as it did before any of this existed, minus the offline page.
    return undefined
  }
}

// `isProduction` is injectable for the same reason it is on registerServiceWorker: without it the
// guard's own branch is unreachable under jsdom, and a test asserting "does not register outside
// production" would pass even with the guard deleted.
export const useServiceWorker = (
  isProduction: boolean = process.env.NODE_ENV === 'production',
  reload: () => void = reloadWindow,
  delay: Delay = wait,
): void => {
  useEffect(() => {
    // Caught, not floated. Everything inside registerServiceWorker is already guarded, but a
    // default parameter evaluates before any of that, so this is the only place a rejection from
    // resolveContainer could surface -- as an unhandled rejection, on every load.
    registerServiceWorker(undefined, SCRIPT_URL, isProduction, reload, delay).catch(() => undefined)
  }, [delay, isProduction, reload])
}
