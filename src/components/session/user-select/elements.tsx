import { Button } from '@heroui/react'
import { UserPlus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React, { useEffect, useRef, useState } from 'react'

import { PillArrowButton } from '@components/pill-arrow-button'

export const SectionContainer = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">{children}</div>
)

export const SectionTitle = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <h2 className="choosee-brand text-3xl text-[#F5F5F5]">{children}</h2>
)

export const UserOption = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: () => void
}): React.ReactNode => (
  <label
    className={`flex cursor-pointer items-center gap-3 rounded-[12px] border p-3.5 transition-all ${
      checked
        ? 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)]'
        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
    }`}
  >
    <input checked={checked} className="accent-[#F59E0B]" name="user-select" onChange={onChange} type="radio" />
    <span className="text-sm font-medium text-[#D4D4D4]">{label}</span>
  </label>
)

export const CreateNewOption = ({ checked, onChange }: { checked: boolean; onChange: () => void }): React.ReactNode => (
  <label
    className={`flex cursor-pointer items-center gap-3 rounded-[12px] border border-dashed p-3.5 transition-all ${
      checked
        ? 'border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.07)]'
        : 'border-[rgba(245,158,11,0.2)] hover:border-[rgba(245,158,11,0.4)] hover:bg-[rgba(245,158,11,0.05)]'
    }`}
  >
    <input checked={checked} className="accent-[#F59E0B]" name="user-select" onChange={onChange} type="radio" />
    <UserPlus className="h-4 w-4 text-[#F59E0B]" />
    <span className="text-sm font-medium text-[#F59E0B]">I&apos;m new</span>
  </label>
)

export const ConfirmButton = ({
  isDisabled,
  isLoading,
  onPress,
}: {
  isDisabled: boolean
  isLoading: boolean
  onPress: () => void
}): React.ReactNode => (
  <PillArrowButton
    isDisabled={isDisabled}
    isLoading={isLoading}
    label="Let's go"
    loadingLabel="Joining…"
    onPress={onPress}
  />
)

export const ErrorMessage = ({ message }: { message: string }): React.ReactNode => (
  <p className="text-sm text-red-400">{message}</p>
)

export const InviteSection = ({ sessionId }: { sessionId: string }): React.ReactNode => {
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionUrl = `${typeof window === 'undefined' ? '' : window.location.origin}/s/${sessionId}`

  useEffect(() => {
    return () => clearTimeout(copiedTimer.current)
  }, [])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(sessionUrl)
      clearTimeout(copiedTimer.current)
      setCopied(true)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard API unavailable */
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-sm font-semibold text-[#D4D4D4]">Invite someone</p>
      <p className="text-xs text-[#4B5563]">Share this link so others can join</p>
      <Button
        className="w-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] font-bold text-[#0A0A0B] hover:opacity-90"
        onPress={handleCopy}
        variant="primary"
      >
        {copied ? 'Copied!' : 'Copy invite link'}
      </Button>
      <div className="flex justify-center rounded-lg bg-white p-3">
        <QRCodeSVG size={128} value={sessionUrl} />
      </div>
    </div>
  )
}
