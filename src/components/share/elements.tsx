import { Button, Input, Label, Modal, Spinner, TextField, FieldError } from '@heroui/react'
import { Check, Copy, Send, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React from 'react'

import { GoogleLogo } from '@components/google-logo'

export const ShareModal = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <Modal>
    <Modal.Trigger>
      <Button
        className="rounded-full border-white/[0.15] bg-white/[0.07] text-[#E5E7EB] hover:bg-white/[0.12]"
        variant="outline"
      >
        <Share2 className="h-4 w-4" />
        Invite
      </Button>
    </Modal.Trigger>
    <Modal.Backdrop variant="blur">
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Invite friends</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4 p-0.5">{children}</div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
)

export const CopyUrlButton = ({ copied, onPress }: { copied: boolean; onPress: () => void }): React.ReactNode => (
  <Button className="w-full" onPress={onPress} variant="outline">
    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    {copied ? 'Copied!' : 'Copy URL'}
  </Button>
)

export const QrCode = ({ url }: { url: string }): React.ReactNode => (
  <div className="flex justify-center rounded-xl bg-white p-4">
    <QRCodeSVG size={140} value={url} />
  </div>
)

export const SmsForm = ({
  isSending,
  isValid,
  error,
  onChange,
  onSend,
  phone,
}: {
  isSending: boolean
  isValid: boolean
  error?: string
  onChange: (value: string) => void
  onSend: () => void
  phone: string
}): React.ReactNode => (
  <div className="flex flex-col gap-2">
    <TextField isInvalid={!!error}>
      <Label>Phone number</Label>
      <Input
        disabled={isSending}
        onChange={(e) => onChange(e.target.value)}
        placeholder="+1 (555) 123-4567"
        type="tel"
        value={phone}
      />
      {error && <FieldError>{error}</FieldError>}
    </TextField>
    <Button className="w-full" isDisabled={!isValid || isSending} onPress={onSend}>
      {isSending ? <Spinner color="current" size="sm" /> : <Send className="h-4 w-4" />}
      {isSending ? 'Sending...' : 'Send invite'}
    </Button>
  </div>
)

export const SmsAuthGate = ({ onSignIn }: { onSignIn: () => void }): React.ReactNode => (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-divider bg-surface p-4">
    <p className="text-center text-sm text-default-500">Sign in with Google to invite people by text</p>
    <Button onPress={onSignIn} size="sm" variant="outline">
      <GoogleLogo />
      Sign in with Google
    </Button>
  </div>
)

export const StatusMessage = ({ error, status }: { error: string; status: string }): React.ReactNode => (
  <>
    {status === 'sent' && <p className="text-center text-sm text-success">Invite sent</p>}
    {status === 'error' && <p className="text-sm text-danger">{error}</p>}
  </>
)
