import React, { useState } from 'react'

import RecentPolls from './index'
import { RecentPoll } from '@hooks/useRecentPolls'
import '@testing-library/jest-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jsdom ships no PointerEvent, and react-aria falls back to mouse events without it. HeroUI's
// AlertDialog buttons sit on that path, so supplying one keeps a click here behaving like a real
// click. Same polyfill the app-bar suite uses.
class PointerEventPolyfill extends MouseEvent {
  public pointerId: number
  public pointerType: string
  public width: number
  public height: number
  public pressure: number
  public isPrimary: boolean

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props)
    this.pointerId = props.pointerId ?? 1
    this.pointerType = props.pointerType ?? 'mouse'
    this.width = props.width ?? 1
    this.height = props.height ?? 1
    this.pressure = props.pressure ?? 0.5
    this.isPrimary = props.isPrimary ?? true
  }
}

global.PointerEvent = PointerEventPolyfill as never
Element.prototype.hasPointerCapture = (): boolean => false
Element.prototype.setPointerCapture = (): void => undefined
Element.prototype.releasePointerCapture = (): void => undefined

// Two live regions are always mounted -- one for prune notices, one for removal/restore -- because a
// region has to exist BEFORE it has text or assistive technology announces nothing. So `role`
// alone is ambiguous; pick the one holding the message under test.
const liveRegionContaining = (text: string): HTMLElement => {
  const region = screen.getAllByRole('status').find((node) => node.textContent?.includes(text))
  if (!region) throw new Error(`No live region contains: ${text}`)
  return region
}

