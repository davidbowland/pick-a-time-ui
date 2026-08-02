import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import React from 'react'

import { BrandLink, GoogleSignInButton, NavContainer, UserMenu } from './elements'
import { useAuthContext } from '@components/auth-context'
import { clearSessionCookie } from '@hooks/useSessionCookie'
import { disconnectCalendar, fetchCalendarState } from '@services/api'

export interface AppBarProps {
  sessionId?: string
  now?: () => number
}

const AppBar = ({ sessionId, now }: AppBarProps): React.ReactNode => {
  const { isSignedIn, isLoading, user, handleSignIn, handleSignOut } = useAuthContext()
  const queryClient = useQueryClient()

  // Keyed on nothing but 'calendar': a connection belongs to a Google account, not a poll, so the
  // painting screen and this menu read the same cache entry and one disconnect refreshes both.
  const { data: calendar } = useQuery({ enabled: isSignedIn, queryFn: fetchCalendarState, queryKey: ['calendar'] })

  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  })

  const handleSignOutClick = (): void => {
    // Clears the cookie only — it does NOT update any `useSessionCookie` hook's in-memory
    // `userId` state elsewhere in the tree (e.g. in `Poll`). Safe only because `handleSignOut()`
    // immediately triggers a full-page Cognito redirect that unmounts everything; if sign-out is
    // ever changed to not navigate away, this will need to reconcile that in-memory state too.
    if (sessionId) clearSessionCookie(sessionId)
    handleSignOut()
  }

  return (
    <NavContainer>
      <Link href="/">
        <BrandLink>Pick a Time</BrandLink>
      </Link>
      {!isLoading && (
        <>
          {isSignedIn ? (
            <UserMenu
              calendarStatus={calendar?.status}
              lastSyncedAt={calendar?.lastSyncedAt ?? null}
              name={user?.name ?? 'User'}
              now={now}
              onDisconnect={() => disconnectMutation.mutate()}
              onSignOut={handleSignOutClick}
            />
          ) : (
            <GoogleSignInButton onPress={handleSignIn} />
          )}
        </>
      )}
    </NavContainer>
  )
}

export default AppBar
