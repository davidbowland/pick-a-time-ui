import React, { useEffect, useId, useRef, useState } from 'react'

import {
  BROWSER_MENU_STEPS,
  DismissAction,
  INSTALL_COPY,
  IOS_STEPS,
  InstallAction,
  InstallActions,
  InstallBanner,
  InstallBody,
  InstallHeadingLevel,
  InstallStepsDialog,
  InstalledStatus,
} from './elements'
import { useInstallPrompt } from '@hooks/useInstallPrompt'
import { InstallCapability } from '@utils/install-capability'

/** The capabilities that put a visible offer on screen. The other two render nothing. */
const OFFERING: InstallCapability[] = ['promptable', 'spent', 'ios-share', 'browser-menu']

/**
 * Where focus goes when the offer is dismissed.
 *
 * The banner unmounts on dismiss, so without this focus falls to `<body>` and the next Tab starts
 * the page over — AC-023 calls that focus "lost to the document". The main landmark is the
 * skip-link target every page already implies, and `tabindex="-1"` is what makes a landmark
 * accept `focus()` without joining the tab order. Injectable, so a page with a better answer than
 * "the top of the content" can pass one.
 */
export const focusMainLandmark = (doc: Document | null = globalThis.document): void => {
  const target = doc?.querySelector<HTMLElement>('main') ?? doc?.querySelector<HTMLElement>('h1')
  if (!target) return
  target.setAttribute('tabindex', '-1')
  // preventScroll: the banner sits well below the fold on `/`, and focusing the landmark without
  // this jumps the page to the top as a side effect of dismissing a banner.
  target.focus({ preventScroll: true })
}

export interface InstallPromptProps {
  /** Called after a dismissal, once the offer is gone. Defaults to focusing the main landmark. */
  focusAfterDismiss?: () => void
  /** The offer sits under the page's `h1`; a page that nests it deeper passes `h3`. */
  headingLevel?: InstallHeadingLevel
}

/**
 * Offers to install Pick a Time, but only where installing is actually possible.
 *
 * Everything about which offer to make lives in `useInstallPrompt`; this component's whole job is
 * to render one of four offers, nothing at all, or the announcement that the app is now installed.
 * Rendering nothing for `installed` and `none` is the point rather than an omission: an offer a
 * browser cannot honour is a promise the app then fails to keep.
 *
 * The banner is inline and NOT focus-trapped — see the note on `InstallBanner`. Only the
 * instruction dialog traps focus, because only it is modal.
 */
const InstallPrompt = ({
  focusAfterDismiss = focusMainLandmark,
  headingLevel = 'h2',
}: InstallPromptProps): React.ReactNode => {
  const { capability, dismiss, prompt } = useInstallPrompt()
  const [wasOffered, setWasOffered] = useState(false)
  const [hasPrompted, setHasPrompted] = useState(false)
  // Deliberately one render behind `capability === 'installed'`. The live region has to be in the
  // DOM and EMPTY before it gains text, or assistive technology treats it as a new node rather than
  // a changed region and announces nothing at all.
  const [announced, setAnnounced] = useState(false)
  const dismissRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const headingId = useId()

  // Remembers that an offer was on screen, so a later `installed` can tell the two silences apart:
  // arriving inside the installed app says nothing, whereas an offer that disappears because the
  // install succeeded has to announce itself (AC-041).
  useEffect(() => {
    if (OFFERING.includes(capability)) setWasOffered(true)
  }, [capability])

  // Focus follows the control that vanished, and only after the visitor pressed something. The
  // browser's install sheet destroys `Install` whichever way it is answered: accepted, the whole
  // banner goes; declined, the offer becomes `spent` and only the dismiss button is left. Both
  // drop focus to `<body>` unless it is moved deliberately. This never fires for an install that
  // happened elsewhere — stealing focus in response to a background event is its own defect.
  // Runs after the empty region has painted, so this second update is what AT actually hears.
  useEffect(() => {
    if (capability !== 'installed' || !wasOffered) return
    setAnnounced(true)
  }, [capability, wasOffered])

  useEffect(() => {
    if (!hasPrompted) return
    const target = capability === 'installed' ? statusRef.current : dismissRef.current
    target?.focus()
  }, [capability, hasPrompted])

  const handleInstall = async (): Promise<void> => {
    await prompt()
    setHasPrompted(true)
  }

  const handleDismiss = (): void => {
    dismiss()
    focusAfterDismiss()
  }

  if (capability === 'installed') {
    return wasOffered ? <InstalledStatus announced={announced} ref={statusRef} /> : null
  }

  if (capability === 'none') {
    return null
  }

  const isSpent = capability === 'spent'

  return (
    <InstallBanner headingId={headingId} headingLevel={headingLevel}>
      <InstallBody>{isSpent ? INSTALL_COPY.spentBody : INSTALL_COPY.body}</InstallBody>
      <InstallActions>
        {capability === 'promptable' && <InstallAction label={INSTALL_COPY.install} onPress={handleInstall} />}
        {capability === 'ios-share' && <InstallStepsDialog steps={IOS_STEPS} />}
        {capability === 'browser-menu' && <InstallStepsDialog steps={BROWSER_MENU_STEPS} />}
        <DismissAction
          label={isSpent ? INSTALL_COPY.spentDismiss : INSTALL_COPY.dismiss}
          onPress={handleDismiss}
          ref={dismissRef}
        />
      </InstallActions>
    </InstallBanner>
  )
}

export default InstallPrompt
