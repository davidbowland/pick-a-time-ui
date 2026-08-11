import {
  CapturedPrompt,
  InstallEnv,
  InstallWindow,
  readInstallEnv,
  resolveInstallCapability,
} from '@utils/install-capability'

// Real user agents, copied rather than invented: every branch in the resolver exists because one
// of these strings was misread once.
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
// iPadOS 13+ and a real Mac send byte-identical user agents. Only maxTouchPoints separates them.
const MAC_DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0'
const FIREFOX_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0'
const FIREFOX_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0'
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'

const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1'
const IOS_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15'
const IOS_EDGE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0.2592.87 Version/17.0 Mobile/15E148 Safari/604.1'
const IOS_OPERA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPT/4.5.0 Mobile/15E148 Safari/604.1'
const IOS_DUCKDUCKGO =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15'

const FACEBOOK_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/468.0.0.31.107;]'
const INSTAGRAM_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 331.0.0.21.90'
const INSTAGRAM_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 331.0.0.37.90 Android'
const TIKTOK_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 BytedanceWebview/d8a21c6 AppName/musical_ly app_version/34.5.4'
const SNAPCHAT_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.85.0.44 (like Safari/604.1)'
const WECHAT_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 MMWEBID/1234 MicroMessenger/8.0.49.2600(0x28003137) WeChat/arm64'
const LINE_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.6.1/IAB'

const NO_PROMPT: CapturedPrompt = { isCaptured: false, isInstalled: false, isSpent: false }
const CAPTURED: CapturedPrompt = { isCaptured: true, isInstalled: false, isSpent: false }
const SPENT: CapturedPrompt = { isCaptured: false, isInstalled: false, isSpent: true }
const JUST_INSTALLED: CapturedPrompt = { isCaptured: false, isInstalled: true, isSpent: true }

const envOf = (overrides: Partial<InstallEnv> = {}): InstallEnv => ({
  matchesMedia: () => false,
  maxTouchPoints: 0,
  standalone: false,
  userAgent: ANDROID_CHROME,
  ...overrides,
})

/** A `matchesMedia` that answers for exactly one display mode, the way a real browser does. */
const displayMode =
  (mode: string) =>
  (query: string): boolean =>
    query === `(display-mode: ${mode})`

const windowOf = (overrides: InstallWindow = {}): InstallWindow => ({
  matchMedia: () => ({ matches: false }),
  navigator: { maxTouchPoints: 0, userAgent: ANDROID_CHROME },
  ...overrides,
})

