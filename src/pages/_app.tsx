import '@fontsource-variable/outfit'
import '@fontsource/bebas-neue'
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
        <div className="relative min-h-[100dvh] bg-[#0A0A0B] text-foreground">
          {/* Fixed ambient gradient orbs — Arena background */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div
              className="absolute rounded-full"
              style={{
                top: '-220px',
                left: '-80px',
                width: '560px',
                height: '560px',
                background: 'radial-gradient(circle, rgba(245,158,11,0.13) 0%, transparent 70%)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                bottom: '-80px',
                right: '-160px',
                width: '480px',
                height: '480px',
                background: 'radial-gradient(circle, rgba(234,88,12,0.09) 0%, transparent 70%)',
              }}
            />
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
