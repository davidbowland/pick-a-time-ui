import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import React from 'react'

import { JOIN_COPY } from './elements'
import { JoinPanelImpl } from './join-panel'
import { fetchPoll } from '@services/api'
import '@testing-library/jest-dom'
import { RenderResult, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PollData } from '@types'

// Only `fetchPoll` is replaced, matching the sibling dialog suite: `hasStatusCode` and
// `parseApiMessage` are pure and stay real.
jest.mock('@services/api', () => ({ ...jest.requireActual('@services/api'), fetchPoll: jest.fn() }))
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

/** The shape a failed request arrives in: a plain object, never an `ApiError` instance. */
const apiFailure = (statusCode: number, body = ''): unknown => ({ response: { body, headers: {}, statusCode } })

describe('JoinPanelImpl', () => {
  const onOpenChange = jest.fn()
  const poll = { expiration: 1_800_000_000, name: 'Game night' } as PollData
  const push = jest.fn()

  function setup(props: Partial<React.ComponentProps<typeof JoinPanelImpl>> = {}): RenderResult {
    // `mockResolvedValue`, not a bare `jest.fn()`: the hook attaches a `.catch` to what `push`
    // returns, and `undefined` would turn that into a TypeError swallowed by query-core.
    push.mockResolvedValue(true)
    jest.mocked(useRouter).mockReturnValue({ push } as any)
    jest.mocked(fetchPoll).mockResolvedValue(poll)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={client}>
        <JoinPanelImpl anchor="dock" id="panel" onOpenChange={onOpenChange} {...props} />
      </QueryClientProvider>,
    )
  }

  const field = (): HTMLInputElement => screen.getByLabelText(JOIN_COPY.fieldLabel) as HTMLInputElement

  const submitButton = (): HTMLElement => screen.getByRole('button', { name: JOIN_COPY.submit })

  it('is not a dialog — it is a non-modal disclosure', () => {
    setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names itself without rendering a heading', () => {
    setup()
    expect(screen.getByLabelText(JOIN_COPY.heading)).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('takes its name from inside itself, never from the trigger', () => {
    setup()
    const panel = document.getElementById('panel') as HTMLElement
    const nameId = panel.getAttribute('aria-labelledby') as string
    // The trigger's visible label becomes `Close` while the panel is open, so a name borrowed from
    // it would read as "Close". The named element has to live in here.
    expect(panel.contains(document.getElementById(nameId))).toBe(true)
    expect(document.getElementById(nameId)).toHaveTextContent(JOIN_COPY.heading)
  })

  it('offers the same field at the door anchor', () => {
    setup({ anchor: 'door' })
    expect(field()).toBeInTheDocument()
  })

  it('puts focus in the field when it opens', async () => {
    setup()
    await waitFor(() => expect(field()).toHaveFocus())
  })

  it('applies a prefill and selects it so one keystroke replaces it', async () => {
    setup({ prefill: 'lazy giraffe' })
    await waitFor(() => expect(field()).toHaveFocus())
    expect(field()).toHaveValue('lazy giraffe')
    await waitFor(() => expect(field().selectionEnd).toBe('lazy giraffe'.length))
    expect(field().selectionStart).toBe(0)
  })

  it('leaves the field empty when there is nothing to prefill', async () => {
    setup()
    await waitFor(() => expect(field()).toHaveFocus())
    expect(field()).toHaveValue('')
  })

  it('shows the notice it was given', async () => {
    setup({ notice: JOIN_COPY.pasteNotice })
    expect(await screen.findByText(JOIN_COPY.pasteNotice)).toBeInTheDocument()
  })

  // The panel mounts only when it opens, so a notice rendered on the first commit would enter the
  // DOM already populated -- which every screen reader ignores. It has to arrive later.
  it('mounts every live region empty and fills the notice on a later commit', async () => {
    setup({ notice: JOIN_COPY.pasteNotice })
    // `getAllByRole`, not `getByRole`: this surface hosts the progress region as well as the notice.
    screen.getAllByRole('status').forEach((region) => expect(region).toBeEmptyDOMElement())
    const notice = await screen.findByText(JOIN_COPY.pasteNotice)
    expect(notice.closest('[role="status"]')).toBeInTheDocument()
  })

  it('announces the notice politely, so it never cuts anything off', async () => {
    setup({ notice: JOIN_COPY.pasteNotice })
    const notice = await screen.findByText(JOIN_COPY.pasteNotice)
    expect(notice.closest('[role="alert"]')).toBeNull()
  })

  // A polite region fired in the same tick as a focus move is routinely swallowed. The description
  // is the fallback that cannot be swallowed, because it is part of the focus announcement.
  it('speaks the notice as part of the field, not only as a live region', async () => {
    setup({ notice: JOIN_COPY.pasteNotice, prefill: 'lazy giraffe' })
    await screen.findByText(JOIN_COPY.pasteNotice)
    expect(field()).toHaveAccessibleDescription(expect.stringContaining(JOIN_COPY.pasteNotice))
  })

  it('describes the field with the hint alone when there is no notice', async () => {
    setup()
    await waitFor(() => expect(field()).toHaveFocus())
    expect(field()).toHaveAccessibleDescription(JOIN_COPY.hint)
  })

  it('drops the notice once a lookup has been attempted, so it cannot contradict an error', async () => {
    jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))
    setup({ notice: JOIN_COPY.pasteNotice, prefill: 'lazy giraffe' })
    await screen.findByText(JOIN_COPY.pasteNotice)
    await userEvent.click(submitButton())

    await screen.findByRole('alert')
    expect(screen.queryByText(JOIN_COPY.pasteNotice)).not.toBeInTheDocument()
  })

  it('describes the field with the error once a lookup has failed', async () => {
    jest.mocked(fetchPoll).mockRejectedValueOnce(apiFailure(404))
    setup({ prefill: 'lazy giraffe' })
    await waitFor(() => expect(field()).toHaveFocus())
    await userEvent.click(submitButton())

    await screen.findByRole('alert')
    expect(field()).toHaveAccessibleDescription(expect.stringContaining(JOIN_COPY.firstMissNote))
  })

  it('closes on Escape and reports it', async () => {
    setup()
    await waitFor(() => expect(field()).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ignores every other key', async () => {
    setup()
    await waitFor(() => expect(field()).toHaveFocus())
    await userEvent.keyboard('a')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  // The listener is on `document`, so a panel that left one behind would keep closing a panel that
  // no longer exists — and, once the door and the dock have both been opened, the wrong one.
  it('stops listening for Escape once it is gone', async () => {
    const { unmount } = setup()
    await waitFor(() => expect(field()).toHaveFocus())
    unmount()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('opens the poll when the code resolves', async () => {
    setup({ prefill: 'lazy giraffe' })
    await waitFor(() => expect(field()).toHaveFocus())
    await userEvent.click(submitButton())
    await waitFor(() => expect(push).toHaveBeenCalledWith('/p/lazy-giraffe'))
  })

  it('names the poll it found while it opens', async () => {
    setup({ prefill: 'lazy giraffe' })
    await waitFor(() => expect(field()).toHaveFocus())
    await userEvent.click(submitButton())
    expect(await screen.findByText(JOIN_COPY.successHeadline('Game night'))).toBeInTheDocument()
  })

  it('says it is looking while the lookup is in flight', async () => {
    jest.mocked(fetchPoll).mockReturnValueOnce(new Promise<PollData>(() => undefined))
    setup({ prefill: 'lazy giraffe' })
    await waitFor(() => expect(field()).toHaveFocus())
    await userEvent.click(submitButton())
    await waitFor(() => expect(screen.getAllByText(JOIN_COPY.finding).length).toBeGreaterThan(0))
  })
})
