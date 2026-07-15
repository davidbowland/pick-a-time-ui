import '@fontsource-variable/fraunces'
import '@fontsource-variable/plus-jakarta-sans'
import { ToastProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppProps } from 'next/app'
import React, { useEffect, useState } from 'react'

import '@assets/css/index.css'
import { AuthProvider } from '@components/auth-context'
import '@config/amplify'

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
