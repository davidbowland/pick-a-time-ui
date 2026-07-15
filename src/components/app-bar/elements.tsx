import { Button } from '@heroui/react'
import { LogOut } from 'lucide-react'
import React from 'react'

import { GoogleLogo } from '@components/google-logo'
import { Mark } from '@components/mark'

export const NavContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <nav className="relative z-40 px-4 pt-4 pb-2">
    <div className="mx-auto flex max-w-[960px] items-center justify-between rounded-full border border-[var(--hair)] bg-[var(--bone)]/[0.03] px-6 py-2">
      {children}
    </div>
  </nav>
)

export const BrandLink = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <span className="flex items-center gap-2 text-2xl text-[var(--accent)]" style={{ fontFamily: 'var(--font-display)' }}>
    <Mark size={26} />
    {children}
  </span>
)

export const GoogleSignInButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button
    aria-label="Sign in with Google"
    className="shrink-0 rounded-full border-[var(--hair)] bg-[var(--bone)]/[0.05] px-3 text-[var(--slate)] hover:bg-[var(--bone)]/[0.09] sm:px-4"
    onPress={onPress}
    size="sm"
    variant="outline"
  >
    <GoogleLogo />
    <span className="hidden sm:inline">Sign in with Google</span>
  </Button>
)

export const UserMenu = ({ name, onSignOut }: { name: string; onSignOut: () => void }): React.ReactNode => (
  <div className="flex min-w-0 items-center gap-3">
    <span className="hidden max-w-[120px] truncate text-sm text-[var(--slate)] sm:inline">{name}</span>
    <Button
      aria-label="Sign out"
      className="shrink-0 rounded-full border-[var(--hair)] bg-[var(--bone)]/[0.05] px-3 text-[var(--slate)] hover:bg-[var(--bone)]/[0.09] sm:px-4"
      onPress={onSignOut}
      size="sm"
      variant="outline"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  </div>
)
