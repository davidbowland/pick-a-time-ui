import { Button, Radio, RadioGroup } from '@heroui/react'
import React from 'react'

export const SectionContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="arena-glass-outer">
    <div className="arena-glass-inner flex flex-col gap-4 p-6">{children}</div>
  </div>
)

export const SectionTitle = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <h2 className="text-lg font-semibold text-[#F5F5F5]">{children}</h2>
)

export const UserOptions = ({
  users,
  selected,
  createNew,
  onSelectUser,
  onSelectCreateNew,
}: {
  users: { userId: string; label: string }[]
  selected: string | null
  createNew: boolean
  onSelectUser: (userId: string) => void
  onSelectCreateNew: () => void
}): React.ReactNode => (
  <RadioGroup
    onChange={(value) => (value === '__new__' ? onSelectCreateNew() : onSelectUser(value))}
    value={createNew ? '__new__' : (selected ?? '')}
  >
    {users.map((user) => (
      <Radio key={user.userId} value={user.userId}>
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          {user.label}
        </Radio.Content>
      </Radio>
    ))}
    <Radio value="__new__">
      <Radio.Content>
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
    className="w-full rounded-full border-white/[0.09] bg-white/[0.05] text-[#D4D4D4]"
    onPress={onPress}
    variant="secondary"
  >
    Continue with Google
  </Button>
)

export const SignInBenefitNote = (): React.ReactNode => (
  <p className="text-center text-xs text-[#6B7280]">
    Sign in to keep the same name if you come back on another device.
  </p>
)
