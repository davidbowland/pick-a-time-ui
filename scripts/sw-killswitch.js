/*
 * Emergency service worker kill switch.
 *
 *   cp scripts/sw-killswitch.js scripts/sw-src.js
 *   git rm -f test/scripts/sw-src.test.ts
 *   git commit -am "Kill the service worker" && git push origin master
 *
 * The `git rm` is not tidiness, it is the difference between a lever that works and one that jams.
 * Both deploy jobs are `needs: [test]`, and test/scripts/sw-src.test.ts evaluates scripts/sw-src.js
 * and reads its `__swTestExports` seam. This file deliberately has no seam and no fetch handler, so
 * the moment it is copied over sw-src.js that suite fails, the test job fails, and NEITHER deploy
 * job runs — the emergency procedure would refuse to ship the emergency fix, discovered mid-incident.
 * Delete the test in the same commit; it comes back with the real worker.
 *
 * It must go through the pipeline. `npm run deploy` builds and syncs the TEST stack
 * (scripts/deploy.sh deploys pick-a-time-ui-test and copies to the pick-a-time-ui-test bucket), so
 * running it during a production incident changes nothing on pick-a-time.com. Only the master
 * pipeline touches production, and both of its deploy jobs pass the CloudFront distribution ID to
 * copyToS3.sh — which is what invalidates /sw.js so browsers actually fetch this file.
 *
 * This worker registers no fetch handler, deletes every cache, and then unregisters itself, so the
 * site goes back to behaving as a plain static site. Restore with
 * `git revert <sha>` once the real fix is ready — the kill switch was committed, so HEAD is
 * already this file and `git checkout --` would restore nothing.
 *
 * Why a replacement file rather than "just unregister in the app": a browser that already holds a
 * broken worker runs THAT worker on the next visit, including the visit that would have fixed it.
 * The only remote lever is a different byte sequence at this same URL, which is why ADR-2 put the
 * invalidation path in place before anything registered a worker at all.
 */

const deleteAllCaches = async () => {
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch {
    // Guarded because `caches` is not reliably there: Safari private browsing rejects caches.open
    // outright, and site data can be blocked entirely. Either way there is nothing left to clear,
    // and a rejection here would abort install and leave the broken worker in place — the one
    // outcome this file exists to prevent.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(deleteAllCaches())
  // skipWaiting is load-bearing, not tidiness. A new worker is `waiting` until every tab of the
  // origin closes, so without this the kill switch would sit behind the very worker it replaces and
  // would NOT take effect on the visit that delivered it — which is the entire point.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Repeated on activate as well as install: a client still controlled by the previous worker
      // keeps that worker's caches reachable until this one takes over, and install ran before that
      // handover.
      await deleteAllCaches()

      // Deliberately NO self.clients.claim(). Claiming fires `controllerchange` in every open page,
      // and src/hooks/useServiceWorker.ts reloads on that event — the reload re-registers, this
      // worker claims again, and the page loops forever without the person ever seeing a working
      // site. Skipping the claim costs nothing here: this worker handles no fetches, so a tab still
      // controlled by the old worker is already going to the network for everything now that the
      // caches are gone, and the next navigation is uncontrolled anyway.
      await self.registration.unregister()
    })(),
  )
})
