import { Modal } from '@heroui/react'
import { Check, CircleAlert, WifiOff } from 'lucide-react'
import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'
import { PillButton } from '@components/ui/pill-button'

/**
 * Every string the dialog can put on screen, in one place.
 *
 * Final after a three-lens copy review (UX, Pinker, voice-against-sample). The diagnosis comes
 * first and the recovery is an imperative; pre-request validation is a fragment with no stop, and
 * post-request failures are full sentences with one. Changing a string here is a copy decision, not
 * a code change.
 */
export const JOIN_COPY = {
  closeLabel: 'Close',
  empty: 'Enter your poll code or link',
  fieldLabel: 'Poll code or link',
  /** Shown while the lookup is in flight, on the submit button and in the status region. */
  finding: 'Finding your poll…',
  firstMiss: (spokenCode: string): string => `Couldn't find ${spokenCode}. Check the spelling and try again.`,
  firstMissLong: "Couldn't find that poll code. Check the spelling and try again.",
  firstMissNote: "If it's right, the poll may have closed.",
  heading: 'Join a poll',
  hint: 'Like lazy giraffe. A whole poll link works too.',
  offline: "Couldn't look that up. Check your connection and try again.",
  placeholder: 'lazy giraffe',
  refusal: "Couldn't read that as a poll code.",
  refusalNote: 'Enter the poll code, like lazy giraffe, or paste the whole poll link.',
  secondMiss: 'Still no poll with that code. Check it against what you were sent.',
  secondMissNote: 'If it matches, the poll may have closed. Ask whoever sent it for the link.',
  serverFailure: 'Something went wrong looking that up. Try again.',
  submit: 'Join poll',
  successCode: (spokenCode: string): string => `Poll code: ${spokenCode}`,
  successHeadline: (pollName: string): string => `Opening ${pollName}…`,
}

/**
 * The shell every overlay in this app wears: blurred backdrop, small container, corner close.
 *
 * It sets **no panel background and no radius**. HeroUI's `.modal__dialog` supplies `bg-overlay`
 * and `min(32px, var(--radius-3xl))`, and none of the app's other modals override them — a
 * hand-set panel here would be the one overlay that looks slightly wrong beside the other three.
 *
 * `placement="auto"` is HeroUI's responsive default: pinned to the bottom edge below `sm`, where a
 * thumb is, and centred above it.
 */
export const JoinDialogFrame = ({
  children,
  isOpen,
  onOpenChange,
}: {
  children: React.ReactNode
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}): React.ReactNode => (
  <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
    <Modal.Backdrop variant="blur">
      <Modal.Container placement="auto" size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={JOIN_COPY.closeLabel} />
          <Modal.Header>
            <Modal.Heading className="pr-8">{JOIN_COPY.heading}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4 p-0.5">{children}</div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
)

export interface JoinFieldProps {
  describedBy: string
  id: string
  inputRef: React.RefObject<HTMLInputElement | null>
  isInvalid: boolean
  isPending: boolean
  onChange: (value: string) => void
  value: string
}

/**
 * The one field, with a real `<label for>` — not an `aria-label`, and not the placeholder, both of
 * which leave the field unnamed for anyone reading with speech and unhittable for anyone using
 * voice control.
 *
 * `--field-border`, never `--hair`: `--hair` is a 22%-alpha line that reads about 1.5:1 against the
 * panel, under the 3:1 floor WCAG sets for the boundary of a control.
 *
 * The four autofill attributes are off because a poll code is somebody else's identifier, typed
 * once. Browser form history would keep it in a datalist on a shared device, and autocorrect would
 * quietly rewrite two ordinary words into two other ordinary words.
 *
 * In flight the field goes `readonly` + `aria-disabled`, never `disabled`: `disabled` drops the
 * element out of the tab order with the caret still in it, which strands keyboard focus on nothing.
 */
