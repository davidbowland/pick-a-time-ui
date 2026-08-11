import React from 'react'

import InstallPrompt, { focusMainLandmark } from './index'
import { UseInstallPrompt, useInstallPrompt } from '@hooks/useInstallPrompt'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallCapability } from '@utils/install-capability'

jest.mock('@hooks/useInstallPrompt')

describe('InstallPrompt', () => {
  const dismiss = jest.fn()
  const focusAfterDismiss = jest.fn()
  const prompt = jest.fn()

  beforeAll(() => {
    prompt.mockResolvedValue(false)
  })

  const setup = (capability: InstallCapability, overrides: Partial<UseInstallPrompt> = {}): void => {
    jest.mocked(useInstallPrompt).mockReturnValue({
      capability,
      dismiss,
      isDismissed: false,
      prompt,
      ...overrides,
    })
  }

  const renderPrompt = (): ReturnType<typeof render> => render(<InstallPrompt focusAfterDismiss={focusAfterDismiss} />)

  const openSteps = async (): Promise<void> => {
    await userEvent.click(screen.getByRole('button', { name: 'How to install' }))
    await screen.findByRole('dialog')
  }

  describe('capabilities that render nothing', () => {
    it('renders nothing inside the installed app', () => {
      setup('installed')

      const { container } = renderPrompt()

      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('renders nothing when the browser cannot install', () => {
      setup('none')

      const { container } = renderPrompt()

      expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing once the offer has been dismissed', () => {
      // The hook persists the dismissal and reports `none` for it, so a dismissed offer is
      // indistinguishable from a browser that never had one -- by design.
      setup('none', { isDismissed: true })

      const { container } = renderPrompt()

      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('promptable', () => {
    it('offers to install, with a way out', () => {
      setup('promptable')

      renderPrompt()

      expect(screen.getByRole('heading', { name: 'Install Pick a Time' })).toBeInTheDocument()
      expect(screen.getByText('Opens full screen, straight to your polls.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    })

    it('names the region by its heading', () => {
      setup('promptable')

      renderPrompt()

      expect(screen.getByRole('region', { name: 'Install Pick a Time' })).toBeInTheDocument()
    })

    it('renders the heading at the level the page asks for', () => {
      setup('promptable')

      render(<InstallPrompt headingLevel="h3" />)

      expect(screen.getByRole('heading', { level: 3, name: 'Install Pick a Time' })).toBeInTheDocument()
    })

    it('asks the browser to install when Install is pressed', async () => {
      setup('promptable')

      renderPrompt()
      await userEvent.click(screen.getByRole('button', { name: 'Install' }))

      expect(prompt).toHaveBeenCalledTimes(1)
    })

    it('does not trap focus -- the banner is inline, not modal', async () => {
      setup('promptable')

      render(
        <>
          <InstallPrompt focusAfterDismiss={focusAfterDismiss} />
          <a href="/">After the banner</a>
        </>,
      )
      await userEvent.tab()
      expect(screen.getByRole('button', { name: 'Install' })).toHaveFocus()
      await userEvent.tab()
      await userEvent.tab()

      expect(screen.getByRole('link', { name: 'After the banner' })).toHaveFocus()
    })
  })

  describe('spent', () => {
    it('explains the one-shot prompt rather than vanishing', () => {
      setup('spent')

      renderPrompt()

      expect(screen.getByRole('heading', { name: 'Install Pick a Time' })).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your browser offers the install button only once per visit. Open your browser menu and choose Install app, or reload this page to bring the button back.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hide this' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    })
  })

  describe('ios-share', () => {
    it('offers instructions instead of a button the browser cannot honour', () => {
      setup('ios-share')

      renderPrompt()

      expect(screen.getByRole('button', { name: 'How to install' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    })

    it('gives Safari steps as an ordered list, in order', async () => {
      setup('ios-share')

      renderPrompt()
      await openSteps()

      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        "Tap Share in Safari's toolbar.",
        'Choose Add to Home Screen.',
        'Open Pick a Time from your Home Screen.',
      ])
    })

    it('names the dialog and its close control', async () => {
      setup('ios-share')

      renderPrompt()
      await openSteps()

      expect(screen.getByRole('dialog', { name: 'Install Pick a Time' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Close install steps' })).toBeInTheDocument()
    })

    it('moves focus into the dialog on open', async () => {
      setup('ios-share')

      renderPrompt()
      await openSteps()

      await waitFor(() => expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement))
    })

    it('closes on Escape and returns focus to the trigger', async () => {
      setup('ios-share')

      renderPrompt()
      await openSteps()
      await userEvent.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(screen.getByRole('button', { name: 'How to install' })).toHaveFocus())
    })

    it('closes on Got it and returns focus to the trigger', async () => {
      setup('ios-share')

      renderPrompt()
      await openSteps()
      await userEvent.click(screen.getByRole('button', { name: 'Got it' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(screen.getByRole('button', { name: 'How to install' })).toHaveFocus())
    })

    it('closes on the close control', async () => {
      setup('ios-share')

      renderPrompt()
      await openSteps()
      await userEvent.click(screen.getByRole('button', { name: 'Close install steps' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('browser-menu', () => {
    it('gives Firefox for Android its own steps, in order', async () => {
      setup('browser-menu')

      renderPrompt()
      await openSteps()

      // textContent includes the screen-reader-only gloss, which is the point: what a sighted
      // reader sees is "Tap ⋮", what a screen reader hears is "Tap the three-dot menu".
      expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        "Tap ⋮the three-dot menu in your browser's toolbar.",
        'Choose Add to Home screen.',
        'Open Pick a Time from there.',
      ])
    })

    // U+22EE is announced as nothing, so without a gloss the step reads "Tap in your browser's
    // toolbar" — an instruction with its subject missing. The glyph is hidden and the words are
    // supplied beside it, rather than role="img" + aria-label, which VoiceOver prefixes with
    // "image".
    it('gives the menu glyph a spoken name, so the step is not read with its subject missing', async () => {
      setup('browser-menu')

      renderPrompt()
      await openSteps()

      const step = screen.getAllByRole('listitem')[0]

      expect(step.querySelector('[aria-hidden="true"]')?.textContent).toBe('⋮')
      expect(step.querySelector('.sr-only')?.textContent).toBe('the three-dot menu')
    })
  })

  describe('dismissal', () => {
    it('persists the dismissal through the hook', async () => {
      setup('promptable')

      renderPrompt()
      await userEvent.click(screen.getByRole('button', { name: 'Not now' }))

      expect(dismiss).toHaveBeenCalledTimes(1)
    })

    it('moves focus somewhere rather than dropping it to the document', async () => {
      setup('promptable')

      renderPrompt()
      await userEvent.click(screen.getByRole('button', { name: 'Not now' }))

      expect(focusAfterDismiss).toHaveBeenCalledTimes(1)
    })

    it('dismisses the spent offer too', async () => {
      setup('spent')

      renderPrompt()
      await userEvent.click(screen.getByRole('button', { name: 'Hide this' }))

      expect(dismiss).toHaveBeenCalledTimes(1)
      expect(focusAfterDismiss).toHaveBeenCalledTimes(1)
    })

    it('is dismissible from the keyboard', async () => {
      setup('promptable')

      renderPrompt()
      screen.getByRole('button', { name: 'Not now' }).focus()
      await userEvent.keyboard('{Enter}')

      expect(dismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('focusMainLandmark', () => {
    it('focuses the main landmark', () => {
      render(<main>Content</main>)

      focusMainLandmark(document)

      expect(screen.getByRole('main')).toHaveFocus()
    })

    it('falls back to the page heading when there is no main landmark', () => {
      render(<h1>Your polls</h1>)

      focusMainLandmark(document)

      expect(screen.getByRole('heading', { name: 'Your polls' })).toHaveFocus()
    })

    it('does nothing when there is neither', () => {
      render(<p>Nothing focusable</p>)

      focusMainLandmark(document)

      expect(document.body).toHaveFocus()
    })

    it('does nothing without a document', () => {
      expect(() => focusMainLandmark(null)).not.toThrow()
    })

    it('reads the live document when given nothing', () => {
      render(<main>Content</main>)

      focusMainLandmark()

      expect(screen.getByRole('main')).toHaveFocus()
    })
  })

  describe('installation succeeding', () => {
    it('announces the install rather than letting the offer vanish silently', async () => {
      setup('promptable')

      const { rerender } = renderPrompt()
      await userEvent.click(screen.getByRole('button', { name: 'Install' }))
      setup('installed')
      rerender(<InstallPrompt focusAfterDismiss={focusAfterDismiss} />)

      expect(screen.getByRole('status')).toHaveTextContent('Pick a Time is installed.')
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    })

    it('puts focus on the announcement, since the button the visitor pressed is gone', async () => {
      setup('promptable')

      const { rerender } = renderPrompt()
      await userEvent.click(screen.getByRole('button', { name: 'Install' }))
      setup('installed')
      rerender(<InstallPrompt focusAfterDismiss={focusAfterDismiss} />)

      await waitFor(() => expect(screen.getByRole('status')).toHaveFocus())
    })

    it('announces an install that happened outside the offer, without stealing focus', async () => {
      setup('promptable')

      const { rerender } = renderPrompt()
      setup('installed')
      rerender(<InstallPrompt focusAfterDismiss={focusAfterDismiss} />)

      expect(screen.getByRole('status')).toHaveTextContent('Pick a Time is installed.')
      await waitFor(() => expect(screen.getByRole('status')).not.toHaveFocus())
    })
  })

  describe('declining the browser install sheet', () => {
    it('explains the spent prompt and keeps focus on the control that is left', async () => {
      setup('promptable')

      const { rerender } = renderPrompt()
      await userEvent.click(screen.getByRole('button', { name: 'Install' }))
      setup('spent')
      rerender(<InstallPrompt focusAfterDismiss={focusAfterDismiss} />)

      await waitFor(() => expect(screen.getByRole('button', { name: 'Hide this' })).toHaveFocus())
    })
  })
})
