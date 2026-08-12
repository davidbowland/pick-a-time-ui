import React, { useState } from 'react'

import { CopyButton, QrButton, ShareButton, ShareGroup } from './elements'
import { useHasWebShare } from '@hooks/useHasWebShare'

export interface ShareProps {
  pollName: string
  sessionId: string
}

const Share = ({ pollName, sessionId }: ShareProps): React.ReactNode => {
  const [copied, setCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const hasWebShare = useHasWebShare()

  // encodeURIComponent, matching services/api.ts:125: an identifier carrying a URL-meaningful
  // character would otherwise produce a link, a QR payload and a Web Share URL that all point
  // somewhere other than this poll.
  const sessionUrl = `${typeof window === 'undefined' ? '' : window.location.origin}/p/${encodeURIComponent(sessionId)}`

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

  const handleCopyCode = async (): Promise<void> => {
    try {
      // The identifier alone, not the URL — this is the thing someone reads out or types in.
      await navigator.clipboard.writeText(sessionId)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // Silent, as above: no success is claimed, and the code stays on screen to be read
      // aloud or selected by hand.
    }
  }

  const handleQrOpenChange = (isOpen: boolean): void => {
    setIsQrOpen(isOpen)
    // A confirmation left over from a previous visit to the modal would be stale, and it would
    // mount the live region already populated, where nothing announces it.
    setCodeCopied(false)
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
      <QrButton
        codeCopied={codeCopied}
        isOpen={isQrOpen}
        onCopyCode={handleCopyCode}
        onOpenChange={handleQrOpenChange}
        sessionId={sessionId}
        url={sessionUrl}
      />
    </ShareGroup>
  )
}

export default Share
