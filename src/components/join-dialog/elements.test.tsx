import React from 'react'

import { JOIN_COPY, JoinError } from './elements'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'

describe('JoinError', () => {
  // `live` is the region's own property, fixed for its lifetime, and deliberately NOT derived from
  // `variant`. These first two tests are the pair that pins that: the same variant announces
  // differently depending only on the slot it was rendered into.
  it('announces politely when the slot is a polite one', () => {
    render(<JoinError error={{ lines: [JOIN_COPY.pasteNotice], variant: 'notice' }} id="e" live="polite" />)
    expect(screen.getByRole('status')).toHaveTextContent("That link goes to a poll — here's the code to join it.")
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces assertively by default, whatever the variant', () => {
    render(<JoinError error={{ lines: [JOIN_COPY.pasteNotice], variant: 'notice' }} id="e" />)
    expect(screen.getByRole('alert')).toHaveTextContent(JOIN_COPY.pasteNotice)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('still announces a failure as an alert', () => {
    render(<JoinError error={{ lines: [JOIN_COPY.offline], variant: 'offline' }} id="e" />)
    expect(screen.getByRole('alert')).toHaveTextContent(JOIN_COPY.offline)
  })

  it('renders both lines of a refusal, not only the first', () => {
    render(<JoinError error={{ lines: [JOIN_COPY.refusal, JOIN_COPY.refusalNote], variant: 'alert' }} id="e" />)
    const alert = within(screen.getByRole('alert'))
    expect(alert.getByText(JOIN_COPY.refusal)).toBeInTheDocument()
    expect(alert.getByText(JOIN_COPY.refusalNote)).toBeInTheDocument()
  })

  // Both slots must be able to exist empty, because a live region that enters the DOM already
  // populated is announced by nothing at all. The polite case is the one that was unreachable while
  // the role was derived from the content.
  it('mounts an assertive region empty so a later commit is announced', () => {
    render(<JoinError id="e" />)
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })

  it('mounts a polite region empty so a later commit is announced', () => {
    render(<JoinError id="e" live="polite" />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  // The glyph is decoration beside words that already carry the state. Asserted as the property —
  // nothing in the region reaches the accessibility tree as an image — rather than by reaching for
  // the `svg` element, which would couple the test to lucide's markup.
  it('keeps the glyph out of the announcement', () => {
    render(<JoinError error={{ lines: [JOIN_COPY.pasteNotice], variant: 'notice' }} id="e" live="polite" />)
    const region = screen.getByRole('status')
    expect(within(region).queryByRole('img')).not.toBeInTheDocument()
    expect(region.textContent).toBe(JOIN_COPY.pasteNotice)
  })
})
