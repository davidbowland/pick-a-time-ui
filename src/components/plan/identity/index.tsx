import { useMutation } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  ErrorMessage,
  GoogleSignInButton,
  SectionContainer,
  SectionTitle,
  SignInBenefitNote,
  UserOptions,
} from './elements'
import { useAuthContext } from '@components/auth-context'
import { PillArrowButton } from '@components/pill-arrow-button'
import { createUser, parseApiMessage } from '@services/api'
import { User } from '@types'
import { displayName } from '@utils/users'

export interface IdentityPhaseProps {
  sessionId: string
  users: User[]
  onUserSelected: (userId: string) => void
}

const IdentityPhase = ({ sessionId, users, onUserSelected }: IdentityPhaseProps): React.ReactNode => {
  const { isSignedIn, isLoading: isAuthLoading, handleSignIn } = useAuthContext()
  const [selected, setSelected] = useState<string | null>(null)
  const [createNew, setCreateNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoCreateFired = useRef(false)

  const isSignedInRef = useRef(isSignedIn)
  isSignedInRef.current = isSignedIn

  const createMutation = useMutation({
    mutationFn: () => createUser(sessionId, isSignedInRef.current),
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
        <PillArrowButton
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
      <SectionTitle>Who are you on this plan?</SectionTitle>
      <UserOptions
        createNew={createNew}
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
      {error && <ErrorMessage message={error} />}
      <PillArrowButton
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
