import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ErrorState, LoadingState } from './elements'
import { derivePhase } from './helpers'
import IdentityPhase from './identity'
import { IntroExplainer } from './onboarding/elements'
import PaintingPhase from './painting'
import ResultsPhase from './results'
import VoterIdentityControl from './voter-identity'
import { useAuthContext } from '@components/auth-context'
import ErrorBoundary from '@components/error-boundary'
import InstallPrompt from '@components/install-prompt'
import { JoinTrigger } from '@components/join-dialog'
import Share from '@components/share'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { usePollOnboarding } from '@hooks/usePollOnboarding'
import { useRecentPolls } from '@hooks/useRecentPolls'
import { useSessionCookie } from '@hooks/useSessionCookie'
import { claimUser, fetchPoll, fetchUsers } from '@services/api'
import { PollData, User } from '@types'
import { formatExpiration } from '@utils/dates'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'
import { hasStatusCode } from '@utils/http-status'
import { displayName } from '@utils/users'

const TAB_BASE_CLASS = `rounded-full px-4 py-1.5 text-sm font-bold transition-colors duration-150 ease-out ${FOCUS_RING}`

/**
 * Shown when somebody signed in is sent back to the picker because the participant they were voting
 * as belongs to a different Google account.
 *
 * States the fact and the two ways forward, in the picker's own words -- "join as somebody new" is
 * the label on the option it points at. It does not say "error" or "sorry": nothing went wrong and
 * nothing here is theirs to retry.
 */
const REFUSED_NOTICE = (name: string): string =>
  `${name} belongs to a different Google account. Pick your own name, or join as somebody new.`

/**
 * The poll-is-gone arrival state (AC-040). Approved copy, kept together so a later edit has to
 * look at the whole voice at once.
 *
 * `{pollName}` is the name held by the local entry, because the server has nothing left to tell us:
 * a 404 carries no poll name. A visitor who arrives on a dead link with no entry of their own gets
 * `GONE_FALLBACK_NAME` instead — the state is still true for them, only less specific.
 */
const GONE_COPY = {
  body: "The poll closed or was deleted, so it's no longer in your polls.",
  heading: (pollName: string): string => `${pollName} isn't there anymore`,
  startPoll: 'Start a poll',
  // Announced, not read. It restates the heading and body on purpose -- that is what the region is
  // for -- but in the app's own voice rather than the passive: "is no longer available and has been
  // removed" was two passives and a zombie noun where the visible copy right above it says
  // "isn't there anymore" and "closed or was deleted" (AC-050).
  status: (pollName: string): string => `${pollName} isn't there anymore. It closed or was deleted.`,
  yourPolls: 'Go to your polls',
}

const GONE_FALLBACK_NAME = 'This poll'

const GONE_ACTION_BASE = `inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold ${FOCUS_RING}`

/**
 * Both controls navigate, so both are links rather than buttons: a control that changes the URL
 * has to be openable in a new tab and has to announce itself as a link. The copy table calls them
 * buttons; the shape it describes is a link that looks like one.
 */
export const PollGoneState = ({
  announcement,
  pollName,
}: {
  announcement: string
  pollName: string
}): React.ReactNode => (
  <div className="flex flex-col items-center gap-4 p-10 text-center">
    <h1 className="text-2xl text-[var(--bone)]" style={{ fontFamily: 'var(--font-display)' }}>
      {GONE_COPY.heading(pollName)}
    </h1>
    <p className="text-sm text-[var(--slate)]">{GONE_COPY.body}</p>
    {/* Rendered EMPTY on the commit that mounts it, and given its text on a later one. A live
        region that enters the DOM already populated is routinely announced by nothing at all —
        NVDA, JAWS and VoiceOver all watch regions that already exist for changes. */}
    <p className="sr-only" role="status">
      {announcement}
    </p>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link className={`${GONE_ACTION_BASE} bg-[var(--accent)] text-[var(--ink)] hover:opacity-90`} href="/">
        {GONE_COPY.yourPolls}
      </Link>
      <Link
        className={`${GONE_ACTION_BASE} border border-[var(--hair)] text-[var(--bone)] hover:bg-[var(--bone)]/[0.06]`}
        href="/"
      >
        {GONE_COPY.startPoll}
      </Link>
    </div>
    {/* Last, and deliberately not a third pill. The two links above are certainties -- both go
        somewhere that exists. Entering a code is a maybe, and dressing it like its neighbours would
        turn one clear pair of exits into three equal-looking offers. So it is the same quiet
        sentence the home page uses, one line beneath the row, which also puts it last in reading
        and focus order: heading, fact, the two ways out, then the way back in. */}
    <JoinTrigger />
  </div>
)

