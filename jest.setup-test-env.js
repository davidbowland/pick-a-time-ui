// Environment variables
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost'
process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID = 'somereallylongvalue1111'
process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = 'us-east_clientId'
process.env.NEXT_PUBLIC_DELAY_BETWEEN_REFRESH_MS = '500'
process.env.NEXT_PUBLIC_IDENTITY_POOL_ID = 'us-east-2:iujhgvd56yhjm98uygt'
process.env.NEXT_PUBLIC_ORIGIN = 'http://localhost'
process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = 'oiuytfghjmnbvcdsdrty'

window.URL.createObjectURL = jest.fn()

// Polyfill scrollIntoView for jsdom (not implemented)
Element.prototype.scrollIntoView = jest.fn()

// Polyfill getAnimations for jsdom (not implemented). HeroUI's Tabs indicator
// (react-aria-components' SharedElementTransition) calls this unconditionally whenever
// selection changes, even with no CSS transition actually running in jsdom.
Element.prototype.getAnimations = jest.fn(() => [])

// Polyfill inert for jsdom (not implemented in jsdom 29.7.0). Reflects the inert attribute
// as a boolean property on the element, required by React 19 support for the inert attribute.
Object.defineProperty(HTMLElement.prototype, 'inert', {
  configurable: true,
  get() {
    return this.hasAttribute('inert')
  },
  set(value) {
    if (value) {
      this.setAttribute('inert', '')
    } else {
      this.removeAttribute('inert')
    }
  },
})

// Polyfill matchMedia for jsdom (used by device-detection and Embla)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Polyfill IntersectionObserver for jsdom (not implemented). framer-motion's `whileInView`
// feature constructs one unconditionally on mount; without this, any component using
// whileInView crashes in tests with "IntersectionObserver is not defined". This is a
// decorative-only stub — no test in this repo asserts on intersection callbacks actually
// firing, so observe/unobserve/disconnect are no-ops.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
window.IntersectionObserver = IntersectionObserverStub
global.IntersectionObserver = IntersectionObserverStub

// Suppress noisy warnings from @react-aria / HeroUI internals that are not actionable in tests
const originalWarn = console.warn
console.warn = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : ''
  if (
    msg.includes('If you do not provide a visible label') ||
    msg.includes('PressResponder was rendered without a pressable child')
  ) {
    return
  }
  originalWarn.call(console, ...args)
}
