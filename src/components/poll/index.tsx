import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'

import { ErrorState, LoadingState } from './elements'
import { derivePhase } from './helpers'
import IdentityPhase from './identity'
import { IntroExplainer } from './onboarding/elements'
import PaintingPhase from './painting'
import ResultsPhase from './results'
import VoterIdentityControl from './voter-identity'
import { useAuthContext } from '@components/auth-context'
import ErrorBoundary from '@components/error-boundary'
import Share from '@components/share'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { usePollOnboarding } from '@hooks/usePollOnboarding'
import { useSessionCookie } from '@hooks/useSessionCookie'
import { fetchPoll, fetchUsers } from '@services/api'
import { PollData, User } from '@types'
import { formatExpiration } from '@utils/dates'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'

const TAB_BASE_CLASS = `rounded-full px-4 py-1.5 text-sm font-bold transition-colors duration-150 ease-out ${FOCUS_RING}`

function tabSkinFor(isSelected: boolean): string {
  return isSelected ? 'bg-[var(--accent)] text-[var(--ink)]' : 'text-[var(--slate)] hover:text-[var(--bone)]'
}

function consumeQueryParamId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id') ?? undefined
  if (id) {
    params.delete('id')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }
  return id
}

export interface PollProps {
  sessionId: string
}

const PollComponent = ({ sessionId }: PollProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const { userId, setUserId, clearUserId } = useSessionCookie(sessionId)
  const { isSignedIn } = useAuthContext()
  const queryParamId = useMemo(() => consumeQueryParamId(), [])
  const [tab, setTab] = useState<'painting' | 'results'>('painting')
  const [lastUsedUserId, setLastUsedUserId] = useState<string | undefined>(undefined)
  const [notYouClicked, setNotYouClicked] = useState(false)

  const {
    data: poll,
    isError: isPollError,
    refetch: refetchPoll,
  } = useQuery<PollData>({ queryKey: ['poll', sessionId], queryFn: () => fetchPoll(sessionId) })
  const {
    data: users,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useQuery<User[]>({ queryKey: ['users', sessionId], queryFn: () => fetchUsers(sessionId) })

  const usersLoaded = users !== undefined
  const effectiveUserId = useMemo(() => {
    if (!users) return undefined
    if (!notYouClicked && queryParamId && users.some((u) => u.userId === queryParamId)) return queryParamId
    if (userId && users.some((u) => u.userId === userId)) return userId
    return undefined
  }, [queryParamId, userId, users, notYouClicked])

  const currentUser = useMemo(() => users?.find((u) => u.userId === effectiveUserId), [users, effectiveUserId])

  // A newly-created/selected user is set on the cookie immediately, but the `users` list is only
  // updated by the server on its own schedule — without invalidating it here, a brand-new user's
  // id never appears in the (stale) cached list, `effectiveUserId` never resolves, and the phase
  // machine stays stuck on `identity` forever. Invalidating forces a refetch that picks it up.
  const handleUserSelected = (newUserId: string): void => {
    setUserId(newUserId)
    // The previous voter's tab choice (e.g. "The overlap") must not carry over to whoever
    // joins next — every newly selected user starts on their own hours.
    setTab('painting')
    void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
    // Joining also bumps the poll's participantCount, which every "N of M free" total renders
    // against — left stale at its pre-join value, the results phase pairs it with a fresher
    // overlap and shows more people free than it says exist.
    void queryClient.invalidateQueries({ queryKey: ['poll', sessionId] })
  }

  const handleNotYou = (): void => {
    if (effectiveUserId) setLastUsedUserId(effectiveUserId)
    setNotYouClicked(true)
    clearUserId()
  }

  const phase = derivePhase(poll, usersLoaded, effectiveUserId != null, isPollError || isUsersError)
  const onboarding = usePollOnboarding(sessionId)
  const viewerTimezone = useMemo(() => detectViewerTimezone(), [])

  if (phase === 'error') {
    return (
      <ErrorState
        onRetry={() => {
          void refetchPoll()
          void refetchUsers()
        }}
      />
    )
  }

  if (phase === 'loading' || !poll) return <LoadingState />

  return (
    <div className="flex flex-col gap-6">
      {/* One header unit: title and actions share a row, the deadline tucks tight beneath —
          the share buttons never wrap into an orphan row of unlabeled chrome at any width. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl text-[var(--bone)]" style={{ fontFamily: 'var(--font-display)' }}>
            {poll.name}
          </h1>
          {phase !== 'identity' && <Share pollName={poll.name} sessionId={sessionId} />}
        </div>
        <p className="text-xs text-[var(--slate)]">{formatExpiration(poll.expiration, viewerTimezone)}</p>
      </div>
      {phase === 'identity' ? (
        <>
          {onboarding.showIntro && (
            <IntroExplainer dateCount={poll.dates.length} onDismiss={onboarding.dismissIntro} pollName={poll.name} />
          )}
          <IdentityPhase
            lastUsedUserId={lastUsedUserId}
            onUserSelected={handleUserSelected}
            sessionId={sessionId}
            users={users ?? []}
          />
        </>
      ) : (
        <>
          <div className="flex flex-col items-start gap-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
            <div
              className="inline-flex shrink-0 gap-1 self-start rounded-full border border-[var(--hair)] bg-[var(--bone)]/[0.04] p-1"
              role="tablist"
            >
              <button
                aria-selected={tab === 'painting'}
                className={`${TAB_BASE_CLASS} ${tabSkinFor(tab === 'painting')}`}
                onClick={() => setTab('painting')}
                role="tab"
              >
                Your hours
              </button>
              <button
                aria-selected={tab === 'results'}
                className={`${TAB_BASE_CLASS} ${tabSkinFor(tab === 'results')}`}
                onClick={() => {
                  setTab('results')
                  // The overlap query refetches on its own when ResultsPhase remounts, but the
                  // participant count (poll) and roster (users) it renders against live on these
                  // two queries — left stale while others join, the fresher overlap disagrees
                  // with them ("2 of 1 free").
                  void queryClient.invalidateQueries({ queryKey: ['poll', sessionId] })
                  void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
                }}
                role="tab"
              >
                The overlap
              </button>
            </div>
            {currentUser && (
              <VoterIdentityControl
                isSignedIn={isSignedIn}
                onNotYou={handleNotYou}
                sessionId={sessionId}
                user={currentUser}
              />
            )}
          </div>
          {tab === 'painting' ? (
            <PaintingPhase poll={poll} sessionId={sessionId} userId={effectiveUserId as string} />
          ) : (
            <ResultsPhase
              poll={poll}
              sessionId={sessionId}
              users={users ?? []}
              viewerUserId={effectiveUserId as string}
            />
          )}
        </>
      )}
    </div>
  )
}

const PollWithErrorBoundary = ({ sessionId }: PollProps): React.ReactNode => (
  <ErrorBoundary>
    <PollComponent sessionId={sessionId} />
  </ErrorBoundary>
)

export default PollWithErrorBoundary
