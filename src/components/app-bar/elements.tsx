import { Button } from '@heroui/react'
import { LogOut } from 'lucide-react'
import React from 'react'

import { GoogleLogo } from '@components/google-logo'

export const NavContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <nav className="px-4 pt-4 pb-2 relative z-40">
    <div className="mx-auto flex max-w-[960px] items-center justify-between rounded-full border border-white/[0.07] bg-white/[0.03] px-6 py-2">
      {children}
    </div>
  </nav>
)

export const BrandLink = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <span className="brand-display text-2xl text-[#F59E0B]">{children}</span>
)

export const GoogleSignInButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button
    className="rounded-full border-white/[0.09] bg-white/[0.05] text-[#D4D4D4] hover:bg-white/[0.09]"
    onPress={onPress}
    size="sm"
    variant="outline"
  >
    <GoogleLogo />
    Sign in with Google
  </Button>
)

export const UserMenu = ({ name, onSignOut }: { name: string; onSignOut: () => void }): React.ReactNode => (
  <div className="flex items-center gap-3">
    <span className="text-sm text-[#6B7280]">{name}</span>
    <Button
      className="rounded-full border-white/[0.09] bg-white/[0.05] text-[#6B7280] hover:bg-white/[0.09]"
      onPress={onSignOut}
      size="sm"
      variant="outline"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  </div>
)
