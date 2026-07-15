// src/components/story/phone-mock/index.test.tsx
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { PhoneMock } from './index'

describe('PhoneMock', () => {
  it('is hidden from assistive tech — it is a decorative illustration only', () => {
    render(
      <PhoneMock>
        <p>Fake poll summary</p>
      </PhoneMock>,
    )
    expect(screen.getByText('Fake poll summary').closest('[aria-hidden]')).toBeInTheDocument()
  })

  it('is inert — nothing inside can receive keyboard focus, not just hidden from assistive tech', () => {
    // aria-hidden alone does NOT remove an element from the tab order — a real focusable
    // element (e.g. a PillButton dropped into a mock scene for visual fidelity) would become
    // a keyboard-reachable tab stop that's invisible to assistive tech, a WCAG 2.4.3/4.1.2
    // focus-order defect. `inert` is what actually removes the subtree from both the tab
    // order and assistive tech, so this wrapper carries both attributes, not aria-hidden alone.
    const { container } = render(
      <PhoneMock>
        <button type="button">Looks like a button</button>
      </PhoneMock>,
    )
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect((container.firstChild as HTMLElement).inert).toBe(true)
  })
})
