import React, { useEffect, useId, useRef, useState } from 'react'

import { JOIN_COPY, JoinError, JoinField, JoinHint, JoinStatus, JoinSubmit, JoinSuccess } from './elements'
import { useJoinLookup } from './use-join-lookup'

export interface JoinPanelImplProps {
  /** Which trigger this panel hangs off. Positioning only — the contents are identical. */
  anchor: 'dock' | 'door'
  /** The trigger's `aria-controls` target. */
  id: string
  /** One-shot explanation of a displacement. Cleared by the first submit; never shown beside an error. */
  notice?: string
  onOpenChange: (open: boolean) => void
  /** Applied once, on mount, then selected — so one keystroke replaces the whole code. */
  prefill?: string
}

// Grows out of flow at both anchors, so opening it can never move the page: upward from the dock in
// the bottom-left corner, downward from the door in the hero's copy column.
const ANCHOR_CLASS: Record<JoinPanelImplProps['anchor'], string> = {
  dock: 'bottom-[calc(100%+8px)] left-0',
  door: 'top-[calc(100%+8px)] left-0',
}

/**
 * The join surface on `/`. A non-modal disclosure: no backdrop, no dim, no focus trap, no `inert`.
 * The page behind stays lit and operable.
 *
 * Deliberately **not** `role="dialog"` — that role promises a modality this surface does not have.
 *
 * Mounted only while open — mounting IS open, which is why there is no `isOpen` prop. That is also
 * what keeps `elements.tsx`, and through it HeroUI's `Modal`, out of the landing page's first-paint
 * chunk.
 */
export const JoinPanelImpl = ({ anchor, id, notice, onOpenChange, prefill }: JoinPanelImplProps): React.ReactNode => {
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const nameId = `${fieldId}-name`
  const noticeId = `${fieldId}-notice`
  const lookup = useJoinLookup()
  const panelRef = useRef<HTMLDivElement>(null)

  // Mount only. A `prefill` that arrived later would overwrite whatever the visitor had already
  // typed, so the value is read once and never watched.
  useEffect(() => {
    if (!prefill) return
    lookup.onChange(prefill)
  }, [])

  // Selected in a frame of its own rather than straight after the value lands, because `useJoinLookup`
  // moves focus into the field in ITS animation frame and this effect is registered after that one.
  // Same frame, later callback: focus lands first, then the selection goes on top of it.
  useEffect(() => {
    if (!prefill) return
    const frame = requestAnimationFrame(() => lookup.inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [])

  // Escape comes free from HeroUI's `Modal` for the dialog; a disclosure gets nothing, so it is
  // hand-written here. The trigger is never unmounted while its panel is open, so closing hands focus
  // back to a control that is still on the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // Scoped to the panel and its trigger, not the document. This surface is deliberately
      // non-modal -- the page behind stays lit and operable -- so swallowing every Escape on the
      // page would take the key away from the very thing that choice exists to preserve: someone
      // who clicked into "Name your poll" with the panel still open and presses Escape to dismiss
      // an autofill dropdown. It is the ARIA disclosure convention too: Escape applies when focus
      // is within the component or on the control that opened it. Matched by `aria-controls`
      // pointing at THIS panel -- `[aria-expanded="true"]` would match any expanded disclosure on the
      // page, and this one shares a page with the story toggle, the recents expander and the create
      // form's summaries.
      const target = event.target as Node | null
      const inPanel = target !== null && panelRef.current?.contains(target) === true
      const onTrigger = target instanceof Element && target.closest(`[aria-controls="${id}"]`) !== null
      if (!inPanel && !onTrigger) return
      onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onOpenChange])

  // A live region that enters the DOM already populated is announced by nothing at all, and this
  // panel mounts only when it opens -- so a notice passed in as a prop would be present on the
  // region's very first commit. It is therefore held back and set one commit later, in the same
  // frame that moves focus.
  const [isNoticeShown, setIsNoticeShown] = useState(false)
  useEffect(() => {
    if (!notice) return
    const frame = requestAnimationFrame(() => setIsNoticeShown(true))
    return () => cancelAnimationFrame(frame)
  }, [notice])

  // The notice explains why this panel opened. Once a lookup has been attempted it is either
  // irrelevant or actively contradicting the error beneath it, so it ends at the first submit.
  const visibleNotice = isNoticeShown && notice && !lookup.hasSubmitted ? notice : undefined

  // The notice also rides the FIELD'S DESCRIPTION, not just the live region. A polite region fired in
  // the same tick as a focus move is routinely swallowed by the focus announcement -- and this
  // sentence is the only explanation a visitor gets for a panel they never opened taking their
  // cursor. Riding the description makes it part of the focus announcement itself, with no
  // live-region timing to get right. A notice and an error never coexist, so this stays a three-way
  // choice rather than a list.
  const describedBy = visibleNotice ? `${noticeId} ${hintId}` : lookup.error ? `${errorId} ${hintId}` : hintId

  return (
    <div
      aria-labelledby={nameId}
      className={`absolute z-50 flex w-[min(24rem,calc(100vw-40px))] flex-col gap-3.5 rounded-[32px] border-[length:var(--field-border-width)] border-solid border-[var(--field-border)] bg-[var(--surface)] p-5 shadow-[var(--overlay-shadow)] ${ANCHOR_CLASS[anchor]}`}
      // How the page's paste listener recognises its own surface. A paste landing in here is the
      // visitor using the field, so the reach stays out of it -- offering to explain a displacement
      // that did not happen would be nonsense. An attribute rather than the panel's `id`, because
      // the id is generated per trigger and the page would have to collect them all to match on it.
      data-join-panel=""
      id={id}
      ref={panelRef}
      role="group"
    >
      {/* A name, not a heading. A real heading here would put `Join a poll` on screen twice — once as
          the door's own label and once as the title of what the door opened. */}
      <span className="sr-only" id={nameId}>
        {JOIN_COPY.heading}
      </span>
      {lookup.success ? (
        <JoinSuccess
          headlineRef={lookup.headlineRef}
          pollName={lookup.success.pollName}
          spokenCode={lookup.success.spokenCode}
        />
      ) : (
        <form className="flex flex-col gap-3.5" noValidate onSubmit={lookup.submit}>
          {/* `live="polite"` is fixed for this slot's lifetime and is NOT derived from the variant —
              deriving it would make the role a function of the content, so the commit that gave the
              region its role would always be the commit that filled it, and a cleared notice would
              revert to `role="alert"`, leaving two alert regions on one surface. */}
          <JoinError
            error={visibleNotice ? { lines: [visibleNotice], variant: 'notice' } : undefined}
            id={noticeId}
            live="polite"
          />
          <JoinField
            describedBy={describedBy}
            id={fieldId}
            inputRef={lookup.inputRef}
            isInvalid={Boolean(lookup.error)}
            isPending={lookup.isPending}
            onChange={lookup.onChange}
            value={lookup.value}
          />
          <JoinHint id={hintId} />
          <JoinError error={lookup.error} id={errorId} />
          <JoinSubmit isLoading={lookup.isPending} onPress={() => lookup.submit()} />
        </form>
      )}
      {/* Outside the form, so it survives the swap to the success state still empty. */}
      <JoinStatus text={lookup.isPending ? JOIN_COPY.finding : ''} />
    </div>
  )
}
