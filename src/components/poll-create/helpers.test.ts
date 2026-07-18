import {
  computeStartEndMinuteStep,
  computeWeekendOverride,
  formatDaysTimesSummary,
  formatTimeLabel,
  formatWeekdaysSummary,
  generateWeekdayDates,
  matchingPresetLabel,
  reconcilePatternDates,
  TIME_RANGE_PRESETS,
  timeWindowError,
  updateExcludedDates,
} from './helpers'

describe('generateWeekdayDates', () => {
  it('returns an empty array when no weekdays are selected', () => {
    expect(generateWeekdayDates([], 3, '2026-07-14')).toEqual([])
  })

  it('generates the next occurrence of each weekday, repeated weekly for weekCount weeks', () => {
    // Anchor: Tuesday, 2026-07-14. Weekday 4 = Thursday, weekday 6 = Saturday.
    expect(generateWeekdayDates([4, 6], 2, '2026-07-14')).toEqual([
      '2026-07-16', // Thu, week 0
      '2026-07-18', // Sat, week 0
      '2026-07-23', // Thu, week 1
      '2026-07-25', // Sat, week 1
    ])
  })

  it('includes the anchor date itself when it already matches a selected weekday', () => {
    // Anchor: Thursday, 2026-07-16, weekday 4 = Thursday.
    expect(generateWeekdayDates([4], 1, '2026-07-16')).toEqual(['2026-07-16'])
  })

  it('returns dates sorted ascending even when weekdays are given out of order', () => {
    // Anchor: Tuesday, 2026-07-14. Weekday 3 = Wednesday (07-15), weekday 4 = Thursday (07-16).
    expect(generateWeekdayDates([4, 3], 1, '2026-07-14')).toEqual(['2026-07-15', '2026-07-16'])
  })
})

describe('formatWeekdaysSummary', () => {
  it('returns "Not set yet" for an empty selection', () => {
    expect(formatWeekdaysSummary([])).toBe('Not set yet')
  })

  it('collapses Mon-Fri to a single range label', () => {
    expect(formatWeekdaysSummary([1, 2, 3, 4, 5])).toBe('Mon–Fri')
  })

  it('collapses Sat+Sun to a single range label', () => {
    expect(formatWeekdaysSummary([0, 6])).toBe('Sat–Sun')
  })

  it('collapses Fri+Sat to a single range label (a contiguous range that wraps toward the end of the week)', () => {
    expect(formatWeekdaysSummary([6, 5])).toBe('Fri–Sat')
  })

  it('lists a genuinely non-contiguous combination as comma-separated short day names, in week order', () => {
    expect(formatWeekdaysSummary([5, 1, 3])).toBe('Mon, Wed, Fri')
  })
})

describe('reconcilePatternDates', () => {
  it('adds newly-generated pattern dates on top of unrelated manual dates', () => {
    expect(
      reconcilePatternDates({
        currentDates: ['2026-07-20'],
        previousPatternDates: [],
        newPatternDates: ['2026-07-16', '2026-07-17'],
        excludedDates: [],
      }),
    ).toEqual(['2026-07-16', '2026-07-17', '2026-07-20'])
  })

  it('drops a previously-generated date that the new pattern no longer produces', () => {
    expect(
      reconcilePatternDates({
        currentDates: ['2026-07-16', '2026-07-17'],
        previousPatternDates: ['2026-07-16', '2026-07-17'],
        newPatternDates: ['2026-07-16'],
        excludedDates: [],
      }),
    ).toEqual(['2026-07-16'])
  })

  it('does not re-add a date the user explicitly excluded, even though the pattern still generates it', () => {
    expect(
      reconcilePatternDates({
        currentDates: [],
        previousPatternDates: ['2026-07-16'],
        newPatternDates: ['2026-07-16', '2026-07-23'],
        excludedDates: ['2026-07-16'],
      }),
    ).toEqual(['2026-07-23'])
  })

  it('preserves a manually-added date that was never part of any pattern', () => {
    expect(
      reconcilePatternDates({
        currentDates: ['2026-07-21', '2026-07-16'],
        previousPatternDates: ['2026-07-16'],
        newPatternDates: ['2026-07-16', '2026-07-23'],
        excludedDates: [],
      }),
    ).toEqual(['2026-07-16', '2026-07-21', '2026-07-23'])
  })
})

