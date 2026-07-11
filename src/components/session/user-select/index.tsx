import { useMutation } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  ConfirmButton,
  CreateNewOption,
  ErrorMessage,
  InviteSection,
  SectionContainer,
  SectionTitle,
  UserOption,
} from './elements'
import { useAuthContext } from '@components/auth-context'
import { createUser, parseApiMessage } from '@services/api'
import { User } from '@types'
import { displayName } from '@utils/users'

export interface UserSelectPhaseProps {
  sessionId: string
  users: User[]
  onUserSelected: (userId: string) => void
}

const UserSelectPhase = ({ sessionId, users, onUserSelected }: UserSelectPhaseProps): React.ReactNode => {
  const { isSignedIn, isLoading: isAuthLoading } = useAuthContext()
  const [selected, setSelected] = useState<string | null>(null)
  const [createNew, setCreateNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoCreateFired = useRef(false)

  // Keep a ref so the mutation closure always reads the latest value.
  const isSignedInRef = useRef(isSignedIn)
  isSignedInRef.current = isSignedIn

  const createMutation = useMutation({
    mutationFn: () => createUser(sessionId, isSignedInRef.current),
    onSuccess: (newUser) => {
      onUserSelected(newUser.userId)
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.response) {
        if (err.response.statusCode === 400) {
          setError(parseApiMessage(err.response.body, 'This group is full.'))
          return
        }
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

  const handleConfirm = (): void => {
    if (isAuthLoading) return
    if (createNew) {
      createMutation.mutate()
    } else if (selected) {
      onUserSelected(selected)
    }
  }

  // While auto-creating, show nothing (loading handled by parent)
  if (isEmpty) return null

  return (
    <SectionContainer>
      <SectionTitle>{users.length === 1 ? 'Welcome back' : 'Back again? Choose your name'}</SectionTitle>

      <div className="flex flex-col gap-2">
        <CreateNewOption
          checked={createNew}
          onChange={() => {
            setCreateNew(true)
            setSelected(null)
          }}
        />
        {users.map((user) => (
          <UserOption
            checked={!createNew && selected === user.userId}
            key={user.userId}
            label={displayName(user)}
            onChange={() => {
              setSelected(user.userId)
              setCreateNew(false)
            }}
          />
        ))}
      </div>

      {error && <ErrorMessage message={error} />}

      <ConfirmButton
        isDisabled={!createNew && !selected}
        isLoading={createMutation.isPending || isAuthLoading}
        onPress={handleConfirm}
      />

      <InviteSection sessionId={sessionId} />
    </SectionContainer>
  )
}

export default UserSelectPhase
