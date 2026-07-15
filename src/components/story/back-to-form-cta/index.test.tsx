import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { createRef } from 'react'

import { BackToFormCta } from './index'
import { useIsIntersecting } from '@hooks/useIsIntersecting'

jest.mock('@hooks/useIsIntersecting')

describe('BackToFormCta', () => {
  const formRef = createRef<HTMLDivElement>()
  const footerRef = createRef<HTMLDivElement>()

  it('is hidden while the form section is in view', () => {
    jest.mocked(useIsIntersecting).mockImplementation((ref) => ref === formRef)
    render(<BackToFormCta footerRef={footerRef} formRef={formRef} onJump={jest.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is hidden while the closing footer is in view', () => {
    jest.mocked(useIsIntersecting).mockImplementation((ref) => ref === footerRef)
    render(<BackToFormCta footerRef={footerRef} formRef={formRef} onJump={jest.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is visible when neither the form nor the footer is in view', () => {
    jest.mocked(useIsIntersecting).mockImplementation(() => false)
    render(<BackToFormCta footerRef={footerRef} formRef={formRef} onJump={jest.fn()} />)
    expect(screen.getByRole('button', { name: /start a poll/i })).toBeInTheDocument()
  })

  it('calls onJump when clicked', async () => {
    jest.mocked(useIsIntersecting).mockImplementation(() => false)
    const onJump = jest.fn()
    render(<BackToFormCta footerRef={footerRef} formRef={formRef} onJump={onJump} />)
    await userEvent.click(screen.getByRole('button', { name: /start a poll/i }))
    expect(onJump).toHaveBeenCalledTimes(1)
  })
})
