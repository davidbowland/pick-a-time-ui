import { AlertDescription, AlertRoot } from '@heroui/react'
import Link from 'next/link'
import React from 'react'

export const ErrorContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="flex min-h-screen items-center justify-center p-4">{children}</div>
)

export const ErrorAlert = (): React.ReactNode => (
  <AlertRoot status="danger">
    <AlertDescription>
      Something went wrong — <Link href="/">go back to the home page</Link>.
    </AlertDescription>
  </AlertRoot>
)
