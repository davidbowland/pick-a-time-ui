import { toast } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useRef, useState } from 'react'

import { firstUnvotedIndex } from '../helpers'
import {
  ActionRow,
  BracketButton,
  MatchupContainer,
  TournamentHeader,
  VoteCallToAction,
  VotingContainer,
  VsLabel,
} from './elements'
import { useAuthContext } from '@components/auth-context'
import BracketView from '@components/bracket-view'
import RestaurantCard from '@components/restaurant-card'
import { FilterClosingSoonBadge, SoloVoterHint } from '@components/session/elements'
import Share from '@components/share'
import { patchUser, hasErrorCode } from '@services/api'
import { ChoicesMap, ErrorCode, SessionData, User } from '@types'
import { displayName } from '@utils/users'

const VOTE_ACCEPT_DELAY_MS = 300 // Time green check shows

export interface VotingPhaseProps {
  sessionId: string
  session: SessionData
  currentUser: User
  choices: ChoicesMap
  usersCount: number
}

const VotingPhase = ({ sessionId, session, currentUser, choices, usersCount }: VotingPhaseProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const { isSignedIn } = useAuthContext()
  const [bracketOpen, setBracketOpen] = useState(false)

  const currentRound = session.currentRound
  const matchups = session.bracket[currentRound] ?? []

  const [pendingVote, setPendingVote] = useState<{ idx: number; choiceId: string } | null>(null)
  const pendingVoteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const matchupRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  useEffect(() => {
    return () => clearTimeout(pendingVoteTimer.current)
  }, [])

  const realMatchupIndex = firstUnvotedIndex(session, currentUser)
  const isPending = pendingVote !== null

  // While a vote result is being shown, hold on the previous matchup
  const matchupIndex = isPending ? pendingVote.idx : realMatchupIndex

  useEffect(() => {
    if (realMatchupIndex !== -1 && !isPending) {
      if (hasScrolled.current) {
        matchupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      hasScrolled.current = true
    }
  }, [realMatchupIndex, isPending])

  if (matchupIndex === -1) return null

  const matchup = matchups[matchupIndex]
  const [choiceA, choiceB] = matchup ?? ['', '']

  const voteMutation = useMutation({
    mutationFn: ({ idx, choiceId }: { idx: number; choiceId: string }) =>
      patchUser(
        sessionId,
        currentUser.userId,
        [{ op: 'replace', path: `/votes/${currentRound}/${idx}`, value: choiceId }],
        isSignedIn,
      ),
    onMutate: async ({ idx, choiceId }) => {
      setPendingVote({ idx, choiceId })
      await queryClient.cancelQueries({ queryKey: ['users', sessionId] })
      const previous = queryClient.getQueryData<User[]>(['users', sessionId])
      queryClient.setQueryData<User[]>(['users', sessionId], (old) =>
        old?.map((u) => {
          if (u.userId !== currentUser.userId) return u
          const roundVotes = u.votes[currentRound] ?? []
          const padded = Array.from({ length: Math.max(matchups.length, roundVotes.length) }, (_, i) =>
            i === idx ? choiceId : (roundVotes[i] ?? null),
          )
          return {
            ...u,
            votes: u.votes.map((r, ri) => (ri === currentRound ? padded : r)),
          }
        }),
      )
      return { previous }
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(['users', sessionId], context?.previous)
      setPendingVote(null)
      if (hasErrorCode(err, ErrorCode.ROUND_NOT_CURRENT)) {
        toast.info('Round was advanced, moving to the next round.')
        void queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
        return
      }
      toast.danger('Vote failed. Please try again.')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
      clearTimeout(pendingVoteTimer.current)
      pendingVoteTimer.current = setTimeout(() => setPendingVote(null), VOTE_ACCEPT_DELAY_MS)
    },
  })

  const handleVote = (choiceId: string): void => {
    if (voteMutation.isPending || pendingVote !== null) return
    voteMutation.mutate({ idx: matchupIndex, choiceId })
  }

  const nameMutation = useMutation({
    mutationFn: (newName: string) =>
      patchUser(sessionId, currentUser.userId, [{ op: 'replace', path: '/name', value: newName }], isSignedIn),
    onMutate: async (newName) => {
      await queryClient.cancelQueries({ queryKey: ['users', sessionId] })
      const previous = queryClient.getQueryData<User[]>(['users', sessionId])
      queryClient.setQueryData<User[]>(['users', sessionId], (old) =>
        old?.map((u) => (u.userId === currentUser.userId ? { ...u, name: newName } : u)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['users', sessionId], context?.previous)
      toast.danger('Failed to update name. Please try again.')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
    },
  })

  const handleNameSave = (newName: string): void => {
    if (newName && newName !== currentUser.name) {
      nameMutation.mutate(newName)
    }
  }

  return (
    <VotingContainer>
      {usersCount <= 1 && session.currentRound === 0 && <SoloVoterHint />}
      {session.filterClosingSoon && <FilterClosingSoonBadge />}

      <TournamentHeader
        matchCurrent={matchupIndex + 1}
        matchTotal={matchups.length}
        onNameSave={handleNameSave}
        playerName={displayName(currentUser)}
        roundCurrent={currentRound + 1}
        roundTotal={session.totalRounds}
      />

      <VoteCallToAction />

      <MatchupContainer ref={matchupRef}>
        {(() => {
          const isBusy = voteMutation.isPending || pendingVote !== null
          const votedId =
            pendingVote?.choiceId ?? (voteMutation.isPending ? voteMutation.variables?.choiceId : undefined)
          // Only show overlays if the voted choice is one of the CURRENT matchup cards;
          // prevents both cards showing ✗ when an optimistic update advances to the next matchup
          const votedForCurrent = votedId !== undefined && (votedId === choiceA || votedId === choiceB)
          return (
            <>
              <RestaurantCard
                choice={choices[choiceA] ?? { choiceId: choiceA, name: choiceA, photos: [] }}
                disabled={isBusy}
                key={choiceA}
                onClick={() => handleVote(choiceA)}
                selected={votedForCurrent ? votedId === choiceA : undefined}
                variant="voting"
              />
              <VsLabel />
              <RestaurantCard
                choice={choices[choiceB] ?? { choiceId: choiceB, name: choiceB, photos: [] }}
                disabled={isBusy}
                key={choiceB}
                onClick={() => handleVote(choiceB)}
                selected={votedForCurrent ? votedId === choiceB : undefined}
                variant="voting"
              />
            </>
          )
        })()}
      </MatchupContainer>

      <ActionRow>
        <BracketButton onPress={() => setBracketOpen(true)} />
        <Share sessionId={sessionId} userId={currentUser.userId} />
      </ActionRow>

      <BracketView choices={choices} onClose={() => setBracketOpen(false)} open={bracketOpen} session={session} />
    </VotingContainer>
  )
}

export default VotingPhase
