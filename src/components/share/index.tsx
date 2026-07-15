import React, { useState } from 'react'

import { CopyButton, QrButton, ShareButton, ShareGroup } from './elements'
import { useHasWebShare } from '@hooks/useHasWebShare'

export interface ShareProps {
  pollName: string
  sessionId: string
}

const Share = ({ pollName, sessionId }: ShareProps): React.ReactNode => {
  const [copied, setCopied] = useState(false)
  const hasWebShare = useHasWebShare()

  const sessionUrl = `${typeof window === 'undefined' ? '' : window.location.origin}/p/${sessionId}`

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(sessionUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write failures are silent — the Copied announcement simply never
      // fires, and the Share button and QR code remain available as fallbacks.
    }
  }

  const handleShare = async (): Promise<void> => {
    try {
      await navigator.share({ title: pollName, url: sessionUrl })
    } catch {
      // Thrown for both a user-dismissed share sheet and a failed share — either way
      // there's nothing to recover from, and Copy/QR remain available as fallbacks.
    }
  }

  return (
    <ShareGroup>
      {hasWebShare && <ShareButton onPress={handleShare} />}
      <CopyButton copied={copied} onPress={handleCopy} />
      <QrButton url={sessionUrl} />
    </ShareGroup>
  )
}

export default Share
