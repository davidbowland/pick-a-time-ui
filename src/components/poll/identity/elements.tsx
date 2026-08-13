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
        <Radio.Content className="w-full py-3.5">
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
      <Radio.Content className="w-full py-3.5">
        <Radio.Control>
          <Radio.Indicator />
        </Radio.Control>
        Join as somebody new
      </Radio.Content>
    </Radio>
  </RadioGroup>
)

export const ErrorMessage = ({ message }: { message: string }): React.ReactNode => (
  <p className="text-sm text-red-400">{message}</p>
)

/**
 * Why this picker is showing again after somebody had already been identified.
 *
 * Not an ErrorMessage: nothing failed and nothing is theirs to retry — they were voting as a person
 * who turned out to belong to somebody else. It is stated as a fact, in the same voice as the rest
 * of the card, and announced because the person did not ask to be back here.
 */
export const IdentityNotice = ({ message }: { message: string }): React.ReactNode => (
  <p className="text-sm text-[var(--slate)]" role="status">
    {message}
  </p>
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
    Sign in with Google to mark yourself busy where you&apos;re already booked, and to keep your name on other devices.
  </p>
)
