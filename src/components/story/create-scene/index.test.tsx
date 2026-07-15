import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { CreateScene } from './index'
import PollCreate from '@components/poll-create'

jest.mock('@components/poll-create')

describe('CreateScene', () => {
  beforeAll(() => {
    jest.mocked(PollCreate).mockReturnValue(<div data-testid="real-poll-create" />)
  })

  it('renders the real PollCreate form, not a mockup', () => {
    render(<CreateScene />)
    expect(screen.getByTestId('real-poll-create')).toBeInTheDocument()
  })

  it('names the interaction explicitly in the eyebrow copy, not just a timestamp', () => {
    render(<CreateScene />)
    expect(screen.getByText(/this one's live|try it now|this one's real/i)).toBeInTheDocument()
  })

  it('does not wrap the form in the decorative phone-mockup chrome', () => {
    const { container } = render(<CreateScene />)
    // PhoneMock's signature is a div with aria-hidden="true" wrapping everything — the real
    // form must not live inside one, or it inherits the "this is a picture" visual grammar.
    expect(container.querySelector('[aria-hidden="true"] [data-testid="real-poll-create"]')).not.toBeInTheDocument()
  })
})
