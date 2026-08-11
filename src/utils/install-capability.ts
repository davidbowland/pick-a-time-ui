/**
 * What this browser can actually do about installing Pick a Time.
 *
 * Every value here has to survive being rendered: `ios-share` and `browser-menu` each name a
 * control the visitor is told to tap, so resolving one on a browser that does not have that
 * control is worse than saying nothing at all. That is why the three "cannot install" classes —
 * Firefox on desktop, iOS browsers that are not Safari, and in-app webviews — all collapse to
 * `none`, and why `none` means "render nothing", not "we are not sure".
 *
 * `spent` is deliberately distinct from `none`: see the note on the captured-prompt branch below.
 */
export type InstallCapability = 'installed' | 'promptable' | 'spent' | 'ios-share' | 'browser-menu' | 'none'

/** The captured `beforeinstallprompt`, flattened to plain data so the resolver stays pure. */
export interface CapturedPrompt {
  isCaptured: boolean
  // Set from the `appinstalled` event. The originating tab keeps `display-mode: browser` after a
  // successful install on Chromium, so the display-mode check below cannot see it -- without this
  // the resolver reports `spent` and the UI tells someone who just installed to install again.
  isInstalled: boolean
  isSpent: boolean
}

/**
 * Everything the resolver reads about the browser, flattened the same way, so the whole matrix is
 * table-testable with no React, no jsdom, and no globals.
 */
export interface InstallEnv {
  matchesMedia: (query: string) => boolean
  maxTouchPoints: number
  standalone: boolean
  userAgent: string
}

/** Only the handful of properties `readInstallEnv` touches, so a test can hand over a plain object. */
export interface InstallWindow {
  matchMedia?: (query: string) => { matches: boolean }
  navigator?: {
    maxTouchPoints?: number
    standalone?: boolean
    userAgent?: string
  }
}

const IOS_PATTERN = /iPad|iPhone|iPod/

/**
 * Facebook, Instagram, TikTok, Snapchat, WeChat and LINE, by the tokens each one actually adds.
 *
 * Every one of these user agents ALSO contains "Chrome" (the Android builds) or "Safari" (the iOS
 * builds), so a webview reads as an ordinary browser to every other test in this file. That is why
 * the webview branch runs before all of them.
 */
const IN_APP_WEBVIEW_PATTERN =
  /FBAN|FBAV|FB_IAB|Instagram|TikTok|BytedanceWebview|musical_ly|Snapchat|MicroMessenger|Line\/|LINE\//

/**
 * Chrome, Firefox, Edge, Opera and DuckDuckGo on iOS. Apple requires all of them to be WebKit
 * wrappers, and none of them has an Add to Home Screen that produces an installed app. Handing
 * them the Share-sheet steps would name Safari's toolbar inside an app that is not Safari, so
 * these must resolve `none` rather than `ios-share`.
 */
// Three Opera tokens, not one: OPiOS is Opera Mini, OPT/ is modern Opera Touch, OPX/ is Opera
// GX. All three are WebKit wrappers with no Add to Home Screen, so any of them resolving
// `ios-share` would hand out steps for a sheet the browser does not have.
const IOS_NON_SAFARI_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|OPX\/|DuckDuckGo/

/**
 * Firefox for Android installs a web app from its ⋮ menu but has never implemented
 * `beforeinstallprompt`, so no amount of waiting produces an event to put behind a button.
 *
 * `Android` is load-bearing: Firefox on the DESKTOP cannot install a web app at all — Mozilla
 * removed site-specific browsers and shipped nothing in their place — so pointing a desktop reader
 * at a menu item that does not exist is worse than silence. Desktop Firefox falls through to `none`.
 */
const FIREFOX_ANDROID_PATTERN = /Android.*Firefox\//

