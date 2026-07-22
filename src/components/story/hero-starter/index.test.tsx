import React from 'react'

import { HeroStarter } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('HeroStarter', () => {
  function setup(over: Partial<React.ComponentProps<typeof HeroStarter>> = {}): {
    onNameChange: jest.Mock
    onStart: jest.Mock
  } {
    const props = { name: '', onNameChange: jest.fn(), onStart: jest.fn(), ...over }
    render(<HeroStarter {...props} />)
    return { onNameChange: props.onNameChange as jest.Mock, onStart: props.onStart as jest.Mock }
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
})
