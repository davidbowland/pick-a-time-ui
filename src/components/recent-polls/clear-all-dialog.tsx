import { AlertDialog, Button } from '@heroui/react'
import React from 'react'

import { DIALOG_BUTTON_CLASS, clearDialogBody } from './elements'

/*
 * Split out of `elements.tsx` so HeroUI's AlertDialog -- and the react-aria overlay tree behind it
 * -- stays out of the landing page's first-paint download. Nothing here renders any markup until
 * somebody presses "Clear all", and this file is never in the prerendered HTML.
 *
 * Deliberately NOT prefetched, unlike the date picker. This chunk is 1.6 KB gzip and most visitors
 * never clear their list, so warming it on every load would spend bytes on the majority to save
 * about 8 ms for the few. `elements.tsx` loads it on first open instead.
 */
export const ClearAllDialog = ({
  count,
  isOpen,
  onConfirm,
  onOpenChange,
}: {
  count: number
  isOpen: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}): React.ReactNode => (
  <AlertDialog.Root isOpen={isOpen} onOpenChange={onOpenChange}>
    {/* Alert dialogs disable Escape by default. This one is cancellable and Escape is how people
        leave a confirmation, so it stays on. */}
    <AlertDialog.Backdrop isKeyboardDismissDisabled={false} variant="blur">
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Heading>Clear your polls?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm text-[var(--slate)]">{clearDialogBody(count)}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button className={DIALOG_BUTTON_CLASS} onPress={() => onOpenChange(false)} variant="outline">
              Cancel
            </Button>
            <Button className={DIALOG_BUTTON_CLASS} onPress={onConfirm} variant="primary">
              Clear all
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog.Root>
)
