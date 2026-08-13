import React from 'react'

import { DoorPair } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('DoorPair', () => {
  function setup(
    over: Partial<Pick<React.ComponentProps<typeof DoorPair>, 'isJoinOpen' | 'maxLength' | 'name'>> = {},
  ): { onJoinOpenChange: jest.Mock; onNameChange: jest.Mock; onStart: jest.Mock } {
    const props = {
      isJoinOpen: false,
      name: '',
      onJoinOpenChange: jest.fn(),
      onNameChange: jest.fn(),
      onStart: jest.fn(),
      ...over,
    }
    render(<DoorPair {...props} />)
    return { onJoinOpenChange: props.onJoinOpenChange, onNameChange: props.onNameChange, onStart: props.onStart }
  }

  const starter = (): HTMLElement => screen.getByLabelText(/name your poll/i)
  const door = (): HTMLElement => screen.getByRole('button', { name: 'Join a poll' })

  it('offers both ways in', () => {
    setup()
    expect(starter()).toBeInTheDocument()
    expect(door()).toBeInTheDocument()
  })

  it('describes the join door with the question that finds its audience', () => {
    setup()
    expect(door()).toHaveAccessibleDescription('Have a poll code?')
  })

  it('describes the starter with the cost note', () => {
    setup()
    expect(starter()).toHaveAccessibleDescription('Free, no account — set the dates on the next step.')
  })

  // Control-then-caption in both groups, at every width — nothing reorders. That is what keeps tab
  // order and the screen-reader reading order matching what is on screen.
  it('keeps the door ahead of its own caption in reading order', () => {
    setup()
    const caption = screen.getByText('Have a poll code?')
    expect(door().compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the starter ahead of its own caption in reading order', () => {
    setup()
    const caption = screen.getByText('Free, no account — set the dates on the next step.')
    expect(starter().compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('puts the starter and Start ahead of the door in focus order', () => {
    setup()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Start', 'Join a poll'])
  })

  it('forwards Start to its caller', async () => {
    const { onStart } = setup()
    await userEvent.click(screen.getByRole('button', { name: /start/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('forwards name edits to its caller', async () => {
    const { onNameChange } = setup()
    await userEvent.type(starter(), 'A')
    expect(onNameChange).toHaveBeenCalledWith('A')
  })

  it('shows the name it was given', () => {
    setup({ name: 'Book club' })
    expect(starter()).toHaveValue('Book club')
  })

  it('passes the length cap down to the starter', () => {
    setup({ maxLength: 80 })
    expect(starter()).toHaveAttribute('maxLength', '80')
  })

  it('asks to open the join door when it is pressed', async () => {
    const { onJoinOpenChange } = setup()
    await userEvent.click(door())
    expect(onJoinOpenChange).toHaveBeenCalledWith(true)
  })

  it('reports the door collapsed until its caller opens it', () => {
    setup()
    expect(door()).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders no join panel while the door is closed', () => {
    setup()
    expect(screen.queryByLabelText('Poll code or link')).not.toBeInTheDocument()
  })
})
