import { Button, Modal } from '@heroui/react'
import React, { useState } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

/**
 * Every visible string this surface renders, reviewed and approved as a set. Kept together so a
 * later edit has to look at the whole voice at once rather than one label in isolation.
 *
 * Deliberately absent, and not to be added back: an exclamation mark (this app has none anywhere),
 * any promise of notifications (out of scope), and any claim about working offline — the app does
 * not work offline, and saying so on the install offer would be the one lie a visitor could check
 * within a minute of installing.
 */
export const INSTALL_COPY = {
  body: 'Opens full screen, straight to your polls.',
  closeSteps: 'Close install steps',
  dismiss: 'Not now',
  gotIt: 'Got it',
  heading: 'Install Pick a Time',
  install: 'Install',
  installed: 'Pick a Time is installed.',
  instructions: 'How to install',
  spentBody:
    'Your browser offers the install button only once per visit. Open your browser menu and choose Install app, or reload this page to bring the button back.',
  spentDismiss: 'Hide this',
} as const

export interface InstallStep {
  id: string
  text: React.ReactNode
}

export const IOS_STEPS: InstallStep[] = [
  { id: 'share', text: "Tap Share in Safari's toolbar." },
  { id: 'add', text: 'Choose Add to Home Screen.' },
  { id: 'open', text: 'Open Pick a Time from your Home Screen.' },
]

export const BROWSER_MENU_STEPS: InstallStep[] = [
  {
    id: 'menu',
    text: (
      <>
        Tap{' '}
        {/* U+22EE is announced as nothing at all by VoiceOver and as "vertical ellipsis" by some
            others, either of which turns this step into "Tap in your browser's toolbar" — an
            instruction with its subject missing. The visible glyph is unchanged; only what a
            screen reader says in its place is supplied. */}
        {/* U+22EE is announced as NOTHING by VoiceOver, so the step read "Tap in your browser's
            toolbar" -- an instruction with its subject silently removed. role="img" + aria-label
            works but VoiceOver prefixes it with "image"; sr-only text reads cleanly and matches the
            idiom already used in src/components/share/elements.tsx. */}
        <span aria-hidden="true">⋮</span>
        <span className="sr-only">the three-dot menu</span> in your browser&apos;s toolbar.
      </>
    ),
  },
  { id: 'add', text: 'Choose Add to Home screen.' },
  { id: 'open', text: 'Open Pick a Time from there.' },
]

// min-h-11 is 44px, comfortably past the 24x24 CSS px floor of WCAG 2.2 AA (2.5.8), and matches the
// touch target the rest of the app already offers.
const ACTION_BASE = `inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold ${FOCUS_RING}`

// motion-safe: is the only motion here, so nothing at all plays under prefers-reduced-motion,
// matching the gate at src/assets/css/index.css:210-214. There is no entrance animation by design:
// a banner that slides in is a banner that moves while somebody is reading the line above it.
const PRIMARY_ACTION_CLASS = `${ACTION_BASE} bg-[var(--accent)] text-[var(--ink)] hover:opacity-90 motion-safe:transition-opacity`

const DISMISS_ACTION_CLASS = `${ACTION_BASE} text-[var(--accent)] underline underline-offset-2 hover:opacity-90 motion-safe:transition-opacity`

export type InstallHeadingLevel = 'h2' | 'h3'

export interface InstallBannerProps {
  children: React.ReactNode
  headingId: string
  headingLevel: InstallHeadingLevel
}

/**
 * The offer itself: an inline, non-modal region on the `IntroExplainer` idiom.
 *
 * It is deliberately NOT focus-trapped. Trapping a panel that sits in the normal flow of the page
 * would manufacture exactly the keyboard dead end AC-025 forbids: nothing here is modal, the
 * content behind it is still live, and a visitor who is not interested must be able to tab
 * straight past. Only the instruction dialog below traps focus, because a dialog is modal and its
 * backdrop really does make the rest of the page unreachable.
 */
export const InstallBanner = ({ children, headingId, headingLevel }: InstallBannerProps): React.ReactNode => {
  const Heading = headingLevel

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-[var(--hair)] bg-[var(--bone)]/10 pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] text-sm text-[var(--bone)]"
    >
      <Heading className="text-base font-bold text-[var(--bone)]" id={headingId}>
        {INSTALL_COPY.heading}
      </Heading>
      {children}
    </section>
  )
}

