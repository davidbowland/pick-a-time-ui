import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import React from 'react'

import { JoinTrigger, JoinTriggerProps } from './index'
import { fetchPoll } from '@services/api'
import '@testing-library/jest-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PollData } from '@types'

// Only `fetchPoll` is replaced. `hasStatusCode` and `parseApiMessage` are pure and stay real --
// and this partial mock is precisely the arrangement that makes `instanceof ApiError` unreliable,
// which is why the dialog reads the status structurally instead.
jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  fetchPoll: jest.fn(),
}))
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

const poll = { expiration: 1_800_000_000, name: 'Board meeting — Q3' } as PollData

/** The shape a failed request arrives in: a plain object, never an `ApiError` instance. */
const apiFailure = (statusCode: number, body = ''): unknown => ({ response: { body, headers: {}, statusCode } })

interface Deferred {
  promise: Promise<PollData>
  resolve: (value: PollData) => void
}

const deferred = (): Deferred => {
  let resolve!: (value: PollData) => void
  const promise = new Promise<PollData>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('JoinTrigger', () => {
  const push = jest.fn()
  const isOnline = jest.fn()

  beforeAll(() => {
    // jsdom's navigator.onLine is a read-only accessor on the prototype, so it is replaced once
    // with one that reads a mock. `setup()` restores the default for every test.
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => isOnline() })
  })

  afterAll(() => {
    onlineManager.setOnline(true)
  })

  function setup(): void {
    isOnline.mockReturnValue(true)
    onlineManager.setOnline(true)
    // `mockResolvedValue`, not a bare `jest.fn()`. `router.push` returns a promise and the component
    // attaches a `.catch` to it; a mock returning `undefined` makes that a TypeError thrown inside
    // `onSuccess`, which query-core catches and turns into `onError`. Every test here would still
    // pass — the success branch has already rendered by then — while the component under test was
    // quietly failing on every single one of them.
    push.mockResolvedValue(true)
    jest.mocked(useRouter).mockReturnValue({ push } as any)
    jest.mocked(fetchPoll).mockResolvedValue(poll)
  }

  /** Both the browser and React Query believe the device is offline. */
  function goOffline(): void {
    isOnline.mockReturnValue(false)
    onlineManager.setOnline(false)
  }

  const renderTrigger = (variant?: JoinTriggerProps['variant']): void => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <JoinTrigger variant={variant} />
      </QueryClientProvider>,
    )
  }

  const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Enter it and join a poll' })

  const openDialog = async (): Promise<HTMLElement> => {
    await userEvent.click(trigger())
    return await screen.findByRole('dialog')
  }

  const field = (): HTMLElement => screen.getByLabelText('Poll code or link')

  const enterCode = async (code: string): Promise<HTMLElement> => {
    const dialog = await openDialog()
    await userEvent.type(field(), code)
    return dialog
  }

  const submit = async (dialog: HTMLElement): Promise<void> => {
    await userEvent.click(within(dialog).getByRole('button', { name: 'Join poll' }))
  }

  describe('the trigger', () => {
    it('asks the question in words, and extends the control name for screen readers', () => {
      setup()

      renderTrigger()

      expect(screen.getByText('Have a poll code?')).toBeInTheDocument()
      expect(trigger()).toBeInTheDocument()
    })

    it('offers a plain pill where a sentence has nothing to sit beside', () => {
      setup()

      renderTrigger('pill')

      expect(screen.getByRole('button', { name: 'Enter a poll code' })).toBeInTheDocument()
    })

    it('renders no dialog until it is pressed, so the overlay chunk is never fetched', () => {
      setup()

      renderTrigger()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens the dialog from the pill too', async () => {
      setup()

      renderTrigger('pill')
      await userEvent.click(screen.getByRole('button', { name: 'Enter a poll code' }))

      expect(await screen.findByRole('dialog', { name: 'Join a poll' })).toBeInTheDocument()
    })
  })

  describe('opening', () => {
    it('names the dialog, its field, and its way out', async () => {
      setup()

      renderTrigger()
      const dialog = await openDialog()

      expect(screen.getByRole('dialog', { name: 'Join a poll' })).toBeInTheDocument()
      expect(field()).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Join poll' })).toBeInTheDocument()
    })

    it('says what the field accepts, and describes the field with it', async () => {
      setup()

      renderTrigger()
      await openDialog()

      expect(screen.getByText('Like lazy giraffe. A whole poll link works too.')).toBeInTheDocument()
      expect(field()).toHaveAccessibleDescription('Like lazy giraffe. A whole poll link works too.')
    })

    it('puts focus on the field, not on the close button', async () => {
      setup()

      renderTrigger()
      await openDialog()

      await waitFor(() => expect(field()).toHaveFocus())
    })

    it('mounts both live regions empty, so a later change is the thing announced', async () => {
      setup()

      renderTrigger()
      const dialog = await openDialog()

      expect(within(dialog).getByRole('alert')).toBeEmptyDOMElement()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('closes on Escape and returns focus to the trigger', async () => {
      setup()

      renderTrigger()
      await openDialog()
      await userEvent.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(trigger()).toHaveFocus())
    })

    it('closes on the close control', async () => {
      setup()

      renderTrigger()
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('before any request', () => {
    it('asks for a value rather than looking up nothing', async () => {
      setup()

      renderTrigger()
      const dialog = await openDialog()
      await submit(dialog)

      expect(await within(dialog).findByText('Enter your poll code or link')).toBeInTheDocument()
      expect(fetchPoll).not.toHaveBeenCalled()
    })

    it('refuses locally what could not be a poll code, and spends no request on it', async () => {
      setup()

      renderTrigger()
      const dialog = await enterCode('100%')
      await submit(dialog)

      expect(await within(dialog).findByText("Couldn't read that as a poll code.")).toBeInTheDocument()
      expect(
        within(dialog).getByText('Enter the poll code, like lazy giraffe, or paste the whole poll link.'),
      ).toBeInTheDocument()
      expect(fetchPoll).not.toHaveBeenCalled()
    })

    it('keeps the refused value and selects it, so a retry is one keystroke', async () => {
      setup()

      renderTrigger()
      const dialog = await enterCode('100%')
      await submit(dialog)

      await waitFor(() => expect(field()).toHaveFocus())
      expect(field()).toHaveValue('100%')
    })

    it('selects the refused value, so the retry really is one keystroke', async () => {
      // The test above proves the value survives; only this one proves it is SELECTED. Deleting
      // `select()` from `failWith` leaves every other assertion in this file green, and costs
      // whoever is retrying a full retype.
      setup()

      renderTrigger()
      const dialog = await enterCode('100%')
      await submit(dialog)

      const input = field() as HTMLInputElement
      await waitFor(() => expect(input).toHaveFocus())
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe('100%'.length)
    })

    it('puts the refusal inside the live region, not merely somewhere on screen', async () => {
      // Every other failure test here resolves its copy with `findByText` against the whole dialog,
      // which passes just as well when the words render OUTSIDE `JoinError`'s region -- where no
      // screen reader announces them. Scoping the query to the region is the whole assertion.
      setup()

      renderTrigger()
      const dialog = await enterCode('100%')
      await submit(dialog)

      const alert = await within(dialog).findByRole('alert')
      await waitFor(() => expect(within(alert).getByText("Couldn't read that as a poll code.")).toBeInTheDocument())
      expect(field()).toHaveFocus()
    })

    it('marks the field invalid and describes it with the error', async () => {
      setup()

      renderTrigger()
      const dialog = await enterCode('100%')
      await submit(dialog)

      await waitFor(() => expect(field()).toHaveAttribute('aria-invalid', 'true'))
      expect(field()).toHaveAccessibleDescription(/Couldn't read that as a poll code\./)
    })
  })

  describe('a code that resolves', () => {
    it('names the poll it found and goes there', async () => {
      setup()

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      expect(await screen.findByText('Opening Board meeting — Q3…')).toBeInTheDocument()
      expect(screen.getByText('Poll code: lazy giraffe')).toBeInTheDocument()
      expect(fetchPoll).toHaveBeenCalledWith('lazy-giraffe')
      expect(push).toHaveBeenCalledWith('/p/lazy-giraffe')
    })

    it('goes nowhere when the dialog was dismissed while the lookup was still running', async () => {
      // useMutation's callbacks still fire after its observer unmounts, so without a guard someone
      // who closes mid-lookup gets yanked to a poll a second after deciding against it. That is the
      // same "navigation the user is no longer expecting" that networkMode: 'always' exists to
      // prevent, arriving through a different door.
      setup()
      const pending = deferred()
      jest.mocked(fetchPoll).mockReturnValueOnce(pending.promise)

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      pending.resolve(poll)

      await waitFor(() => expect(fetchPoll).toHaveBeenCalledWith('lazy-giraffe'))
      expect(push).not.toHaveBeenCalled()
    })

    it('falls back to the code when the poll has no name', async () => {
      setup()
      jest.mocked(fetchPoll).mockResolvedValueOnce({ ...poll, name: '' })

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      expect(await screen.findByText('Opening lazy giraffe…')).toBeInTheDocument()
      expect(screen.queryByText('Poll code: lazy giraffe')).not.toBeInTheDocument()
    })

    it('focuses the headline, which is what announces it', async () => {
      setup()

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      await waitFor(() => expect(screen.getByText('Opening Board meeting — Q3…')).toHaveFocus())
    })

    it('leaves the status region empty, so the success is not announced twice', async () => {
      setup()

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      await screen.findByText('Opening Board meeting — Q3…')
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('encodes the code it routes to', async () => {
      // A code carrying a character that ENCODES DIFFERENTLY. The earlier version of this test used
      // `lazy%20giraffe`, which the parser normalises to `lazy-giraffe` — and since
      // `encodeURIComponent('lazy-giraffe')` is `lazy-giraffe`, deleting the encode entirely left
      // the test green. It proved normalisation and called it encoding.
      //
      // The parser deliberately allows non-ASCII (it refuses only what could mean something other
      // than itself in a URL, never a shape), so this input is one the app must really handle.
      setup()

      renderTrigger()
      const dialog = await enterCode('perezoso jirafa ñ')
      await submit(dialog)

      await screen.findByText('Opening Board meeting — Q3…')
      expect(push).toHaveBeenCalledWith('/p/perezoso-jirafa-%C3%B1')
    })

    it('shows a failure rather than sitting on "Opening…" when the navigation itself rejects', async () => {
      // Without the `.catch`, a rejected push leaves the success panel on screen forever: a poll
      // that says it is opening and never opens. Untested until now because the router mock
      // returned `undefined`, which made this branch unreachable.
      setup()
      push.mockRejectedValueOnce(new Error('route cancelled'))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      expect(await within(dialog).findByText('Something went wrong looking that up. Try again.')).toBeInTheDocument()
      expect(screen.queryByText('Opening Board meeting — Q3…')).not.toBeInTheDocument()
    })
  })

  describe('while the lookup is in flight', () => {
    it('says what it is doing, in the status region and on the button', async () => {
      setup()
      const pending = deferred()
      jest.mocked(fetchPoll).mockReturnValueOnce(pending.promise)

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Finding your poll…'))
      expect(within(dialog).getByRole('button', { name: 'Finding your poll…' })).toBeInTheDocument()

      pending.resolve(poll)
      await screen.findByText('Opening Board meeting — Q3…')
    })

    it('keeps the field in the tab order rather than disabling it under the caret', async () => {
      setup()
      const pending = deferred()
      jest.mocked(fetchPoll).mockReturnValueOnce(pending.promise)

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      await waitFor(() => expect(field()).toHaveAttribute('readonly'))
      expect(field()).toHaveAttribute('aria-disabled', 'true')
      expect(field()).not.toBeDisabled()

      pending.resolve(poll)
      await screen.findByText('Opening Board meeting — Q3…')
    })

    it('will not start a second lookup', async () => {
      setup()
      const pending = deferred()
      jest.mocked(fetchPoll).mockReturnValueOnce(pending.promise)

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Finding your poll…'))
      // Enter in the field submits the form again -- the button is already unavailable, the guard
      // in the handler is what stops this one.
      await userEvent.type(field(), '{Enter}')

      expect(fetchPoll).toHaveBeenCalledTimes(1)

      pending.resolve(poll)
      await screen.findByText('Opening Board meeting — Q3…')
    })
  })

  describe('a code that misses', () => {
    it('reads the code back and says what to do about it', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      expect(
        await within(dialog).findByText("Couldn't find lazy giraffe. Check the spelling and try again."),
      ).toBeInTheDocument()
      expect(within(dialog).getByText("If it's right, the poll may have closed.")).toBeInTheDocument()
    })

    it('does not read back a value too long to be evidence', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('a-poll-code-far-longer-than-anyone-would-say-aloud')
      await submit(dialog)

      expect(
        await within(dialog).findByText("Couldn't find that poll code. Check the spelling and try again."),
      ).toBeInTheDocument()
    })

    it('says something new the second time, rather than repeating itself', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await within(dialog).findByText("Couldn't find lazy giraffe. Check the spelling and try again.")
      await submit(dialog)

      expect(
        await within(dialog).findByText('Still no poll with that code. Check it against what you were sent.'),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByText('If it matches, the poll may have closed. Ask whoever sent it for the link.'),
      ).toBeInTheDocument()
    })

    it('starts counting again once the value changes to something new', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await within(dialog).findByText("Couldn't find lazy giraffe. Check the spelling and try again.")
      await submit(dialog)
      await within(dialog).findByText('Still no poll with that code. Check it against what you were sent.')
      await userEvent.clear(field())
      await userEvent.type(field(), 'brave otter')
      await submit(dialog)

      expect(
        await within(dialog).findByText("Couldn't find brave otter. Check the spelling and try again."),
      ).toBeInTheDocument()
    })

    it('still escalates when the same value is cleared and retyped', async () => {
      // The path the second-miss copy was written for: someone re-reading the words off a phone
      // call, who clears the field and types the same thing again because they misheard nothing.
      // Tracking this on every keystroke could never work — getting back to `lazy giraffe` means
      // passing through `l`, `la`, `laz`, each of which differs from the value that missed.
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await within(dialog).findByText("Couldn't find lazy giraffe. Check the spelling and try again.")
      await userEvent.clear(field())
      await userEvent.type(field(), 'lazy giraffe')
      await submit(dialog)

      expect(
        await within(dialog).findByText('Still no poll with that code. Check it against what you were sent.'),
      ).toBeInTheDocument()
    })

    it('escalates when the same code is retyped in a different shape', async () => {
      // `lazy giraffe` and `Lazy-Giraffe` are the same identifier. Someone re-reading two words off
      // a message types a different string for the same poll nearly every attempt, so keying the
      // counter on raw text would hand them the first-miss copy forever.
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await within(dialog).findByText("Couldn't find lazy giraffe. Check the spelling and try again.")
      await userEvent.clear(field())
      await userEvent.type(field(), 'Lazy-Giraffe')
      await submit(dialog)

      expect(
        await within(dialog).findByText('Still no poll with that code. Check it against what you were sent.'),
      ).toBeInTheDocument()
    })

    it('keeps the typed value through the failure', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await within(dialog).findByText("Couldn't find lazy giraffe. Check the spelling and try again.")

      expect(field()).toHaveValue('lazy giraffe')
      await waitFor(() => expect(field()).toHaveFocus())
    })

    it('goes nowhere', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)
      await within(dialog).findByText("Couldn't find lazy giraffe. Check the spelling and try again.")

      expect(push).not.toHaveBeenCalled()
    })
  })

  describe('a lookup that cannot happen', () => {
    // The regression test for `networkMode: 'always'`. React Query v5 pauses an online-mode
    // mutation fired while offline: nothing is requested, `onError` never fires, and this message
    // never arrives -- the submit just hangs with the spinner up.
    it('says so while the device is offline, rather than waiting forever', async () => {
      setup()
      goOffline()
      jest.mocked(fetchPoll).mockRejectedValueOnce(new TypeError('Failed to fetch'))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      expect(
        await within(dialog).findByText("Couldn't look that up. Check your connection and try again."),
      ).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('passes on what the API said about its own failure', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(503, JSON.stringify({ message: 'Try again shortly.' })))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      expect(await within(dialog).findByText('Try again shortly.')).toBeInTheDocument()
    })

    it('falls back to its own words, and never puts the thrown message on screen', async () => {
      setup()
      jest.mocked(fetchPoll).mockRejectedValueOnce(new Error('GET /sessions/lazy-giraffe responded with 500'))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      expect(await within(dialog).findByText('Something went wrong looking that up. Try again.')).toBeInTheDocument()
      expect(screen.queryByText(/GET \/sessions/)).not.toBeInTheDocument()
    })

    it('never writes the thrown error to the console', async () => {
      // `ApiError.message` is built as `GET /sessions/<code>`, so re-throwing or logging it would
      // put the entered poll code into the browser console -- and into whatever ships console
      // output onward. Keeping it off the screen is only half the property; this is the other half.
      setup()
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(500, JSON.stringify({ message: 'Try again shortly.' })))

      renderTrigger()
      const dialog = await enterCode('lazy giraffe')
      await submit(dialog)

      await within(dialog).findByText('Try again shortly.')
      expect(consoleError).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('the controlled door and dock variants', () => {
    const openChanges = jest.fn()

    interface ControlledProps {
      initialOpen?: boolean
      notice?: string
      prefill?: string
      variant: 'dock' | 'door'
    }

    /**
     * The door and the dock are controlled, so their open state belongs to whoever renders them.
     * This stands in for the landing page, which has to keep the two of them, the paste listener
     * and `BackToFormCta` agreeing on which single surface is open.
     */
    const Controlled = ({ initialOpen = false, notice, prefill, variant }: ControlledProps): React.ReactNode => {
      const [open, setOpen] = React.useState(initialOpen)
      return (
        <JoinTrigger
          isOpen={open}
          notice={notice}
          onOpenChange={(next) => {
            openChanges(next)
            setOpen(next)
          }}
          prefill={prefill}
          variant={variant}
        />
      )
    }

    const renderControlled = (variant: 'dock' | 'door', props: Omit<ControlledProps, 'variant'> = {}): void => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(
        <QueryClientProvider client={queryClient}>
          <Controlled variant={variant} {...props} />
        </QueryClientProvider>,
      )
    }

    const dockTrigger = (): HTMLElement =>
      screen.getByRole('button', { name: 'Have a poll code? Enter it and join a poll' })

    const doorTrigger = (): HTMLElement => screen.getByRole('button', { name: 'Join a poll' })

    const closeControl = (): HTMLElement => screen.getByRole('button', { name: 'Close' })

    /** The panel names itself; it is deliberately not a dialog, so it is resolved as a group. */
    const panel = (): Promise<HTMLElement> => screen.findByRole('group', { name: 'Join a poll' })

    it('names the door for where it goes', () => {
      setup()

      renderControlled('door')

      expect(doorTrigger()).toBeInTheDocument()
    })

    it('asks the dock question, and extends the control name for screen readers', () => {
      setup()

      renderControlled('dock')

      expect(screen.getByText('Have a poll code?')).toBeInTheDocument()
      expect(dockTrigger()).toBeInTheDocument()
    })

    it('reports its collapsed state on the trigger', () => {
      setup()

      renderControlled('dock')

      expect(dockTrigger()).toHaveAttribute('aria-expanded', 'false')
    })

    it('becomes a close control while open, so the question is never asked twice on one screen', async () => {
      setup()

      renderControlled('dock', { initialOpen: true })
      await panel()

      expect(closeControl()).toHaveAttribute('aria-expanded', 'true')
      expect(screen.queryByText('Have a poll code?')).not.toBeInTheDocument()
    })

    it('renders no panel until it is pressed, so the overlay chunk is never fetched', () => {
      setup()

      renderControlled('door')

      // The FALLBACK's absence is the assertion that discriminates. `next/dynamic` always renders
      // its `loading` element on the first commit, so querying for the field would pass even with
      // the `{isOpen ? ... : null}` guard deleted -- and that guard is the entire reason HeroUI's
      // Modal stays out of the landing page's first-paint chunk.
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument()
    })

    it('asks to open when pressed', async () => {
      setup()

      renderControlled('door')
      await userEvent.click(doorTrigger())

      expect(openChanges).toHaveBeenCalledWith(true)
      expect(await panel()).toBeInTheDocument()
    })

    it('asks to close when pressed again', async () => {
      setup()

      renderControlled('door', { initialOpen: true })
      await panel()
      await userEvent.click(closeControl())

      expect(openChanges).toHaveBeenCalledWith(false)
      expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument()
    })

    it('points the trigger at the panel it controls', async () => {
      setup()

      renderControlled('dock', { initialOpen: true })

      expect(closeControl().getAttribute('aria-controls')).toBe((await panel()).id)
    })

    it('opens a disclosure rather than a dialog, so the page behind stays operable', async () => {
      setup()

      renderControlled('door', { initialOpen: true })
      await panel()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('hands the panel the code it was opened with', async () => {
      setup()

      renderControlled('dock', { initialOpen: true, prefill: 'lazy giraffe' })

      expect(await screen.findByLabelText('Poll code or link')).toHaveValue('lazy giraffe')
    })

    it('hands the panel the notice that explains why it opened', async () => {
      setup()

      renderControlled('dock', { initialOpen: true, notice: "That link goes to a poll — here's the code to join it." })

      expect(await screen.findByText("That link goes to a poll — here's the code to join it.")).toBeInTheDocument()
    })

    it('takes no focus when it mounts closed, so arriving on the page never moves the caret', () => {
      setup()

      renderControlled('dock')

      expect(dockTrigger()).not.toHaveFocus()
      expect(document.body).toHaveFocus()
    })

    it('returns focus to the trigger when Escape closes the panel', async () => {
      // The panel closes by asking to be unmounted, and at that instant the focused element is
      // inside the subtree being removed -- so without the trigger taking focus back, Escape drops
      // a keyboard visitor onto <body> and makes them tab the page again from the top.
      setup()

      renderControlled('dock', { initialOpen: true })
      await waitFor(() => expect(field()).toHaveFocus())
      await userEvent.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument())
      expect(dockTrigger()).toHaveFocus()
    })

    it('leaves focus alone when the page closes the panel for its own reasons', async () => {
      setup()
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const view = (isOpen: boolean): React.ReactNode => (
        <QueryClientProvider client={client}>
          <input aria-label="Name your poll" />
          <JoinTrigger isOpen={isOpen} onOpenChange={jest.fn()} variant="door" />
        </QueryClientProvider>
      )
      const { rerender } = render(view(true))
      await panel()

      // The panel is non-modal on purpose, so the visitor can click straight back into the page --
      // and the next task closes this panel FROM THE PAGE when a poll link is pasted into that very
      // field. Returning focus on every close, rather than only when the browser dropped it, would
      // rip the caret out mid-paste and scroll to a trigger the visitor was not looking at.
      const elsewhere = screen.getByLabelText('Name your poll')
      elsewhere.focus()
      rerender(view(false))

      expect(elsewhere).toHaveFocus()
    })

    it('leaves Escape to the rest of the page while focus is outside the panel', async () => {
      setup()
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <input aria-label="Name your poll" />
          <Controlled variant="door" />
        </QueryClientProvider>,
      )
      await userEvent.click(doorTrigger())
      await panel()

      screen.getByLabelText('Name your poll').focus()
      await userEvent.keyboard('{Escape}')

      // Still open: a disclosure that swallowed every Escape on the page would take the key away
      // from the page it deliberately left operable.
      expect(await panel()).toBeInTheDocument()
    })

    it('returns focus to the trigger when the close control closes the panel', async () => {
      // For these variants the trigger IS the close control -- while open it reads `Close`, the
      // panel's only visible dismissal -- so pressing `Close` and pressing the trigger are one
      // gesture, and this covers both of AC-032's press paths.
      setup()

      renderControlled('dock', { initialOpen: true })
      await waitFor(() => expect(field()).toHaveFocus())
      await userEvent.click(closeControl())

      await waitFor(() => expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument())
      expect(dockTrigger()).toHaveFocus()
    })

    it('returns focus to the door when the door panel closes', async () => {
      setup()

      renderControlled('door', { initialOpen: true })
      await waitFor(() => expect(field()).toHaveFocus())
      await userEvent.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument())
      expect(doorTrigger()).toHaveFocus()
    })

    it('leaves focus in the field while the panel stays open', async () => {
      setup()

      renderControlled('door', { initialOpen: true })
      await panel()

      await waitFor(() => expect(field()).toHaveFocus())
    })
  })
})
