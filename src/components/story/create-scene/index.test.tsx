import React from 'react'

import { CreateScene } from './index'
import PollCreate from '@components/poll-create'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@components/poll-create')

describe('CreateScene', () => {
  beforeAll(() => {
    jest.mocked(PollCreate).mockReturnValue(<div data-testid="real-poll-create" />)
  })

  it('renders the real PollCreate form, not a mockup', () => {
    render(<CreateScene />)
    expect(screen.getByTestId('real-poll-create')).toBeInTheDocument()
  })

  it('does not wrap the form in the decorative phone-mockup chrome', () => {
    const { container } = render(<CreateScene />)
    // PhoneMock's signature is a div with aria-hidden="true" wrapping everything — the real
    // form must not live inside one, or it inherits the "this is a picture" visual grammar.
    expect(container.querySelector('[aria-hidden="true"] [data-testid="real-poll-create"]')).not.toBeInTheDocument()
  })

  it('heads the scene at h2 by default', () => {
    render(<CreateScene />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Pick your dates.')
  })

  it('takes the level down to h3 when the story hangs off another surface heading', () => {
    // The returning landing composition collapses the whole story under an h2 control. A hardcoded
    // h2 here left the document skipping a level, which is D-30 and AC-048.
    render(<CreateScene headingLevel="h3" />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Pick your dates.')
  })

  it('can head the scene at h1 when it is the page subject', () => {
    render(<CreateScene headingLevel="h1" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pick your dates.')
  })

  it('forwards the controlled name props to PollCreate', () => {
    const onNameChange = jest.fn()
    const registerFocusName = jest.fn()
    render(<CreateScene name="Book club" onNameChange={onNameChange} registerFocusName={registerFocusName} />)
    expect(jest.mocked(PollCreate).mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'Book club', onNameChange, registerFocusName }),
    )
  })
})