/**
 * Whether a failed poll fetch means "this poll is gone" rather than "we could not reach the API".
 *
 * Delegates to `@utils/http-status`, NOT to the `hasStatusCode` re-exported from `@services/api`:
 * this file's own test does `jest.mock('@services/api')`, so that route would resolve to an
 * automock returning `undefined` and a gone poll would read as a generic error, forever. Nothing
 * mocks the util. The name stays because "is this poll gone" is what the call sites mean.
 */
export const isPollGone = (error: unknown): boolean => hasStatusCode(error, 404)

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
  /** Injectable clock. Entry pruning and `lastSeen` both read it, so tests must be able to fix it. */
  now?: () => number
  sessionId: string
  /** Injectable storage for the recents entry. Defaults to `window.localStorage`. */
  storage?: Storage
}

const PollComponent = ({ now, sessionId, storage }: PollProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const { userId, setUserId, clearUserId } = useSessionCookie(sessionId)
  const { isLoading: isAuthLoading, isSignedIn } = useAuthContext()
  const queryParamId = useMemo(() => consumeQueryParamId(), [])
  const [tab, setTab] = useState<'painting' | 'results'>('painting')
  const [lastUsedUserId, setLastUsedUserId] = useState<string | undefined>(undefined)
  const [notYouClicked, setNotYouClicked] = useState(false)

  const {
    data: poll,
    error: pollError,
    isError: isPollError,
    refetch: refetchPoll,
  } = useQuery<PollData>({ queryKey: ['poll', sessionId], queryFn: () => fetchPoll(sessionId) })
  const {
    data: users,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useQuery<User[]>({ queryKey: ['users', sessionId], queryFn: () => fetchUsers(sessionId) })

  // The participant a claim came back 403 on: it belongs to a different Google account, so this
  // person cannot be it. Held with the name it had, because the name is what the notice says and
  // `currentUser` is gone by the time it renders.
  const [refused, setRefused] = useState<{ name: string; userId: string } | undefined>(undefined)

  const usersLoaded = users !== undefined
  const effectiveUserId = useMemo(() => {
    if (!users) return undefined
    const isUsable = (id: string): boolean => id !== refused?.userId && users.some((u) => u.userId === id)
    if (!notYouClicked && queryParamId && isUsable(queryParamId)) return queryParamId
    if (userId && isUsable(userId)) return userId
    return undefined
  }, [queryParamId, userId, users, notYouClicked, refused])

  const currentUser = useMemo(() => users?.find((u) => u.userId === effectiveUserId), [users, effectiveUserId])

  // Somebody who opens the poll link first and signs in afterwards is voting as a participant with
  // no Google account attached -- joining signed-out stores none, and signing in does not go back
  // and attach one. Every calendar route then answers 403 ("You can only connect your own
  // calendar") for that participant, for the life of the poll. The API links the two on any
  // authenticated PATCH of an unlinked participant, so this is that PATCH: no operations, no other
  // effect, and a no-op on a participant already linked to this account.
  //
  // Fired here rather than at the connect button because the calendar CHECK hits the same rule --
  // an unlinked participant on a second poll fails its automatic check with nothing on screen
  // explaining why. Once per participant: the ref, not the dependency list, is what survives
  // strict mode's double-invoke.
  const claimedUserIdRef = useRef<string | undefined>(undefined)
  // The name to put in the notice if the claim is refused, captured per render: reading
  // `currentUser` inside the effect would either stale-close over it or drag it into the
  // dependency list, which would re-fire the claim on every refetch of the users list.
  const currentNameRef = useRef<string | undefined>(undefined)
  currentNameRef.current = currentUser ? displayName(currentUser) : undefined
  useEffect(() => {
    if (!isSignedIn || !effectiveUserId || claimedUserIdRef.current === effectiveUserId) return
    claimedUserIdRef.current = effectiveUserId
    const claimedUserId = effectiveUserId
    const claimedName = currentNameRef.current
    void claimUser(sessionId, claimedUserId)
      .then(() => {
        // The availability read fires during the first render, before this claim lands, so for an
        // unlinked participant it 403s and falls back to the open route -- which knows nothing about
        // a calendar. Without this the record stays layer-less for the whole visit (nothing else
        // refetches it: refetchOnWindowFocus is off and no staleTime is set), so the calendar was
        // connected, the grid never showed it, and the fill had nothing to skip.
        void queryClient.invalidateQueries({ queryKey: ['availability', sessionId, claimedUserId] })
      })
      .catch((err: unknown) => {
        // 403 is the only answer that says anything about WHOSE participant this is: it means
        // another Google account holds it. Anything else -- a dropped connection, a 500 -- says
        // nothing, and throwing somebody out of their own poll over it would be worse than the
        // failure. Those are swallowed: the calendar is the only thing they cost, and the connect
        // button explains itself in words if the person reaches for it.
        if (!hasStatusCode(err, 403) || !claimedName) return
        setRefused({ name: claimedName, userId: claimedUserId })
        // The cookie points at somebody else's participant. Left alone, every later visit lands on
        // this same refusal.
        clearUserId()
      })
  }, [clearUserId, effectiveUserId, isSignedIn, sessionId])

  // A newly-created/selected user is set on the cookie immediately, but the `users` list is only
  // updated by the server on its own schedule — without invalidating it here, a brand-new user's
  // id never appears in the (stale) cached list, `effectiveUserId` never resolves, and the phase
  // machine stays stuck on `identity` forever. Invalidating forces a refetch that picks it up.
  const handleUserSelected = (newUserId: string): void => {
    setUserId(newUserId)
    // The previous voter's tab choice (e.g. "Everyone's overlap") must not carry over to whoever
    // joins next — every newly selected user starts on their own hours.
    setTab('painting')
    void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
    // Joining also bumps the poll's participantCount, which every "N of M free" total renders
    // against — left stale at its pre-join value, the results phase pairs it with a fresher
    // overlap and shows more people free than it says exist.
    void queryClient.invalidateQueries({ queryKey: ['poll', sessionId] })
  }

  // Both the overlap tab and the link at the foot of the grid come through here. The invalidations
  // are the reason it is one function: the overlap query refetches on its own when ResultsPhase
  // mounts, but the participant count (poll) and roster (users) it renders against live on these
  // two queries — left stale while others join, the fresher overlap disagrees with them ("2 of 1
  // free"). A second entrance that forgot them would show that only sometimes.
  const showResults = (): void => {
    setTab('results')
    void queryClient.invalidateQueries({ queryKey: ['poll', sessionId] })
    void queryClient.invalidateQueries({ queryKey: ['users', sessionId] })
  }

  const handleNotYou = (): void => {
    if (effectiveUserId) setLastUsedUserId(effectiveUserId)
    setNotYouClicked(true)
    clearUserId()
  }

  const phase = derivePhase(poll, usersLoaded, effectiveUserId != null, isPollError || isUsersError)
  // The seed lets a dismissal persist before identity resolves. The intro renders during the
  // identity phase and the recents entry lands when that phase ends, so without it the two never
  // coexist and the dismissal is silently lost (a regression against the behaviour before ADR-4).
  // `poll` is fetched by the time the intro can render, so its expiration is real.
  const onboarding = usePollOnboarding(
    sessionId,
    storage,
    now,
    poll ? { expiration: poll.expiration, pollName: poll.name } : undefined,
  )
  const viewerTimezone = useMemo(() => detectViewerTimezone(), [])

  // Exactly one instance on this page. Two do not share state: the second reads its own copy at
  // mount, so one list goes stale the moment the other writes.
  const { polls: recentPolls, record, remove } = useRecentPolls(storage, now)

  const isGone = isPollGone(pollError)
  // The name is captured as state rather than derived on every render, because the entry it comes
  // from is deliberately destroyed a moment later — a purely derived name would blank the heading
  // the instant the removal lands. It is derived once, for the render that removes it.
  const [goneName, setGoneName] = useState<string | undefined>(undefined)
  const [announcement, setAnnouncement] = useState('')
  const gonePollName =
    goneName ?? recentPolls.find((entry) => entry.sessionId === sessionId)?.pollName ?? GONE_FALLBACK_NAME

  // ADR-4: the entry is written when identity RESOLVES, not when availability is marked. Somebody
  // who opened a shared link and was pulled away before answering is exactly the person who has
  // lost the way back, and the entry is what gives it to them. Every dependency here is a
  // primitive, so a refetch that returns the same poll does not write a second time.
  const participantName = currentUser ? displayName(currentUser) : undefined
  const resolvedUserId = currentUser?.userId
  const pollName = poll?.name
  // Epoch SECONDS, copied from the server's own value — never a computed TTL, and never
  // milliseconds, which would read as a date in the year 55000 and expire nothing.
  const expiration = poll?.expiration
  useEffect(() => {
    if (expiration === undefined || pollName === undefined || participantName === undefined || !resolvedUserId) return
    record({ expiration, name: participantName, pollName, sessionId, userId: resolvedUserId })
  }, [expiration, participantName, pollName, record, resolvedUserId, sessionId])

  // AC-040: pruning happens on read, so a live entry can point at a poll that has since died. The
  // entry is removed from the store, not merely hidden.
  useEffect(() => {
    if (!isGone || goneName !== undefined) return
    setGoneName(gonePollName)
    remove(sessionId)
  }, [goneName, gonePollName, isGone, remove, sessionId])

  // A second pass, deliberately: the region above paints empty first and gains its text here.
  useEffect(() => {
    if (goneName === undefined) return
    setAnnouncement(GONE_COPY.status(goneName))
  }, [goneName])

  // Ahead of the generic error state, which is what a 404 would otherwise land in.
  if (isGone) {
    return <PollGoneState announcement={announcement} pollName={gonePollName} />
  }

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
            notice={refused && REFUSED_NOTICE(refused.name)}
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
                {/* Says what the tab is FOR, not what it contains. "Your hours" reads as hours you
                    own; this is the only instruction some voters get before they look down at a
                    wall of rectangles. */}
                Mark your times
              </button>
              <button
                aria-selected={tab === 'results'}
                className={`${TAB_BASE_CLASS} ${tabSkinFor(tab === 'results')}`}
                onClick={showResults}
                role="tab"
              >
                {/* "The overlap" used a definite article for a thing nobody has been introduced to.
                    Naming the people whose overlap it is makes the noun concrete. */}
                Everyone&apos;s overlap
              </button>
            </div>
            {currentUser && (
              <VoterIdentityControl
                isAuthLoading={isAuthLoading}
                isSignedIn={isSignedIn}
                onNotYou={handleNotYou}
                sessionId={sessionId}
                user={currentUser}
              />
            )}
          </div>
          {tab === 'painting' ? (
            <PaintingPhase
              isSignedIn={isSignedIn}
              onSeeOverlap={showResults}
              poll={poll}
              sessionId={sessionId}
              userId={effectiveUserId as string}
            />
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
      {/* AC-023, and last on purpose: the poll itself is what the visitor came for, so the install
          offer sits under the person picker and under the calendar rather than ahead of either.
          `h2` because the only heading above it on this page is the poll title's `h1`, and the
          identity step's own heading is an `h2` alongside it — an `h3` here would skip a level.
          Focus after dismissal falls to the default: the page's `<main>` landmark. */}
      <InstallPrompt headingLevel="h2" />
    </div>
  )
}

const PollWithErrorBoundary = ({ now, sessionId, storage }: PollProps): React.ReactNode => (
  <ErrorBoundary>
    <PollComponent now={now} sessionId={sessionId} storage={storage} />
  </ErrorBoundary>
)

export default PollWithErrorBoundary
