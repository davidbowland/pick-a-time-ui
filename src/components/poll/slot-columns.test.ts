import {
  buildUnionColumns,
  dayOffsetLegendLine,
  findCellForColumn,
  gridContextLine,
  gridLayout,
  showsDateColumn,
} from './slot-columns'

describe('buildUnionColumns', () => {
  it('returns the single shared window set unchanged when every date has identical slots', () => {
    const rows = [
      [
        { startMinute: 540, endMinute: 600 },
        { startMinute: 570, endMinute: 630 },
      ],
      [
        { startMinute: 540, endMinute: 600 },
        { startMinute: 570, endMinute: 630 },
      ],
    ]
    expect(buildUnionColumns(rows)).toEqual([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 570, endMinute: 630 },
    ])
  })

  it('merges distinct weekday/weekend windows into one sorted union', () => {
    const rows = [[{ startMinute: 540, endMinute: 600 }], [{ startMinute: 660, endMinute: 720 }]]
    expect(buildUnionColumns(rows)).toEqual([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 660, endMinute: 720 },
    ])
  })

  it('sorts a later-starting row before an earlier one when the union is built, ordering strictly by start time', () => {
    const rows = [[{ startMinute: 660, endMinute: 720 }], [{ startMinute: 540, endMinute: 600 }]]
    expect(buildUnionColumns(rows)).toEqual([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 660, endMinute: 720 },
    ])
  })

  it('dedupes identical windows that appear in more than one row', () => {
    const rows = [
      [{ startMinute: 540, endMinute: 600 }],
      [{ startMinute: 540, endMinute: 600 }],
      [{ startMinute: 660, endMinute: 720 }],
    ]
    expect(buildUnionColumns(rows)).toHaveLength(2)
  })

  it('returns an empty array for no rows', () => {
    expect(buildUnionColumns([])).toEqual([])
  })
})

describe('findCellForColumn', () => {
  it('returns the matching cell by start/end minute', () => {
    const rowCells = [
      { slotIndex: 0, startMinute: 540, endMinute: 600 },
      { slotIndex: 1, startMinute: 660, endMinute: 720 },
    ]
    expect(findCellForColumn(rowCells, { startMinute: 660, endMinute: 720 })).toEqual({
      slotIndex: 1,
      startMinute: 660,
      endMinute: 720,
    })
  })

  it('returns undefined when the row has no matching window', () => {
    const rowCells = [{ slotIndex: 0, startMinute: 540, endMinute: 600 }]
    expect(findCellForColumn(rowCells, { startMinute: 660, endMinute: 720 })).toBeUndefined()
  })

  it('returns undefined for an empty row', () => {
    expect(findCellForColumn([], { startMinute: 540, endMinute: 600 })).toBeUndefined()
  })
})

describe('showsDateColumn', () => {
  it('hides the date column for a single-date poll', () => {
    expect(showsDateColumn(1)).toBe(false)
  })

  it('shows the date column once there is more than one date', () => {
    expect(showsDateColumn(2)).toBe(true)
  })

  it('hides the date column when there are no dates', () => {
    expect(showsDateColumn(0)).toBe(false)
  })
})

describe('gridContextLine', () => {
  it('combines a collapsed date and a collapsed slot into one meeting-time line', () => {
    expect(gridContextLine('Thu, Sep 4', '6:00–7:00 PM')).toBe('Meeting time: Thu, Sep 4, 6:00–7:00 PM')
  })

  it('names only the meeting time when the grid still shows its dates', () => {
    expect(gridContextLine(undefined, '6:00–7:00 PM')).toBe('Meeting time: 6:00–7:00 PM')
  })

  it('names only the date when the grid still shows its times', () => {
    expect(gridContextLine('Thu, Sep 4', undefined)).toBe('Date: Thu, Sep 4')
  })

  it('says nothing when the grid still shows both axes', () => {
    expect(gridContextLine(undefined, undefined)).toBeUndefined()
  })
})

describe('dayOffsetLegendLine', () => {
  it('explains only the +1 marker when every offset column runs late', () => {
    expect(dayOffsetLegendLine([0, 1, 1])).toBe('+1 means the next day in your time zone.')
  })

  it('explains only the −1 marker when every offset column runs early', () => {
    expect(dayOffsetLegendLine([-1, -1, 0])).toBe('−1 means the previous day in your time zone.')
  })

  it('explains both markers when the grid shows both', () => {
    expect(dayOffsetLegendLine([-1, 0, 1])).toBe('+1 means the next day in your time zone; −1 means the previous day.')
  })

  it('says nothing when every column falls on the poll date', () => {
    expect(dayOffsetLegendLine([0, 0, 0])).toBeUndefined()
  })

  it('says nothing when the grid renders no columns at all', () => {
    expect(dayOffsetLegendLine([])).toBeUndefined()
  })
})

// rem, not px: the label text, its padding and PaintGrid's border-spacing are all rem, so a px
// min-width would hold still while its contents grew with the reader's root font size (WCAG 1.4.4
// Resize Text, AA). The numbers below are the exact rem equivalents of the px figures they replace
// — 25.25rem was 404px, 19.75rem was 316px, 5.75rem was 92px, 0.25rem was 4px — so nothing about
// the arithmetic changed, only the unit.
describe('gridLayout', () => {
  it('derives the colgroup props and the table min-width from one call, so they cannot disagree', () => {
    expect(gridLayout(6, true)).toEqual({
      colgroupProps: { columnCount: 6, hasLabelColumn: true },
      tableStyle: { minWidth: '25.25rem' },
    })
  })

  it('drops the label column from both halves together', () => {
    expect(gridLayout(6, false)).toEqual({
      colgroupProps: { columnCount: 6, hasLabelColumn: false },
      tableStyle: { minWidth: '19.75rem' },
    })
  })

  // The two cases above pin the per-column term; these pin the border-spacings around it. A
  // border-separate table with C columns consumes C+1 of them — one between each adjacent pair and
  // one at each outer edge — so a label column and no slot columns costs two, not one.
  it('counts the outer border-spacing on both edges, not only the gaps between columns', () => {
    expect(gridLayout(0, true).tableStyle.minWidth).toBe('5.75rem')
  })

  it('reserves only a single spacing when there is neither a label nor any slot column', () => {
    expect(gridLayout(0, false).tableStyle.minWidth).toBe('0.25rem')
  })
})
