import { Button, Skeleton } from '@heroui/react'
import { Eye, MousePointerClick, Pencil } from 'lucide-react'
import React, { useEffect, useState } from 'react'

export const VotingContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 p-4">{children}</div>
)

export const TournamentHeader = ({
  matchCurrent,
  matchTotal,
  onNameSave,
  playerName,
  roundCurrent,
  roundTotal,
}: {
  matchCurrent: number
  matchTotal: number
  onNameSave: (name: string) => void
  playerName: string
  roundCurrent: number
  roundTotal: number
}): React.ReactNode => {
  const roundPct = Math.round((roundCurrent / roundTotal) * 100)
  const labelClass = 'text-[8px] font-bold uppercase tracking-[0.2em] text-[#374151]'
  return (
    <div className="w-full overflow-hidden rounded-[18px] border border-white/[0.06] bg-white/[0.02]">
      <div className="flex flex-col">
        {/* Round + Match: always a side-by-side row */}
        <div className="flex divide-x divide-white/[0.06]">
          <div className="flex flex-1 flex-col items-center gap-0.5 py-3 md:py-4">
            <span className={labelClass}>Round</span>
            <div className="choosee-brand whitespace-nowrap text-[38px] leading-none text-[#F5F5F5] md:text-[52px]">
              {roundCurrent}
              <span className="text-[16px] text-[#374151] md:text-[22px]"> / {roundTotal}</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 py-3 md:py-4">
            <span className={labelClass}>Match</span>
            <div className="choosee-brand whitespace-nowrap text-[38px] leading-none text-[#F5F5F5] md:text-[52px]">
              {matchCurrent}
              <span className="text-[16px] text-[#374151] md:text-[22px]"> / {matchTotal}</span>
            </div>
          </div>
          {/* Voting As: third column on desktop only */}
          <div className="hidden flex-1 flex-col items-center py-4 md:flex">
            <span className={labelClass}>Voting As</span>
            <div className="flex flex-1 items-center">
              <InlineNameEditor name={playerName} onSave={onNameSave} />
            </div>
          </div>
        </div>
        {/* Voting As: second row on mobile only */}
        <div className="flex border-t border-white/[0.06] px-4 py-2.5 md:hidden">
          <div className="flex flex-col gap-0.5">
            <span className={labelClass}>Voting As</span>
            <InlineNameEditor name={playerName} onSave={onNameSave} />
          </div>
        </div>
      </div>
      <div className="h-1.5 w-full bg-white/[0.06]">
        <div className="h-full bg-[#F59E0B] transition-all duration-700" style={{ width: `${roundPct}%` }} />
      </div>
    </div>
  )
}

export const MatchupContainer = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => (
  <div className="relative w-full scroll-mt-16 p-2" ref={ref}>
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-[rgba(245,158,11,0.2)]"
    />
    <span
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-[rgba(245,158,11,0.2)]"
    />
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-[rgba(245,158,11,0.2)]"
    />
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-[rgba(245,158,11,0.2)]"
    />
    <div className="grid w-full grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_72px_1fr]">{children}</div>
  </div>
))
MatchupContainer.displayName = 'MatchupContainer'

export const VsLabel = (): React.ReactNode => (
  <div className="flex items-center justify-center py-1 md:flex-col md:py-0">
    <span
      className="choosee-brand select-none text-[48px] text-[rgba(245,158,11,0.25)]"
      style={{ textShadow: '0 0 24px rgba(245,158,11,0.12)' }}
    >
      VS
    </span>
  </div>
)

export const VoteCallToAction = (): React.ReactNode => {
  const [verb, setVerb] = useState<string | null>(null)

  useEffect(() => {
    setVerb(window.matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click')
  }, [])

  return (
    <div className="flex w-full items-center justify-center gap-3">
      <div className="h-px flex-1 bg-white/[0.04]" />
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#374151]">
        <MousePointerClick className="h-3.5 w-3.5" />
        {verb ? <span>{verb} a card to vote</span> : <Skeleton className="h-3 w-28 rounded-sm" />}
      </div>
      <div className="h-px flex-1 bg-white/[0.04]" />
    </div>
  )
}

export const ActionRow = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="flex items-center justify-center gap-3">{children}</div>
)

export const BracketButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button
    className="rounded-full border-white/[0.15] bg-white/[0.07] text-[#E5E7EB] hover:bg-white/[0.12]"
    onPress={onPress}
    variant="outline"
  >
    <Eye className="h-4 w-4" />
    View bracket
  </Button>
)

export const InlineNameEditor = ({
  name,
  onSave,
}: {
  name: string
  onSave: (newName: string) => void
}): React.ReactNode => {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  useEffect(() => {
    if (!editing) setValue(name)
  }, [name, editing])

  const commit = (): void => {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed) {
      onSave(trimmed)
    } else {
      setValue(name)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="choosee-brand rounded border border-[rgba(245,158,11,0.3)] bg-transparent px-2 py-1 text-[22px] font-bold text-[#F5F5F5] outline-none focus:border-[#F59E0B]"
        onBlur={commit}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setValue(name)
            setEditing(false)
          }
        }}
        value={value}
      />
    )
  }

  return (
    <button
      className="flex cursor-pointer items-center gap-2 hover:text-[#F59E0B]"
      onClick={() => {
        setValue(name)
        setEditing(true)
      }}
      type="button"
    >
      <span className="choosee-brand text-[32px] leading-none text-[#F5F5F5]">{name}</span>
      <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-[#374151]" />
    </button>
  )
}
