import { Button, Modal } from '@heroui/react'
import { Check, Copy, QrCode as QrCodeIcon, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

// h-9: one step below the default control size, so the group sits beside the poll title as
// quiet header furniture instead of competing with it.
// --field-border, not --hair: --hair is a 22%-alpha line that reads about 1.5:1 against the page,
// under the 3:1 WCAG floor for a control boundary. See the comment beside --field-border in
// assets/css/index.css, which exists for exactly this case.
const BUTTON_CLASS = `h-9 shrink-0 rounded-full border-[var(--field-border)] bg-[var(--bone)]/[0.07] text-[var(--bone)] hover:bg-white/[0.12] ${FOCUS_RING}`
const ICON_BUTTON_CLASS = `w-9 min-w-0 ${BUTTON_CLASS}`

// Taller than the header row's h-9 buttons: this one sits in a modal body with room to spare, and
// a copy control people reach for while reading a code aloud should clear 44px comfortably.
const CODE_BUTTON_CLASS = `h-11 shrink-0 rounded-full border-[var(--field-border)] bg-[var(--bone)]/[0.07] px-4 text-sm text-[var(--bone)] hover:bg-white/[0.12] ${FOCUS_RING}`

const LABEL_CLASS = 'text-xs font-medium uppercase tracking-[0.14em] text-[var(--slate)]'

export const ShareGroup = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="flex items-center gap-2">{children}</div>
)

export const ShareButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <Button aria-label="Share" className={`px-3 sm:px-4 ${BUTTON_CLASS}`} onPress={onPress} variant="outline">
    <Share2 aria-hidden="true" className="h-4 w-4" />
    <span className="hidden sm:inline">Share</span>
  </Button>
)

/**
 * A solid chip (background + shadow), not bare text, so this reads as a small overlay floating above
 * whatever's underneath rather than an extra row squeezed into the gap beside the control.
 * `pointer-events-none`: without it, the chip could block a tap on that content for the ~2s it is
 * visible.
 *
 * The region is always mounted and empty until `copied` flips, because a live region that enters the
 * DOM already populated is announced by nothing (see components/poll/index.tsx:69-73). The label is
 * text, never colour alone. The caller supplies the `relative` positioning context.
 *
 * `placement` exists because of where the two callers sit, not for variety. HeroUI's Modal defaults
 * to `scroll: "inside"`, which makes `.modal__body` an `overflow-y-auto` clip box. A chip hanging
 * BELOW the last element in that body lands in the dialog's own padding, outside the clip, and is
 * cut off — so the on-screen half of the confirmation disappears while the announced half keeps
 * working, which is the kind of failure no test in jsdom can see. The header-row copy button is not
 * inside a scroller and is unaffected, which is exactly why this is a per-caller decision.
 */
export const CopiedChip = ({
  copied,
  label,
  placement = 'below',
}: {
  copied: boolean
  label: string
  placement?: 'below' | 'above'
}): React.ReactNode => (
  <span
    aria-live="polite"
    className={
      copied
        ? `pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--surface)] px-2 py-1 text-xs text-[var(--bone)] shadow-lg ${
            placement === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`
        : 'sr-only'
    }
  >
    {copied ? label : ''}
  </span>
)

export const CopyButton = ({ copied, onPress }: { copied: boolean; onPress: () => void }): React.ReactNode => (
  <span className="relative inline-flex shrink-0">
    <Button aria-label="Copy link" className={ICON_BUTTON_CLASS} isIconOnly onPress={onPress} variant="outline">
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
    </Button>
    <CopiedChip copied={copied} label="Link copied" />
  </span>
)

export interface QrButtonProps {
  codeCopied: boolean
  isOpen: boolean
  onCopyCode: () => void
  onOpenChange: (isOpen: boolean) => void
  sessionId: string
  url: string
}

export const QrButton = ({
  codeCopied,
  isOpen,
  onCopyCode,
  onOpenChange,
  sessionId,
  url,
}: QrButtonProps): React.ReactNode => (
  // Controlled: the copy-confirmed state lives in the parent, so the open state does too.
  // No panel background or radius is set here — HeroUI's .modal__dialog supplies both.
  <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
    {/* `render` rather than a `Button` child, matching install-prompt/elements.tsx:179-186:
        `Modal.Trigger` renders its own `role="button"` wrapper, so nesting a real button inside it
        puts TWO buttons with the same name in the accessibility tree and only the inner one is
        focusable. Rendering the trigger AS the button leaves exactly one control. */}
    <Modal.Trigger
      aria-label="Show the QR code and poll code"
      className={`inline-flex items-center justify-center ${ICON_BUTTON_CLASS}`}
      render={(props) => <button {...(props as React.ComponentPropsWithRef<'button'>)} type="button" />}
    >
      <QrCodeIcon aria-hidden="true" className="h-4 w-4" />
    </Modal.Trigger>
    <Modal.Backdrop variant="blur">
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header>
            <Modal.Heading>Share this poll</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-5">
              {/* aria-hidden: the QR encodes the URL and nothing else, and the URL is real text
                  a few lines down. Announcing the plate would only add noise. */}
              <div aria-hidden="true" className="flex justify-center rounded-xl bg-white p-4">
                <QRCodeSVG size={180} value={url} />
              </div>
              <p className="text-center text-sm text-[var(--slate)]">Scan to join</p>

              <dl className="flex flex-col gap-1">
                <dt className={LABEL_CLASS}>Poll link</dt>
                <dd className="break-all select-all text-sm text-[var(--bone)]">{url}</dd>
              </dl>

              <div aria-hidden="true" className="h-px w-full bg-[var(--hair)]" />

              <dl className="flex flex-col gap-2">
                <dt className={LABEL_CLASS}>Poll code</dt>
                {/* Real, selectable, resizable text — never an image — and spaced rather than
                    hyphenated because the point of it is being read out loud. */}
                <dd className="break-words select-all text-3xl font-semibold tracking-wide text-[var(--bone)] sm:text-4xl">
                  {sessionId.split('-').join(' ')}
                </dd>
              </dl>

              <span className="relative inline-flex self-start">
                <Button className={CODE_BUTTON_CLASS} onPress={onCopyCode} variant="outline">
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Copy code
                </Button>
                <CopiedChip copied={codeCopied} label="Code copied" placement="above" />
              </span>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
)