// --bone rather than the quieter --slate: over this panel's `--bone/10` fill, slate measures 4.6:1
// against a 4.5:1 requirement, which is close enough to the line that any later tweak to the fill
// breaks it. Bone measures 12.3:1 and matches `IntroExplainer`, which this panel copies.
export const InstallBody = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <p className="mt-1 text-sm text-[var(--bone)]" role="status">
    {children}
  </p>
)

export const InstallActions = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
)

export const InstallAction = ({ label, onPress }: { label: string; onPress: () => void }): React.ReactNode => (
  <Button className={PRIMARY_ACTION_CLASS} onPress={onPress} variant="primary">
    {label}
  </Button>
)

export interface DismissActionProps {
  label: string
  onPress: () => void
  ref?: React.Ref<HTMLButtonElement>
}

// A plain button rather than a HeroUI one, following `IntroExplainer`'s own dismiss: this is quiet
// text, and the ref is needed so focus can be put back on it when the offer changes underfoot.
export const DismissAction = ({ label, onPress, ref }: DismissActionProps): React.ReactNode => (
  <button className={DISMISS_ACTION_CLASS} onClick={onPress} ref={ref} type="button">
    {label}
  </button>
)

/**
 * AC-041: the offer vanishing on its own is a change of context, so it is announced rather than
 * silently removed. `tabIndex={-1}` is here so focus can land on the message when the button the
 * visitor just pressed disappears from under their cursor — the alternative is focus falling to
 * `<body>`.
 *
 * The wording neither congratulates nor promises anything: the app does not work offline and does
 * not send notifications, so the announcement says only that the install happened.
 */
export const InstalledStatus = ({
  announced,
  ref,
}: {
  announced: boolean
  ref?: React.Ref<HTMLParagraphElement>
}): React.ReactNode => (
  // The element renders EMPTY first and gains its text on a later update. A live region that
  // enters the DOM already populated is commonly never announced -- NVDA, JAWS and VoiceOver all
  // watch existing regions for changes rather than treating a fresh populated node as one. Focus
  // alone would announce it, but the path that does not take focus is exactly what AC-041 is for.
  <p className="text-sm text-[var(--slate)]" ref={ref} role="status" tabIndex={-1}>
    {announced ? INSTALL_COPY.installed : ''}
  </p>
)

/**
 * The per-browser steps, in a real `<ol>` inside a real modal.
 *
 * A dialog, not an expander, because the steps send somebody into browser chrome the page cannot
 * draw: the instruction has to stay put while they look for the control, and the page behind it
 * has nothing to offer until they are done. HeroUI's `Modal` brings the focus trap, Escape, and
 * focus restore to the trigger with it, which is the whole reason to use it rather than hand-roll
 * a panel.
 */
export const InstallStepsDialog = ({ steps }: { steps: InstallStep[] }): React.ReactNode => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
      {/* `render` rather than a `Button` child: `Modal.Trigger` renders its own `role="button"`
          wrapper, so nesting a real button inside it puts TWO buttons with the same name in the
          accessibility tree, and only the inner one is focusable. Rendering the trigger AS the
          button leaves exactly one control, reachable by keyboard, which is what AC-039 asks for. */}
      <Modal.Trigger
        className={PRIMARY_ACTION_CLASS}
        render={(props) => <button {...(props as React.ComponentPropsWithRef<'button'>)} type="button" />}
      >
        {INSTALL_COPY.instructions}
      </Modal.Trigger>
      <Modal.Backdrop variant="blur">
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={INSTALL_COPY.closeSteps} />
            <Modal.Header>
              <Modal.Heading>{INSTALL_COPY.heading}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--bone)]">
                {steps.map((step) => (
                  <li key={step.id}>{step.text}</li>
                ))}
              </ol>
            </Modal.Body>
            <Modal.Footer>
              <Button className={PRIMARY_ACTION_CLASS} onPress={() => setIsOpen(false)} variant="primary">
                {INSTALL_COPY.gotIt}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
