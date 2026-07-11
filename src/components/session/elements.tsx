import { AlertDescription, AlertRoot } from '@heroui/react'
import { Clock, Users } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

export const ErrorBanner = ({ message }: { message: string }): React.ReactNode => (
  <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
    <AlertRoot status="danger">
      <AlertDescription>{message}</AlertDescription>
    </AlertRoot>
    <Link className="text-[#F59E0B] underline" href="/">
      Go home
    </Link>
  </div>
)

export const ClosingSoonErrorAlert = (): React.ReactNode => (
  <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
    <AlertRoot status="warning">
      <AlertDescription>
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Not enough restaurants are open near you</p>
            <p className="mt-1 text-sm opacity-80">
              Turn off the &ldquo;closing soon&rdquo; filter, or expand your search area.
            </p>
          </div>
        </div>
      </AlertDescription>
    </AlertRoot>
    <Link className="text-[#F59E0B] underline" href="/">
      Try again
    </Link>
  </div>
)

export const SoloVoterHint = (): React.ReactNode => (
  <div className="flex items-center gap-2 rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.07)] px-3 py-2 text-xs text-[#F59E0B]">
    <Users className="h-4 w-4 flex-shrink-0" />
    <span>You&apos;re the only one here. Invite friends to vote with you.</span>
  </div>
)

export const FilterClosingSoonBadge = (): React.ReactNode => (
  <div className="flex items-center gap-1.5 rounded-full border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.07)] px-2.5 py-1 text-xs text-[#F59E0B]">
    <Clock className="h-3 w-3" />
    <span>Closing soon hidden</span>
  </div>
)
