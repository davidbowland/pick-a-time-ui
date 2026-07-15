import { AlertDescription, AlertRoot, Button, Spinner } from '@heroui/react'
import React from 'react'

import { RecommendedMeeting } from '@services/api'
import { PollData, User } from '@types'
import { formatShortDate } from '@utils/dates'
import { formatViewerSlotLabel } from '@utils/timezone'
import { displayName } from '@utils/users'

export function attendanceTag(freeCount: number, total: number): string {
  return freeCount === total ? "Everyone's free" : 'Best available'
}

export const BestSlotBanner = ({
  label,
  freeCount,
  total,
}: {
  label: string
  freeCount: number
  total: number
}): React.ReactNode => (
  <div className="flex items-center justify-between rounded-2xl bg-[var(--ink)] p-4 text-[var(--bone)]">
    <div>
      <div className="text-xs uppercase tracking-wide opacity-60">Best time</div>
      <div className="text-sm font-semibold">{label}</div>
    </div>
    <div className="text-right text-xs opacity-60">
      <div className="font-semibold text-[var(--bone)]">{attendanceTag(freeCount, total)}</div>
      <div>
        {freeCount} of {total} free
      </div>
    </div>
  </div>
)

export const EmptyBestSlot = (): React.ReactNode => (
  <div className="rounded-2xl bg-[var(--ink)] p-4 text-center text-sm text-[var(--bone)]/80">
    No overlap yet. Once everyone paints their availability, the best time will show up here.
  </div>
)

export const LoadingState = (): React.ReactNode => (
  <div className="flex items-center gap-3 p-4 text-sm text-[var(--slate)]" role="status">
    <Spinner size="sm" />
    <span>Loading everyone&rsquo;s availability&hellip;</span>
  </div>
)

export const ErrorState = ({ onRetry }: { onRetry: () => void }): React.ReactNode => (
  <div className="flex flex-col items-center gap-3 p-4 text-center" role="alert">
    <AlertRoot status="danger">
      <AlertDescription>Couldn&rsquo;t load the results. Check your connection and try again.</AlertDescription>
    </AlertRoot>
    <Button onPress={onRetry} variant="secondary">
      Try again
    </Button>
  </div>
)

export function formatMeetingLabel(
  poll: PollData,
  date: string | undefined,
  startMinute: number,
  endMinute: number,
  viewerTimezone: string = poll.timezone,
): string {
  if (!date) return '—'
  if (!poll.usesTimes) return formatShortDate(date)
  return `${formatShortDate(date)}, ${formatViewerSlotLabel(date, startMinute, endMinute, poll.timezone, viewerTimezone)}`
}

const nameFor = (users: User[], userId: string): string => {
  const user = users.find((u) => u.userId === userId)
  return displayName(user ?? { userId, name: null, calendarStatus: 'not_connected' })
}

export const SuggestedTimes = ({
  meetings,
  users,
  poll,
  viewerTimezone,
}: {
  meetings: RecommendedMeeting[]
  users: User[]
  poll: PollData
  viewerTimezone: string
}): React.ReactNode =>
  meetings.length === 0 ? null : (
    <section aria-labelledby="suggested-times-heading" className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]" id="suggested-times-heading">
        Suggested times
      </div>
      <ul className="flex flex-col gap-2">
        {meetings.map((meeting) => (
          <li
            className="flex flex-col gap-1 rounded-2xl bg-[var(--ink)] p-3 text-[var(--bone)]"
            key={`${meeting.dateIndex}-${meeting.slotIndex}`}
          >
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>
                {formatMeetingLabel(poll, meeting.date, meeting.startMinute, meeting.endMinute, viewerTimezone)}
              </span>
              <span className="text-xs font-normal opacity-60">
                {attendanceTag(meeting.freeCount, poll.participantCount)} · {meeting.freeCount} of{' '}
                {poll.participantCount} free
              </span>
            </div>
            {(meeting.excludedByCalendar ?? []).length > 0 && (
              <div className="flex flex-col gap-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Heads up</div>
                <ul className="flex flex-col gap-0.5 text-xs opacity-80">
                  {(meeting.excludedByCalendar ?? []).map((userId) => (
                    <li key={userId}>{nameFor(users, userId)}&rsquo;s calendar shows a conflict.</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
