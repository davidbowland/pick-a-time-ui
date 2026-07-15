import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import { CreateCard } from './elements'

describe('CreateCard', () => {
  it('pins its box-shadow to the settled, no-glow value under prefers-reduced-motion via a motion-reduce: utility class', () => {
    // The reduced-motion behavior is implemented as pure CSS (a `motion-reduce:` Tailwind
    // variant with the important modifier), not JS. jsdom doesn't evaluate real CSS cascade
    // or media queries, so we can't assert the resulting computed style here — instead we
    // assert the static class name itself is present, which is what drives the behavior.
    const { container } = render(<CreateCard>child content</CreateCard>)

    expect(container.firstChild).toHaveClass('motion-reduce:[box-shadow:0_0_0_0_rgba(63,174,138,0)]!')
  })
})
