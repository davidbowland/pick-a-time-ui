import React, { useId } from 'react'

export interface MarkProps {
  className?: string
  size?: number
}

const CELL_SIZE = { height: 10, width: 12 }
const ROW_Y = [9, 20.5, 32, 43.5]
const COL_X = [12, 25, 38]

// The "Pick a Time" wordmark traced onto the app's own paint grid: a solid top
// bar, an open counter in the bowl, a row that closes the bowl, then the stem
// continuing alone — the same cells users paint availability onto, shaped into a P.
const FILLED_CELLS: readonly (readonly boolean[])[] = [
  [true, true, true],
  [true, false, true],
  [true, true, true],
  [true, false, false],
]

export const Mark = ({ className, size = 32 }: MarkProps): React.ReactNode => {
  const gradientId = useId()

  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent-soft)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${gradientId})`} height="60" rx="14" width="56" x="4" y="2" />
      <rect
        fill="none"
        height="58"
        rx="13"
        stroke="var(--bone)"
        strokeOpacity="0.35"
        strokeWidth="1"
        width="54"
        x="5"
        y="3"
      />
      {ROW_Y.map((y, rowIndex) =>
        COL_X.map((x, colIndex) =>
          FILLED_CELLS[rowIndex][colIndex] ? (
            <rect
              fill="var(--ink)"
              height={CELL_SIZE.height}
              key={`${rowIndex}-${colIndex}`}
              rx="2.5"
              width={CELL_SIZE.width}
              x={x}
              y={y}
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
