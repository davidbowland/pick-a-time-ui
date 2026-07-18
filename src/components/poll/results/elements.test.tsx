import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { attendanceTag, BestSlotBanner, formatMeetingLabel, ParticipationStatus, SuggestedTimes } from './elements'
import { RecommendedMeeting } from '@services/api'
import { PollData, User } from '@types'

describe('ParticipationStatus', () => {
  it('addresses a lone participant directly instead of counting them', () => {
    render(<ParticipationStatus count={1} />)
    expect(screen.getByText('Only you so far — the overlap fills in as others join.')).toBeInTheDocument()
  })

  it('counts participants once there is more than one', () => {
    render(<ParticipationStatus count={3} />)
    expect(screen.getByText('3 people so far — the overlap updates as more join.')).toBeInTheDocument()
  })
})

describe('attendanceTag', () => {
  it('labels full attendance as "Everyone\'s free"', () => {
    expect(attendanceTag(3, 3)).toBe("Everyone's free")
  })

  it('labels partial attendance as "Best available"', () => {
    expect(attendanceTag(2, 3)).toBe('Best available')
  })
})

describe('BestSlotBanner attendance tag', () => {
  it('shows "Everyone\'s free" when every participant is free', () => {
    render(<BestSlotBanner freeCount={3} freeUserIds={['a', 'b', 'c']} label="Thu, Sep 4" total={3} users={[]} />)
    expect(screen.getByText("Everyone's free")).toBeInTheDocument()
  })

  it('shows "Best available" when only some participants are free', () => {
    render(<BestSlotBanner freeCount={2} freeUserIds={['a', 'b']} label="Thu, Sep 4" total={3} users={[]} />)
    expect(screen.getByText('Best available')).toBeInTheDocument()
  })
})

