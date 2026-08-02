import { AlertDialog, Button, Dropdown, Header, Menu } from '@heroui/react'
import { CalendarDays, ChevronDown, LogOut, Unplug } from 'lucide-react'
import React, { useState } from 'react'

import { GoogleLogo } from '@components/google-logo'
import { Mark } from '@components/mark'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { formatCheckedAgo } from '@utils/dates'

export type CalendarStatus = 'not_connected' | 'connected' | 'error'

const MENU_ITEM_CLASS = `flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--bone)] outline-none data-[focused=true]:bg-[var(--bone)]/[0.1] ${FOCUS_RING}`

const DIALOG_BUTTON_CLASS = `rounded-full px-4 text-sm font-bold ${FOCUS_RING}`

// `error` means we hold a connection we could not read, so it still needs a way out — reporting it
// as "Not connected" would strand someone with a broken link and no Disconnect.
const calendarDetail = (status: CalendarStatus, lastSyncedAt: number | null, now: () => number): string => {
  if (status === 'not_connected') return 'Not connected'
  if (status === 'error') return 'Connected · last check failed'
  // The API stamps 0, not null, when an account has connected but never synced -- see
  // get-calendar-callback.ts. `?? null` does not catch it, and formatCheckedAgo(0) renders a
  // timestamp from 1970, which is what the app bar showed from the moment OAuth completed.
  if (!lastSyncedAt) return 'Connected'
  return `Connected · checked ${formatCheckedAgo(lastSyncedAt, now)}`
}

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

export interface UserMenuProps {
  name: string
  calendarStatus?: CalendarStatus
  lastSyncedAt: number | null
  onDisconnect: () => void
  onSignOut: () => void
  now?: () => number
}

export const UserMenu = ({
  name,
  calendarStatus,
  lastSyncedAt,
  onDisconnect,
  onSignOut,
  now = Date.now,
}: UserMenuProps): React.ReactNode => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleConfirm = (): void => {
    setIsConfirmOpen(false)
    onDisconnect()
  }

  return (
    <>
      <Dropdown.Root>
        {/* The name is the trigger, so `aria-label` carries it even at the width where the label
            itself is hidden — otherwise the button announces as nothing on a phone. */}
        <Dropdown.Trigger
          aria-label={`Account menu for ${name}`}
          className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full border border-[var(--hair)] bg-[var(--bone)]/[0.05] px-3 py-1.5 text-sm text-[var(--slate)] hover:bg-[var(--bone)]/[0.09] sm:px-4 ${FOCUS_RING}`}
        >
          <span className="hidden max-w-[120px] truncate sm:inline">{name}</span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Menu
            aria-label="Account"
            className="min-w-[15rem] rounded-xl border border-[var(--hair)] bg-[var(--surface)] p-1.5 outline-none"
          >
            {calendarStatus === undefined ? null : (
              <Menu.Section className="border-b border-[var(--hair)] pb-1.5">
                <Header className="flex items-start gap-2 px-2 py-1.5">
                  <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--slate)]" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm text-[var(--bone)]">Google Calendar</span>
                    <span className="text-xs text-[var(--slate)]">
                      {calendarDetail(calendarStatus, lastSyncedAt, now)}
                    </span>
                  </span>
                </Header>
                {/* No Connect here: connecting needs a poll to return to, so that offer lives on the
                    painting screen. Disconnecting needs nothing but the account. */}
                {calendarStatus !== 'not_connected' && (
                  <Menu.Item className={MENU_ITEM_CLASS} onAction={() => setIsConfirmOpen(true)}>
                    <Unplug aria-hidden="true" className="h-4 w-4 shrink-0" />
                    Disconnect
                  </Menu.Item>
                )}
              </Menu.Section>
            )}
            <Menu.Item className={`mt-1.5 ${MENU_ITEM_CLASS}`} onAction={onSignOut}>
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
              Sign out
            </Menu.Item>
          </Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      <AlertDialog.Root isOpen={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        {/* Alert dialogs disable the escape key by default. Escape is the standard way out of a
            confirmation, and this one is cancellable, so it stays on. */}
        <AlertDialog.Backdrop isKeyboardDismissDisabled={false} variant="blur">
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>Disconnect Google Calendar?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-[var(--slate)]">
                  We&apos;ll delete your calendar data and stop checking it. Hours we already marked busy stay busy.
                  This applies to every poll you&apos;re in.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button className={DIALOG_BUTTON_CLASS} onPress={() => setIsConfirmOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button className={DIALOG_BUTTON_CLASS} onPress={handleConfirm} variant="primary">
                  Disconnect
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </>
  )
}
