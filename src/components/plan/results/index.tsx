import { keepPreviousData, useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { BestSlotBanner, EmptyBestSlot, ErrorState, ExceptionsList, LoadingState, ModeTabs, WeekNav } from './elements'
import { fetchOverlap, OverlapResponse } from '@services/api'
import { PlanData } from '@types'

export interface ResultsPhaseProps {
  sessionId: string
  plan: PlanData
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const hourLabelFull = (hour: number): string => {
  const hr = hour % 12 === 0 ? 12 : hour % 12
  return `${hr}:00 ${hour < 12 ? 'AM' : 'PM'}`
}

const ResultsPhase = ({ sessionId, plan }: ResultsPhaseProps): React.ReactNode => {
  const [mode, setMode] = useState<'pattern' | 'week'>('pattern')
  const [week, setWeek] = useState(0)

  const { data, isLoading, isFetching, isError, refetch } = useQuery<OverlapResponse>({
    queryKey: ['overlap', sessionId, mode, mode === 'week' ? week : null],
    queryFn: () => fetchOverlap(sessionId, mode === 'pattern' ? 'pattern' : week),
    // Keep showing the previous mode's/week's data while the next one loads. Without this,
    // TanStack Query's `isLoading` is true on every new queryKey (every tab switch and every
    // week page), which would blank the whole panel — including WeekNav itself — to a spinner
    // on each click. With it, `isLoading` only stays true for the very first request (nothing
    // to fall back on yet); every later transition keeps rendering the previous data while
    // `isFetching` flips on in the background.
    placeholderData: keepPreviousData,
  })

  const handleModeChange = (next: 'pattern' | 'week'): void => {
    setMode(next)
    // Always land on the first week when entering the by-week view. Nothing here remembers
    // the last week you looked at across a pattern -> week -> pattern -> week round trip; that's
    // a deliberate simplification, not a bug, but worth a second look if this ever feels wrong.
    if (next === 'week') setWeek(0)
  }

  let content: React.ReactNode

  if (isLoading) {
    // Only the very first request for this session ever lands here — placeholderData means
    // every later tab switch or week page keeps rendering the prior content below instead.
    content = <LoadingState />
  } else if (isError || !data) {
    // The server is the only source of truth here — if the request fails, there is nothing
    // for this screen to render on its own. Show that plainly, with a way to try again, rather
    // than silently rendering nothing (a null return here would look like an empty session to
    // the user, not a failed request).
    content = <ErrorState onRetry={() => refetch()} />
  } else {
    // Defensive: the API contract promises `grid`/`bestSlot`, but don't let a genuinely empty
    // or not-yet-fully-robust response take the whole screen down with it.
    const bestSlot = data.grid?.bestSlot
    const dayName = bestSlot ? (DAY_NAMES[plan.weekdays[bestSlot.dayIndex]] ?? '—') : undefined
    const label = bestSlot ? `${dayName} ${hourLabelFull(plan.startHour + bestSlot.hourIndex)}` : ''

    content = (
      <div className="flex flex-col gap-4">
        {/* WeekNav (and the tabs above, which always render regardless of `content`) stay
            mounted and interactive here even while a subsequent fetch is in flight — only the
            fetching indicator below reflects that a refresh is happening. */}
        {mode === 'week' && <WeekNav onChange={setWeek} week={week} weekCount={plan.weekCount} />}
        {isFetching && (
          <div className="text-xs text-[#9CA3AF]" role="status">
            Updating&hellip;
          </div>
        )}
        {!bestSlot || bestSlot.freeCount === 0 ? (
          <EmptyBestSlot />
        ) : (
          <BestSlotBanner freeCount={bestSlot.freeCount} label={label} total={plan.participantCount} />
        )}
        <ExceptionsList exceptions={data.exceptions.map((exception) => exception.description)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ModeTabs mode={mode} onChange={handleModeChange}>
        {content}
      </ModeTabs>
    </div>
  )
}

export default ResultsPhase
