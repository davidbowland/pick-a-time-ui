import { Button } from '@heroui/react'
import { Eye, Trophy } from 'lucide-react'
import React from 'react'

import { PillArrowButton } from '@components/pill-arrow-button'

export const WinnerContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 p-4">{children}</div>
)

export const WinnerLoading = (): React.ReactNode => (
  <div className="flex flex-col items-center gap-4 p-8">
    <div className="relative h-12 w-12">
      <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/[0.06] border-t-[#F59E0B]" />
    </div>
    <p className="text-[#4B5563]">Revealing the winner…</p>
  </div>
)

export const WinnerTitle = (): React.ReactNode => (
  <div className="flex flex-col items-center gap-3">
    <div className="animate-bounce">
      <Trophy className="h-14 w-14 text-[#F59E0B]" />
    </div>
    <h2
      className="choosee-brand text-[clamp(64px,10vw,96px)] leading-none tracking-[0.06em] text-[#F59E0B]"
      style={{ textShadow: '0 0 40px rgba(245,158,11,0.35)' }}
    >
      WINNER
    </h2>
  </div>
)

export const NewSessionButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <PillArrowButton label="Start over" onPress={onPress} />
)

export const BracketButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button
    className="rounded-full border-white/[0.09] bg-white/[0.05] text-[#6B7280] hover:bg-white/[0.09]"
    onPress={onPress}
    variant="outline"
  >
    <Eye className="h-4 w-4" />
    View final bracket
  </Button>
)
