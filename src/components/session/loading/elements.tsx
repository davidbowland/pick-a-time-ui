import { AlertDescription, AlertRoot } from '@heroui/react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

const LOADING_MESSAGES = [
  'Scouting the competition...',
  'Lining up the challengers...',
  'Preparing the arena...',
  'Setting up your bracket...',
  'Gathering the contenders...',
  'Warming up the kitchen...',
  'Checking the menus...',
  'Polishing the silverware...',
  'Rolling out the red carpet...',
  'Sharpening the knives...',
]

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const LoadingSpinner = (): React.ReactNode => {
  const [messages, setMessages] = useState<string[] | null>(null)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    setMessages(shuffle(LOADING_MESSAGES))
  }, [])

  useEffect(() => {
    if (!messages) return
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [messages])

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-16">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/[0.06] border-t-[#F59E0B]" />
        <div
          className="absolute inset-2 animate-spin rounded-full border-4 border-white/[0.06] border-b-[#F59E0B]"
          style={{ animationDirection: 'reverse', animationDuration: '1.4s' }}
        />
      </div>
      <p className="text-center text-[#4B5563] transition-all duration-500">
        {messages ? messages[msgIdx] : 'Loading...'}
      </p>
    </div>
  )
}

export const ErrorAlert = ({ message }: { message: string }): React.ReactNode => (
  <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
    <AlertRoot status="danger">
      <AlertDescription>{message}</AlertDescription>
    </AlertRoot>
    <Link className="text-[#F59E0B] underline" href="/">
      Go home
    </Link>
  </div>
)

export const TimeoutAlert = (): React.ReactNode => (
  <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6">
    <AlertRoot status="warning">
      <AlertDescription>Session setup timed out. Please try again.</AlertDescription>
    </AlertRoot>
    <Link className="text-[#F59E0B] underline" href="/">
      Try again
    </Link>
  </div>
)
