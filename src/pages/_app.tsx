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
