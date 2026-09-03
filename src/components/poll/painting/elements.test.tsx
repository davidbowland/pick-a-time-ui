import React from 'react'

import { CalendarStrip, CalendarStripProps, GridKey, PaintStatus, StripReport, Toolbar } from './elements'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Toolbar', () => {
  it('should select every cell when Select all is pressed', async () => {
    const onSelectAll = jest.fn()
    render(<Toolbar onClear={jest.fn()} onSelectAll={onSelectAll} />)
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(onSelectAll).toHaveBeenCalledTimes(1)
  })

  it('should clear every cell when Clear all is pressed', async () => {
    const onClear = jest.fn()
    render(<Toolbar onClear={onClear} onSelectAll={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('GridKey', () => {
  // The two ordinary fills are unconditional: green versus grey is the entire language of this
  // grid, and a voter who never connects a calendar used to get no legend at all. AC-035 still
  // holds for the two calendar treatments below them — those appear only while a cell draws them.
  const keyCases: [string, number, number, string[]][] = [
    [
      'both calendar treatments on screen',
      2,
      3,
      ['Free', 'Not free', 'Booked on your calendar', 'Marked free, but booked'],
    ],
    ['only unmarked booked squares', 2, 0, ['Free', 'Not free', 'Booked on your calendar']],
    ['only marked-and-booked squares', 0, 3, ['Free', 'Not free', 'Marked free, but booked']],
    ['no calendar layer at all', 0, 0, ['Free', 'Not free']],
  ]

  it.each(keyCases)('should list exactly the treatments drawn for %s', (_name, unmarked, marked, expected) => {
    render(<GridKey markedBookedCount={marked} unmarkedBookedCount={unmarked} />)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(expected)
  })

  // The free/not-free pair is what a signed-out voter -- the majority of them -- has to read the
  // grid by, so the key has to survive having no calendar to talk about.
  it('should keep the key on screen when no cell draws a calendar treatment', () => {
    render(<GridKey markedBookedCount={0} unmarkedBookedCount={0} />)
    expect(screen.getByRole('list', { name: 'Key' })).toBeInTheDocument()
  })

  it('should draw the check on the free swatch', () => {
    render(<GridKey markedBookedCount={0} unmarkedBookedCount={0} />)
    expect(screen.getByTestId('key-free-check')).toBeInTheDocument()
  })

  it('should name the key for a screen reader', () => {
    render(<GridKey markedBookedCount={1} unmarkedBookedCount={1} />)
    expect(screen.getByRole('list', { name: 'Key' })).toBeInTheDocument()
  })

  // Each swatch draws the mark its cell draws, not just its fill. The fills alone cannot carry the
  // key: a conflict's fill IS an ordinary painted cell's fill, and booked sits a deliberate 6%
  // off unpainted, so a fill-only swatch names a square the reader cannot find on the grid. Same
  // WCAG 1.4.1 reasoning the cells themselves follow.
  it('should draw the calendar mark on the booked swatch', () => {
    render(<GridKey markedBookedCount={0} unmarkedBookedCount={2} />)
    expect(screen.getByTestId('key-booked-glyph')).toBeInTheDocument()
  })

  it('should draw the check on the marked-and-booked swatch', () => {
    render(<GridKey markedBookedCount={3} unmarkedBookedCount={0} />)
    expect(screen.getByTestId('key-conflict-check')).toBeInTheDocument()
  })

  // The bar is the whole difference between a conflict and an ordinary painted cell, so a swatch
  // without it is the bug this key already had.
  it('should draw the bar on the marked-and-booked swatch', () => {
    render(<GridKey markedBookedCount={3} unmarkedBookedCount={0} />)
    expect(screen.getByTestId('key-conflict-bar')).toBeInTheDocument()
  })

  it('should draw no marks for a treatment no cell is drawing', () => {
    render(<GridKey markedBookedCount={0} unmarkedBookedCount={2} />)
    expect(screen.queryByTestId('key-conflict-bar')).not.toBeInTheDocument()
  })
})

describe('PaintStatus', () => {
  const INSTRUCTION = "Click the times you're free. Drag across to mark several."

  // The wrong verb here does not merely read as off-register: it names a gesture the reader's
  // hardware cannot perform. Only the first word moves -- dragging is dragging on both.
  it.each([
    [true, "Tap the times you're free. Drag across to mark several."],
    [false, "Click the times you're free. Drag across to mark several."],
  ])('should name the gesture the pointer can actually make (coarse: %s)', (isCoarsePointer, expected) => {
    render(<PaintStatus isCoarsePointer={isCoarsePointer} markedCount={0} saveState="idle" />)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  // The verb this screen never had. It stays on screen at every state, because a voter changing
  // their mind needs it as much as one arriving at an empty grid.
  it.each([
    ['an empty grid', 0, 'idle' as const],
    ['a grid already filled in', 8, 'idle' as const],
    ['a save in flight', 3, 'saving' as const],
    ['a save that landed', 3, 'saved' as const],
  ])('should keep the instruction on screen for %s', (_name, markedCount, saveState) => {
    render(<PaintStatus isCoarsePointer={false} markedCount={markedCount} saveState={saveState} />)
    expect(screen.getByText(INSTRUCTION)).toBeInTheDocument()
  })

  // Nothing has happened yet, so there is nothing to report. Saying "0 slots marked" to somebody
  // who has not touched the grid reads as a failure rather than a starting point.
  it('should report nothing before the voter has marked anything', () => {
    render(<PaintStatus isCoarsePointer={false} markedCount={0} saveState="idle" />)
    expect(screen.getByTestId('paint-status').textContent).toBe('')
  })

  // The whole reason this exists: painting saves silently on a debounce and there is no Submit
  // button, so without a receipt the voter's reasonable assumption -- that nothing has been sent
  // -- is wrong and nothing on screen corrects it.
  it.each([
    [1, '1 slot marked. Saved.'],
    [8, '8 slots marked. Saved.'],
  ])('should report %i marked slots once the save lands', (markedCount, expected) => {
    render(<PaintStatus isCoarsePointer={false} markedCount={markedCount} saveState="saved" />)
    expect(screen.getByTestId('paint-status').textContent).toBe(expected)
  })

  // Clearing the grid is a save like any other, and "0 slots marked" is a number where a state is
  // what the voter wants confirmed.
  it('should say a cleared grid is empty rather than count nothing', () => {
    render(<PaintStatus isCoarsePointer={false} markedCount={0} saveState="saved" />)
    expect(screen.getByTestId('paint-status').textContent).toBe('Nothing marked. Saved.')
  })

  it('should say a save is in flight rather than claim it has landed', () => {
    render(<PaintStatus isCoarsePointer={false} markedCount={3} saveState="saving" />)
    expect(screen.getByTestId('paint-status').textContent).toBe('Saving…')
  })

  // A voter returning to a poll they already answered gets the count without the claim: nothing
  // was just saved, so nothing says it was.
  it('should report what is already marked without claiming a save just happened', () => {
    render(<PaintStatus isCoarsePointer={false} markedCount={8} saveState="idle" />)
    expect(screen.getByTestId('paint-status').textContent).toBe('8 slots marked.')
  })

  // Polite, never assertive: the report follows a gesture the voter just made, so interrupting
  // them to read it back would be worse than letting it wait.
  it('should announce the report through a live region', () => {
    render(<PaintStatus isCoarsePointer={false} markedCount={2} saveState="saved" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('CalendarStrip', () => {
  const now = (): number => 1_754_006_400_000
  const noop = (): void => undefined
  const base: CalendarStripProps = {
    bookedCount: 3,
    busyWindow: { end: '2026-08-25', start: '2026-08-12' },
    conflictCount: 0,
    fillReasonId: 'fill-reason',
    fillableCount: 4,
    hasBusyLayer: true,
    isChecking: false,
    isConnecting: false,
    lastSyncedAt: 1_754_006_280,
    markedCount: 2,
    now,
    onCheckAgain: noop,
    onClearConflicts: noop,
    onConnect: noop,
    onDismiss: noop,
    onFill: noop,
    onKeepConflicts: noop,
    status: 'connected',
  }

  const liveText = (): string => screen.getByTestId('calendar-strip-detail').textContent ?? ''

  describe('not connected', () => {
    it('should offer to connect', () => {
      render(<CalendarStrip {...base} status="not_connected" />)
      expect(screen.getByText('Fill this in from your calendar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    })

    // AC-033: the prompt may promise only what the system does. It shows booked time and marks
    // nothing on its own, and the freeBusy limit is stated as the fact it is.
    it('should promise only what connecting actually does', () => {
      render(<CalendarStrip {...base} status="not_connected" />)
      expect(liveText()).toBe(
        "Connect Google Calendar and we'll show where your primary calendar says you're booked, then fill in the rest in one tap. We never mark anything you didn't ask for. We see when you're busy — never event titles, guests, or locations.",
      )
    })

    it('should claim no automatic marking', () => {
      render(<CalendarStrip {...base} status="not_connected" />)
      expect(screen.queryByText(/we'll mark you busy|automatically/i)).not.toBeInTheDocument()
    })

    it('should connect when Connect is pressed', async () => {
      const onConnect = jest.fn()
      render(<CalendarStrip {...base} onConnect={onConnect} status="not_connected" />)
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
      expect(onConnect).toHaveBeenCalledTimes(1)
    })

    it('should dismiss the offer when Not now is pressed', async () => {
      const onDismiss = jest.fn()
      render(<CalendarStrip {...base} onDismiss={onDismiss} status="not_connected" />)
      await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('connecting', () => {
    it('should say it is connecting', () => {
      render(<CalendarStrip {...base} isConnecting status="not_connected" />)
      expect(liveText()).toBe('Connecting to Google Calendar…')
    })

    // The one control that keeps native `disabled`: its label is its own explanation and the state
    // ends by itself, so nothing is stranded by its leaving the tab order (AC-032's exception).
    it('should refuse a second press while connecting', () => {
      render(<CalendarStrip {...base} isConnecting status="not_connected" />)
      expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
    })
  })

  describe('checking', () => {
    // AC-031: what is on screen stays on screen, and the live region says where it came from.
    it('should say a check is running and that the squares are from the last one', () => {
      render(<CalendarStrip {...base} isChecking />)
      expect(screen.getByText('Google Calendar connected')).toBeInTheDocument()
      expect(liveText()).toBe('Checking your calendar… The booked squares on screen are from the last check.')
    })

    // AC-032: aria-disabled, never disabled — the control stays reachable and says why.
    it('should keep the fill control focusable while making it inert', async () => {
      const onFill = jest.fn()
      render(<CalendarStrip {...base} isChecking onFill={onFill} />)
      const fill = screen.getByRole('button', { name: "Fill in what's free" })

      fill.focus()
      await userEvent.click(fill)

      expect(fill).toHaveAttribute('aria-disabled', 'true')
      expect(fill).not.toBeDisabled()
      expect(fill).toHaveFocus()
      expect(onFill).not.toHaveBeenCalled()
    })

    it('should point the inert fill control at an on-screen reason', () => {
      render(<CalendarStrip {...base} isChecking />)
      expect(screen.getByRole('button', { name: "Fill in what's free" })).toHaveAttribute(
        'aria-describedby',
        'fill-reason',
      )
    })

    it('should make the check control inert without removing it from the tab order', () => {
      render(<CalendarStrip {...base} isChecking />)
      const checking = screen.getByRole('button', { name: 'Checking…' })
      checking.focus()
      expect(checking).toHaveAttribute('aria-disabled', 'true')
      expect(checking).toHaveFocus()
    })
  })

  describe('connected, at rest', () => {
    // One case per branch of the at-rest report, table-driven: the copy is where this feature is
    // most likely to make a claim it cannot support.
    const restCases: [string, Partial<CalendarStripProps>, string][] = [
      [
        'nothing marked yet, with booked time on screen',
        { bookedCount: 3, markedCount: 0 },
        "The grid shows where your calendar says you're booked. One tap marks everything else free.",
      ],
      [
        'a grid where every slot is booked, and so has no fill control to point at',
        { bookedCount: 6, fillableCount: 0, markedCount: 0 },
        'Nothing left to fill. Nothing on your grid changed.',
      ],
      [
        'a check that found nothing booked',
        { bookedCount: 0, lastSyncedAt: null },
        'Checked just now · nothing booked on your primary calendar, Aug 12–25',
      ],
      [
        'a check that found nothing booked, some time ago',
        { bookedCount: 0 },
        'Checked 2 minutes ago · nothing booked on your primary calendar, Aug 12–25',
      ],
      [
        'a window that spans two months',
        { bookedCount: 0, busyWindow: { end: '2026-09-02', start: '2026-08-12' }, lastSyncedAt: null },
        'Checked just now · nothing booked on your primary calendar, Aug 12–Sep 2',
      ],
      [
        'marked time that no booking contradicts',
        { bookedCount: 3, markedCount: 5 },
        'Nothing you marked is booked on your calendar.',
      ],
      // No layer to report on: the authenticated read refused (an unlinked participant), so the
      // strip may say when the account was last checked and nothing whatever about booked time.
      ['no busy layer of its own', { hasBusyLayer: false }, 'Checked 2 minutes ago'],
      // A window the server could not name is not a window we can read out.
      ['a check with no window to name', { bookedCount: 0, busyWindow: null }, 'Checked 2 minutes ago'],
    ]

    it.each(restCases)('should report %s', (_name, overrides, expected) => {
      render(<CalendarStrip {...base} {...overrides} />)
      expect(liveText()).toBe(expected)
    })

    it('should confirm the connection in the title', () => {
      render(<CalendarStrip {...base} />)
      expect(screen.getByText('Google Calendar connected')).toBeInTheDocument()
    })

    it('should offer the fill when there is something left to fill', async () => {
      const onFill = jest.fn()
      render(<CalendarStrip {...base} onFill={onFill} />)
      await userEvent.click(screen.getByRole('button', { name: "Fill in what's free" }))
      expect(onFill).toHaveBeenCalledTimes(1)
    })

    // AC-034's tail: an empty calendar still leaves the bulk action available.
    it('should keep the fill available when the calendar is clear', () => {
      render(<CalendarStrip {...base} bookedCount={0} />)
      expect(screen.getByRole('button', { name: "Fill in what's free" })).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    })

    // The distinction the count alone cannot draw: fillableCount is high here precisely BECAUSE no
    // layer arrived, since a slot nothing knows to be booked counts as fillable. Offering the
    // control on that number promises to skip booked hours and skips none, having seen none --
    // Select all wearing the calendar's name. Reachable for real: a signed-in participant whose
    // record is not yet linked gets a 403 on the authed read and falls back to the open one.
    it('should withhold the fill when no busy layer arrived, however many slots look fillable', () => {
      render(<CalendarStrip {...base} fillableCount={12} hasBusyLayer={false} />)
      expect(screen.queryByRole('button', { name: "Fill in what's free" })).not.toBeInTheDocument()
    })

    it('should drop the fill when every slot is already marked or booked', () => {
      render(<CalendarStrip {...base} fillableCount={0} />)
      expect(screen.queryByRole('button', { name: "Fill in what's free" })).not.toBeInTheDocument()
    })

    it('should check again when Check again is pressed', async () => {
      const onCheckAgain = jest.fn()
      render(<CalendarStrip {...base} onCheckAgain={onCheckAgain} />)
      await userEvent.click(screen.getByRole('button', { name: 'Check again' }))
      expect(onCheckAgain).toHaveBeenCalledTimes(1)
    })

    it('should never offer disconnect, which is account-wide', () => {
      render(<CalendarStrip {...base} />)
      expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument()
    })
  })

  describe('reports', () => {
    // AC-024 and AC-040. Every singular/plural branch of the report copy, one case each. The
    // skipped count is what the fill actually skipped, so it varies independently of the marked one.
    const reportCases: [StripReport, string][] = [
      [{ kind: 'filled', markedCount: 23, skippedCount: 7 }, 'Marked 23 slots free · skipped 7 booked slots'],
      [{ kind: 'filled', markedCount: 1, skippedCount: 7 }, 'Marked 1 slot free · skipped 7 booked slots'],
      [{ kind: 'filled', markedCount: 23, skippedCount: 1 }, 'Marked 23 slots free · skipped 1 booked slot'],
      [{ kind: 'filled', markedCount: 30, skippedCount: 0 }, 'Marked 30 slots free'],
      [{ kind: 'filled', markedCount: 0, skippedCount: 3 }, 'Nothing left to fill. Nothing on your grid changed.'],
      [{ count: 7, kind: 'cleared' }, 'Cleared 7 slots · nothing you marked is booked now'],
      [{ count: 1, kind: 'cleared' }, 'Cleared 1 slot · nothing you marked is booked now'],
      [{ count: 7, kind: 'kept' }, "Kept 7 slots · we won't ask again unless you change them"],
      [{ count: 1, kind: 'kept' }, "Kept 1 slot · we won't ask again unless you change it"],
      [{ kind: 'unchanged' }, "Checked 2 minutes ago · your booked time hasn't changed"],
    ]

    it.each(reportCases)('should report %j in the live region', (report, expected) => {
      render(<CalendarStrip {...base} report={report} />)
      expect(liveText()).toBe(expected)
    })

    it('should keep the connected title while reporting', () => {
      render(<CalendarStrip {...base} report={{ kind: 'filled', markedCount: 4, skippedCount: 0 }} />)
      expect(screen.getByText('Google Calendar connected')).toBeInTheDocument()
    })
  })

  describe('review', () => {
    const reviewCases: [number, string, string, string][] = [
      [7, '7 slots you marked free are booked on your calendar.', 'Clear these 7', 'Keep them'],
      [1, '1 slot you marked free is booked on your calendar.', 'Clear this one', 'Keep it'],
    ]

    it.each(reviewCases)(
      'should state %i unresolved conflicts and offer both ways out',
      (count, detail, clear, keep) => {
        render(<CalendarStrip {...base} conflictCount={count} />)
        expect(screen.getByText('Marked free, but booked')).toBeInTheDocument()
        expect(liveText()).toBe(detail)
        expect(screen.getByRole('button', { name: clear })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: keep })).toBeInTheDocument()
      },
    )

    it('should clear every conflict when the resolution control is pressed', async () => {
      const onClearConflicts = jest.fn()
      render(<CalendarStrip {...base} conflictCount={3} onClearConflicts={onClearConflicts} />)
      await userEvent.click(screen.getByRole('button', { name: 'Clear these 3' }))
      expect(onClearConflicts).toHaveBeenCalledTimes(1)
    })

    it('should keep every conflict when the keep control is pressed', async () => {
      const onKeepConflicts = jest.fn()
      render(<CalendarStrip {...base} conflictCount={3} onKeepConflicts={onKeepConflicts} />)
      await userEvent.click(screen.getByRole('button', { name: 'Keep them' }))
      expect(onKeepConflicts).toHaveBeenCalledTimes(1)
    })

    // The review asks one question. A check cannot answer it -- it would only re-report the same
    // conflicts -- and the fill cannot touch a booked slot, so both stand down until it is settled.
    it('should offer nothing but the two resolutions', () => {
      render(<CalendarStrip {...base} conflictCount={3} />)
      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Clear these 3', 'Keep them'])
    })

    // The report of a resolution belongs to the state after it, so a live conflict outranks it.
    it('should ask before it reports', () => {
      render(<CalendarStrip {...base} conflictCount={2} report={{ count: 5, kind: 'cleared' }} />)
      expect(liveText()).toBe('2 slots you marked free are booked on your calendar.')
    })
  })

  describe('error', () => {
    // AC-042: named, not merely undrawn.
    it('should say the calendar could not be reached and offer a retry', () => {
      render(<CalendarStrip {...base} status="error" />)
      expect(screen.getByText("We couldn't reach Google Calendar")).toBeInTheDocument()
      expect(liveText()).toBe('Nothing on your grid changed. Booked squares are hidden until we can check again.')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('should retry when Try again is pressed', async () => {
      const onCheckAgain = jest.fn()
      render(<CalendarStrip {...base} onCheckAgain={onCheckAgain} status="error" />)
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onCheckAgain).toHaveBeenCalledTimes(1)
    })

    it('should keep the fill reachable but inert, with its reason named', async () => {
      const onFill = jest.fn()
      render(<CalendarStrip {...base} onFill={onFill} status="error" />)
      const fill = screen.getByRole('button', { name: "Fill in what's free" })

      fill.focus()
      await userEvent.click(fill)

      expect(fill).toHaveAttribute('aria-disabled', 'true')
      expect(fill).toHaveAttribute('aria-describedby', 'fill-reason')
      expect(fill).toHaveFocus()
      expect(onFill).not.toHaveBeenCalled()
    })
  })

  // The state a retry cannot mend. Google has dropped the permission, so the only control that can
  // change anything is Connect -- and a `Try again` here would be a button guaranteed to fail.
  describe('revoked', () => {
    it('should ask for a reconnect and say the grid is untouched', () => {
      render(<CalendarStrip {...base} status="revoked" />)
      expect(screen.getByText('Reconnect Google Calendar')).toBeInTheDocument()
      expect(liveText()).toBe(
        'Google ended the permission we were using, so we stopped checking. Nothing on your grid changed. Reconnect to see your booked squares again.',
      )
    })

    it('should offer Reconnect and never a retry', () => {
      render(<CalendarStrip {...base} status="revoked" />)
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    })

    it('should start the connect flow when Reconnect is pressed', async () => {
      const onConnect = jest.fn()
      const onCheckAgain = jest.fn()
      render(<CalendarStrip {...base} onCheckAgain={onCheckAgain} onConnect={onConnect} status="revoked" />)

      await userEvent.click(screen.getByRole('button', { name: 'Reconnect' }))

      expect(onConnect).toHaveBeenCalledTimes(1)
      expect(onCheckAgain).not.toHaveBeenCalled()
    })

    it('should keep the fill reachable but inert, with its reason named', async () => {
      const onFill = jest.fn()
      render(<CalendarStrip {...base} onFill={onFill} status="revoked" />)
      const fill = screen.getByRole('button', { name: "Fill in what's free" })

      fill.focus()
      await userEvent.click(fill)

      expect(fill).toHaveAttribute('aria-disabled', 'true')
      expect(fill).toHaveAttribute('aria-describedby', 'fill-reason')
      expect(fill).toHaveFocus()
      expect(onFill).not.toHaveBeenCalled()
    })
  })

  // AC-036. A live region that is unmounted and remounted with new text is frequently not
  // announced at all, so every state has to update this one node rather than replace it.
  it('should keep one live region across every state transition', () => {
    const { rerender } = render(<CalendarStrip {...base} status="not_connected" />)
    const live = screen.getByTestId('calendar-strip-detail')

    rerender(<CalendarStrip {...base} isConnecting status="not_connected" />)
    rerender(<CalendarStrip {...base} isChecking />)
    rerender(<CalendarStrip {...base} conflictCount={2} />)
    rerender(<CalendarStrip {...base} report={{ count: 2, kind: 'cleared' }} />)
    rerender(<CalendarStrip {...base} status="revoked" />)
    rerender(<CalendarStrip {...base} status="error" />)

    expect(screen.getByTestId('calendar-strip-detail')).toBe(live)
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent('Nothing on your grid changed.')
  })
})
