// Environment variables
process.env.NEXT_PUBLIC_CHOOSEE_API_BASE_URL = 'http://localhost'
process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID = 'somereallylongvalue1111'
process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = 'us-east_clientId'
process.env.NEXT_PUBLIC_DELAY_BETWEEN_REFRESH_MS = '500'
process.env.NEXT_PUBLIC_IDENTITY_POOL_ID = 'us-east-2:iujhgvd56yhjm98uygt'
process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = 'oiuytfghjmnbvcdsdrty'

window.URL.createObjectURL = jest.fn()

// Polyfill scrollIntoView for jsdom (not implemented)
Element.prototype.scrollIntoView = jest.fn()

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
