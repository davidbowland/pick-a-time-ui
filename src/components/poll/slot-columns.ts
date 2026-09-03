export interface TimeWindow {
  startMinute: number
  endMinute: number
}

// Cells rendered where a date's own slots don't include a given union column — muted, no fill,
// not a button, so it's excluded from tab order and (for the paint-drag gesture in
// painting/grid.tsx) from pointer hit-testing, since it carries no data-date-index/data-slot-index.
export const DISABLED_CELL_CLASS =
  'flex h-8 items-center justify-center rounded border border-dashed border-[var(--hair)] bg-[var(--bone)]/[0.03] cursor-not-allowed'

// The two calendar treatments, kept here beside DISABLED_CELL_CLASS so the three "this is not an
// ordinary cell" appearances are read together whenever any one of them changes. That adjacency is
// the point: the failure these guard against is a booked cell drifting close enough to the
// out-of-window cell to be mistaken for it, and nothing in a test can see that if the three live in
// three files.
//
// Unlike DISABLED_CELL_CLASS these are FRAGMENTS, not whole class lists — the cell keeps the shared
// button base in painting/grid.tsx and swaps only the part that varies. A whole-cell constant would
// have to restate that base three times over, and the copies would diverge on the first change to
// the focus ring or the transition.
//
// Where DISABLED_CELL_CLASS is deliberately not a button — no slot exists there, so there is
// nothing to press — a booked cell IS one, and stays one: focusable, in tab order, never
// `disabled`, never `aria-hidden` (AC-018). The calendar reports; it does not decide. A participant
// who is genuinely free during a meeting their calendar knows about must be able to say so in one
// press, and taking the button away to "protect" them from a contradiction is exactly the
// destructive behavior this feature replaced.
//
// Each fragment carries a `text-` color for the cell's non-color channel to inherit rather than
// naming that color at the glyph: painting/grid.tsx draws the `Clock` glyph and the conflict marker
// with `currentColor` (lucide strokes with it; the marker span uses `bg-current`), so the fill and
// the thing drawn on it cannot be changed apart. That is what makes the pairing testable at all —
// booked-contrast.test.ts composites each fill over the page and then measures the indicator
// against that fill, which is the ground the reader actually sees it on.
//
// Two things the call site has to honor, neither of which any test can catch:
//
// FRAGMENT, not a class list. Unlike DISABLED_CELL_CLASS below, these are the varying half of a
// cell and are composed with the shared button base. There is no tailwind-merge in this project, so
// two `bg-*` utilities on one element are resolved by CSS source order, NOT by which came later in
// the string — layering a fragment over the base's `bg-[var(--bone)]/10` produces whichever the
// stylesheet happens to emit last. Pick exactly one `bg-*` in a ternary instead.
//
// Do not restate the `text-` color at the glyph. `currentColor` inheritance is the whole mechanism,
// and hard-coding a color there (as the existing `Check` does) leaves the contrast test measuring a
// value nothing renders. It cannot be asserted here: reading it back would be a class-string
// assertion, which CLAUDE.md bars.
//
// AC-015: the fill is decorative and the GLYPH carries the meaning. The `--bone` family cannot
// clear 3:1 against the page below roughly a=0.40, and a fill that loud reads as a warning — the
// calendar is not entitled to shout. So the fill only has to separate three states by eye
// (0.03 out-of-window < 0.10 unpainted < 0.16 booked, AC-013/AC-014), while `--slate` on the
// composited booked fill does the accessible work at 3.80:1.
export const BOOKED_CELL_FRAGMENT = 'bg-[var(--bone)]/16 text-[var(--slate)]'

// A conflict is a painted cell that is also booked, so it keeps the painted fill exactly — dimming
// it would say the participant's own mark had been overruled, which is the one thing this feature
// promised never to do. The `--ink` marker bar is the entire difference, and `--ink` is forced
// rather than chosen: no color in the palette clears 3:1 against BOTH `--ink` and `--accent` (the
// ceiling is about 2.17:1), so any marker legible on the page would disappear on the accent fill it
// is actually drawn on. `--ink` on `--accent` is 6.50:1.
export const CONFLICT_CELL_FRAGMENT = 'bg-[var(--accent)] text-[var(--ink)]'

// The two ORDINARY cell fills, named here for exactly the reason the two calendar fragments above
// are: the key in painting/elements.tsx draws them as swatches, and a swatch that restated the
// value would go on matching a grid that had since moved. They were inline in painting/grid.tsx
// until the key started needing them, which is why booked-contrast.test.ts used to read that file
// for the unpainted fill rather than import a constant — it imports this one now.
//
// Same two rules as the fragments above: exactly one `bg-*` on a cell, chosen in a ternary, and
// never layered; and 0.10 is load-bearing, not a taste — booked sits at 0.16 and out-of-window at
// 0.03, and the three have to stay distinguishable by eye in that order (AC-013/AC-014).
export const FREE_CELL_FRAGMENT = 'bg-[var(--accent)]'
export const UNMARKED_CELL_FRAGMENT = 'bg-[var(--bone)]/10'

