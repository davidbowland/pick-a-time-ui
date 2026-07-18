import { AlertDescription, AlertRoot, Button, Spinner } from '@heroui/react'
import { Star } from 'lucide-react'
import React from 'react'

import { RecommendedMeeting } from '@services/api'
import { PollData, User } from '@types'
import { formatShortDate } from '@utils/dates'
import { formatViewerSlotLabel } from '@utils/timezone'
import { displayName } from '@utils/users'

export function attendanceTag(freeCount: number, total: number): string {
  return freeCount === total ? "Everyone's free" : 'Best available'
}

// There is no invite total to show against — the participant count only grows as people join —
// so this states the running count alone rather than an "N of M" that would need an unknowable M.
export const ParticipationStatus = ({ count }: { count: number }): React.ReactNode => (
  <p className="text-xs text-[var(--slate)]">
    {count <= 1
      ? 'Only you so far — the overlap fills in as others join.'
      : `${count} people so far — the overlap updates as more join.`}
  </p>
)

// The viewer always leads the list — reading your own name in the third person, 80px below the
// row that already names you, breaks the second-person voice the rest of the app keeps.
function missingUserIds(freeUserIds: string[], users: User[], viewerUserId?: string): string[] {
  const missing = users.map((u) => u.userId).filter((id) => !freeUserIds.includes(id))
  return viewerUserId !== undefined && missing.includes(viewerUserId)
    ? [viewerUserId, ...missing.filter((id) => id !== viewerUserId)]
    : missing
}

const cantMakeItName = (users: User[], userId: string, viewerUserId?: string): string =>
  userId === viewerUserId ? 'You' : nameFor(users, userId)

export const BestSlotBanner = ({
  label,
  freeCount,
  freeUserIds,
  total,
  users,
  viewerUserId,
}: {
  label: string
  freeCount: number
  freeUserIds: string[]
  total: number
  users: User[]
  viewerUserId?: string
}): React.ReactNode => (
  <div className="relative flex flex-col gap-3 rounded-2xl border border-[var(--hair)] bg-[var(--bone)]/[0.06] p-4 text-[var(--bone)]">
    <span
      aria-hidden="true"
      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold)]"
    >
      <Star className="h-3.5 w-3.5 text-[var(--ink)]" fill="currentColor" />
    </span>
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide opacity-60">Best time</div>
        <div className="text-sm font-semibold">{label}</div>
      </div>
      <div className="text-right text-xs opacity-60">
        <div className="font-semibold text-[var(--bone)]">{attendanceTag(freeCount, total)}</div>
        <div className="whitespace-nowrap">
          {freeCount} of {total} free
        </div>
      </div>
    </div>
    {freeCount < total && (
      <div className="flex flex-col gap-0.5 border-t border-[var(--hair)] pt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Can&rsquo;t make it</div>
        <ul className="flex flex-col gap-0.5 text-xs opacity-80">
          {missingUserIds(freeUserIds, users, viewerUserId).map((id) => (
            <li key={id}>{cantMakeItName(users, id, viewerUserId)}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
)

export const EmptyBestSlot = (): React.ReactNode => (
  <div className="rounded-2xl border border-[var(--hair)] bg-[var(--bone)]/[0.06] p-4 text-center text-sm text-[var(--bone)]/80">
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
  viewerUserId,
}: {
  meetings: RecommendedMeeting[]
  users: User[]
  poll: PollData
  viewerTimezone: string
  viewerUserId?: string
}): React.ReactNode =>
  meetings.length === 0 ? null : (
    <section aria-labelledby="suggested-times-heading" className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]" id="suggested-times-heading">
        Suggested times
      </div>
      <ul className="flex flex-col gap-2">
        {meetings.map((meeting) => (
          <li
            className="flex flex-col gap-1 rounded-2xl border border-[var(--hair)] bg-[var(--bone)]/[0.06] p-3 text-[var(--bone)]"
            key={`${meeting.dateIndex}-${meeting.slotIndex}`}
          >
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>
                {formatMeetingLabel(poll, meeting.date, meeting.startMinute, meeting.endMinute, viewerTimezone)}
              </span>
              {/* "2 of 3 free" is one fact — never let it break mid-phrase. The only allowed wrap
                point is after the separator, so narrow screens stack the tag and the count as two
                clean right-aligned lines instead of orphaning "3 free" under the tag. */}
              <span className="text-right text-xs font-normal opacity-60">
                {attendanceTag(meeting.freeCount, poll.participantCount)} ·{' '}
                <span className="whitespace-nowrap">
                  {meeting.freeCount} of {poll.participantCount} free
                </span>
              </span>
            </div>
            {meeting.freeCount < poll.participantCount && (
              <div className="flex flex-col gap-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Can&rsquo;t make it</div>
                <ul className="flex flex-col gap-0.5 text-xs opacity-80">
                  {missingUserIds(meeting.freeUserIds, users, viewerUserId).map((id) => (
                    <li key={id}>{cantMakeItName(users, id, viewerUserId)}</li>
                  ))}
                </ul>
              </div>
            )}
            {(meeting.excludedByCalendar ?? []).length > 0 && (
              <div className="flex flex-col gap-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Heads up</div>
                <ul className="flex flex-col gap-0.5 text-xs opacity-80">
                  {(meeting.excludedByCalendar ?? []).map((userId) => (
                    <li key={userId}>
                      {userId === viewerUserId
                        ? 'Your calendar shows a conflict.'
                        : `${nameFor(users, userId)}’s calendar shows a conflict.`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