describe("BestSlotBanner can't-make-it line", () => {
  const users: User[] = [
    { userId: 'a', name: 'Amber Harbor', calendarStatus: 'not_connected' },
    { userId: 'b', name: 'Priya Patel', calendarStatus: 'not_connected' },
    { userId: 'c', name: 'Jordan Lee', calendarStatus: 'not_connected' },
  ]

  it('names whoever is missing when attendance is not unanimous', () => {
    render(<BestSlotBanner freeCount={2} freeUserIds={['a', 'c']} label="Thu, Sep 4" total={3} users={users} />)
    expect(screen.getByText('Can’t make it')).toBeInTheDocument()
    expect(screen.getByText('Priya Patel')).toBeInTheDocument()
  })

  it("shows no can't-make-it line when everyone is free", () => {
    render(<BestSlotBanner freeCount={3} freeUserIds={['a', 'b', 'c']} label="Thu, Sep 4" total={3} users={users} />)
    expect(screen.queryByText('Can’t make it')).not.toBeInTheDocument()
  })

  it('calls the viewer "You" instead of their own name, listed before everyone else', () => {
    render(
      <BestSlotBanner freeCount={1} freeUserIds={['c']} label="Thu, Sep 4" total={3} users={users} viewerUserId="b" />,
    )
    const you = screen.getByText('You')
    const other = screen.getByText('Amber Harbor')
    expect(screen.queryByText('Priya Patel')).not.toBeInTheDocument()
    expect(you.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('SuggestedTimes attendance tag', () => {
  const poll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04'],
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1140,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1725453600,
    participantCount: 3,
    slots: [[{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }]],
  }
  const meeting: RecommendedMeeting = {
    dateIndex: 0,
    slotIndex: 0,
    date: '2025-09-04',
    startMinute: 1080,
    endMinute: 1140,
    freeCount: 3,
    freeUserIds: [],
    excludedByCalendar: [],
  }

  it('tags a fully-attended suggestion as "Everyone\'s free"', () => {
    render(
      <SuggestedTimes
        meetings={[meeting]}
        participantCount={3}
        poll={poll}
        users={[]}
        viewerTimezone="America/Chicago"
      />,
    )
    expect(screen.getByText(/everyone.s free/i)).toBeInTheDocument()
  })

  it('tags a partially-attended suggestion as "Best available"', () => {
    render(
      <SuggestedTimes
        meetings={[{ ...meeting, freeCount: 2 }]}
        participantCount={3}
        poll={poll}
        users={[]}
        viewerTimezone="America/Chicago"
      />,
    )
    expect(screen.getByText(/best available/i)).toBeInTheDocument()
  })
})

describe("SuggestedTimes can't-make-it line", () => {
  const poll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04'],
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1140,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1725453600,
    participantCount: 3,
    slots: [[{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }]],
  }
  const users: User[] = [
    { userId: 'a', name: 'Amber Harbor', calendarStatus: 'not_connected' },
    { userId: 'b', name: 'Priya Patel', calendarStatus: 'not_connected' },
    { userId: 'c', name: 'Jordan Lee', calendarStatus: 'not_connected' },
  ]
  const meeting: RecommendedMeeting = {
    dateIndex: 0,
    slotIndex: 0,
    date: '2025-09-04',
    startMinute: 1080,
    endMinute: 1140,
    freeCount: 2,
    freeUserIds: ['a', 'c'],
    excludedByCalendar: [],
  }

  it('names whoever is missing when attendance is not unanimous', () => {
    render(
      <SuggestedTimes
        meetings={[meeting]}
        participantCount={3}
        poll={poll}
        users={users}
        viewerTimezone="America/Chicago"
      />,
    )
    expect(screen.getByText('Can’t make it')).toBeInTheDocument()
    expect(screen.getByText('Priya Patel')).toBeInTheDocument()
  })

  it("shows no can't-make-it line when everyone is free", () => {
    render(
      <SuggestedTimes
        meetings={[{ ...meeting, freeCount: 3, freeUserIds: ['a', 'b', 'c'] }]}
        participantCount={3}
        poll={poll}
        users={users}
        viewerTimezone="America/Chicago"
      />,
    )
    expect(screen.queryByText('Can’t make it')).not.toBeInTheDocument()
  })

  it("shows both the can't-make-it line and the heads-up calendar-conflict block, in that order, without merging them", () => {
    render(
      <SuggestedTimes
        meetings={[{ ...meeting, excludedByCalendar: ['a'] }]}
        participantCount={3}
        poll={poll}
        users={users}
        viewerTimezone="America/Chicago"
      />,
    )
    const cantMakeIt = screen.getByText('Can’t make it')
    const headsUp = screen.getByText('Heads up')
    expect(cantMakeIt.compareDocumentPosition(headsUp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(/amber harbor.s calendar shows a conflict/i)).toBeInTheDocument()
  })

  it('calls the viewer "You" in the can\'t-make-it list instead of their own name', () => {
    render(
      <SuggestedTimes
        meetings={[meeting]}
        participantCount={3}
        poll={poll}
        users={users}
        viewerTimezone="America/Chicago"
        viewerUserId="b"
      />,
    )
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.queryByText('Priya Patel')).not.toBeInTheDocument()
  })

  it('phrases the viewer\'s own calendar conflict in second person, not "You\'s"', () => {
    render(
      <SuggestedTimes
        meetings={[{ ...meeting, excludedByCalendar: ['b'] }]}
        participantCount={3}
        poll={poll}
        users={users}
        viewerTimezone="America/Chicago"
        viewerUserId="b"
      />,
    )
    expect(screen.getByText('Your calendar shows a conflict.')).toBeInTheDocument()
    expect(screen.queryByText(/priya patel.s calendar/i)).not.toBeInTheDocument()
  })
})

describe('formatMeetingLabel', () => {
  const timedPoll: PollData = {
    sessionId: 'amber-harbor',
    name: 'Lunch with friends',
    dates: ['2025-09-04'],
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1140,
    slotMinutes: 60,
    timezone: 'America/Chicago',
    expiration: 1725453600,
    participantCount: 3,
    slots: [[{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }]],
  }
  const datesOnlyPoll: PollData = { ...timedPoll, usesTimes: false }

  it('returns just the date for a dates-only poll', () => {
    expect(formatMeetingLabel(datesOnlyPoll, '2025-09-04', 0, 1440, 'America/Chicago')).toBe('Thu, Sep 4')
  })

  it('returns an em dash when there is no date', () => {
    expect(formatMeetingLabel(timedPoll, undefined, 0, 60, 'America/Chicago')).toBe('—')
  })

  it('shows the poll-timezone date and time when the viewer shares the poll timezone', () => {
    expect(formatMeetingLabel(timedPoll, '2025-09-04', 1080, 1140, 'America/Chicago')).toBe('Thu, Sep 4, 6:00–7:00 PM')
  })

  it('keeps the poll-canonical date and flags the time when the viewer is in a different zone', () => {
    expect(formatMeetingLabel(timedPoll, '2025-09-04', 1080, 1140, 'Asia/Tokyo')).toBe(
      'Thu, Sep 4, 8:00–9:00 AM (next day for you)',
    )
  })

  it('defaults to the poll timezone (no conversion) when no viewer timezone is given', () => {
    expect(formatMeetingLabel(timedPoll, '2025-09-04', 1080, 1140)).toBe('Thu, Sep 4, 6:00–7:00 PM')
  })
})
