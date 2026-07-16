import { buildUnionColumns, findCellForColumn } from './slot-columns'

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
