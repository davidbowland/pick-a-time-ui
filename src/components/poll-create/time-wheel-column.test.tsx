import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { TimeWheelColumn } from './time-wheel-column'

const OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
]

describe('TimeWheelColumn', () => {
  it('marks the current value as the selected option', () => {
    render(<TimeWheelColumn aria-label="Hour" onChange={jest.fn()} options={OPTIONS} value="2" />)

    expect(screen.getByRole('option', { name: '2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '1' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange when an option is clicked', async () => {
    const onChange = jest.fn()
    render(<TimeWheelColumn aria-label="Hour" onChange={onChange} options={OPTIONS} value="1" />)

    await userEvent.click(screen.getByRole('option', { name: '3' }))

    expect(onChange).toHaveBeenCalledWith('3')
  })

  it('moves to the next option on ArrowDown', async () => {
    const onChange = jest.fn()
    render(<TimeWheelColumn aria-label="Hour" onChange={onChange} options={OPTIONS} value="1" />)

    screen.getByRole('listbox').focus()
    await userEvent.keyboard('{ArrowDown}')

    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('moves to the previous option on ArrowUp', async () => {
    const onChange = jest.fn()
    render(<TimeWheelColumn aria-label="Hour" onChange={onChange} options={OPTIONS} value="2" />)

    screen.getByRole('listbox').focus()
    await userEvent.keyboard('{ArrowUp}')

    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('does not call onChange when ArrowUp is pressed at the first option', async () => {
    const onChange = jest.fn()
    render(<TimeWheelColumn aria-label="Hour" onChange={onChange} options={OPTIONS} value="1" />)

    screen.getByRole('listbox').focus()
    await userEvent.keyboard('{ArrowUp}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('jumps to the last option on End', async () => {
    const onChange = jest.fn()
    render(<TimeWheelColumn aria-label="Hour" onChange={onChange} options={OPTIONS} value="1" />)

    screen.getByRole('listbox').focus()
    await userEvent.keyboard('{End}')

    expect(onChange).toHaveBeenCalledWith('3')
  })

  it('jumps to the first option on Home', async () => {
    const onChange = jest.fn()
    render(<TimeWheelColumn aria-label="Hour" onChange={onChange} options={OPTIONS} value="3" />)

    screen.getByRole('listbox').focus()
    await userEvent.keyboard('{Home}')

    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('exposes the selected option via aria-activedescendant', () => {
    render(<TimeWheelColumn aria-label="Hour" onChange={jest.fn()} options={OPTIONS} value="2" />)

    const listbox = screen.getByRole('listbox')
    const selectedOption = screen.getByRole('option', { name: '2' })
    expect(listbox).toHaveAttribute('aria-activedescendant', selectedOption.id)
  })

  it('uses the provided aria-label as its accessible name', () => {
    render(<TimeWheelColumn aria-label="Minute" onChange={jest.fn()} options={OPTIONS} value="1" />)

    expect(screen.getByRole('listbox', { name: 'Minute' })).toBeInTheDocument()
  })

  it('does not throw and does not call onChange when options is empty', async () => {
    const onChange = jest.fn()
    render(<TimeWheelColumn aria-label="Hour" onChange={onChange} options={[]} value="" />)

    screen.getByRole('listbox').focus()
    await userEvent.keyboard('{ArrowDown}')

    expect(onChange).not.toHaveBeenCalled()
  })
})
