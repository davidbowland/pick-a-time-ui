import type { AppProps } from 'next/app'
import { createElement, type ReactNode } from 'react'

import { installPromptStore } from '@hooks/useInstallPrompt'
import { useServiceWorker } from '@hooks/useServiceWorker'
import App from '@pages/_app'
import { render } from '@testing-library/react'
import { runRecentPollsMigration } from '@utils/recent-polls-migration'

jest.mock('@hooks/useInstallPrompt', () => ({ installPromptStore: { start: jest.fn() } }))
jest.mock('@hooks/useServiceWorker')
jest.mock('@utils/recent-polls-migration')
// The app shell's own auth provider resolves a session asynchronously. It has nothing to do with the
// PWA wiring and would only add non-determinism to it.
jest.mock('@components/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

describe('_app.tsx PWA wiring', () => {
  // The three call sites plus the page render, in the order they actually happened. `_app` is in
  // coveragePathIgnorePatterns, so what is worth asserting here is that these calls exist at all and
  // that each one lands in the phase its acceptance criterion needs.
  const renderApp = (calls: string[]) => {
    jest.mocked(installPromptStore.start).mockImplementationOnce(() => {
      calls.push('installPromptStore.start')
    })
    jest.mocked(runRecentPollsMigration).mockImplementationOnce(() => {
      calls.push('runRecentPollsMigration')
      return true
    })
    jest.mocked(useServiceWorker).mockImplementationOnce(() => {
      calls.push('useServiceWorker')
    })
    const Page = () => {
      calls.push('page render')
      return null
    }
    return render(createElement(App, { Component: Page, pageProps: {}, router: {} as AppProps['router'] } as AppProps))
  }

  beforeAll(() => {
    jest.mocked(runRecentPollsMigration).mockReturnValue(true)
  })

  it('registers the service worker from the app shell', () => {
    renderApp([])

    expect(jest.mocked(useServiceWorker)).toHaveBeenCalledTimes(1)
    // No arguments: the hook's own defaults decide production versus `next dev` (AC-006) and own the
    // page reload. Passing anything from here would move that decision out of the covered module.
    expect(jest.mocked(useServiceWorker)).toHaveBeenCalledWith()
  })

  it('starts the install prompt store from the app shell', () => {
    renderApp([])

    expect(jest.mocked(installPromptStore.start)).toHaveBeenCalledTimes(1)
    // No target argument, so the store listens on `window` (AC-035).
    expect(jest.mocked(installPromptStore.start)).toHaveBeenCalledWith()
  })

  it('starts the install prompt store during render, before the page below it renders', () => {
    const calls: string[] = []

    renderApp(calls)

    // `beforeinstallprompt` fires once and early. Capturing from an effect, or from the component
    // that renders the offer, is too late -- so this call has to precede the page's own render.
    expect(calls.indexOf('installPromptStore.start')).toBeLessThan(calls.indexOf('page render'))
  })

  it('runs the legacy sweep once the tree has mounted', () => {
    const calls: string[] = []

    renderApp(calls)

    expect(jest.mocked(runRecentPollsMigration)).toHaveBeenCalledTimes(1)
    // No arguments: the util defaults to the device's own localStorage.
    expect(jest.mocked(runRecentPollsMigration)).toHaveBeenCalledWith()
    // In an effect, not in render: the sweep reads localStorage, which the static export's
    // prerender does not have.
    expect(calls.indexOf('runRecentPollsMigration')).toBeGreaterThan(calls.indexOf('page render'))
  })

  it('does not sweep again when the shell re-renders', () => {
    const { rerender } = renderApp([])

    rerender(
      createElement(App, {
        Component: () => null,
        pageProps: { changed: true },
        router: {} as AppProps['router'],
      } as AppProps),
    )

    // AC-029 asks for one sweep per load, not one per render.
    expect(jest.mocked(runRecentPollsMigration)).toHaveBeenCalledTimes(1)
  })
})
