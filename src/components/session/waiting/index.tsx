import { toast } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

import {
  ActionRow,
  BracketButton,
  ConfirmDialog,
  ForceRoundButton,
  NotifyAuthGate,
  NotifyCheckbox,
  NotifySection,
  PhoneInput,
  ProgressText,
  WaitingContainer,
} from './elements'
import { useAuthContext } from '@components/auth-context'
import BracketView from '@components/bracket-view'
import { FilterClosingSoonBadge, SoloVoterHint } from '@components/session/elements'
import Share from '@components/share'
import { usePhoneInput } from '@hooks/use-phone-input'
import { closeRound, patchUser, subscribeToRound, hasErrorCode } from '@services/api'
import { ChoicesMap, ErrorCode, SessionData, User } from '@types'
import { isSoloVoter } from '@utils/users'

export interface WaitingPhaseProps {
  sessionId: string
  session: SessionData
  currentUser: User
  choices: ChoicesMap
}

const WaitingPhase = ({ sessionId, session, currentUser, choices }: WaitingPhaseProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const { isSignedIn, handleSignIn } = useAuthContext()
  const [bracketOpen, setBracketOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notifyChecked, setNotifyChecked] = useState(false)
  const [hasShared, setHasShared] = useState(false)
  const phoneInput = usePhoneInput()
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'saving' | 'subscribed'>('idle')

  const currentRound = session.currentRound

  const closeMutation = useMutation({
    mutationFn: () => closeRound(sessionId, currentRound),
    onSuccess: (updatedSession) => {
      setConfirmOpen(false)
      queryClient.setQueryData<SessionData>(['session', sessionId], updatedSession)
    },
    onError: (err) => {
      setConfirmOpen(false)
      if (hasErrorCode(err, ErrorCode.ROUND_NOT_CURRENT)) {
        toast.info('Round already advanced.')
        void queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
        return
      }
      toast.danger('Failed to advance round. Please try again.')
    },
  })

  const phoneMutation = useMutation({
    mutationFn: (phone: string) =>
      patchUser(sessionId, currentUser.userId, [{ op: 'replace', path: '/phone', value: phone }], isSignedIn),
  })

  const savePhoneAndSubscribe = async (phone?: string): Promise<void> => {
    setNotifyStatus('saving')
    try {
      if (phone) {
        await phoneMutation.mutateAsync(phone)
      }
      await subscribeToRound(sessionId, currentRound + 1, currentUser.userId, isSignedIn)
      setNotifyStatus('subscribed')
    } catch {
      setNotifyChecked(false)
      setNotifyStatus('idle')
    }
  }

  const handleNotifyToggle = async (): Promise<void> => {
    if (notifyChecked) {
      setNotifyChecked(false)
      return
    }
    setNotifyChecked(true)
    if (currentUser.phone) {
      await savePhoneAndSubscribe()
    }
  }

  const handlePhoneSubmit = async (): Promise<void> => {
    phoneInput.showError()
    if (!phoneInput.isValid) return
    await savePhoneAndSubscribe(phoneInput.value)
  }

  const solo = isSoloVoter(session)

  return (
    <WaitingContainer>
      {solo && !hasShared && <SoloVoterHint />}
      {session.filterClosingSoon && <FilterClosingSoonBadge />}

      <ProgressText
        finished={session.votersSubmitted}
        subtitle={solo ? 'Wrapping up this round...' : 'Waiting for others to finish voting...'}
        total={session.voterCount}
      />

      {/* Notification opt-in grouped together */}
      <NotifySection>
        {isSignedIn ? (
          <>
            <NotifyCheckbox
              checked={notifyChecked}
              disabled={notifyStatus === 'subscribed'}
              onChange={handleNotifyToggle}
              subscribed={notifyStatus === 'subscribed'}
            />
            {notifyChecked && !currentUser.phone && notifyStatus !== 'subscribed' && (
              <PhoneInput
                error={phoneInput.error}
                isLoading={notifyStatus === 'saving'}
                isValid={phoneInput.isValid}
                onChange={phoneInput.onChange}
                onSubmit={handlePhoneSubmit}
                value={phoneInput.value}
              />
            )}
          </>
        ) : (
          <NotifyAuthGate onSignIn={handleSignIn} />
        )}
      </NotifySection>

      {/* Action buttons in a compact row */}
      <ActionRow>
        <BracketButton onPress={() => setBracketOpen(true)} />
        <div onClick={() => setHasShared(true)}>
          <Share sessionId={sessionId} userId={currentUser.userId} />
        </div>
        <ForceRoundButton isLoading={closeMutation.isPending} onPress={() => setConfirmOpen(true)} />
      </ActionRow>

      {confirmOpen && (
        <ConfirmDialog
          isLoading={closeMutation.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => closeMutation.mutate()}
          open={confirmOpen}
        />
      )}

      <BracketView choices={choices} onClose={() => setBracketOpen(false)} open={bracketOpen} session={session} />
    </WaitingContainer>
  )
}

export default WaitingPhase
