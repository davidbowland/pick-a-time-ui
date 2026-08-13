import React from 'react'

import { HeroStarter } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('HeroStarter', () => {
  // `isPaired`/`noteId` are a discriminated union on the component, so the two arms are rendered
  // through separate calls rather than one spread. A `Partial<ComponentProps<…>>` would collapse the
  // union back into two independent optionals — which is exactly the looseness the union exists to
  // remove, so widening it here to keep one tidy spread would defeat the type at its only call site.
  const PAIR_NOTE_ID = 'pair-note'

  function setup(
    over: Partial<Pick<React.ComponentProps<typeof HeroStarter>, 'maxLength' | 'name'>> & {
      /** Render paired, as `DoorPair` does. The union then requires a `noteId`, so one is supplied. */
      paired?: boolean
      /** Whether the stand-in parent actually renders the note element the id points at. */
      parentRendersNote?: boolean
    } = {},
  ): { onNameChange: jest.Mock; onStart: jest.Mock } {
    const { paired, parentRendersNote, ...rest } = over
    const props = { name: '', onNameChange: jest.fn(), onStart: jest.fn(), ...rest }
    render(
      <>
        {paired ? <HeroStarter {...props} isPaired noteId={PAIR_NOTE_ID} /> : <HeroStarter {...props} />}
        {/* Stands in for DoorPair: when the pair owns the note, the element the input points at
            lives outside HeroStarter, so the description only resolves if both are in one render.
            Rendering it is a separate switch from pairing, so one test can check that HeroStarter
            emits no note of its own without the stand-in supplying the very text it looks for. */}
        {paired && parentRendersNote ? (
          <p id={PAIR_NOTE_ID}>Free, no account — set the dates on the next step.</p>
        ) : null}
      </>,
    )
    return { onNameChange: props.onNameChange, onStart: props.onStart }
  }

  it('renders the name typed in from props', () => {
    setup({ name: 'Book club' })
    expect(screen.getByLabelText(/name your poll/i)).toHaveValue('Book club')
  })

  it('applies the maxLength constraint to the input when provided', () => {
    setup({ maxLength: 80 })
    expect(screen.getByLabelText(/name your poll/i)).toHaveAttribute('maxLength', '80')
  })

  it('reports name edits', async () => {
    const { onNameChange } = setup()
    await userEvent.type(screen.getByLabelText(/name your poll/i), 'A')
    expect(onNameChange).toHaveBeenCalledWith('A')
  })

  it('fires onStart when the Start button is clicked', async () => {
    const { onStart } = setup({ name: 'Book club' })
    await userEvent.click(screen.getByRole('button', { name: /start/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('fires onStart on Enter even when empty', async () => {
    const { onStart } = setup()
    await userEvent.type(screen.getByLabelText(/name your poll/i), '{enter}')
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('describes the field with its own note, so the cost is announced with the control', () => {
    setup()
    expect(screen.getByLabelText(/name your poll/i)).toHaveAccessibleDescription(
      'Free, no account — set the dates on the next step.',
    )
  })

  it('describes the field with the note the pair owns', () => {
    setup({ paired: true, parentRendersNote: true })
    expect(screen.getByLabelText(/name your poll/i)).toHaveAccessibleDescription(
      'Free, no account — set the dates on the next step.',
    )
  })

  it('renders no note of its own when the pair owns it', () => {
    setup({ paired: true })
    expect(screen.queryByText(/free, no account/i)).not.toBeInTheDocument()
  })

  it('still names the field when paired', () => {
    setup({ paired: true })
    expect(screen.getByLabelText(/name your poll/i)).toBeInTheDocument()
  })
})
