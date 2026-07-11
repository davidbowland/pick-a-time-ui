import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'

import { ErrorState, LoadingState } from './elements'
import { derivePhase } from './helpers'
import IdentityPhase from './identity'
import PaintingPhase from './painting'
import ResultsPhase from './results'
import ErrorBoundary from '@components/error-boundary'
import Share from '@components/share'
import { useSessionCookie } from '@hooks/useSessionCookie'
import { fetchPlan, fetchUsers } from '@services/api'
import { PlanData, User } from '@types'

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

export interface PlanProps {
  sessionId: string
}

const PlanComponent = ({ sessionId }: PlanProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const { userId, setUserId } = useSessionCookie(sessionId)
  const queryParamId = useMemo(() => consumeQueryParamId(), [])
  const [tab, setTab] = useState<'painting' | 'results'>('painting')

  const {
    data: plan,
    isError: isPlanError,
    refetch: refetchPlan,
  } = useQuery<PlanData>({ queryKey: ['plan', sessionId], queryFn: () => fetchPlan(sessionId) })
  const {
    data: users,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useQuery<User[]>({ queryKey: ['users', sessionId], queryFn: () => fetchUsers(sessionId) })

  const usersLoaded = users !== undefined
  const effectiveUserId = useMemo(() => {
    if (!users) return undefined
    if (queryParamId && users.some((u) => u.userId === queryParamId)) return queryParamId
    if (userId && users.some((u) => u.userId === userId)) return userId
    return undefined
  }, [queryParamId, userId, users])

  // A newly-created/selected user is set on the cookie immediately, but the `users` list is only
  // updated by the server on its own schedule — without invalidating it here, a brand-new user's
  // id never appears in the (stale) cached list, `effectiveUserId` never resolves, and the phase
  // machine stays stuck on `identity` forever. Invalidating forces a refetch that picks it up.
  const handleUserSelected = (newUserId: string): void => {
    setUserId(newUserId)
    void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
  }

  const phase = derivePhase(plan, usersLoaded, effectiveUserId != null, isPlanError || isUsersError)

  if (phase === 'error') {
    return (
      <ErrorState
        onRetry={() => {
          void refetchPlan()
          void refetchUsers()
        }}
      />
    )
  }

  if (phase === 'loading' || !plan) return <LoadingState />

  return (
    <div>
      <h1>{plan.name}</h1>
      {phase === 'identity' ? (
        <IdentityPhase onUserSelected={handleUserSelected} sessionId={sessionId} users={users ?? []} />
      ) : (
        <>
          <Share sessionId={sessionId} userId={effectiveUserId as string} />
          <div role="tablist">
            <button aria-selected={tab === 'painting'} onClick={() => setTab('painting')} role="tab">
              Your hours
            </button>
            <button aria-selected={tab === 'results'} onClick={() => setTab('results')} role="tab">
              The overlap
            </button>
          </div>
          {tab === 'painting' ? (
            <PaintingPhase plan={plan} sessionId={sessionId} userId={effectiveUserId as string} />
          ) : (
            <ResultsPhase plan={plan} sessionId={sessionId} />
          )}
        </>
      )}
    </div>
  )
}

const PlanWithErrorBoundary = ({ sessionId }: PlanProps): React.ReactNode => (
  <ErrorBoundary>
    <PlanComponent sessionId={sessionId} />
  </ErrorBoundary>
)

export default PlanWithErrorBoundary
