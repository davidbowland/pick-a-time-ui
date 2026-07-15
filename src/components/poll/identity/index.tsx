import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'

import {
  ErrorMessage,
  GoogleSignInButton,
  SectionContainer,
  SectionTitle,
  SignInBenefitNote,
  UserOptions,
} from './elements'
import { useAuthContext } from '@components/auth-context'
import { PillButton } from '@components/ui/pill-button'
import { VoterNameField } from '@components/ui/voter-name-field'
import { createUser, fetchConfig, parseApiMessage, patchUser } from '@services/api'
import { User } from '@types'
import { displayName } from '@utils/users'

export interface IdentityPhaseProps {
  sessionId: string
  users: User[]
  onUserSelected: (userId: string) => void
  lastUsedUserId?: string
}

const IdentityPhase = ({ sessionId, users, onUserSelected, lastUsedUserId }: IdentityPhaseProps): React.ReactNode => {
  const { isSignedIn, isLoading: isAuthLoading, handleSignIn } = useAuthContext()
  const [selected, setSelected] = useState<string | null>(null)
  const [createNew, setCreateNew] = useState(false)
  const [newVoterName, setNewVoterName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const autoCreateFired = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastUsedInputRef = useRef<HTMLInputElement>(null)
  const headingId = useId()

  const isSignedInRef = useRef(isSignedIn)
  isSignedInRef.current = isSignedIn

  // `lastUsedUserId` only becomes truthy when the poll page's "This isn't me" handler detaches
  // the current voter and swaps this picker back in — the poll's active-phase subtree (including
  // the button that was just clicked) unmounts in the process, so nothing else moves focus here.
  // Focus the matching "last used" radio option directly so picking yourself back is one
  // Enter/Space press away, with no need to tab past the heading first. Falls back to the heading
  // if that option isn't in the rendered list (e.g. removed server-side in the interim).
  // This intentionally does not fire on the very first mount of a brand-new, auto-creating poll:
  // that path shows no picker UI at all, and `lastUsedUserId` is never set to begin with.
  useEffect(() => {
    if (!lastUsedUserId) return
    if (lastUsedInputRef.current) lastUsedInputRef.current.focus()
    else headingRef.current?.focus()
  }, [lastUsedUserId])

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: fetchConfig, staleTime: Infinity })

  const createMutation = useMutation({
    mutationFn: async () => {
      const newUser = await createUser(sessionId, isSignedInRef.current)
      const trimmedName = newVoterName.trim()
      if (trimmedName && !isSignedInRef.current) {
        return patchUser(
          sessionId,
          newUser.userId,
          [{ op: 'replace', path: '/name', value: trimmedName }],
          isSignedInRef.current,
        )
      }
      return newUser
    },
    onSuccess: (newUser) => onUserSelected(newUser.userId),
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.response?.statusCode === 400) {
        setError(parseApiMessage(err.response.body, 'This group is full.'))
        return
      }
      setError("Couldn't join. Try again.")
    },
  })

  const isEmpty = users.length === 0
  const doAutoCreate = useCallback(() => {
    if (isEmpty && !isAuthLoading && !autoCreateFired.current) {
      autoCreateFired.current = true
      createMutation.mutate()
    }
  }, [isEmpty, isAuthLoading, createMutation])

  useEffect(() => {
    doAutoCreate()
  }, [doAutoCreate])

  if (isEmpty && !error) return null

  if (isEmpty) {
    return (
      <SectionContainer>
        {error && <ErrorMessage message={error} />}
        <PillButton
          isLoading={createMutation.isPending}
          label="Try again"
          loadingLabel="Joining..."
          onPress={() => createMutation.mutate()}
        />
      </SectionContainer>
    )
  }

  const handleConfirm = (): void => {
    if (isAuthLoading) return
    if (createNew) createMutation.mutate()
    else if (selected) onUserSelected(selected)
  }

  return (
    <SectionContainer>
      <SectionTitle id={headingId} ref={headingRef}>
        Who are you on this poll?
      </SectionTitle>
      <UserOptions
        createNew={createNew}
        headingId={headingId}
        lastUsedInputRef={lastUsedInputRef}
        lastUsedUserId={lastUsedUserId}
        onSelectCreateNew={() => {
          setCreateNew(true)
          setSelected(null)
        }}
        onSelectUser={(userId) => {
          setSelected(userId)
          setCreateNew(false)
        }}
        selected={selected}
        users={users.map((u) => ({ userId: u.userId, label: displayName(u) }))}
      />
      {createNew && !isSignedIn && (
        <VoterNameField
          label="Name"
          maxLength={config?.participantNameMaxLength}
          onChange={setNewVoterName}
          value={newVoterName}
        />
      )}
      {error && <ErrorMessage message={error} />}
      <PillButton
        isDisabled={!createNew && !selected}
        isLoading={createMutation.isPending || isAuthLoading}
        label="Continue"
        loadingLabel="Joining..."
        onPress={handleConfirm}
      />
      {!isSignedIn && (
        <>
          <GoogleSignInButton onPress={handleSignIn} />
          <SignInBenefitNote />
        </>
      )}
    </SectionContainer>
  )
}

export default IdentityPhase
