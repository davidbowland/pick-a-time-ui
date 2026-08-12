import dynamic from 'next/dynamic'
import React, { useState } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

/**
 * The way in for someone who was invited but whose link doesn't work — wrong device, deleted
 * message, words read out over the phone, a link truncated in transit.
 *
 * A question rather than a label, because this is the one affordance on the page whose audience
 * does not know the feature exists: it has to describe the reader's situation, not the app's
 * function. The visible words are contained in the accessible name (WCAG 2.5.3 Label in Name),
 * which is why the extension is screen-reader-only text rather than an `aria-label`.
 */
export const JOIN_TRIGGER_COPY = {
  control: 'Enter it',
  pillLabel: 'Enter a poll code',
  preface: 'Have a poll code?',
  srSuffix: ' and join a poll',
}

/**
 * `loading` matters more here than on most lazy chunks. This is the one control on the page whose
 * audience does not already know the feature exists, and it is pressed by someone who has been
 * handed two words and is not sure this will work at all. On a slow connection an absent fallback
 * means pressing it produces nothing whatsoever until the chunk lands — which reads as a dead
 * button, from the person least likely to press it twice.
 *
 * `role="status"` rather than a bare div so the wait is announced too, and the string matches the
 * app's existing loading voice (`components/poll/elements.tsx`).
 */
const JoinDialogImpl = dynamic(async () => (await import('./join-dialog')).JoinDialog, {
  loading: () => (
    <p className="sr-only" role="status">
      Loading…
    </p>
  ),
  ssr: false,
})

export interface JoinTriggerProps {
  /**
   * `sentence` (the default) is the quiet inline line used beside a create affordance. `pill` is
   * the bordered control for a page that has nothing else on it — bordered rather than filled,
   * because entering a code can still miss.
   */
  variant?: 'sentence' | 'pill'
}

/**
 * The trigger, and the dialog it owns.
 *
 * Two things here are load-bearing:
 *
 * 1. **The dialog is rendered only while open.** `dynamic()` starts its import when the wrapper
 *    mounts, so a wrapper left mounted-but-closed downloads HeroUI's `Modal` and the react-aria
 *    overlay tree on every landing visit and defeats the split entirely. `null` while closed is
 *    what keeps the chunk unfetched. Same shape as `recent-polls/elements.tsx`.
 * 2. **`isOpen` lives here, not in the page.** Both landing compositions are always in the DOM and
 *    swapped with CSS, so there are two triggers; each owning its own dialog is what makes focus
 *    return to the trigger that was actually pressed.
 *
 * The trigger itself ships in the prerendered markup with no storage gate and no CSS toggle of its
 * own, so it stays out of the page's pre-paint layout contract.
 */
export const JoinTrigger = ({ variant = 'sentence' }: JoinTriggerProps): React.ReactNode => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {variant === 'pill' ? (
        <button
          className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--field-border)] px-5 text-sm font-bold text-[var(--bone)] hover:bg-[var(--bone)]/[0.06] ${FOCUS_RING}`}
          onClick={() => setIsOpen(true)}
          type="button"
        >
          {JOIN_TRIGGER_COPY.pillLabel}
        </button>
      ) : (
        // --copy-color, not --slate and not --accent. In the first-visit composition this sentence
        // sits directly on SkyBackground, which interpolates night to day as the page scrolls, so a
        // fixed colour washes out as it lightens: measured with the repo's own contrastRatio,
        // --slate here falls under 4.5:1 about a tenth of the way into the transition and bottoms
        // out near 2.4:1, while the sentence is still on screen being read.
        //
        // --eyebrow-accent is the wrong token despite looking like the right one. Its AA guarantee
        // (sky-background/index.test.tsx:37) is against the --copy-color CHIP that EyebrowTag fills
        // behind it, not against the page — so at night, where the chip is bone, it is picked as a
        // DARK green, and painting that straight onto the dark page would be worse than the bug it
        // was meant to fix.
        //
        // --copy-color is the one token guaranteed legible against the page at every step, because
        // being that is its entire job. The link is distinguished by weight and underline rather
        // than hue, which AC-035 wanted anyway. The fallback covers the surfaces that have no
        // SkyBackground at all: the 404 and the poll-is-gone screen.
        // Full strength, not the /70 the neighbouring story copy uses. --copy-color is chosen to
        // clear 4.5:1 against the page, and it only just does — it bottoms at 4.51:1 across the
        // night-to-day mix. Any alpha at all spends a margin that is not there: at 70% it drops
        // under the floor a seventh of the way into the scroll and reaches 3.03:1, which is the
        // same class of failure as the --slate it replaced, just less of it.
        <p className="text-sm text-[var(--copy-color,var(--bone))]">
          {JOIN_TRIGGER_COPY.preface}{' '}
          <button
            className={`inline-flex min-h-6 items-center rounded-md px-0.5 font-semibold text-[var(--copy-color,var(--bone))] underline underline-offset-[3px] hover:opacity-80 ${FOCUS_RING}`}
            onClick={() => setIsOpen(true)}
            type="button"
          >
            {JOIN_TRIGGER_COPY.control}
            <span className="sr-only">{JOIN_TRIGGER_COPY.srSuffix}</span>
          </button>
        </p>
      )}
      {isOpen ? <JoinDialogImpl isOpen={isOpen} onOpenChange={setIsOpen} /> : null}
    </>
  )
}