export function buildUnionColumns(rows: TimeWindow[][]): TimeWindow[] {
  const byKey = new Map<string, TimeWindow>()
  for (const row of rows) {
    for (const window of row) {
      byKey.set(`${window.startMinute}-${window.endMinute}`, {
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })
    }
  }
  return [...byKey.values()].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
}

// Assumes `rowCells` and `column` were both derived from the same server-side slot
// computation (e.g. a poll's `slots` and a matching overlap response's `cells`) — a
// mismatch here fails silently, rendering a real slot as a disabled placeholder.
export function findCellForColumn<T extends TimeWindow>(rowCells: T[], column: TimeWindow): T | undefined {
  return rowCells.find((cell) => cell.startMinute === column.startMinute && cell.endMinute === column.endMinute)
}

// Both grids drop table *auto* layout — which sized every column to its own header text and let
// the label column swallow spare width — for `table-layout: fixed` plus a <colgroup>. These are
// the widths that colgroup specifies.
//
// EVERY width here is rem, never px, and that is load-bearing rather than stylistic. What these
// tracks have to contain is all rem already: the label text is `text-xs` (0.75rem), its padding is
// `pr-2 pl-1` (0.5rem + 0.25rem), and PaintGrid's `border-spacing-1` is 0.25rem. A px track would
// hold still while all three grew with the reader's root font size — at a 20px root, a routine
// browser accessibility setting, the text is 25% wider against an unchanged column and `Wed May 28`
// overflows. WCAG 1.4.4 Resize Text (AA) is binding here, and the `min-w-16` (4rem) these widths
// replaced scaled correctly, so shipping px would have been a regression. Every value below is the
// exact rem equivalent of the px figure it started as, so rendering at a 16px root is unchanged.
//
// 3rem x `h-8` cells (48x32px at a 16px root) clear WCAG 2.2 SC 2.5.8's 24x24 AA minimum with room
// to spare. (SC 2.5.5's 44x44 is Level AAA and not the operative bar.)
const GRID_SLOT_MIN_WIDTH_REM = 3
// Unconditional, not conditional on a month being shown: buildGridDateLabels always emits a month
// on row 0, so the widest label form is always present whenever this column renders.
//
// 5.25rem (84px at a 16px root) is an ESTIMATE, not a measurement — the browser accessibility audit
// still has to confirm it against real type. The worst case is `Wed May 28`, not `Wed Jul 28`:
// `May` is the widest of the twelve month abbreviations in Plus Jakarta Sans (`M` is the widest cap
// and `a`/`y` are both full-width lowercase), with `Aug`, `Sep` and `Dec` close behind.
// `Wed Jul 28` is the NARROWEST form — `J` is a narrow cap and `l` the narrowest lowercase glyph —
// so an earlier estimate built on it (4.75rem) left no slack for the months that actually matter.
//
// The label cell's `pr-2 pl-1` must not grow: this number assumes exactly those 0.75rem (12px at a
// 16px root) of padding. And because the cell is `whitespace-nowrap text-right` inside a
// `sticky left-0` cell in an `overflow-auto` scrollport, an overflow spills LEFT and is clipped by
// the scrollport — you silently get `ed May 28`, a failure that is easy to miss and hard to
// attribute.
const GRID_LABEL_WIDTH_REM = 5.25
// PaintGrid's `border-spacing-1` (0.25rem / 4px at a 16px root). NOT a general "gap", and the
// formula below deliberately OVER-reserves for HeatGrid rather than describing it.
//
// HeatGrid sets `border-spacing-0` and gets its 0.25rem inter-cell gap from `p-0.5` on each of two
// adjacent cells — padding that lives INSIDE the cell box, and is therefore already part of the
// column's own width. gridMinWidth nonetheless charges a gap OUTSIDE every column for both grids.
// The surplus is intentional, and here is the arithmetic that shows it is safe. With a label column
// and C slot columns, the min-width is 5.25 + 3C + 0.25(C + 2) = (5.75 + 3.25C)rem.
//
//   PaintGrid spends 0.25(C + 2)rem of that on real border-spacing and 5.25rem on the label track,
//   leaving exactly 3C for the slot columns — 3rem each, on the nose, and its cells are `p-0`, so
//   the button is the full 3rem.
//
//   HeatGrid spends nothing on spacing, so its C slot columns share (3.25C + 0.5)rem — 3.25 + 0.5/C
//   each. `p-0.5` takes 0.25rem of that back, leaving a visible button of (3 + 0.5/C)rem: 3.5rem at
//   C = 1, 3.25rem at C = 2, converging on 3rem from above as C grows. Above the 3rem floor for
//   every C, never below it.
//
// So do NOT "simplify" the surplus away. Trimming the gap term to make HeatGrid's columns land on
// 3rem would starve PaintGrid, whose border-spacing genuinely consumes it. Moving HeatGrid's gap
// from `p-0.5` to border-spacing without also dropping the padding would double-charge and put its
// buttons at 2.75rem, under the floor — and heat-grid.tsx documents a separate, independent reason
// border-spacing cannot be used there at all (spacing gaps are transparent holes through which ring
// and star fragments show under the sticky bands).
const GRID_COLUMN_GAP_REM = 0.25

