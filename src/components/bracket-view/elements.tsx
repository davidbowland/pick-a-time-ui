import { Drawer } from '@heroui/react'
import React from 'react'

export const BracketDrawer = ({
  children,
  onClose,
  open,
}: {
  children: React.ReactNode
  onClose: () => void
  open: boolean
}): React.ReactNode => (
  <Drawer.Backdrop isOpen={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()} variant="blur">
    <Drawer.Content placement="right">
      <Drawer.Dialog>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading className="choosee-brand pr-8 text-2xl text-[#F59E0B]">The Bracket</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          <div className="min-h-full overflow-auto" style={{ touchAction: 'manipulation' }}>
            <div className="inline-flex min-w-max gap-6">{children}</div>
          </div>
        </Drawer.Body>
      </Drawer.Dialog>
    </Drawer.Content>
  </Drawer.Backdrop>
)

export const RoundColumn = ({
  children,
  roundNumber,
}: {
  children: React.ReactNode
  roundNumber: number
}): React.ReactNode => (
  <div className="flex min-w-[200px] flex-col gap-4">
    <h3 className="choosee-brand text-lg tracking-wider text-[#374151]">Round {roundNumber}</h3>
    {children}
  </div>
)

export const MatchupCard = ({
  nameA,
  nameB,
  winnerSlot,
}: {
  nameA: string
  nameB: string
  winnerSlot: 'a' | 'b' | null
}): React.ReactNode => (
  <div className="relative overflow-visible rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-sm">
    <div
      className={`rounded-t-xl border-b border-white/[0.06] px-3 pb-4 pt-2.5 text-sm font-medium transition-colors ${
        winnerSlot === 'a' ? 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]' : 'text-[#D4D4D4]'
      }`}
    >
      {winnerSlot === 'a' && <span className="mr-1.5 text-[#F59E0B]">▶</span>}
      {nameA}
    </div>
    <div
      className={`rounded-b-xl px-3 pb-2.5 pt-4 text-sm font-medium transition-colors ${
        winnerSlot === 'b' ? 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]' : 'text-[#D4D4D4]'
      }`}
    >
      {winnerSlot === 'b' && <span className="mr-1.5 text-[#F59E0B]">▶</span>}
      {nameB}
    </div>
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-[#0A0A0B] shadow-sm">
        <span className="choosee-brand text-xs text-[#374151]">VS</span>
      </div>
    </div>
  </div>
)

export const ByeCard = ({ name }: { name: string }): React.ReactNode => (
  <div className="rounded-xl border border-dashed border-white/[0.06] px-3 py-2.5 text-sm italic text-[#374151]">
    {name} — bye
  </div>
)
