import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import React from 'react'

import { ScrollEdges } from '@hooks/useScrollEdges'

const BADGE_CLASS =
  // z-50 keeps the chevrons above every sticky layer in the grids they overlay — the heat grid's
  // ladder tops out at z-40 (its corner cell), and the up/down chevrons deliberately sit ON the
  // sticky date column, so anything lower would let that column paint over them.
  'pointer-events-none absolute z-50 rounded-full bg-[var(--ink)]/80 p-0.5 text-[var(--slate)] shadow-[0_0_0_1px_var(--hair)]'

// Purely decorative — the actual scroll affordance is the scrollport itself (native scrollbar,
// wheel/trackpad, or dragging the sticky date/time labels on touch). Positioned to sit *on* the
// header a direction's drag actually uses, not just at the nearest viewport edge: left/right ride
// the sticky time-label row (dragging it left/right is what scrolls columns), while up/down ride
// the sticky date-label column (dragging it up/down is what scrolls rows) — so the icon itself
// points at the thing to drag, not just at "more content this way."
export const ScrollEdgeIndicators = ({ edges }: { edges: ScrollEdges }): React.ReactNode => (
  <>
    {edges.canScrollLeft && (
      <ChevronLeft
        aria-hidden="true"
        className={`${BADGE_CLASS} top-2 left-1`}
        data-testid="scroll-edge-left"
        size={16}
      />
    )}
    {edges.canScrollRight && (
      <ChevronRight
        aria-hidden="true"
        className={`${BADGE_CLASS} top-2 right-1`}
        data-testid="scroll-edge-right"
        size={16}
      />
    )}
    {edges.canScrollUp && (
      <ChevronUp aria-hidden="true" className={`${BADGE_CLASS} top-1 left-10`} data-testid="scroll-edge-up" size={16} />
    )}
    {edges.canScrollDown && (
      <ChevronDown
        aria-hidden="true"
        className={`${BADGE_CLASS} bottom-1 left-10`}
        data-testid="scroll-edge-down"
        size={16}
      />
    )}
  </>
)