// Rounds before serializing so rem arithmetic can never emit float noise (`0.7500000000000001rem`)
// into a style attribute. Today every constant above is a multiple of 0.25 and the sums are exact,
// but that is a property of the current numbers, not of the formula.
function remLength(rem: number): string {
  return `${Math.round(rem * 10000) / 10000}rem`
}

// The width the label <col> is pinned to, ready to drop straight into a style attribute.
export const GRID_LABEL_WIDTH = remLength(GRID_LABEL_WIDTH_REM)

// A single-date poll states its date above the grid instead, mirroring how a single-slot poll
// already states "Meeting time:" (painting/index.tsx). Shared so a grid and its parent cannot
// disagree about whether the column exists.
export function showsDateColumn(dateCount: number): boolean {
  return dateCount > 1
}

// The line above the grid. A single-date poll and a single-slot poll each drop their axis from the
// grid, so whatever they dropped has to be stated once here instead — and when a poll is both, one
// combined line reads better than two stacked notes. Shared rather than duplicated in both phases
// so the wording cannot drift between painting and results.
export function gridContextLine(date: string | undefined, slotLabel: string | undefined): string | undefined {
  if (date && slotLabel) return `Meeting time: ${date}, ${slotLabel}`
  if (slotLabel) return `Meeting time: ${slotLabel}`
  if (date) return `Date: ${date}`
  return undefined
}

// A line above the grid, beside the cadence line. Both grids mark an off-day column header with a
// `+1` / `−1` superscript that is aria-hidden — the full "(next day for you)" wording rides the
// header's aria-label — so a sighted reader gets a bare symbol that nothing on the page defines.
// This defines it, and only when a column actually carries one: most polls never shift a day, and a
// permanent line would cost every one of those readers a line to learn nothing.
//
// It renders ABOVE the grid, for the same reason the cadence line does: the scrollport is
// `max-h-[32rem]`, so a legend placed below it is rarely on screen at the same time as the `+1` in
// a header it explains — which on a phone is most of the time.
//
// The both-markers branch cannot fire from a single poll today, since every column converts from
// the same date and a fixed offset can only straddle one midnight. It costs one comparison, and
// the alternative failure is a legend that explains half of what is on screen.
export function dayOffsetLegendLine(dayOffsets: number[]): string | undefined {
  const hasNextDay = dayOffsets.some((offset) => offset > 0)
  const hasPreviousDay = dayOffsets.some((offset) => offset < 0)
  if (hasNextDay && hasPreviousDay) return '+1 means the next day in your time zone; −1 means the previous day.'
  if (hasNextDay) return '+1 means the next day in your time zone.'
  if (hasPreviousDay) return '−1 means the previous day in your time zone.'
  return undefined
}

// The floor width the table is pinned to, as a rem CSS length so it scales with the root font
// exactly as the text and padding inside it do. Below this the table scrolls with every slot column
// at exactly GRID_SLOT_MIN_WIDTH_REM; above it, `w-full` stretches the unspecified slot columns
// equally.
//
// A border-separate table with C columns consumes C+1 border-spacings: one between each adjacent
// pair AND one at each outer edge, between the table's padding edge and the outermost cell
// (CSS 2.1 17.6.1). With a label column C = columnCount + 1, so the spacing count is columnCount + 2.
//
// Deliberately not exported: gridLayout is the only caller, and exporting this would be the one way
// to obtain the min-width apart from the colgroup it must agree with. Tested through gridLayout.
function gridMinWidth(columnCount: number, hasLabelColumn: boolean): string {
  const columns = hasLabelColumn ? columnCount + 1 : columnCount
  const labelWidth = hasLabelColumn ? GRID_LABEL_WIDTH_REM : 0
  return remLength(labelWidth + columnCount * GRID_SLOT_MIN_WIDTH_REM + (columns + 1) * GRID_COLUMN_GAP_REM)
}

// GridColumns deliberately emits slot <col>s with NO width, because that is what makes fixed
// layout divide the leftover space equally. The consequence is that the entire 24x24 AA target
// floor lives in the table's min-width instead — a grid that renders the colgroup but forgets the
// style silently divides the container instead (20 columns on a 390px phone gives ~14px cells,
// below the SC 2.5.8 minimum, with no failing test possible since style assertions are barred).
// `min-width` cannot move onto the <col>: only width, border, background and visibility apply to
// table columns. So the two must be derived together, from one call, and never passed separately.
export function gridLayout(
  columnCount: number,
  hasLabelColumn: boolean,
): { colgroupProps: { columnCount: number; hasLabelColumn: boolean }; tableStyle: { minWidth: string } } {
  return {
    colgroupProps: { columnCount, hasLabelColumn },
    tableStyle: { minWidth: gridMinWidth(columnCount, hasLabelColumn) },
  }
}
