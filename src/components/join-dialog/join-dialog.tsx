import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import React, { useEffect, useId, useRef, useState } from 'react'

import {
  JOIN_COPY,
  JoinDialogFrame,
  JoinError,
  JoinErrorState,
  JoinField,
  JoinHint,
  JoinStatus,
  JoinSubmit,
  JoinSuccess,
} from './elements'
import { fetchPoll, hasStatusCode, parseApiMessage } from '@services/api'
import { parseSessionCode } from '@utils/session-code'

/**
 * Longest echo worth reading back inside an error. A pasted URL parses to whatever segment it
 * ended with, and repeating ninety characters of it in a sentence is noise, not evidence.
 */
const ECHO_MAX_LENGTH = 24

/** Codes are stored hyphenated and read aloud as words. Everything on screen uses the spoken form. */
const spoken = (code: string): string => code.replace(/-/g, ' ')

/**
 * The API's `ApiError.message` is built as `GET /sessions/<code>` — it carries the entered code
 * inside it, and anything that reaches the error boundary is `console.error`ed. So the body is read
 * for the API's own `message` field and the error object itself is never rendered, logged, or
 * re-thrown.
 */
const errorBody = (err: unknown): string | undefined =>
  (err as { response?: { body?: string } } | null | undefined)?.response?.body

export interface JoinDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Type a poll code (or paste the link), have it checked, and go to the poll.
 *
 * Reached only through `dynamic()` from `index.tsx`, and only once a trigger has been pressed — the
 * HeroUI `Modal` and the react-aria overlay tree behind it have no business in the landing page's
 * first-paint download.
 */
