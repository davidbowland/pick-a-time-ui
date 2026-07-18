import React from 'react'

import { VoterNameField } from './voter-name-field'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('VoterNameField', () => {
  it('renders the given label and associates it with the input', () => {
    render(<VoterNameField label="Your name" onChange={jest.fn()} value="" />)

    expect(screen.getByLabelText('Your name')).toBeInTheDocument()
  })

  it('shows the current value and calls onChange with the new value when edited', async () => {
    const onChange = jest.fn()
    render(<VoterNameField label="Name" onChange={onChange} value="" />)

    await userEvent.type(screen.getByLabelText('Name'), 'A')

    expect(onChange).toHaveBeenCalledWith('A')
  })

  it('shows the helper copy explaining the field is optional', () => {
    render(<VoterNameField label="Name" onChange={jest.fn()} value="" />)

    expect(screen.getByText('Optional — skip it and we’ll give you a name like ‘Clever Fox.’')).toBeInTheDocument()
  })

  it('applies the maxLength constraint to the input when provided', () => {
    render(<VoterNameField label="Name" maxLength={50} onChange={jest.fn()} value="" />)

    expect(screen.getByLabelText('Name')).toHaveAttribute('maxLength', '50')
  })
})
