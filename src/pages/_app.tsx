import { ToastProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppProps } from 'next/app'
import localFont from 'next/font/local'
import React, { useEffect, useState } from 'react'

// Deliberately no `import '@config/amplify'` here. It was a static import from the app shell, which
// put the whole Cognito client (78 KB gzip) in every page's graph including the landing page -- the
// exact cost the lazy loader in @services/auth exists to avoid, and it would have survived every
// runtime guard silently. Amplify.configure now runs via that dynamic import, and the OAuth listener
// is registered by the callback page's own static import, which is the only route the ?code= can
// land on.
import '@assets/css/index.css'
import { AuthProvider } from '@components/auth-context'
import { installPromptStore } from '@hooks/useInstallPrompt'
import { useServiceWorker } from '@hooks/useServiceWorker'
import { runRecentPollsMigration } from '@utils/recent-polls-migration'

// These two faces used to arrive as Fontsource side-effect imports, which put their @font-face rules
// inside the render-blocking stylesheet -- so the browser could not discover the woff2 files until
// that CSS had downloaded and parsed, a fully serial extra round trip. next/font emits
// `<link rel="preload" as="font">` into the prerendered HTML instead, so they download in parallel.
//
// `fallback` is not optional. next/font's style.fontFamily is `<face>, <adjusted-fallback>`, where
// the adjusted fallback is a local("Times New Roman"/"Arial") face carrying size-adjust metrics --
// and no trailing generic. Without these arrays a machine with neither font installed would fall
// through to the browser default instead of serif/sans-serif, which is what index.css declared
// before this moved.
const fraunces = localFont({
  adjustFontFallback: 'Times New Roman',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  preload: true,
  src: '../assets/fonts/fraunces-latin-wght-normal.woff2',
  weight: '100 900',
})

const plusJakartaSans = localFont({
  adjustFontFallback: 'Arial',
  display: 'swap',
  fallback: ['Helvetica', 'sans-serif'],
  preload: true,
  src: '../assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  weight: '200 800',
})

export default function App({ Component, pageProps }: AppProps) {
  // Chromium fires `beforeinstallprompt` once, early, and the event cannot be replayed or asked for
  // again (AC-035). This runs in the render body, not from an effect: effects run after the first
  // paint, and mounting `useInstallPrompt` -- which starts the store from its own effect -- in the
  // component that renders the offer is later still, by which point the event has fired and been
  // discarded. `start` is idempotent and no-ops without a `window`, so re-renders and the static
  // export's prerender both cost nothing.
  installPromptStore.start()

  // Registers /sw.js in production and actively unregisters an existing worker under `next dev`
  // (AC-005, AC-006). Every failure mode is swallowed inside the hook; nothing surfaces here.
  useServiceWorker()

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  // Sweeps the legacy `pat_onboarded_*` keys (AC-029). Nothing else calls it. It records its own
  // done flag inside `pat_recent_polls`, so every load after the first is a no-op -- the empty
  // dependency list keeps it to one call per load, and the flag keeps it to one sweep per device.
  // In an effect rather than in render because it reads localStorage, which the static export's
  // prerender does not have.
  useEffect(() => {
    runRecentPollsMigration()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {/* At :root, not on the wrapper div below: HeroUI's ToastProvider portals outside that
          wrapper and would otherwise render in the browser default font. next/font's own
          `variable:` option cannot do this -- it defines the variable inside a generated class that
          has to be attached to an element, and the only element high enough is <html>, which _app
          cannot reach in the Pages Router. */}
      <style global jsx>{`
        :root {
          --font-display: ${fraunces.style.fontFamily};
          --font-body: ${plusJakartaSans.style.fontFamily};
        }
      `}</style>
      <AuthProvider>
        <div className="relative min-h-[100dvh] bg-[var(--ink)] text-foreground">
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-40 right-[-12%] h-[38rem] w-[38rem] rounded-full bg-[var(--accent)]/[0.09] blur-[140px]" />
            <div className="absolute bottom-[-18%] left-[-12%] h-[32rem] w-[32rem] rounded-full bg-[var(--accent-soft)]/[0.06] blur-[140px]" />
          </div>
          <div className="relative z-10">
            <Component {...pageProps} />
          </div>
        </div>
      </AuthProvider>
      <ToastProvider placement="bottom" />
    </QueryClientProvider>
  )
}