export const JoinField = ({
  describedBy,
  id,
  inputRef,
  isInvalid,
  isPending,
  onChange,
  value,
}: JoinFieldProps): React.ReactNode => (
  <div className="flex w-full flex-col gap-2">
    <label className="text-[13px] font-semibold text-[var(--bone)]" htmlFor={id}>
      {JOIN_COPY.fieldLabel}
    </label>
    <input
      aria-describedby={describedBy}
      aria-disabled={isPending || undefined}
      aria-invalid={isInvalid || undefined}
      autoCapitalize="none"
      autoComplete="off"
      autoCorrect="off"
      className={`h-13 w-full rounded-full border-[length:var(--field-border-width)] border-solid border-[var(--field-border)] bg-[var(--field-background)] px-5 text-base text-[var(--field-foreground)] placeholder:text-[var(--slate)] read-only:opacity-60 ${FOCUS_RING}`}
      enterKeyHint="go"
      id={id}
      name="poll-code"
      onChange={(event) => onChange(event.target.value)}
      placeholder={JOIN_COPY.placeholder}
      readOnly={isPending}
      ref={inputRef}
      spellCheck={false}
      type="text"
      value={value}
    />
  </div>
)

export const JoinHint = ({ id }: { id: string }): React.ReactNode => (
  <p className="text-[13px] leading-relaxed text-[var(--slate)]" id={id}>
    {JOIN_COPY.hint}
  </p>
)

export interface JoinErrorState {
  lines: string[]
  /** Picks the glyph only. The words carry the state; nothing here depends on colour. */
  variant: 'alert' | 'offline'
}

/**
 * The error region, mounted on the dialog's first commit with nothing in it.
 *
 * A `role="alert"` that enters the DOM already populated is announced by nothing at all — NVDA,
 * JAWS and VoiceOver watch regions that already exist for changes. So this element is always here
 * and `error` arrives on a later commit.
 */
export const JoinError = ({ error, id }: { error?: JoinErrorState; id: string }): React.ReactNode => (
  <div id={id} role="alert">
    {error ? (
      <div
        className={`flex gap-2.5 rounded-2xl border p-3 ${
          error.variant === 'offline'
            ? 'border-[var(--slate)] bg-[var(--slate)]/10'
            : 'border-[var(--danger)] bg-[var(--danger)]/10'
        }`}
      >
        {error.variant === 'offline' ? (
          <WifiOff aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--bone)]" />
        ) : (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--danger)]" />
        )}
        <div className="flex flex-col gap-1">
          {error.lines.map((line, index) => (
            <p
              className={
                index === 0 ? 'text-sm leading-relaxed break-words text-[var(--bone)]' : 'text-sm text-[var(--slate)]'
              }
              key={line}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    ) : null}
  </div>
)

/**
 * The progress region, mounted empty for the same reason the error region is.
 *
 * Deliberately never populated on success: the success headline takes focus and is announced by
 * that, and filling this too makes a screen reader say the same fact twice.
 */
export const JoinStatus = ({ text }: { text: string }): React.ReactNode => (
  <p className="sr-only" role="status">
    {text}
  </p>
)

export const JoinSubmit = ({ isLoading, onPress }: { isLoading: boolean; onPress: () => void }): React.ReactNode => (
  <PillButton isLoading={isLoading} label={JOIN_COPY.submit} loadingLabel={JOIN_COPY.finding} onPress={onPress} />
)

export interface JoinSuccessProps {
  headlineRef: React.RefObject<HTMLParagraphElement | null>
  /** The poll's real name. Falls back to the code, which is all we have when the name is blank. */
  pollName: string
  spokenCode: string
}

/**
 * Visible for about a second — navigating to `/p/<code>` is a full document load — and worth the
 * second, because it is the only place the code the visitor typed is answered with the poll's
 * actual name.
 *
 * The headline is focused by the dialog on mount, which is what announces it. `tabIndex={-1}` lets
 * it accept focus without joining the tab order.
 */
export const JoinSuccess = ({ headlineRef, pollName, spokenCode }: JoinSuccessProps): React.ReactNode => (
  <div className="flex flex-col items-center gap-4 py-2 text-center">
    <span className="inline-flex h-13 w-13 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]">
      <Check aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
    </span>
    <p
      className="text-base leading-relaxed font-semibold break-words text-[var(--bone)]"
      ref={headlineRef}
      tabIndex={-1}
    >
      {JOIN_COPY.successHeadline(pollName || spokenCode)}
    </p>
    {pollName ? <p className="text-sm text-[var(--slate)]">{JOIN_COPY.successCode(spokenCode)}</p> : null}
  </div>
)
