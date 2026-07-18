import React from 'react'

import PrivacyLink from '@components/privacy-link'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'
import Index from '@pages/index'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@components/story/sky-background')
jest.mock('@components/story/back-to-form-cta')
jest.mock('@components/story/scenes')
jest.mock('@components/story/create-scene')
jest.mock('@components/story/closing-footer')
jest.mock('@components/privacy-link')

describe('Index page', () => {
  beforeAll(() => {
    jest.mocked(SkyBackground).mockReturnValue(<></>)
    jest.mocked(BackToFormCta).mockReturnValue(<></>)
    jest.mocked(HeroScene).mockReturnValue(<></>)
    jest.mocked(IdentityScene).mockReturnValue(<></>)
    jest.mocked(PaintingScene).mockReturnValue(<></>)
    jest.mocked(ResultsScene).mockReturnValue(<></>)
    jest.mocked(ShareScene).mockReturnValue(<></>)
    jest.mocked(CreateScene).mockReturnValue(<></>)
    jest.mocked(ClosingFooter).mockReturnValue(<></>)
    jest.mocked(PrivacyLink).mockReturnValue(<></>)
  })

  it('renders the sky background and the back-to-form CTA', () => {
    render(<Index />)
    expect(SkyBackground).toHaveBeenCalledTimes(1)
    expect(BackToFormCta).toHaveBeenCalledTimes(1)
  })

  it('renders all six scenes in order, with the real CreateScene as Scene 2', () => {
    render(<Index />)
    expect(HeroScene).toHaveBeenCalledTimes(1)
    expect(CreateScene).toHaveBeenCalledTimes(1)
    expect(IdentityScene).toHaveBeenCalledTimes(1)
    expect(PaintingScene).toHaveBeenCalledTimes(1)
    expect(ResultsScene).toHaveBeenCalledTimes(1)
    expect(ShareScene).toHaveBeenCalledTimes(1)
  })

  it('renders the closing footer and privacy link', () => {
    render(<Index />)
    expect(ClosingFooter).toHaveBeenCalledTimes(1)
    expect(PrivacyLink).toHaveBeenCalledTimes(1)
  })
})
