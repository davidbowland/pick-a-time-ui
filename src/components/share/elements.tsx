import { Button, Modal } from '@heroui/react'
import { Check, Copy, QrCode as QrCodeIcon, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

const BUTTON_CLASS = `shrink-0 rounded-full border-[var(--hair)] bg-[var(--bone)]/[0.07] text-[var(--bone)] hover:bg-white/[0.12] ${FOCUS_RING}`

export const ShareGroup = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="flex items-center gap-2">{children}</div>
)

export const ShareButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button aria-label="Share" className={`px-3 sm:px-4 ${BUTTON_CLASS}`} onPress={onPress} variant="outline">
    <Share2 className="h-4 w-4" />
    <span className="hidden sm:inline">Share</span>
  </Button>
)

export const CopyButton = ({ copied, onPress }: { copied: boolean; onPress: () => void }): React.ReactNode => (
  <span className="relative inline-flex shrink-0">
    <Button aria-label="Copy link" className={BUTTON_CLASS} isIconOnly onPress={onPress} variant="outline">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
    {/* A solid chip (background + shadow), not bare text, so this reads as a small overlay
        floating above whatever's underneath rather than an extra row squeezed into the normal
        gap between this button row and the content below it. pointer-events-none: without it,
        the chip could still block a tap on that content for the ~2s it's visible. */}
    <span
      aria-live="polite"
      className={
        copied
          ? 'pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--surface)] px-2 py-1 text-xs text-[var(--bone)] shadow-lg'
          : 'sr-only'
      }
    >
      {copied ? 'Link copied' : ''}
    </span>
  </span>
)

export const QrButton = ({ url }: { url: string }): React.ReactNode => (
  <Modal>
    <Modal.Trigger>
      <Button aria-label="Share via QR code" className={BUTTON_CLASS} isIconOnly variant="outline">
        <QrCodeIcon className="h-4 w-4" />
      </Button>
    </Modal.Trigger>
    <Modal.Backdrop variant="blur">
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Scan to join</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG size={180} value={url} />
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
)
