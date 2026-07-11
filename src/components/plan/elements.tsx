import { AlertDescription, AlertRoot, Button, Spinner } from '@heroui/react'
import React from 'react'

export const LoadingState = (): React.ReactNode => (
  <div className="flex items-center justify-center gap-3 p-10 text-sm text-[#9CA3AF]" role="status">
    <Spinner size="sm" />
    <span>Loading your plan&hellip;</span>
  </div>
)

export const ErrorState = ({ onRetry }: { onRetry: () => void }): React.ReactNode => (
  <div className="flex flex-col items-center gap-3 p-10 text-center" role="alert">
    <AlertRoot status="danger">
      <AlertDescription>Couldn&rsquo;t load this plan. Check your connection and try again.</AlertDescription>
    </AlertRoot>
    <Button onPress={onRetry} variant="secondary">
      Try again
    </Button>
  </div>
)
