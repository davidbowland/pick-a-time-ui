import { Button, Spinner } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import React from 'react'

export const PillButton = ({
  isDisabled = false,
  isLoading = false,
  label,
  loadingLabel,
  onPress,
  variant = 'primary',
}: {
  isDisabled?: boolean
  isLoading?: boolean
  label: string
  loadingLabel?: string
  onPress: () => void
  variant?: 'primary' | 'ghost'
}): React.ReactNode => {
  const isPrimary = variant === 'primary'

  const skin = isPrimary
    ? 'bg-[var(--accent)] text-[var(--ink)] hover:opacity-90'
    : 'border border-[var(--hair)] bg-[var(--bone)]/[0.06] text-[var(--bone)] hover:bg-[var(--bone)]/[0.1]'

  return (
    <Button
      className={`flex w-full items-center justify-between rounded-full pl-5 pr-[7px] text-[13px] font-bold disabled:opacity-40 ${skin}`}
      data-variant={variant}
      isDisabled={isDisabled || isLoading}
      onPress={onPress}
      variant={isPrimary ? 'primary' : 'outline'}
    >
      <span>{isLoading ? (loadingLabel ?? label) : label}</span>
      {isLoading ? (
        <Spinner color="current" size="sm" />
      ) : (
        <div aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.18]">
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </div>
      )}
    </Button>
  )
}
