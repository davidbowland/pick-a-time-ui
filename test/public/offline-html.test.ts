import { readFileSync } from 'fs'
import { join } from 'path'

import { contrastRatio } from '@utils/contrast'

// public/offline.html is served as a static file with no _app, no _document, no React and no
// Tailwind build, so there is no component to render -- the shipped bytes are the whole artifact.
// These assertions read those bytes, following test/pages/_document.test.ts and
// test/utils/css-tokens.test.ts.
const html = readFileSync(join(process.cwd(), 'public/offline.html'), 'utf-8')

const readInlinedToken = (name: string): string => {
  const match = html.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} is not inlined in offline.html`)
  return match[1].trim()
}

const countMatches = (pattern: RegExp): number => (html.match(pattern) ?? []).length

// Everything the visitor can actually read: the brand row and the main panel, tags and HTML
// comments removed.
const visibleText = (html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<script>[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const reducedMotionGate = '@media (prefers-reduced-motion: no-preference)'

describe('public/offline.html document', () => {
  it('declares its language', () => {
    expect(html).toMatch(/<html[^>]*\slang="en"/)
  })

  it('carries the dark class the app normally adds from _document', () => {
    expect(html).toMatch(/<html[^>]*\sclass="dark"/)
  })

  it('declares utf-8, which the em dash in the copy depends on', () => {
    expect(html).toMatch(/<meta charset="utf-8"/)
  })

  it('ships the viewport tag it gets from nowhere else, opted into the safe area', () => {
    expect(html).toMatch(/<meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"/)
  })

  it('keeps itself out of the index', () => {
    expect(html).toMatch(/<meta content="noindex, nofollow" name="robots"/)
  })

  it('titles itself', () => {
    expect(html).toContain('<title>Pick a Time — offline</title>')
  })
})

describe('public/offline.html structure', () => {
  it('has exactly one h1', () => {
    expect(countMatches(/<h1[\s>]/g)).toBe(1)
  })

  it('exposes the header and main landmarks', () => {
    expect(html).toMatch(/<header>/)
    expect(html).toMatch(/<main\b/)
  })

  it('hides the decorative brand mark from assistive technology', () => {
    expect(html).toMatch(/<svg aria-hidden="true"/)
  })
})

describe('public/offline.html copy', () => {
  it.each([
    ['the brand', 'Pick a Time'],
    ['the heading', "You're offline"],
    [
      'the body',
      "Pick a Time needs a connection. Nothing here works without one — not even the polls you've already opened.",
    ],
    ['the second line', "Try again once you're back."],
    ['the retry label', 'Try again'],
    ['the home label', 'Go home'],
  ])('renders %s verbatim', (_element, copy) => {
    expect(visibleText).toContain(copy)
  })

  it('states plainly that nothing works offline, per ADR-1', () => {
    expect(visibleText).toContain('Nothing here works without one')
    expect(visibleText).toContain("not even the polls you've already opened")
  })

  it('uses no exclamation marks', () => {
    expect(visibleText).not.toContain('!')
  })
})

describe('public/offline.html controls', () => {
  it('offers a retry control that re-requests the page the visitor asked for', () => {
    expect(html).toMatch(/<button[^>]*id="retry"[^>]*>Try again<\/button>/)
    expect(html).toMatch(/window\.location\.reload\(\)/)
  })

  it('offers a link back to the app start', () => {
    expect(html).toMatch(/<a class="action action--secondary" href="\/">Go home<\/a>/)
  })

  it('leaves both controls in the tab order and enabled', () => {
    expect(html).not.toMatch(/tabindex="-1"/)
    expect(html).not.toMatch(/\bdisabled\b/)
    expect(html).not.toMatch(/aria-hidden="true"[^>]*>\s*(Try again|Go home)/)
  })

  it('gives focused controls a visible ring built from the app focus-ring values', () => {
    expect(html).toMatch(/\.action:focus-visible \{/)
    expect(countMatches(/0 0 0 4px var\(--accent\)/g)).toBeGreaterThanOrEqual(1)
  })

  it('shows a ring in browsers with no :focus-visible support, and only for keyboard use where there is', () => {
    expect(html).toMatch(/\.action:focus \{/)
    expect(html).toMatch(/\.action:focus:not\(:focus-visible\) \{/)
  })

  it('sizes both controls past the 24x24 CSS px minimum of SC 2.5.8', () => {
    expect(html).toMatch(/min-width: 44px;/)
  })

  // "Contains no .focus()" was the original assertion here, and it was a proxy for the real
  // property rather than the property itself -- it would also have failed on focus restoration,
  // which is the opposite of a trap. What actually matters on a page with no browser chrome to
  // escape from: nothing intercepts keys, nothing adds a tab stop the user cannot leave, and both
  // controls stay in the natural tab order.
  it('intercepts no keys, so nothing can trap the keyboard', () => {
    expect(html).not.toMatch(/keydown|keypress|keyup/)
  })

  it('adds no tabindex, leaving both controls in the natural tab order', () => {
    expect(html).not.toMatch(/tabindex/i)
  })

  // Focus is moved in exactly one place: back onto the retry button after a retry that failed, so
  // a keyboard user is returned to the control they just pressed instead of being dumped at the
  // top of the document with no signal that anything happened.
  it('moves focus only to restore it after a failed retry', () => {
    expect(html.match(/\.focus\(\)/g)).toHaveLength(1)
    expect(html).toMatch(/pat_offline_retried[\s\S]*?retry\.focus\(\)/)
  })
})

describe('public/offline.html inlined tokens', () => {
  it.each([
    ['ink', '#17171a'],
    ['bone', '#f2f1ee'],
    ['accent', '#3fae8a'],
    ['accent-soft', '#7ecdb3'],
    ['slate', '#9494a3'],
    ['hair', 'rgba(148, 148, 163, 0.22)'],
  ])('inlines --%s as the audited value from index.css', (name, value) => {
    expect(readInlinedToken(name)).toBe(value)
  })

  it('inlines a font stack that does not depend on the next/font build output', () => {
    expect(readInlinedToken('font-display')).toContain('Georgia')
    expect(readInlinedToken('font-body')).toContain('system-ui')
  })

  it('fetches no stylesheet, script or font, since it renders with the network gone', () => {
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/)
    expect(html).not.toMatch(/<script[^>]+src=/)
    expect(html).not.toMatch(/@font-face/)
    expect(html).not.toMatch(/url\(["']?http/)
  })

  it('paints the page shell from the inlined tokens rather than the Tailwind build', () => {
    expect(html).not.toMatch(/class="[^"]*\bmin-h-\[/)
  })
})

describe('public/offline.html contrast against its own inlined background', () => {
  const ink = readInlinedToken('ink')

  it.each([
    ['bone', 'the heading and body text'],
    ['accent', 'the brand wordmark'],
    ['slate', 'the second line and the secondary control border'],
  ])('clears 4.5:1 for --%s, used for %s', (token) => {
    expect(contrastRatio(readInlinedToken(token), ink)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([['accent'], ['accent-soft']])(
    'clears 4.5:1 for the ink label on the --%s primary control fill',
    (token) => {
      expect(contrastRatio(ink, readInlinedToken(token))).toBeGreaterThanOrEqual(4.5)
    },
  )
})

describe('public/offline.html motion and safe area', () => {
  it('gates motion behind prefers-reduced-motion, as index.css:179-195 does', () => {
    expect(html).toContain(reducedMotionGate)
  })

  it('declares no animation or transition outside that gate', () => {
    expect(html.slice(0, html.indexOf(reducedMotionGate))).not.toMatch(/\n\s+(animation|transition):/)
  })

  it('pads for the safe area on all four edges', () => {
    expect(html).toMatch(/env\(safe-area-inset-top\)/)
    expect(html).toMatch(/env\(safe-area-inset-right\)/)
    expect(html).toMatch(/env\(safe-area-inset-bottom\)/)
    expect(html).toMatch(/env\(safe-area-inset-left\)/)
  })
})
