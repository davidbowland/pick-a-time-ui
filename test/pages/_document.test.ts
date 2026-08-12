import { readFileSync } from 'fs'
import { join } from 'path'

// `pages/_document.tsx` is in coveragePathIgnorePatterns (jest.config.mjs:11-22), so nothing that
// runs it can be counted. Its inline script is also the one piece of this feature that executes
// before React exists and cannot be imported. Both facts point the same way: assert the source.
const source = readFileSync(join(process.cwd(), 'src/pages/_document.tsx'), 'utf-8')

describe('_document.tsx favicon links', () => {
  it('links the svg favicon', () => {
    expect(source).toMatch(/href="\/favicon\.svg"/)
  })

  it('links an ico fallback', () => {
    expect(source).toMatch(/href="\/favicon\.ico"/)
  })

  it('links the apple touch icon', () => {
    expect(source).toMatch(/href="\/apple-touch-icon\.png"/)
  })

  it('links the web manifest', () => {
    expect(source).toMatch(/href="\/site\.webmanifest"/)
  })
})

describe('_document.tsx viewport (AC-027)', () => {
  it('declares no viewport tag, which Next warns about here', () => {
    // no-document-viewport-meta: _document renders once on the server, outside next/head's dedupe,
    // so a viewport declared here can only ever be a second tag racing next/head's. The real one
    // lives in _app — see test/pages/_app-viewport.test.ts.
    expect(source).not.toMatch(/name="viewport"/)
  })
})

describe('_document.tsx pre-paint composition script', () => {
  it('keeps the dark-class script and the composition selector in ONE inline block', () => {
    // D-8 rejected a second inline script here because a future CSP has to accommodate every one
    // of them. Counting the blocks is the only assertion that can fail when a third arrives.
    expect(source.match(/dangerouslySetInnerHTML=/g)).toHaveLength(1)
  })

  it('still adds the dark class', () => {
    expect(source).toMatch(/documentElement\.classList\.add\('dark'\)/)
  })

  it('reads the recents store the app actually writes', () => {
    expect(source).toMatch(/localStorage\.getItem\('pat_recent_polls'\)/)
  })

  it('publishes a boolean on dataset, not a count', () => {
    expect(source).toMatch(/documentElement\.dataset\.recentPolls = 'true'/)
    expect(source).toMatch(/delete document\.documentElement\.dataset\.recentPolls/)
    // A count would be a second copy of the prune predicate that has to agree numerically with
    // useRecentPolls; ADR-3 and ADR-4 exist because two copies of an expiry rule drift.
    expect(source).not.toMatch(/dataset\.\w*[Cc]ount/)
    // The only value ever assigned is the string literal, so no length can leak in.
    expect(source).not.toMatch(/dataset\.recentPolls = [^']/)
  })

  it('never writes a CSS custom property from stored data', () => {
    // Custom property values are unsanitized: a url(...) smuggled into one is a live fetch, and
    // this origin ships no CSP to stop it.
    expect(source).not.toMatch(/setProperty\(/)
    expect(source).not.toMatch(/\.style\b/)
  })

  it('writes no DOM, so hydration has nothing to mismatch on', () => {
    expect(source).not.toMatch(/document\.write|createElement|innerHTML =|appendChild/)
  })

  it('treats expiration as epoch SECONDS', () => {
    expect(source).toMatch(/poll\.expiration \* 1000 > nowMs/)
  })

  it('guards every storage access in try/catch (AC-018)', () => {
    const script = source.slice(source.indexOf('const PRE_PAINT_SCRIPT'), source.indexOf('export default'))
    expect(script.indexOf('try {')).toBeLessThan(script.indexOf('localStorage'))
    expect(script.indexOf('localStorage')).toBeLessThan(script.indexOf('} catch'))
  })

  it('degrades to the story composition when there is nothing to show', () => {
    // The attribute is deleted rather than set to "false", so absent — the state a blocked or
    // thrown script leaves behind — and empty are the same state (AC-043).
    expect(source).not.toMatch(/dataset\.recentPolls = 'false'/)
  })
})
