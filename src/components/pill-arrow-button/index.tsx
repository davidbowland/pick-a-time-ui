import { Button, Spinner } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import React from 'react'

export const PillArrowButton = ({
  isDisabled = false,
  isLoading = false,
  label,
  loadingLabel,
  onPress,
}: {
  isDisabled?: boolean
  isLoading?: boolean
  label: string
  loadingLabel?: string
  onPress: () => void
}): React.ReactNode => (
  <Button
    className="flex w-full items-center justify-between rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] pl-5 pr-[7px] text-[13px] font-bold text-[#0A0A0B] hover:opacity-90 disabled:opacity-40"
    isDisabled={isDisabled || isLoading}
    onPress={onPress}
    variant="primary"
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
