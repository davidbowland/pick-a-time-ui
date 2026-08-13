import { KeyRound, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useEffect, useId, useRef, useState } from 'react'

import { JOIN_COPY } from './copy'
import { STARTER_ROW_HEIGHT } from '@components/story/hero-starter'
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

/**
 * The panel the `door` and `dock` variants open. Split for the same reason the dialog is: a static
 * import of `./join-panel` — and through it `./elements` — would drag HeroUI's `Modal` and the
 * react-aria overlay tree into the landing page's first-paint chunk, which is the entire cost this
 * split exists to avoid. The two labels the triggers need come from `./copy` instead, which carries
 * no HeroUI import; reading them from `./elements` reintroduces the leak, measured.
 */
const JoinPanelLazy = dynamic(async () => (await import('./join-panel')).JoinPanelImpl, {
  loading: () => (
    <p className="sr-only" role="status">
      Loading…
    </p>
  ),
  ssr: false,
})

export interface JoinTriggerProps {
  /**
   * `door` and `dock` only: the id of an element that explains the trigger, forwarded straight to
   * the button's `aria-describedby`. `DoorPair` uses it to hang `Have a poll code?` off the door —
   * undescribed, the door announces as a bare `Join a poll` button, which tells the one visitor who
   * is not here to create anything nothing at all.
   */
  describedBy?: string
  /**
   * `sentence` (the default) is the quiet inline line used beside a create affordance. `pill` is
   * the bordered control for a page that has nothing else on it — bordered rather than filled,
   * because entering a code can still miss. `door` is the hero's second way in, sized to the
   * starter row beside it. `dock` is the fixed corner pill that appears once the door scrolls away.
   */
  variant?: 'sentence' | 'pill' | 'door' | 'dock'
  /**
   * `door` and `dock` only, and required for them: both are **controlled**, because the landing
   * page coordinates them with each other, with the paste listener and with `BackToFormCta`.
   * `sentence` and `pill` keep owning their own state and ignore these.
   */
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Forwarded to the panel. One-shot explanation of a panel the visitor did not open. */
  notice?: string
  /** Forwarded to the panel. Pre-entered poll code, selected so one keystroke replaces it. */
  prefill?: string
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
 * 2. **For `sentence` and `pill`, `isOpen` lives here, not in the page.** Both landing compositions
 *    are always in the DOM and swapped with CSS, so there are two triggers; each owning its own
 *    dialog is what makes focus return to the trigger that was actually pressed. `door` and `dock`
 *    are the exception and are **controlled**, because on `/` the two of them, the paste listener
 *    and `BackToFormCta` all have to agree on which single surface is open.
 *
 * The trigger itself ships in the prerendered markup with no storage gate and no CSS toggle of its
 * own, so it stays out of the page's pre-paint layout contract.
 */
export const JoinTrigger = ({
  describedBy,
  isOpen = false,
  notice,
  onOpenChange,
  prefill,
  variant = 'sentence',
}: JoinTriggerProps): React.ReactNode => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const panelId = `${useId()}-panel`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(isOpen)

