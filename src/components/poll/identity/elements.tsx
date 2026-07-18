import { Button, Radio, RadioGroup } from '@heroui/react'
import React from 'react'

import { GoogleLogo } from '@components/google-logo'
import { DoubleBezelCard } from '@components/ui/double-bezel-card'

export const SectionContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <DoubleBezelCard className="flex flex-col gap-4 p-6">{children}</DoubleBezelCard>
)

export const SectionTitle = ({
  children,
  id,
  ref,
}: {
  children: React.ReactNode
  id?: string
  ref?: React.Ref<HTMLHeadingElement>
}): React.ReactNode => (
  <h2 className="text-lg font-semibold text-[var(--bone)]" id={id} ref={ref} tabIndex={-1}>
    {children}
  </h2>
)

export const UserOptions = ({
  users,
  selected,
  createNew,
  onSelectUser,
  onSelectCreateNew,
  lastUsedUserId,
  lastUsedInputRef,
  headingId,
}: {
  users: { userId: string; label: string }[]
  selected: string | null
  createNew: boolean
  onSelectUser: (userId: string) => void
  onSelectCreateNew: () => void
  lastUsedUserId?: string
  lastUsedInputRef?: React.RefObject<HTMLInputElement | null>
  headingId?: string
}): React.ReactNode => (
  <RadioGroup
    aria-labelledby={headingId}
    onChange={(value) => (value === '__new__' ? onSelectCreateNew() : onSelectUser(value))}
    value={createNew ? '__new__' : (selected ?? '')}
  >
    {users.map((user) => (
      <Radio
        inputRef={user.userId === lastUsedUserId ? lastUsedInputRef : undefined}
        key={user.userId}
        value={user.userId}
      >
        <Radio.Content className="py-3.5">
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          {user.label}
          {user.userId === lastUsedUserId && (
            <span className="ml-1 text-xs whitespace-nowrap text-[var(--slate)]">· last used</span>
          )}
        </Radio.Content>
      </Radio>
    ))}
    <Radio value="__new__">
      <Radio.Content className="py-3.5">
        <Radio.Control>
          <Radio.Indicator />
        </Radio.Control>
        Join as someone new
      </Radio.Content>
    </Radio>
  </RadioGroup>
)

export const ErrorMessage = ({ message }: { message: string }): React.ReactNode => (
  <p className="text-sm text-red-400">{message}</p>
)

export const GoogleSignInButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button
    className="w-full rounded-full border-[var(--hair)] bg-[var(--bone)]/[0.05] text-[var(--bone)]"
    onPress={onPress}
    variant="secondary"
  >
    <GoogleLogo />
    Continue with Google
  </Button>
)

export const SignInBenefitNote = (): React.ReactNode => (
  <p className="text-center text-xs text-[var(--slate)]">
    Signing in keeps your name the same if you come back on another device.
  </p>
)
