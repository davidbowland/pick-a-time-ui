import Link from 'next/link'
import React from 'react'

import { BrandLink, GoogleSignInButton, NavContainer, UserMenu } from './elements'
import { useAuthContext } from '@components/auth-context'

const AppBar = (): React.ReactNode => {
  const { isSignedIn, isLoading, user, handleSignIn, handleSignOut } = useAuthContext()

  return (
    <NavContainer>
      <Link href="/">
        <BrandLink>Choosee</BrandLink>
      </Link>
      {!isLoading && (
        <>
          {isSignedIn ? (
            <UserMenu name={user?.name ?? 'User'} onSignOut={handleSignOut} />
          ) : (
            <GoogleSignInButton onPress={handleSignIn} />
          )}
        </>
      )}
    </NavContainer>
  )
}

export default AppBar
