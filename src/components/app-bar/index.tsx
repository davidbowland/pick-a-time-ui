import Link from 'next/link'
import React from 'react'

import { BrandLink, GoogleSignInButton, NavContainer, UserMenu } from './elements'
import { useAuthContext } from '@components/auth-context'
import { clearSessionCookie } from '@hooks/useSessionCookie'

export interface AppBarProps {
  sessionId?: string
}

const AppBar = ({ sessionId }: AppBarProps): React.ReactNode => {
  const { isSignedIn, isLoading, user, handleSignIn, handleSignOut } = useAuthContext()

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
            <UserMenu name={user?.name ?? 'User'} onSignOut={handleSignOutClick} />
          ) : (
            <GoogleSignInButton onPress={handleSignIn} />
          )}
        </>
      )}
    </NavContainer>
  )
}

export default AppBar
