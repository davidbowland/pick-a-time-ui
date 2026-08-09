import '@fontsource-variable/fraunces'
import '@fontsource-variable/plus-jakarta-sans'
import { ToastProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppProps } from 'next/app'
import React, { useEffect, useState } from 'react'

// Deliberately no `import '@config/amplify'` here. It was a static import from the app shell, which
// put the whole Cognito client (78 KB gzip) in every page's graph including the landing page -- the
// exact cost the lazy loader in @services/auth exists to avoid, and it would have survived every
// runtime guard silently. Amplify.configure now runs via that dynamic import, and the OAuth listener
// is registered by the callback page's own static import, which is the only route the ?code= can
// land on.
import '@assets/css/index.css'
import { AuthProvider } from '@components/auth-context'

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
