import React from 'react'

import { GRID_LABEL_WIDTH } from './slot-columns'

// Shared by both grids. The label column takes an explicit width; the slot columns deliberately
// take none, because under `table-layout: fixed` unspecified columns divide the remaining space
// *equally* — which is exactly the uniform stretch we want when the columns fit, while the
// table's min-width holds the floor when they don't.
//
// A <colgroup> also applies when no <thead> renders (the dates-only grid), so column widths no
// longer depend on whether a header row exists.
//
// GRID_LABEL_WIDTH is a rem CSS length string, not a number — React would serialize a bare number
// as px, and a px label column would hold still while the rem text and padding inside it grew with
// the reader's root font size (WCAG 1.4.4 Resize Text, AA). See slot-columns.ts.
export const GridColumns = ({
  columnCount,
  hasLabelColumn,
}: {
  columnCount: number
  hasLabelColumn: boolean
}): React.ReactNode => (
  <colgroup>
    {hasLabelColumn && <col style={{ width: GRID_LABEL_WIDTH }} />}
    {Array.from({ length: columnCount }, (_, index) => (
      <col key={index} />
    ))}
  </colgroup>
)