/**
 * The manifest only ASKS for `standalone`; the browser decides what the installed app actually
 * runs as. Firefox for Android runs installed apps in `minimal-ui`, desktop Chromium can hand back
 * `window-controls-overlay`, and a fullscreen install matches neither. Asking about `standalone`
 * alone therefore missed real installs and kept offering "Add to Home Screen" from INSIDE the
 * installed app, where the step does not exist. An ordinary tab is `browser` and matches none of
 * these, which is the entire point.
 */
const APP_DISPLAY_MODES = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay']

/** The only impure function here: reads the browser once, so the resolver below stays pure. */
export const readInstallEnv = (
  win: InstallWindow | undefined = typeof window === 'undefined' ? undefined : (window as unknown as InstallWindow),
): InstallEnv => {
  const nav = win?.navigator
  return {
    // `matchMedia` is optional rather than assumed: it is absent in a few embedded webviews, and
    // throwing here would take the page down over a decoration.
    // Every other read here is defensive and this was not. `matchMedia` can return null in older
    // embedded webviews, and can throw on a media feature an engine does not recognise --
    // `window-controls-overlay` is exactly that kind of feature. Either would throw inside the
    // mount effect and take the tree down over an install banner.
    matchesMedia: (query: string): boolean => {
      try {
        return win?.matchMedia?.(query)?.matches === true
      } catch {
        return false
      }
    },
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    // iOS Safari's own flag, and the only installed signal there before it shipped display-mode.
    standalone: nav?.standalone === true,
    userAgent: nav?.userAgent ?? '',
  }
}

const isInstalled = (prompt: CapturedPrompt, env: InstallEnv): boolean =>
  prompt.isInstalled || APP_DISPLAY_MODES.some((mode) => env.matchesMedia(`(display-mode: ${mode})`)) || env.standalone

/**
 * iPadOS 13 and later report a desktop Mac user agent, so `/iPad/` misses every modern iPad. Touch
 * points tell the two apart: `maxTouchPoints > 1` is false on every real Mac, trackpad included.
 */
const isIos = (env: InstallEnv): boolean =>
  IOS_PATTERN.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)

/**
 * Resolution order is load-bearing, and each step below records a failure a sibling repo shipped:
 *
 *   installed → in-app webview → captured prompt → iOS → Firefox Android → none
 */
export const resolveInstallCapability = (
  prompt: CapturedPrompt,
  env: InstallEnv = readInstallEnv(),
): InstallCapability => {
  // First, because every offer below is wrong inside the installed app.
  if (isInstalled(prompt, env)) {
    return 'installed'
  }
  // BEFORE the iOS check, and that order is the whole fix. Reversed, an iPhone inside Instagram
  // resolved to `ios-share` and was shown three Share-sheet steps for a sheet the webview does not
  // have — a path promised and then not there. A webview can install on no platform, so it is a
  // dead end everywhere and must be answered before any platform branch.
  if (IN_APP_WEBVIEW_PATTERN.test(env.userAgent)) {
    return 'none'
  }
  // A captured event is proof, not inference: the browser has told us it will install this app.
  // It outranks every user-agent guess below.
  if (prompt.isCaptured) {
    return 'promptable'
  }
  // The prompt was captured and has since been used. Chromium fires `beforeinstallprompt` once and
  // will not fire another until the page reloads, so there is nothing left to put behind a button
  // — but the offer is still real and the browser's own menu still installs. Collapsing this into
  // `none` erased the entire install offer the instant somebody backed out of Chrome's sheet.
  if (prompt.isSpent) {
    return 'spent'
  }
  if (isIos(env)) {
    return IOS_NON_SAFARI_PATTERN.test(env.userAgent) ? 'none' : 'ios-share'
  }
  // Reached only after iOS, so Firefox for iOS gets iOS's answer rather than an Android menu item
  // it does not have.
  if (FIREFOX_ANDROID_PATTERN.test(env.userAgent)) {
    return 'browser-menu'
  }
  // Desktop Firefox lands here, as does a Chromium browser that never offered a prompt — which has
  // already decided this app is not installable. Showing an entry point that cannot deliver is
  // worse than showing nothing.
  return 'none'
}