describe('updateExcludedDates', () => {
  it('records a removed date as excluded when it was pattern-matched', () => {
    expect(
      updateExcludedDates({
        excludedDates: [],
        previousDates: ['2026-07-16', '2026-07-17'],
        nextDates: ['2026-07-17'],
        patternDates: ['2026-07-16', '2026-07-17'],
      }),
    ).toEqual(['2026-07-16'])
  })

  it('does not exclude a removed date that was not pattern-matched (a plain manual removal)', () => {
    expect(
      updateExcludedDates({
        excludedDates: [],
        previousDates: ['2026-07-21'],
        nextDates: [],
        patternDates: ['2026-07-16'],
      }),
    ).toEqual([])
  })

  it('clears a date from the excluded list when the user manually re-adds it', () => {
    expect(
      updateExcludedDates({
        excludedDates: ['2026-07-16'],
        previousDates: [],
        nextDates: ['2026-07-16'],
        patternDates: ['2026-07-16'],
      }),
    ).toEqual([])
  })
})

describe('formatTimeLabel', () => {
  it('returns "Dates only" when times are not used', () => {
    expect(
      formatTimeLabel({
        usesTimes: false,
        startMinute: 540,
        endMinute: 1260,
        slotMinutes: 60,
        weekendsDiffer: false,
        weekendStartMinute: 660,
        weekendEndMinute: 720,
      }),
    ).toBe('Dates only')
  })

  it('returns the single window and duration when weekends do not differ', () => {
    expect(
      formatTimeLabel({
        usesTimes: true,
        startMinute: 690,
        endMinute: 810,
        slotMinutes: 60,
        weekendsDiffer: false,
        weekendStartMinute: 660,
        weekendEndMinute: 720,
      }),
    ).toBe('11:30 AM–1:30 PM · 1 hr')
  })

  it('returns both windows, weekdays then weekends, when weekends differ', () => {
    expect(
      formatTimeLabel({
        usesTimes: true,
        startMinute: 540,
        endMinute: 1020,
        slotMinutes: 60,
        weekendsDiffer: true,
        weekendStartMinute: 660,
        weekendEndMinute: 840,
      }),
    ).toBe('9:00 AM–5:00 PM weekdays, 11:00 AM–2:00 PM weekends · 1 hr')
  })

  it('collapses to a single window when weekends differ is set but the windows match', () => {
    expect(
      formatTimeLabel({
        usesTimes: true,
        startMinute: 690,
        endMinute: 810,
        slotMinutes: 60,
        weekendsDiffer: true,
        weekendStartMinute: 690,
        weekendEndMinute: 810,
      }),
    ).toBe('11:30 AM–1:30 PM · 1 hr')
  })
})

describe('computeStartEndMinuteStep', () => {
  it('uses the fine step when the meeting length matches it', () => {
    expect(computeStartEndMinuteStep(15, 15)).toBe(15)
  })

  it('doubles the fine step for meeting lengths longer than the fine step', () => {
    expect(computeStartEndMinuteStep(60, 15)).toBe(30)
  })

  it('doubles the fine step for a 30-minute meeting', () => {
    expect(computeStartEndMinuteStep(30, 15)).toBe(30)
  })
})

