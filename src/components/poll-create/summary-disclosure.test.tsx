import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { SummaryDisclosure } from './summary-disclosure'

describe('SummaryDisclosure', () => {
  it('shows the label and current value, with an "Edit" button, aria-expanded=false and no aria-controls when collapsed', () => {
    render(
      <SummaryDisclosure expanded={false} label="Which days" onToggle={jest.fn()} panelId="panel-1" value="Mon–Fri" />,
    )

    expect(screen.getByText('Which days')).toBeInTheDocument()
    expect(screen.getByText('Mon–Fri')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /edit which days/i })
    expect(button).toHaveTextContent('Edit')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('aria-controls')
  })

  it('shows "Done", aria-expanded=true, and aria-controls pointing at the panel when expanded', () => {
    render(<SummaryDisclosure expanded label="Which days" onToggle={jest.fn()} panelId="panel-1" value="Mon–Fri" />)

    const button = screen.getByRole('button', { name: /done editing which days/i })
    expect(button).toHaveTextContent('Done')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', 'panel-1')
  })

  it('calls onToggle when the edit/done button is clicked', async () => {
    const onToggle = jest.fn()
    render(
      <SummaryDisclosure expanded={false} label="Which days" onToggle={onToggle} panelId="panel-1" value="Mon–Fri" />,
    )

    await userEvent.click(screen.getByRole('button', { name: /edit which days/i }))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
