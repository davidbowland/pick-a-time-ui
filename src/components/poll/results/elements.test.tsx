import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { attendanceTag, BestSlotBanner, formatMeetingLabel, SuggestedTimes } from './elements'
import { RecommendedMeeting } from '@services/api'
import { PollData } from '@types'

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
    render(<BestSlotBanner freeCount={3} label="Thu, Sep 4" total={3} />)
    expect(screen.getByText("Everyone's free")).toBeInTheDocument()
  })

  it('shows "Best available" when only some participants are free', () => {
    render(<BestSlotBanner freeCount={2} label="Thu, Sep 4" total={3} />)
    expect(screen.getByText('Best available')).toBeInTheDocument()
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
    slots: [{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }],
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
    render(<SuggestedTimes meetings={[meeting]} poll={poll} users={[]} viewerTimezone="America/Chicago" />)
    expect(screen.getByText(/everyone.s free/i)).toBeInTheDocument()
  })

  it('tags a partially-attended suggestion as "Best available"', () => {
    render(
      <SuggestedTimes
        meetings={[{ ...meeting, freeCount: 2 }]}
        poll={poll}
        users={[]}
        viewerTimezone="America/Chicago"
      />,
    )
    expect(screen.getByText(/best available/i)).toBeInTheDocument()
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
    slots: [{ slotIndex: 0, startMinute: 1080, endMinute: 1140 }],
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