  // Focus return on every close path, and it has to live HERE rather than in the panel. The panel
  // closes by calling `onOpenChange(false)` and is then unmounted by this component — at which
  // instant the focused element is inside the subtree being removed, so the browser drops focus to
  // `<body>` and a keyboard visitor who pressed Escape restarts the page. The trigger is the one
  // control guaranteed to still be mounted, so it is the one that can take focus back.
  //
  // Open-to-closed only, AND only when focus was actually lost. The narrower guard is the whole
  // point: "did it just close?" is not the same question as "was focus mine to give back?", and the
  // page closes this panel for reasons the visitor did not ask for -- pasting a poll link into "Name
  // your poll" closes the door's panel so the dock's can open. With the broad guard, that paste rips
  // the caret out of the field mid-paste and, on a scrolled page, scrolls to the trigger. A control
  // that steals focus from wherever you were is worse than one that drops it.
  //
  // `document.body`/`null` is exactly the state the browser leaves behind when it removes the
  // focused node, which is the only case this effect exists to repair. Escape-from-inside still
  // returns focus; the `Close` press is a no-op because focus is already on the trigger.
  useEffect(() => {
    const lostFocus = document.activeElement === null || document.activeElement === document.body
    if (wasOpenRef.current && !isOpen && lostFocus) {
      triggerRef.current?.focus()
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  if (variant === 'door' || variant === 'dock') {
    // Hierarchy is fill and width, never altitude. The door is full-width in its own column with a
    // resting --bone/6% wash; the dock is opaque. --copy-color for the door because, unlike the
    // 404's pill, it sits on SkyBackground and the page colour moves as the visitor scrolls — and
    // deliberately NOT for the dock, because --copy-color is a guarantee for text sitting *on* the
    // page, and the page slides underneath a fixed element. An opaque --field-background makes the
    // dock page-independent.
    const skin =
      variant === 'door'
        ? 'w-full bg-[var(--bone)]/[0.06] text-[var(--copy-color,var(--bone))]'
        : 'bg-[var(--field-background)] text-[var(--bone)] shadow-[0_10px_28px_rgba(0,0,0,0.4)]'

    return (
      // `relative` is the panel's positioning context: the panel is absolutely positioned and grows
      // out of flow, so opening it can never move the page.
      <div className="relative">
        <button
          // Only while open: the panel is mounted only when open, so a permanent `aria-controls` is
          // an IDREF pointing at nothing for most of the page's life -- JAWS offers to move to the
          // controlled element and lands nowhere. `aria-expanded` already carries the state.
          aria-controls={isOpen ? panelId : undefined}
          aria-describedby={describedBy}
          aria-expanded={isOpen}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--field-border)] px-5 text-sm font-bold ${skin} ${FOCUS_RING}`}
          onClick={() => onOpenChange?.(!isOpen)}
          ref={triggerRef}
          style={variant === 'door' ? { minHeight: STARTER_ROW_HEIGHT } : undefined}
          type="button"
        >
          {isOpen ? (
            // The panel's only *visible* dismissal — Escape is invisible — and the swap removes
            // every state where `Have a poll code?` is asked twice on one screen. Same shape as the
            // app's own `Show how it works` / `Hide how it works`.
            <>
              <X aria-hidden="true" className="h-4 w-4" />
              {JOIN_COPY.closeLabel}
            </>
          ) : variant === 'door' ? (
            JOIN_COPY.heading
          ) : (
            <>
              <KeyRound aria-hidden="true" className="h-4 w-4" />
              {JOIN_TRIGGER_COPY.preface}
              {/* The visible words are a literal prefix of the accessible name (WCAG 2.5.3), which
                  is why the extension is sr-only text and not an aria-label. `srSuffix` opens with
                  its own space, so the one literal space here sits before `control`. */}
              <span className="sr-only">
                {' '}
                {JOIN_TRIGGER_COPY.control}
                {JOIN_TRIGGER_COPY.srSuffix}
              </span>
            </>
          )}
        </button>
        {isOpen ? (
          <JoinPanelLazy
            anchor={variant}
            id={panelId}
            notice={notice}
            onOpenChange={(open) => onOpenChange?.(open)}
            prefill={prefill}
          />
        ) : null}
      </div>
    )
  }

  return (
    <>
      {variant === 'pill' ? (
        <button
          className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--field-border)] px-5 text-sm font-bold text-[var(--bone)] hover:bg-[var(--bone)]/[0.06] ${FOCUS_RING}`}
          onClick={() => setIsDialogOpen(true)}
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
            onClick={() => setIsDialogOpen(true)}
            type="button"
          >
            {JOIN_TRIGGER_COPY.control}
            <span className="sr-only">{JOIN_TRIGGER_COPY.srSuffix}</span>
          </button>
        </p>
      )}
      {isDialogOpen ? <JoinDialogImpl isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} /> : null}
    </>
  )
}