export const JoinDialog = ({ isOpen, onOpenChange }: JoinDialogProps): React.ReactNode => {
  const router = useRouter()
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const headlineRef = useRef<HTMLParagraphElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** The raw value handed to the last lookup, so `onError` never reads a value from a stale render. */
  const submittedRef = useRef('')
  /** Consecutive misses, and the value that produced the last one. See `handleSubmit`. */
  const missCountRef = useRef(0)
  const missedValueRef = useRef<string | undefined>(undefined)
  /**
   * Whether this dialog is still mounted, readable from a mutation callback.
   *
   * Mounted, not "open". `JoinTrigger` renders `{isOpen ? <JoinDialog/> : null}`, so closing
   * unmounts this component outright — it never re-renders with `isOpen: false`, and a ref tracking
   * the prop would sit at `true` forever. An unmount cleanup is the only thing that actually
   * observes the close.
   */
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  const [value, setValue] = useState('')
  const [error, setError] = useState<JoinErrorState | undefined>(undefined)
  const [success, setSuccess] = useState<{ pollName: string; spokenCode: string } | undefined>(undefined)

  /**
   * Focus the field, not the close button.
   *
   * react-aria-components focuses the first *tabbable* element in the overlay, which is the close
   * control — and the field is the only reason this dialog exists. Done in an animation frame so it
   * lands after the overlay's own autofocus rather than being undone by it.
   */
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  // The success headline takes focus, which is what announces it. This is also why the status
  // region below stays empty on success: announcing it twice says the same fact twice.
  useEffect(() => {
    if (success) headlineRef.current?.focus()
  }, [success])

  const failWith = (next: JoinErrorState): void => {
    // The error is set before focus moves, so the alert is queued first and the field is then
    // focused with its value selected: the typed value survives every failure, and a retry is one
    // keystroke rather than a retype.
    setError(next)
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  const missError = (code: string): JoinErrorState => {
    missCountRef.current += 1
    missedValueRef.current = code
    if (missCountRef.current >= 2) {
      return { lines: [JOIN_COPY.secondMiss, JOIN_COPY.secondMissNote], variant: 'alert' }
    }
    const spokenCode = spoken(code)
    const first = spokenCode.length > ECHO_MAX_LENGTH ? JOIN_COPY.firstMissLong : JOIN_COPY.firstMiss(spokenCode)
    return { lines: [first, JOIN_COPY.firstMissNote], variant: 'alert' }
  }

  const lookup = useMutation({
    mutationFn: (code: string) => fetchPoll(code),
    // 'always', not React Query v5's default of 'online'. An online-mode mutation fired while
    // offline is PAUSED: `mutationFn` never runs, `onError` never fires, and the offline message
    // below is unreachable. A paused mutation also has no cancel — it resumes on reconnect and
    // fires a navigation the user is no longer expecting. Erroring while offline is the honest
    // behaviour, and the only one that can be told to the person waiting.
    networkMode: 'always',
    onError: (err: unknown, code: string) => {
      // Structural, never `instanceof ApiError`: class identity fails silently wherever the module
      // is duplicated, including against an automocked `@services/api` — which this dialog's own
      // test uses.
      if (hasStatusCode(err, 404)) {
        failWith(missError(code))
        return
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        failWith({ lines: [JOIN_COPY.offline], variant: 'offline' })
        return
      }
      failWith({ lines: [parseApiMessage(errorBody(err), JOIN_COPY.serverFailure)], variant: 'alert' })
    },
    onSuccess: (poll, code) => {
      // A dismissed dialog must not navigate. `useMutation`'s callbacks still run after the
      // observer unmounts, so closing mid-lookup and letting it resolve would yank the visitor to
      // a poll a second after they decided against it — the same "navigation the user is no longer
      // expecting" that networkMode: 'always' exists to prevent, arriving through a different door.
      if (!isMountedRef.current) return

      setSuccess({ pollName: poll.name, spokenCode: spoken(code) })
      // Encoded, not concatenated: a value that survived the parser still must not be able to mean
      // a path of its own. Matches what every call in services/api already does.
      //
      // `.catch` because a rejected push leaves the success state on screen forever otherwise, and
      // "Opening…" that never opens is worse than an error.
      router.push(`/p/${encodeURIComponent(code)}`).catch(() => {
        setSuccess(undefined)
        failWith({ lines: [JOIN_COPY.serverFailure], variant: 'alert' })
      })
    },
  })

  const handleChange = (next: string): void => {
    setValue(next)
  }

  const handleSubmit = (event?: React.FormEvent): void => {
    event?.preventDefault()
    // One submission is one request. React Query does not retry mutations, but nothing stops a
    // second Enter while the first lookup is in flight except this.
    if (lookup.isPending) return
    setError(undefined)

    const raw = value.trim()
    if (!raw) {
      failWith({ lines: [JOIN_COPY.empty], variant: 'alert' })
      return
    }

    const code = parseSessionCode(raw)
    // The parser refuses what could mean something other than itself in a URL. It never refuses a
    // value for its shape, so this branch costs no request and never hides a real poll code.
    if (!code) {
      failWith({ lines: [JOIN_COPY.refusal, JOIN_COPY.refusalNote], variant: 'alert' })
      return
    }

    // Decided at submit, not on every keystroke. The earlier version tracked this in `onChange`,
    // which could never work: getting back to a value you already tried means typing through
    // `l`, `la`, `laz`… and every one of those intermediate values differs from the missed one, so
    // the counter was cleared long before the last character arrived. Someone re-reading the words
    // off a phone call — the exact person the second-miss copy is written for — could never reach
    // it. Comparing at submit is both smaller and correct.
    //
    // And it compares the PARSED code, not the raw text. `lazy giraffe`, `Lazy-Giraffe` and a
    // pasted link all mean the identifier `lazy-giraffe`; someone re-reading the words off a
    // message types a different string for the same poll almost every time. Keying on raw text
    // hands them the first-miss copy over and over for a code they have now tried three ways.
    if (code !== missedValueRef.current) {
      missCountRef.current = 0
      missedValueRef.current = undefined
    }

    submittedRef.current = raw
    lookup.mutate(code)
    // Focus follows the value, not the button. `PillButton` sets `isDisabled` while loading, and a
    // disabled control that had focus drops it — which takes Escape with it and leaves someone
    // unable to dismiss a dialog they are waiting on. The field stays `readonly` rather than
    // `disabled` for exactly this reason, so it is the one place focus can rest for the duration.
    inputRef.current?.focus()
  }

  return (
    <JoinDialogFrame isOpen={isOpen} onOpenChange={onOpenChange}>
      {success ? (
        <JoinSuccess headlineRef={headlineRef} pollName={success.pollName} spokenCode={success.spokenCode} />
      ) : (
        <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
          <JoinField
            describedBy={error ? `${errorId} ${hintId}` : hintId}
            id={fieldId}
            inputRef={inputRef}
            isInvalid={Boolean(error)}
            isPending={lookup.isPending}
            onChange={handleChange}
            value={value}
          />
          <JoinHint id={hintId} />
          <JoinError error={error} id={errorId} />
          <JoinSubmit isLoading={lookup.isPending} onPress={() => handleSubmit()} />
        </form>
      )}
      {/* Mounted here rather than inside the form, so it survives the swap to the success state
          still empty. Populated only while a lookup is in flight. */}
      <JoinStatus text={lookup.isPending ? JOIN_COPY.finding : ''} />
    </JoinDialogFrame>
  )
}
