import { Head, Html, Main, NextScript } from 'next/document'
import React from 'react'

// One inline block, not two. D-8 rejected an inline script for service-worker registration partly
// because this file already carries one `dangerouslySetInnerHTML` block that any future CSP has to
// accommodate; adding a second would compound exactly that. The composition selector is merged in
// here instead.
//
// What it does and, as importantly, what it does not:
//   * It sets a BOOLEAN — "at least one unexpired recents entry" — on `documentElement.dataset`.
//     Never a count. A count would be a second implementation of the prune predicate that has to
//     agree numerically with `useRecentPolls.prunePolls`, and two copies of an expiry rule drifting
//     apart is the failure ADR-3 and ADR-4 exist to prevent. A boolean can only be wrong about
//     whether the list is empty, which the React tree corrects on its own render.
//   * It never writes a CSS custom property from stored data. Custom property values are not
//     sanitized, and a `url(...)` smuggled into one is a live fetch this origin has no CSP to stop.
//   * It writes no DOM and adds no elements, so there is nothing for React to mismatch on hydrate.
//   * `expiration` is epoch SECONDS (the server's own `PollData.expiration`), so it is compared
//     against `Date.now() / 1000` worth of milliseconds by multiplying, never by dividing `now`.
//   * The whole body is wrapped in try/catch. Reading `window.localStorage` itself throws in Safari
//     private browsing, so even the property access is inside the guard (AC-018). On any throw the
//     attribute is simply absent and the page renders the seven-scene story (AC-043).
const PRE_PAINT_SCRIPT = `
document.documentElement.classList.add('dark');
try {
  var raw = window.localStorage.getItem('pat_recent_polls');
  var parsed = raw ? JSON.parse(raw) : null;
  var polls = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.polls) ? parsed.polls : []);
  var nowMs = Date.now();
  var hasRecentPolls = polls.some(function (poll) {
    return poll && typeof poll.expiration === 'number' && poll.expiration * 1000 > nowMs;
  });
  if (hasRecentPolls) {
    document.documentElement.dataset.recentPolls = 'true';
  } else {
    delete document.documentElement.dataset.recentPolls;
  }
} catch (error) {}
`.trim()

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/favicon.ico" rel="icon" sizes="any" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <link href="/site.webmanifest" rel="manifest" />
        <meta content="#17171a" name="theme-color" />
        {/* Absent until now, which made every `env(safe-area-inset-*)` in the app resolve to 0 —
            `viewport-fit=cover` is what gives those values anything to report (AC-027). It lives
            here rather than in a page's `next/head` because it has to apply to every surface,
            including `/p/{sessionId}` and the installed app's own chrome-less window.
            Next logs a development-only warning about viewport tags in `_document`; this tag is
            emitted after `next/head`'s default `width=device-width`, so it is the one that wins. */}
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
      </Head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: PRE_PAINT_SCRIPT,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
