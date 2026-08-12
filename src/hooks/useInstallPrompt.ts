import { useCallback, useEffect, useState } from 'react'

import { defaultStorage } from './useRecentPolls'
import {
  CapturedPrompt,
  InstallCapability,
  InstallEnv,
  readInstallEnv,
  resolveInstallCapability,
} from '@utils/install-capability'

/** Disclosed in the privacy policy. The only thing this hook writes to the device. */
export const INSTALL_DISMISSED_KEY = 'pat_install_dismissed'

/** Chromium's `beforeinstallprompt`, which no lib.dom typing describes. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallPromptStore {
  getState: () => CapturedPrompt
  prompt: () => Promise<boolean>
  start: (target?: EventTarget) => void
  subscribe: (listener: () => void) => () => void
}

/**
 * Holds the one captured `beforeinstallprompt` for the whole app.
 *
 * The event fires ONCE, EARLY, and cannot be replayed or re-requested. A component that mounts
 * after it fires — which is every component below the app shell — will never see it, so the
 * capture cannot live in the component that renders the offer. `_app` starts this store at first
 * render and any later consumer subscribes to what it already holds.
 *
 * A factory rather than a bare module singleton: the captured event is genuinely mutable state,
 * and a factory keeps it injectable, so tests build a fresh store instead of unpicking module
 * state left behind by the previous test.
 */
export const createInstallPromptStore = (): InstallPromptStore => {
  let captured: BeforeInstallPromptEvent | undefined
  let isInstalled = false
  let isSpent = false
  let isStarted = false
  const listeners = new Set<() => void>()

  const notify = (): void => listeners.forEach((listener) => listener())

  const capture = (event: Event): void => {
    // Without this the browser shows its own mini-infobar and consumes the event, and the app
    // never gets to choose where the offer appears.
    event.preventDefault()
    captured = event as BeforeInstallPromptEvent
    // A re-fire after a reload is a fresh, usable event, so it clears the spent flag with it — and
    // the installed flag too. The browser only offers this event when the app is installable, so
    // receiving one is evidence it is NOT currently installed: the person uninstalled it, or is on
    // a different device. Clearing only `isSpent` would leave a stale `isInstalled` suppressing the
    // offer forever on a browser that is actively asking to show it.
    isInstalled = false
    isSpent = false
    notify()
  }

  // The only signal a successful install produces in the tab that started it. Chromium leaves that
  // tab on `display-mode: browser`, so without this the resolver still reports `spent` afterwards
  // and the offer re-appears telling someone who just installed to install again. AC-041's
  // announcement hangs off the same event.
  const markInstalled = (): void => {
    isInstalled = true
    captured = undefined
    notify()
  }

  const start = (target: EventTarget | undefined = typeof window === 'undefined' ? undefined : window): void => {
    // Idempotent, so mounting a second consumer does not attach a second listener. Nothing ever
    // removes it: the event is one-shot and app-wide, and detaching when a transient consumer
    // unmounts would throw away the only chance to capture it.
    if (isStarted || !target) return
    isStarted = true
    target.addEventListener('beforeinstallprompt', capture)
    target.addEventListener('appinstalled', markInstalled)
  }

  const prompt = async (): Promise<boolean> => {
    const event = captured
    if (!event) return false
    // Dropped BEFORE awaiting anything: the event is single-use and Chromium throws on a second
    // `prompt()` call, which a double tap would otherwise produce.
    captured = undefined
    isSpent = true
    notify()
    try {
      await event.prompt()
      const choice = await event.userChoice
      const accepted = choice.outcome === 'accepted'
      // Belt and braces with the `appinstalled` listener: Chromium fires that event, but the
      // userChoice outcome is the one signal guaranteed to arrive in this promise.
      if (accepted) markInstalled()
      return accepted
    } catch {
      // A rejected prompt is still a spent prompt. Reporting failure is enough; taking the page
      // down over an install offer is not acceptable.
      return false
    }
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    getState: () => ({ isCaptured: captured !== undefined, isInstalled, isSpent }),
    prompt,
    start,
    subscribe,
  }
}

/** The app-wide instance. `_app` starts it; every consumer reads the same capture. */
export const installPromptStore = createInstallPromptStore()

export const readInstallDismissed = (storage: Storage | undefined = defaultStorage()): boolean => {
  try {
    return storage?.getItem(INSTALL_DISMISSED_KEY) === 'true'
  } catch {
    // Reading localStorage throws outright in Safari private browsing. Not having a stored
    // dismissal is the safe answer.
    return false
  }
}

export const writeInstallDismissed = (storage: Storage | undefined = defaultStorage()): void => {
  try {
    storage?.setItem(INSTALL_DISMISSED_KEY, 'true')
  } catch {
    // Quota, or storage that throws on write. The dismissal then holds for this page only, which
    // is a far better outcome than an error thrown out of a click handler.
  }
}

export interface UseInstallPrompt {
  /** What to render. `none` and `installed` render nothing. */
  capability: InstallCapability
  dismiss: () => void
  /** Why `capability` is `none`, when it is: the visitor closed the offer on a previous visit. */
  isDismissed: boolean
  /** Resolves true only if the visitor accepted the browser's install sheet. */
  prompt: () => Promise<boolean>
}

/**
 * Resolves what kind of install offer this browser can honor, and keeps the one-shot prompt.
 *
 * Capability resolves after mount, never during render: this app is a static export, so the
 * server-rendered markup and the first client render have to agree, and the initial `none` renders
 * nothing rather than flashing an offer that a webview cannot honor.
 */
export function useInstallPrompt(
  store: InstallPromptStore = installPromptStore,
  storage: Storage | undefined = defaultStorage(),
  env: () => InstallEnv = readInstallEnv,
): UseInstallPrompt {
  const [capability, setCapability] = useState<InstallCapability>('none')
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    store.start()
    const sync = (): void => setCapability(resolveInstallCapability(store.getState(), env()))
    sync()
    setIsDismissed(readInstallDismissed(storage))
    // The event can arrive after mount, so the offer appears when the browser says so rather than
    // only if it happened to beat first render.
    return store.subscribe(sync)
  }, [env, storage, store])

  const dismiss = useCallback((): void => {
    writeInstallDismissed(storage)
    setIsDismissed(true)
  }, [storage])

  const prompt = useCallback((): Promise<boolean> => store.prompt(), [store])

  return {
    // A dismissal suppresses the offer without pretending the browser changed. `installed` is a
    // fact about the app, not an offer, so it survives — dismissing an offer must never make the
    // app report itself as uninstalled.
    capability: isDismissed && capability !== 'installed' ? 'none' : capability,
    dismiss,
    isDismissed,
    prompt,
  }
}
