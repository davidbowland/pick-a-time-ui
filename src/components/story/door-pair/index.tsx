import React, { useId } from 'react'

import { JOIN_TRIGGER_COPY, JoinTrigger } from '@components/join-dialog'
import { HeroStarter } from '@components/story/hero-starter'

export interface DoorPairProps {
  /**
   * The pair's own outer element, so a caller can watch the door row itself scroll away. The landing
   * page needs it because the first-visit pair is handed to `HeroScene` as its `action` node: a
   * wrapper div there would break the `action.props.onStart` read that page's test makes, and the
   * hero section is a whole viewport tall, so observing the section instead would report the door as
   * on screen long after it has left.
   */
  containerRef?: React.RefObject<HTMLDivElement | null>
  isJoinOpen: boolean
  maxLength?: number
  name: string
  onJoinOpenChange: (open: boolean) => void
  onNameChange: (value: string) => void
  /**
   * `SceneLayout` renders `action` as a single node and `test/pages/index.test.tsx` reads
   * `action.props.onStart`, so this stays a direct prop rather than a field on an options object.
   */
  onStart: () => void
}

/**
 * The hero's two ways in, as one node: the starter and a `Join a poll` door sharing a top and a
 * bottom edge, each with its own caption.
 *
 * Hierarchy is fill and width, never altitude. The accent-filled Start still wins the page while the
 * join door is a bordered control nobody has to hunt for.
 *
 * **The row wraps rather than squeezing, and that was measured.** As a two-track grid the door's cell
 * is intrinsic while `HeroStarter` ships its Start button `shrink-0`, so the input absorbed the whole
 * loss: at 900px the field was 40px — exactly its own padding, zero pixels of text — and at 768px the
 * row overflowed its track by 87px and painted out past the door. An elastic wrapping flex row gives
 * the starter its entire column back instead.
 *
 * **Both columns are control-then-caption in every layout, visually and in the DOM.** An earlier
 * build lifted the join caption above its door once the pair wrapped, on the theory that a trailing
 * question is a question with nothing answering it. Measured on a phone, it was worse: the question
 * landed midway between the starter's caption above and its own door below, near enough to equal
 * spacing that it read as belonging to neither. Matching the starter's shape is what makes it
 * legible — the two columns then differ only in what they say, not in how they are built. Nothing
 * reorders, so there is no `order` for jsdom to miss and no visual-vs-DOM order to keep in sync.
 *
 * **Stacked, the door stays below the starter and stays intrinsically wide.** Both are hierarchy
 * calls. Reading order and visual order agree — a visitor meets the page's primary act first and the
 * alternate door after it — and the door earns no promotion from the window merely being narrow. It
 * is not stretched to the starter's width for the same reason: hierarchy here is fill *and* width,
 * so a full-bleed door would read as Start's peer rather than the second way in. The extra top
 * margin, on top of the row gap, is what separates two ways in that are no longer separated by being
 * side by side; the container query asks whether *this* column can hold both, which a viewport
 * breakpoint could not. Container queries cannot be exercised in jsdom, so it is verified in a
 * browser.
 */
export const DoorPair = ({
  containerRef,
  isJoinOpen,
  maxLength,
  name,
  onJoinOpenChange,
  onNameChange,
  onStart,
}: DoorPairProps): React.ReactNode => {
  // Both captions are `aria-describedby` targets. The start caption describes the starter input — an
  // association that did not exist before this build — and the join caption is the entire audience
  // filter on the door: without it the door announces as a bare `Join a poll` button, which says
  // nothing to the one person on the page who is not here to create anything.
  const startNoteId = useId()
  const joinNoteId = useId()

  return (
    <div className="@container flex w-full max-w-[33rem] flex-wrap items-start gap-x-3 gap-y-2.5" ref={containerRef}>
      <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2.5">
        <HeroStarter
          isPaired
          maxLength={maxLength}
          name={name}
          noteId={startNoteId}
          onNameChange={onNameChange}
          onStart={onStart}
        />
        {/* 0.85 alpha is safe here only because the door is always at scroll 0. `--copy-color` at
            70% bottoms out at 3.03:1 as the sky lightens, so this treatment must never be reused
            anywhere the sky has moved. */}
        <p className="text-sm text-[var(--copy-color,var(--bone))]/85" id={startNoteId}>
          Free, no account — set the dates on the next step.
        </p>
      </div>
      <div className="flex min-w-0 flex-[0_1_auto] flex-col gap-2.5 @max-[27rem]:mt-[18px]">
        <JoinTrigger describedBy={joinNoteId} isOpen={isJoinOpen} onOpenChange={onJoinOpenChange} variant="door" />
        {/* The two captions' moods differ on purpose. The start caption is a statement that removes
            an objection; this one is a question that identifies an audience the app cannot see.
            Forcing them into the same mood would cost the door the one property that makes it
            findable, so the asymmetry is a ruling, not an oversight. Full strength, not /85: this
            caption is the door's whole explanation. */}
        <p className="text-sm text-[var(--copy-color,var(--bone))]" id={joinNoteId}>
          {JOIN_TRIGGER_COPY.preface}
        </p>
      </div>
    </div>
  )
}