describe('install-capability', () => {
  describe('installed', () => {
    it.each(['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'])(
      'should report installed for display-mode %s',
      (mode) => {
        // The manifest asks for standalone; the browser decides what it actually gives us. Firefox
        // for Android runs installed apps in minimal-ui, and a standalone-only check kept offering
        // install from inside the installed app.
        expect(resolveInstallCapability(NO_PROMPT, envOf({ matchesMedia: displayMode(mode) }))).toEqual('installed')
      },
    )

    it('should report installed from navigator.standalone on iOS', () => {
      expect(resolveInstallCapability(NO_PROMPT, envOf({ standalone: true, userAgent: IPHONE_SAFARI }))).toEqual(
        'installed',
      )
    })

    it('should not report installed in an ordinary browser tab', () => {
      expect(resolveInstallCapability(NO_PROMPT, envOf({ matchesMedia: displayMode('browser') }))).toEqual('none')
    })

    it('should report installed ahead of every offer, including a captured prompt', () => {
      expect(resolveInstallCapability(CAPTURED, envOf({ matchesMedia: displayMode('standalone') }))).toEqual(
        'installed',
      )
    })

    it('should report installed even inside an in-app webview', () => {
      // Installed is a fact about the app, so it outranks the dead-end webview branch below it.
      const env = envOf({ matchesMedia: displayMode('standalone'), userAgent: INSTAGRAM_ANDROID })

      expect(resolveInstallCapability(NO_PROMPT, env)).toEqual('installed')
    })
  })

  describe('in-app webviews', () => {
    it.each([
      ['Facebook on Android', FACEBOOK_ANDROID],
      ['Instagram on Android', INSTAGRAM_ANDROID],
      ['Instagram on iPhone', INSTAGRAM_IPHONE],
      ['TikTok on Android', TIKTOK_ANDROID],
      ['Snapchat on iPhone', SNAPCHAT_IPHONE],
      ['WeChat on Android', WECHAT_ANDROID],
      ['LINE on Android', LINE_ANDROID],
    ])('should offer nothing inside %s', (_name, userAgent) => {
      expect(resolveInstallCapability(NO_PROMPT, envOf({ userAgent }))).toEqual('none')
    })

    it('should offer nothing inside an iPhone webview rather than Share-sheet steps', () => {
      // The ordering test. With the iOS branch first, an iPhone inside Instagram resolved
      // `ios-share` and was handed three steps for a Share sheet the webview does not have.
      expect(resolveInstallCapability(NO_PROMPT, envOf({ userAgent: INSTAGRAM_IPHONE }))).toEqual('none')
      expect(resolveInstallCapability(NO_PROMPT, envOf({ userAgent: SNAPCHAT_IPHONE }))).toEqual('none')
    })

    it('should offer nothing inside a Facebook webview even where a prompt was captured', () => {
      // These user agents also contain "Chrome", so the webview test has to precede the rest.
      expect(resolveInstallCapability(CAPTURED, envOf({ userAgent: FACEBOOK_ANDROID }))).toEqual('none')
    })

    it('should offer nothing inside a webview that already spent a prompt', () => {
      expect(resolveInstallCapability(SPENT, envOf({ userAgent: TIKTOK_ANDROID }))).toEqual('none')
    })
  })

  describe('captured prompt', () => {
    it('should report promptable on Chrome for Android once the event is captured', () => {
      expect(resolveInstallCapability(CAPTURED, envOf())).toEqual('promptable')
    })

    it('should report promptable on Edge for Windows once the event is captured', () => {
      expect(resolveInstallCapability(CAPTURED, envOf({ userAgent: EDGE_WINDOWS }))).toEqual('promptable')
    })

    it('should prefer the captured prompt over the iOS share sheet', () => {
      // A captured event is proof; the user agent is only ever inference.
      const env = envOf({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI })

      expect(resolveInstallCapability(CAPTURED, env)).toEqual('promptable')
    })

    it('should report spent once the prompt has been used, not none', () => {
      // Collapsing spent into none erased the whole offer the moment somebody backed out of
      // Chrome's own install sheet.
      expect(resolveInstallCapability(SPENT, envOf())).toEqual('spent')
    })

    it('should prefer a freshly captured prompt over a spent one', () => {
      expect(resolveInstallCapability({ isCaptured: true, isInstalled: false, isSpent: true }, envOf())).toEqual(
        'promptable',
      )
    })
  })

  describe('iOS', () => {
    it('should report ios-share on iPhone Safari', () => {
      expect(resolveInstallCapability(NO_PROMPT, envOf({ maxTouchPoints: 5, userAgent: IPHONE_SAFARI }))).toEqual(
        'ios-share',
      )
    })

    it('should report ios-share on iPadOS, which reports a desktop Mac user agent', () => {
      const ipad = envOf({ maxTouchPoints: 5, userAgent: MAC_DESKTOP_SAFARI })

      expect(resolveInstallCapability(NO_PROMPT, ipad)).toEqual('ios-share')
    })

    it('should offer nothing on a real Mac with the same user agent', () => {
      // maxTouchPoints is 0 on every Mac, trackpad included, which is the only thing separating
      // these two devices.
      const mac = envOf({ maxTouchPoints: 0, userAgent: MAC_DESKTOP_SAFARI })

      expect(resolveInstallCapability(NO_PROMPT, mac)).toEqual('none')
    })

    it.each([
      ['Chrome', IOS_CHROME],
      ['Firefox', IOS_FIREFOX],
      ['Edge', IOS_EDGE],
      ['Opera', IOS_OPERA],
      ['DuckDuckGo', IOS_DUCKDUCKGO],
    ])('should offer nothing to %s on iOS, a WebKit wrapper that cannot install', (_name, userAgent) => {
      expect(resolveInstallCapability(NO_PROMPT, envOf({ maxTouchPoints: 5, userAgent }))).toEqual('none')
    })

    it('should not send Firefox for iOS to the Android browser menu', () => {
      // The Firefox branch runs after the iOS branch precisely so this cannot happen.
      expect(resolveInstallCapability(NO_PROMPT, envOf({ maxTouchPoints: 5, userAgent: IOS_FIREFOX }))).toEqual('none')
    })
  })

  describe('Firefox', () => {
    it('should report browser-menu on Firefox for Android, which never fires beforeinstallprompt', () => {
      expect(resolveInstallCapability(NO_PROMPT, envOf({ userAgent: FIREFOX_ANDROID }))).toEqual('browser-menu')
    })

    it.each([
      ['macOS', FIREFOX_MAC],
      ['Windows', FIREFOX_WINDOWS],
    ])('should offer nothing on Firefox for %s, which cannot install a web app at all', (_name, userAgent) => {
      // Mozilla removed site-specific browsers, so naming a menu item here would name a control
      // that does not exist.
      expect(resolveInstallCapability(NO_PROMPT, envOf({ userAgent }))).toEqual('none')
    })
  })

  describe('no offer', () => {
    it.each([
      ['Chrome for Android', ANDROID_CHROME],
      ['Edge for Windows', EDGE_WINDOWS],
    ])('should offer nothing on %s that never fired the event', (_name, userAgent) => {
      // A Chromium browser that stayed silent has already decided this app is not installable.
      expect(resolveInstallCapability(NO_PROMPT, envOf({ userAgent }))).toEqual('none')
    })

    it('should offer nothing where the user agent is empty', () => {
      expect(resolveInstallCapability(NO_PROMPT, envOf({ userAgent: '' }))).toEqual('none')
    })
  })

  describe('readInstallEnv', () => {
    it('should read an ordinary Android Chrome tab', () => {
      const env = readInstallEnv(windowOf())

      expect(env.maxTouchPoints).toEqual(0)
      expect(env.standalone).toEqual(false)
      expect(env.userAgent).toEqual(ANDROID_CHROME)
      expect(env.matchesMedia('(display-mode: standalone)')).toEqual(false)
    })

    it('should report the display mode the browser matches', () => {
      const win = windowOf({ matchMedia: (query) => ({ matches: query === '(display-mode: minimal-ui)' }) })

      expect(readInstallEnv(win).matchesMedia('(display-mode: minimal-ui)')).toEqual(true)
    })

    it('should read navigator.standalone and maxTouchPoints', () => {
      const win = windowOf({ navigator: { maxTouchPoints: 5, standalone: true, userAgent: IPHONE_SAFARI } })
      const env = readInstallEnv(win)

      expect(env.maxTouchPoints).toEqual(5)
      expect(env.standalone).toEqual(true)
      expect(env.userAgent).toEqual(IPHONE_SAFARI)
    })

    it('should survive a browser with no matchMedia', () => {
      const env = readInstallEnv(windowOf({ matchMedia: undefined }))

      expect(env.matchesMedia('(display-mode: standalone)')).toEqual(false)
    })

    it('should survive a window with no navigator', () => {
      const env = readInstallEnv(windowOf({ navigator: undefined }))

      expect(env).toEqual({
        matchesMedia: expect.any(Function),
        maxTouchPoints: 0,
        standalone: false,
        userAgent: '',
      })
    })

    it('should read nothing at all from a bare window, and offer nothing on it', () => {
      const env = readInstallEnv({})

      expect(env.matchesMedia('(display-mode: standalone)')).toEqual(false)
      expect(env.userAgent).toEqual('')
      expect(resolveInstallCapability(NO_PROMPT, env)).toEqual('none')
    })

    it('should default to the ambient window', () => {
      expect(readInstallEnv().userAgent).toEqual(window.navigator.userAgent)
    })

    it('should read the ambient browser when the resolver is given no environment', () => {
      expect(resolveInstallCapability(NO_PROMPT)).toEqual('none')
    })
  })

  // Chromium leaves the tab that started the install on `display-mode: browser`, so the display-mode
  // check cannot see the install and the prompt is already spent by then. Without the appinstalled
  // flag this resolves `spent`, and Section 9 tells someone who just installed to install again.
  it('resolves installed straight after an accepted install, before any display-mode change', () => {
    expect(resolveInstallCapability(JUST_INSTALLED, envOf({ userAgent: ANDROID_CHROME }))).toBe('installed')
  })

  // matchMedia returns null in some older embedded webviews and throws on media features an engine
  // does not recognise -- window-controls-overlay is exactly that kind of feature. Either would
  // throw inside the mount effect and take the tree down over an install banner. The guard lives
  // where the env is BUILT from a real window, so that is what these exercise; the resolver itself
  // receives already-flattened plain data.
  it('reads a matchMedia that throws as not-installed rather than propagating', () => {
    const win = {
      matchMedia: () => {
        throw new Error('unknown media feature')
      },
      navigator: { maxTouchPoints: 0, userAgent: ANDROID_CHROME },
    } as unknown as Parameters<typeof readInstallEnv>[0]

    expect(readInstallEnv(win).matchesMedia('(display-mode: window-controls-overlay)')).toBe(false)
  })

  it('reads a matchMedia returning null as not-installed', () => {
    const win = {
      matchMedia: () => null,
      navigator: { maxTouchPoints: 0, userAgent: ANDROID_CHROME },
    } as unknown as Parameters<typeof readInstallEnv>[0]

    expect(readInstallEnv(win).matchesMedia('(display-mode: standalone)')).toBe(false)
  })
})