describe('formatDaysTimesSummary', () => {
  it('summarizes a dates-only selection', () => {
    expect(
      formatDaysTimesSummary({
        dateCount: 3,
        daysLabel: 'Mon–Fri',
        usesTimes: false,
        startMinute: 540,
        endMinute: 1260,
        slotMinutes: 60,
        weekendsDiffer: false,
        weekendStartMinute: 660,
        weekendEndMinute: 720,
      }),
    ).toBe('3 dates · Mon–Fri · Dates only')
  })

  it('summarizes a single date with a time window and meeting length', () => {
    expect(
      formatDaysTimesSummary({
        dateCount: 1,
        daysLabel: 'Mon',
        usesTimes: true,
        startMinute: 690,
        endMinute: 810,
        slotMinutes: 60,
        weekendsDiffer: false,
        weekendStartMinute: 660,
        weekendEndMinute: 720,
      }),
    ).toBe('1 date · Mon · 11:30 AM–1:30 PM · 1 hr')
  })

  it('summarizes zero selected dates with no days chosen', () => {
    expect(
      formatDaysTimesSummary({
        dateCount: 0,
        daysLabel: 'Not set yet',
        usesTimes: false,
        startMinute: 540,
        endMinute: 1260,
        slotMinutes: 60,
        weekendsDiffer: false,
        weekendStartMinute: 660,
        weekendEndMinute: 720,
      }),
    ).toBe('0 dates · Not set yet · Dates only')
  })

  it('includes both windows when weekends differ', () => {
    expect(
      formatDaysTimesSummary({
        dateCount: 7,
        daysLabel: 'Mon–Sun',
        usesTimes: true,
        startMinute: 540,
        endMinute: 1020,
        slotMinutes: 60,
        weekendsDiffer: true,
        weekendStartMinute: 660,
        weekendEndMinute: 840,
      }),
    ).toBe('7 dates · Mon–Sun · 9:00 AM–5:00 PM weekdays, 11:00 AM–2:00 PM weekends · 1 hr')
  })
})

describe('computeWeekendOverride', () => {
  it('returns undefined when none of the dates are weekend dates', () => {
    // 2026-07-16/17 are Thu/Fri.
    expect(computeWeekendOverride(['2026-07-16', '2026-07-17'], 'America/Chicago', 660, 720)).toBeUndefined()
  })

  it('covers only the weekend dates when the poll has a mix of weekday and weekend dates', () => {
    // 2026-07-16 Thu, 2026-07-18 Sat, 2026-07-19 Sun.
    expect(computeWeekendOverride(['2026-07-16', '2026-07-18', '2026-07-19'], 'America/Chicago', 660, 720)).toEqual({
      dates: ['2026-07-18', '2026-07-19'],
      startMinute: 660,
      endMinute: 720,
    })
  })

  it('covers every date when they are all weekend dates', () => {
    expect(computeWeekendOverride(['2026-07-18', '2026-07-19'], 'America/Chicago', 660, 720)).toEqual({
      dates: ['2026-07-18', '2026-07-19'],
      startMinute: 660,
      endMinute: 720,
    })
  })
})

describe('TIME_RANGE_PRESETS', () => {
  it('keeps every preset hour-aligned so it stays valid at any step', () => {
    TIME_RANGE_PRESETS.forEach((preset) => {
      expect(preset.startMinute % 60).toBe(0)
      expect(preset.endMinute % 60).toBe(0)
    })
  })

  it('makes "All day" a superset of every other preset, including the latest Quick-fill scenario (Weekend dinner, ending 9:00 PM/1260)', () => {
    const allDay = TIME_RANGE_PRESETS.find((preset) => preset.label === 'All day')
    expect(allDay).toEqual({ label: 'All day', startMinute: 480, endMinute: 1260 })
  })
})

describe('matchingPresetLabel', () => {
  it('returns the label of the preset matching the given range exactly', () => {
    expect(matchingPresetLabel(1020, 1260)).toBe('Evening')
  })

  it('returns undefined when no preset matches', () => {
    expect(matchingPresetLabel(600, 700)).toBeUndefined()
  })
})

describe('timeWindowError', () => {
  it('returns the end-after-start message when the end is before the start', () => {
    expect(timeWindowError(1020, 540, 60)).toBe('Pick an end time after 5:00 PM.')
  })

  it('treats an end equal to the start as inverted, not too short', () => {
    expect(timeWindowError(540, 540, 60)).toBe('Pick an end time after 9:00 AM.')
  })

  it('prefers the inverted message over the too-short message when both apply', () => {
    // 30-minute backwards window with a 120-minute slot: both conditions are true.
    expect(timeWindowError(570, 540, 120)).toBe('Pick an end time after 9:30 AM.')
  })

  it('returns the longer-window message for a forward window shorter than the meeting length', () => {
    expect(timeWindowError(540, 570, 60)).toBe('Pick a longer time window, or a shorter meeting length.')
  })

  it('accepts a window exactly equal to the meeting length', () => {
    expect(timeWindowError(540, 600, 60)).toBeUndefined()
  })

  it('accepts an ordinary valid window', () => {
    expect(timeWindowError(540, 1260, 60)).toBeUndefined()
  })
})
