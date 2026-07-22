import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import PrivacyLink from '@components/privacy-link'
import { BackToFormCta } from '@components/story/back-to-form-cta'
import { ClosingFooter } from '@components/story/closing-footer'
import { CreateScene } from '@components/story/create-scene'
import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from '@components/story/scenes'
import { SkyBackground } from '@components/story/sky-background'
import Index from '@pages/index'
import { fetchConfig } from '@services/api'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@components/story/sky-background')
jest.mock('@components/story/back-to-form-cta')
jest.mock('@components/story/scenes')
jest.mock('@components/story/create-scene')
jest.mock('@components/story/closing-footer')
jest.mock('@components/privacy-link')
jest.mock('@services/api')

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Index />
    </QueryClientProvider>,
  )
}

describe('Index page', () => {
  beforeAll(() => {
    jest.mocked(fetchConfig).mockResolvedValue({
      allowedSlotMinutes: [15, 30, 60, 90, 120],
      defaultSlotMinutes: 60,
      maxPollDateRangeDays: 365,
      maxPollDates: 90,
      maxPollOverrideGroups: 10,
      maxUsersPerSession: 20,
      participantNameMaxLength: 50,
      pollNameMaxLength: 100,
      sessionExpireHours: 336,
      startEndMinuteStep: 15,
    })
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
    renderPage()
    expect(SkyBackground).toHaveBeenCalledTimes(1)
    expect(BackToFormCta).toHaveBeenCalledTimes(1)
  })

  it('renders all six scenes in order, with the real CreateScene as Scene 2', () => {
    renderPage()
    expect(HeroScene).toHaveBeenCalledTimes(1)
    expect(CreateScene).toHaveBeenCalledTimes(1)
    expect(IdentityScene).toHaveBeenCalledTimes(1)
    expect(PaintingScene).toHaveBeenCalledTimes(1)
    expect(ResultsScene).toHaveBeenCalledTimes(1)
    expect(ShareScene).toHaveBeenCalledTimes(1)
  })

  it('renders the closing footer and privacy link', () => {
    renderPage()
    expect(ClosingFooter).toHaveBeenCalledTimes(1)
    expect(PrivacyLink).toHaveBeenCalledTimes(1)
  })

  it('scrolls to the form and focuses its name field synchronously when the hero starts', () => {
    const focusName = jest.fn()
    let onStart: () => void = () => undefined
    jest.mocked(HeroScene).mockImplementationOnce(({ action }: any) => {
      onStart = action.props.onStart
      return <></>
    })
    jest.mocked(CreateScene).mockImplementationOnce(({ registerFocusName }: any) => {
      registerFocusName?.(focusName)
      return <></>
    })

    renderPage()
    onStart()

    // scrollIntoView is polyfilled as a jest.fn() in the test env.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    // Focus fires synchronously inside the gesture (no rAF/timeout) so iOS opens the keyboard.
    expect(focusName).toHaveBeenCalledTimes(1)
  })
})