describe('RecentPolls', () => {
  // Fixed clock and a fixed zone. Every "closes in N days" string below is arithmetic against
  // these two, so nothing here rots when the machine's date or zone changes.
  const nowMs = 1_754_038_800_000 // 2025-08-01T09:00:00Z
  const now = (): number => nowMs
  const timeZone = 'UTC'

  // Epoch SECONDS, as the store holds them (useRecentPolls.ts:9-12).
  const CLOSES_TODAY = 1_754_078_400 // 2025-08-01T20:00:00Z
  const CLOSES_TOMORROW = 1_754_164_800 // 2025-08-02T20:00:00Z
  const CLOSES_IN_5 = 1_754_510_400 // 2025-08-06T20:00:00Z
  const CLOSES_IN_12 = 1_755_115_200 // 2025-08-13T20:00:00Z
  const CLOSED_AUG_8 = 1_754_683_200 // 2025-08-08T20:00:00Z

  const onClear = jest.fn()
  const onRemove = jest.fn()
  const onRestore = jest.fn()

  const buildPoll = (overrides: Partial<RecentPoll> = {}): RecentPoll => ({
    expiration: CLOSES_IN_5,
    lastSeen: 1_754_000_000_000,
    name: 'Dave',
    pollName: 'Sprint retro',
    seenIntro: true,
    sessionId: 'amber-harbor',
    userId: 'user-1',
    ...overrides,
  })

  const sprintRetro = buildPoll()
  const cabinTrip = buildPoll({
    expiration: CLOSES_IN_12,
    lastSeen: 1_754_000_500_000,
    name: 'Quiet Falcon',
    pollName: 'Cabin trip — August',
    sessionId: 'blue-meadow',
    userId: 'user-2',
  })
  const designCrit = buildPoll({
    expiration: CLOSES_TODAY,
    lastSeen: 1_753_999_000_000,
    pollName: 'Design crit',
    sessionId: 'green-lantern',
    userId: 'user 3/4',
  })

  // 60 characters. Long names must wrap and stay readable, never be clipped away.
  const longName = 'Quarterly planning and roadmap review with the whole team————'

  const manyPolls = Array.from({ length: 25 }, (_, index) =>
    buildPoll({
      lastSeen: 1_754_000_000_000 + index,
      pollName: `Poll ${index}`,
      sessionId: `session-${index}`,
      userId: `user-${index}`,
    }),
  )

  // Stands in for the single owner of `useRecentPolls` (Section 12). Mounting the hook twice does
  // not share state, so the list lives above this component and arrives as props.
  const Harness = ({
    initial,
    prunedCount,
    prunedPolls,
  }: {
    initial: RecentPoll[]
    prunedCount?: number
    prunedPolls?: RecentPoll[]
  }): React.ReactNode => {
    const [polls, setPolls] = useState(initial)
    return (
      <RecentPolls
        now={now}
        onClear={() => {
          onClear()
          setPolls([])
        }}
        onRemove={(sessionId) => {
          onRemove(sessionId)
          setPolls((current) => current.filter((poll) => poll.sessionId !== sessionId))
        }}
        onRestore={(poll) => {
          onRestore(poll)
          setPolls((current) => [poll, ...current])
        }}
        polls={polls}
        prunedCount={prunedCount}
        prunedPolls={prunedPolls}
        timeZone={timeZone}
      />
    )
  }

  const renderList = (initial: RecentPoll[], prunedCount?: number, prunedPolls?: RecentPoll[]): void => {
    render(<Harness initial={initial} prunedCount={prunedCount} prunedPolls={prunedPolls} />)
  }

  const rowNames = (): string[] =>
    screen.getAllByRole('listitem').map((row) => within(row).getByRole('link').getAttribute('aria-label') ?? '')

  const removeButton = (pollName: string): HTMLElement =>
    screen.getByRole('button', { name: `Remove ${pollName} from your polls` })

  describe('empty', () => {
    it('should say the device holds nothing rather than showing an empty list', () => {
      renderList([])

      expect(screen.getByRole('heading', { name: 'No polls on this device yet.' })).toBeInTheDocument()
      expect(screen.getByText('Open a poll link and it shows up here.')).toBeInTheDocument()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('should hide Clear all when there is nothing to clear', () => {
      renderList([])

      expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()
    })

    it('should drop the pick-up-where-you-left-off lede when there is nowhere to pick up from', () => {
      renderList([])

      expect(screen.queryByText(/Pick up where you left off/)).not.toBeInTheDocument()
    })
  })

  describe('list', () => {
    it('should title the surface and explain what the list is', () => {
      renderList([sprintRetro])

      expect(screen.getByRole('heading', { level: 1, name: 'Your polls' })).toBeInTheDocument()
      expect(
        screen.getByText(
          'Pick up where you left off. These live on this device only, and each one goes away when its poll closes.',
        ),
      ).toBeInTheDocument()
    })

    it('should expose real list semantics with one item per poll', () => {
      renderList([sprintRetro, cabinTrip, designCrit])

      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })

    it('should order the rows newest first', () => {
      renderList([sprintRetro, cabinTrip, designCrit])

      expect(rowNames()).toEqual([
        "Open Cabin trip — August, closes in 12 days, you're Quiet Falcon",
        "Open Sprint retro, closes in 5 days, you're Dave",
        "Open Design crit, closes today, you're Dave",
      ])
    })

    it('should lead each row name with the verb so the action is heard before the poll', () => {
      renderList([sprintRetro])

      expect(screen.getByRole('link', { name: "Open Sprint retro, closes in 5 days, you're Dave" })).toBeInTheDocument()
    })

    it('should show the poll name and a meta line for each row', () => {
      renderList([sprintRetro, cabinTrip, designCrit])

      expect(screen.getByText('Sprint retro')).toBeInTheDocument()
      expect(screen.getByText('Closes in 12 days · as Quiet Falcon')).toBeInTheDocument()
      expect(screen.getByText('Closes today · as Dave')).toBeInTheDocument()
    })

    it('should say tomorrow rather than in 1 days', () => {
      renderList([buildPoll({ expiration: CLOSES_TOMORROW })])

      expect(screen.getByText('Closes tomorrow · as Dave')).toBeInTheDocument()
    })

    it('should read expiration as epoch seconds', () => {
      // The same number taken as milliseconds lands in the year 55000 and would render a plausible
      // row rather than failing, which is the harder bug to find.
      renderList([buildPoll({ expiration: CLOSES_IN_12 })])

      expect(screen.getByText('Closes in 12 days · as Dave')).toBeInTheDocument()
    })

    it('should treat an entry already past its close as closing today rather than counting backwards', () => {
      renderList([buildPoll({ expiration: 1_753_900_000 })])

      expect(screen.getByText('Closes today · as Dave')).toBeInTheDocument()
    })

    it('should carry the user id so re-entry needs no second identity prompt', () => {
      renderList([designCrit])

      expect(screen.getByRole('link', { name: /Open Design crit/ })).toHaveAttribute(
        'href',
        '/p/green-lantern?id=user%203%2F4',
      )
    })

    it('should render a 60-character poll name in full', () => {
      renderList([buildPoll({ pollName: longName })])

      expect(screen.getByText(longName)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Remove ${longName} from your polls` })).toBeInTheDocument()
    })

    it('should give each remove control a name that identifies its own entry', () => {
      renderList([sprintRetro, cabinTrip, designCrit])

      expect(removeButton('Sprint retro')).toBeInTheDocument()
      expect(removeButton('Cabin trip — August')).toBeInTheDocument()
      expect(removeButton('Design crit')).toBeInTheDocument()
    })

    it('should count the polls on the device', () => {
      renderList([sprintRetro, cabinTrip, designCrit])

      expect(screen.getByText('3 polls on this device')).toBeInTheDocument()
    })

    it('should fall back to the real clock and the viewer zone when neither is supplied', () => {
      // No assertion on the meta line: without an injected clock its text depends on the day the
      // suite runs. This covers the defaults the page will actually use.
      render(<RecentPolls onClear={onClear} onRemove={onRemove} onRestore={onRestore} polls={[sprintRetro]} />)

      expect(screen.getByText('Sprint retro')).toBeInTheDocument()
    })

    it('should not bother counting a single poll', () => {
      renderList([sprintRetro])

      expect(screen.queryByText('1 poll on this device')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument()
    })
  })

  describe('collapsing', () => {
    it('should show only the first six of twenty-five rows', () => {
      renderList(manyPolls)

      expect(screen.getAllByRole('listitem')).toHaveLength(6)
      expect(screen.getByText('25 polls on this device')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Show all 25 polls' })).toBeInTheDocument()
    })

    it('should show every row once expanded', async () => {
      renderList(manyPolls)
      await userEvent.click(screen.getByRole('button', { name: 'Show all 25 polls' }))

      expect(screen.getAllByRole('listitem')).toHaveLength(25)
      expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument()
    })

    it('should collapse again on Show fewer', async () => {
      renderList(manyPolls)
      await userEvent.click(screen.getByRole('button', { name: 'Show all 25 polls' }))
      await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }))

      expect(screen.getAllByRole('listitem')).toHaveLength(6)
    })

    it('should report its expanded state to assistive technology', async () => {
      renderList(manyPolls)

      expect(screen.getByRole('button', { name: 'Show all 25 polls' })).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(screen.getByRole('button', { name: 'Show all 25 polls' }))
      expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('should not offer an expander for six rows', () => {
      renderList(manyPolls.slice(0, 6))

      expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument()
    })
  })

  describe('removal', () => {
    it('should remove the entry it names', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))

      expect(onRemove).toHaveBeenCalledWith('amber-harbor')
      expect(screen.queryByText('Sprint retro')).not.toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })

    it('should announce the removal in a visible notice that tells the truth about the link', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))

      expect(
        within(liveRegionContaining('Removed Sprint retro')).getByText(
          'Removed Sprint retro from your polls. The link still works if you have it.',
        ),
      ).toBeInTheDocument()
    })

    it('should offer an Undo that names what it undoes', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))

      const undo = screen.getByRole('button', { name: 'Undo removing Sprint retro' })
      expect(undo).toHaveTextContent('Undo')
    })

    it('should move focus to Undo rather than dropping it with the removed row', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Undo removing Sprint retro' })).toHaveFocus())
    })

    it('should put the entry back on Undo', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))
      await userEvent.click(screen.getByRole('button', { name: 'Undo removing Sprint retro' }))

      expect(onRestore).toHaveBeenCalledWith(sprintRetro)
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
      expect(screen.getByText('Sprint retro')).toBeInTheDocument()
    })

    it('should announce the restore', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))
      await userEvent.click(screen.getByRole('button', { name: 'Undo removing Sprint retro' }))

      expect(
        within(liveRegionContaining('is back in your polls')).getByText('Sprint retro is back in your polls.'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Undo removing/ })).not.toBeInTheDocument()
    })

    it('should follow the restored row with focus', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))
      await userEvent.click(screen.getByRole('button', { name: 'Undo removing Sprint retro' }))

      await waitFor(() =>
        expect(screen.getByRole('link', { name: "Open Sprint retro, closes in 5 days, you're Dave" })).toHaveFocus(),
      )
    })

    it('should keep Undo reachable after the last poll is removed', async () => {
      renderList([sprintRetro])
      await userEvent.click(removeButton('Sprint retro'))

      expect(screen.getByRole('heading', { name: 'No polls on this device yet.' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Undo removing Sprint retro' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()
    })

    it('should replace an earlier restore notice when a second removal happens', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))
      await userEvent.click(screen.getByRole('button', { name: 'Undo removing Sprint retro' }))
      await userEvent.click(removeButton('Cabin trip — August'))

      expect(screen.queryByText('Sprint retro is back in your polls.')).not.toBeInTheDocument()
      expect(
        screen.getByText('Removed Cabin trip — August from your polls. The link still works if you have it.'),
      ).toBeInTheDocument()
    })
  })

  describe('clear all', () => {
    const openDialog = async (): Promise<HTMLElement> => {
      await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
      return await screen.findByRole('alertdialog')
    }

    it('should ask before clearing and name the blast radius', async () => {
      renderList([sprintRetro, cabinTrip, designCrit])
      const dialog = await openDialog()

      expect(within(dialog).getByRole('heading', { name: 'Clear your polls?' })).toBeInTheDocument()
      expect(
        within(dialog).getByText(
          "This removes all 3 polls from this device. The polls themselves stay open — you'd need their links again to get back in.",
        ),
      ).toBeInTheDocument()
      expect(onClear).not.toHaveBeenCalled()
    })

    // "This removes all 1 poll" is grammatical and still reads as a miscount -- "all" wants a
    // plural, and a reader hits the numeral before the noun that would excuse it. At one entry the
    // sentence drops the count entirely.
    it('should drop the count from the confirmation for a single entry', async () => {
      renderList([sprintRetro])
      const dialog = await openDialog()

      expect(within(dialog).getByText(/This removes it from this device\./)).toBeInTheDocument()
      expect(within(dialog).queryByText(/all 1 poll/)).not.toBeInTheDocument()
    })

    it('should keep the polls on Cancel', async () => {
      renderList([sprintRetro, cabinTrip])
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      expect(onClear).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('should keep the polls on Escape', async () => {
      renderList([sprintRetro, cabinTrip])
      await openDialog()
      await userEvent.keyboard('{Escape}')

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(onClear).not.toHaveBeenCalled()
    })

    it('should empty the list once confirmed', async () => {
      renderList([sprintRetro, cabinTrip])
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Clear all' }))

      expect(onClear).toHaveBeenCalled()
      expect(await screen.findByRole('heading', { name: 'No polls on this device yet.' })).toBeInTheDocument()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('should send focus to the heading rather than to the document after clearing', async () => {
      renderList([sprintRetro, cabinTrip])
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Clear all' }))

      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Your polls' })).toHaveFocus())
    })

    it('should drop a pending Undo when everything is cleared', async () => {
      renderList([sprintRetro, cabinTrip])
      await userEvent.click(removeButton('Sprint retro'))
      const dialog = await openDialog()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Clear all' }))

      await waitFor(() => expect(screen.queryByRole('button', { name: /Undo removing/ })).not.toBeInTheDocument())
    })
  })

  describe('prune notice', () => {
    const pruneRegion = (): HTMLElement =>
      screen
        .getAllByRole('status')
        .find((region) => region.textContent?.includes('no longer in your polls')) as HTMLElement

    it('should name the one poll that closed and when it closed', () => {
      renderList([sprintRetro], 1, [buildPoll({ expiration: CLOSED_AUG_8, pollName: 'Board meeting — Q3' })])

      expect(
        within(pruneRegion()).getByText("Board meeting — Q3 closed on Aug 8, so it's no longer in your polls."),
      ).toBeInTheDocument()
    })

    it('should still speak in the singular when the store gives a count but no name', () => {
      renderList([sprintRetro], 1)

      expect(within(pruneRegion()).getByText("A poll closed, so it's no longer in your polls.")).toBeInTheDocument()
    })

    it('should agree in number when several polls closed', () => {
      renderList([sprintRetro], 3, [
        buildPoll({ pollName: 'Board meeting — Q3' }),
        buildPoll({ pollName: 'Cabin trip — August' }),
        buildPoll({ pollName: 'Design crit' }),
      ])

      expect(within(pruneRegion()).getByText("3 polls closed, so they're no longer in your polls.")).toBeInTheDocument()
      expect(
        within(pruneRegion()).getByText('Board meeting — Q3, Cabin trip — August, and Design crit'),
      ).toBeInTheDocument()
    })

    it('should join exactly two names without a serial comma', () => {
      renderList([sprintRetro], 2, [
        buildPoll({ pollName: 'Board meeting — Q3' }),
        buildPoll({ pollName: 'Design crit' }),
      ])

      expect(within(pruneRegion()).getByText('Board meeting — Q3 and Design crit')).toBeInTheDocument()
    })

    it('should omit the names line when the store supplied no names', () => {
      renderList([sprintRetro], 3)

      expect(within(pruneRegion()).getByText("3 polls closed, so they're no longer in your polls.")).toBeInTheDocument()
      expect(pruneRegion().textContent).toBe("3 polls closed, so they're no longer in your polls.Got it")
    })

    it('should stay silent when nothing was pruned', () => {
      renderList([sprintRetro])

      expect(screen.queryByText(/no longer in your polls/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Got it' })).not.toBeInTheDocument()
    })

    it('should dismiss and hand focus to the heading rather than to the document', async () => {
      renderList([sprintRetro], 2, [buildPoll({ pollName: 'A' }), buildPoll({ pollName: 'B' })])
      await userEvent.click(screen.getByRole('button', { name: 'Got it' }))

      expect(screen.queryByText(/no longer in your polls/)).not.toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Your polls' })).toHaveFocus())
    })
  })

  // WebKit drops the implicit list/listitem roles the moment `list-style: none` computes, and it
  // computes twice here (the `list-none` class and Tailwind v4's preflight). jsdom implements
  // neither quirk, so a test relying on the implicit roles passes while Safari + VoiceOver -- the
  // installed-app case -- hears nothing. Assert the explicit attributes instead.
  describe('list semantics under WebKit', () => {
    it('states the list role explicitly rather than relying on the implicit one', () => {
      renderList([sprintRetro, cabinTrip])

      expect(screen.getByRole('list')).toHaveAttribute('role', 'list')
      expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('role', 'listitem')
    })
  })
})
