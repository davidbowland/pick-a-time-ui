import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useRef, useState } from 'react'

import { EditNameButton, NameEditForm, NotYouButton } from './elements'
import { fetchConfig, patchUser } from '@services/api'
import { User } from '@types'
import { displayName } from '@utils/users'

export interface VoterIdentityControlProps {
  user: User
  sessionId: string
  isSignedIn: boolean
  onNotYou: () => void
}

const SAVE_ERROR_MESSAGE = "Couldn't save. Try again."

const VoterIdentityControl = ({
  user,
  sessionId,
  isSignedIn,
  onNotYou,
}: VoterIdentityControlProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditingRef = useRef(false)
  // Set right before a blur-triggered close (successful save or empty/unchanged no-op), and
  // read (then reset) by the focus-return effect below, so that close doesn't steal focus back
  // to the Edit button the way an explicit Escape/X cancel does — the voter blurred on purpose.
  const blurClosedRef = useRef(false)

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: fetchConfig, staleTime: Infinity })

  const renameMutation = useMutation({
    mutationFn: (trimmedName: string) =>
      patchUser(sessionId, user.userId, [{ op: 'replace', path: '/name', value: trimmedName }], isSignedIn),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
      setIsEditing(false)
    },
  })

  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      if (!blurClosedRef.current) editButtonRef.current?.focus()
      blurClosedRef.current = false
    }
    wasEditingRef.current = isEditing
  }, [isEditing])

  const currentName = displayName(user)
  const trimmedDraft = draftName.trim()

  const handleEditClick = (): void => {
    renameMutation.reset()
    setDraftName(currentName)
    setIsEditing(true)
  }

  const handleChange = (value: string): void => {
    if (renameMutation.isError) renameMutation.reset()
    setDraftName(value)
  }

  const handleCancel = (): void => {
    // Reset unconditionally: a prior blur-triggered save may have failed and left this `true`
    // (isEditing never became false during the error), which would otherwise wrongly suppress
    // focus-return on this explicit cancel.
    blurClosedRef.current = false
    renameMutation.reset()
    setIsEditing(false)
  }

  const handleBlur = (): void => {
    if (renameMutation.isPending) return
    blurClosedRef.current = true
    if (trimmedDraft && trimmedDraft !== currentName) {
      renameMutation.mutate(trimmedDraft)
    } else {
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <NameEditForm
        errorMessage={renameMutation.isError ? SAVE_ERROR_MESSAGE : undefined}
        isSaving={renameMutation.isPending}
        maxLength={config?.participantNameMaxLength}
        onBlur={handleBlur}
        onCancel={handleCancel}
        onChange={handleChange}
        value={draftName}
      />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[10rem] truncate text-sm font-semibold text-[var(--bone)]">{currentName}</span>
      <EditNameButton onPress={handleEditClick} ref={editButtonRef} />
      {!isSignedIn && <NotYouButton onPress={onNotYou} />}
    </div>
  )
}

export default VoterIdentityControl
