import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { ChecklistSection } from './checklist-section'

describe('ChecklistSection', () => {
  it('shows the step number and renders children when open and not yet done', () => {
    render(
      <ChecklistSection isDone={false} isOpen stepNumber={1} title="Name">
        <p>child content</p>
      </ChecklistSection>,
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('shows a locked placeholder and hides children when neither open nor done', () => {
    render(
      <ChecklistSection isDone={false} isOpen={false} stepNumber={2} title="Days & times">
        <p>child content</p>
      </ChecklistSection>,
    )

    expect(screen.getByText(/unlocks once you finish the step above/i)).toBeInTheDocument()
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })

  it('shows a checkmark, the summary, and a working Edit control when done and collapsed', async () => {
    const onEdit = jest.fn()
    render(
      <ChecklistSection isDone isOpen={false} onEdit={onEdit} stepNumber={1} summary="Lunch with friends" title="Name">
        <p>child content</p>
      </ChecklistSection>,
    )

    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText('Lunch with friends')).toBeInTheDocument()
    expect(screen.queryByText('child content')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /edit name/i }))
    expect(onEdit).toHaveBeenCalled()
  })
})
