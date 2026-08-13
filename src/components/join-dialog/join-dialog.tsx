import React, { useId } from 'react'

import {
  JOIN_COPY,
  JoinDialogFrame,
  JoinError,
  JoinField,
  JoinHint,
  JoinStatus,
  JoinSubmit,
  JoinSuccess,
} from './elements'
import { useJoinLookup } from './use-join-lookup'

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
 *
 * The lookup itself lives in `useJoinLookup`, shared with the non-modal panel. What stays here is
 * the modal shape and the `id`s: ids belong to the surface, so two surfaces on one page cannot
 * collide.
 */
export const JoinDialog = ({ isOpen, onOpenChange }: JoinDialogProps): React.ReactNode => {
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const lookup = useJoinLookup()

  return (
    <JoinDialogFrame isOpen={isOpen} onOpenChange={onOpenChange}>
      {lookup.success ? (
        <JoinSuccess
          headlineRef={lookup.headlineRef}
          pollName={lookup.success.pollName}
          spokenCode={lookup.success.spokenCode}
        />
      ) : (
        <form className="flex flex-col gap-4" noValidate onSubmit={lookup.submit}>
          <JoinField
            describedBy={lookup.error ? `${errorId} ${hintId}` : hintId}
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
      {/* Mounted here rather than inside the form, so it survives the swap to the success state
          still empty. Populated only while a lookup is in flight. */}
      <JoinStatus text={lookup.isPending ? JOIN_COPY.finding : ''} />
    </JoinDialogFrame>
  )
}
