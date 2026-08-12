import { parseSessionCode } from './session-code'

// The parser's sanity cap. Not exported — pinned here by testing both sides of the boundary, so a
// change to the constant fails a test rather than silently widening what reaches the work below.
const MAX_INPUT_LENGTH = 512

const atMaxLength = 'a'.repeat(MAX_INPUT_LENGTH)
const overMaxLength = 'a'.repeat(MAX_INPUT_LENGTH + 1)

describe('parseSessionCode', () => {
  describe('what people read out loud', () => {
    it.each([
      { expected: 'lazy-giraffe', input: 'lazy giraffe', label: 'two words with a space' },
      { expected: 'lazy-giraffe', input: 'lazy-giraffe', label: 'the stored hyphenated form' },
      { expected: 'lazy-giraffe', input: '  Lazy Giraffe  ', label: 'mixed case and surrounding whitespace' },
      { expected: 'lazy-giraffe', input: 'lazy_giraffe', label: 'underscores instead of hyphens' },
      { expected: 'lazy-giraffe', input: '__lazy__giraffe__', label: 'runs of underscores at both ends' },
      { expected: 'lazy-giraffe', input: 'LAZY--GIRAFFE', label: 'a doubled hyphen in the middle' },
      { expected: 'lazy-giraffe', input: 'lazy\tgiraffe', label: 'a tab between the words' },
      { expected: atMaxLength, input: atMaxLength, label: 'a value exactly at the length cap' },
    ])('resolves $label', ({ input, expected }) => {
      expect(parseSessionCode(input)).toBe(expected)
    })
  })

  describe('what people paste', () => {
    it.each([
      {
        expected: 'lazy-giraffe',
        input: 'https://pickatime.dbowland.com/p/lazy-giraffe',
        label: 'a full poll URL on this origin',
      },
      {
        expected: 'lazy-giraffe',
        input: 'https://pickatime.dbowland.com/p/lazy-giraffe?ref=sms#top',
        label: 'a poll URL with a query and a fragment',
      },
      {
        expected: 'lazy-giraffe',
        input: 'pickatime.dbowland.com/p/lazy-giraffe',
        label: 'a poll URL with no scheme',
      },
      {
        expected: 'lazy-giraffe',
        input: '//pickatime.dbowland.com/p/lazy-giraffe',
        label: 'a scheme-relative poll URL',
      },
      {
        expected: 'lazy-giraffe',
        input: 'https://pickatime.dbowland.com/p/Lazy_Giraffe',
        label: 'a poll URL whose segment still needs normalizing',
      },
      {
        expected: 'lazy-giraffe',
        input: 'https://pickatime.dbowland.com/p/lazy%20giraffe',
        label: 'a poll URL that is percent-encoded once',
      },
    ])('resolves $label', ({ input, expected }) => {
      expect(parseSessionCode(input)).toBe(expected)
    })

    it('takes only the path segment from a URL on a foreign host, never the host', () => {
      // The open-redirect guard. The caller routes the return value on this origin, so the only way a
      // foreign host could send someone elsewhere is if the host survived this call. It must not.
      const result = parseSessionCode('https://evil.example.com/p/lazy-giraffe')

      expect(result).toBe('lazy-giraffe')
      expect(result).not.toContain('evil.example.com')
    })

    it.each([
      { expected: 'pancake', input: '//evil.example.com/p/pancake', label: 'a scheme-relative foreign URL' },
      {
        expected: 'pancake',
        input: 'https://someone@evil.example.com/p/pancake',
        label: 'a foreign URL carrying userinfo',
      },
      {
        expected: 'pancake',
        input: 'https://evil.example.com:8443/p/pancake',
        label: 'a foreign URL carrying a port',
      },
    ])('yields only the segment from $label', ({ input, expected }) => {
      expect(parseSessionCode(input)).toBe(expected)
      expect(parseSessionCode(input)).not.toContain('evil.example.com')
    })
  })

  describe('the HOST_LIKE rescue — a poll link that lost its /p/', () => {
    // A link retyped or truncated in transit misses the /p/ path, matches HOST_LIKE, and still
    // resolves to the code the person was actually sent. Deleting that branch takes this with it.
    it.each([
      { expected: 'lazy-giraffe', input: 'pickatime.dbowland.com/lazy-giraffe', label: 'a bare host and code' },
      {
        expected: 'lazy-giraffe',
        input: 'pickatime.dbowland.com/lazy-giraffe?ref=sms',
        label: 'a bare host, code, and query',
      },
      {
        expected: 'about',
        input: 'https://pickatime.dbowland.com/about',
        label: 'an absolute URL with some other path',
      },
    ])('resolves $label to its last segment', ({ input, expected }) => {
      expect(parseSessionCode(input)).toBe(expected)
    })
  })

  describe('refusals — a value that could mean something other than itself', () => {
    it.each([
      { input: '..', label: 'a bare double dot' },
      { input: 'lazy/../admin', label: 'a traversal inside a typed code' },
      { input: '%2e%2e', label: 'a percent-encoded double dot' },
      { input: '%252e%252e', label: 'a double-encoded double dot, which decodes once to a residual percent' },
      { input: 'lazy%2525giraffe', label: 'a percent sign that survives one decode' },
      { input: 'lazy/giraffe', label: 'a path separator' },
      { input: 'lazy\\giraffe', label: 'a backslash' },
      { input: 'lazy:giraffe', label: 'a colon' },
      { input: 'lazy?giraffe', label: 'a query marker' },
      { input: 'lazy#giraffe', label: 'a fragment marker' },
      { input: 'lazy.giraffe', label: 'a dot' },
      { input: 'lazy\u202Egiraffe', label: 'a right-to-left override' },
      { input: 'lazy\u0000giraffe', label: 'a NUL' },
      { input: 'lazy\u200Bgiraffe', label: 'a zero-width space' },
      { input: '', label: 'nothing at all' },
      { input: '   ', label: 'whitespace only' },
      { input: '-', label: 'a lone hyphen' },
      { input: '___', label: 'underscores only' },
      { input: 'https://pickatime.dbowland.com/p/', label: 'a poll URL whose segment is empty' },
      { input: '//', label: 'a URL with no segments at all' },
      { input: 'https://pickatime.dbowland.com/', label: 'a bare origin, whose last segment is the host' },
      { input: overMaxLength, label: 'a value one character over the length cap' },
    ])('refuses $label', ({ input }) => {
      expect(parseSessionCode(input)).toBeUndefined()
    })
  })

  describe('undecodable input fails as a refusal, not as a throw', () => {
    // decodeURIComponent throws URIError on these. Uncaught, that escapes a React event handler where
    // ErrorBoundary cannot catch it, and the submit dies with nothing on screen to explain it.
    it.each([
      { input: '50% off', label: 'a percent followed by a space' },
      { input: '100%', label: 'a trailing percent' },
      { input: '%zz', label: 'a percent followed by non-hex digits' },
      { input: '%ED%A0%80', label: 'a percent-encoded lone surrogate' },
      // The LITERAL form, not just the encoded one. This is the case that would break at the point
      // of use rather than here: `encodeURIComponent('\uD800')` throws URIError, so a surrogate
      // reaching the caller would throw inside a React event handler where ErrorBoundary cannot
      // catch it. Nothing else in this suite pins `\p{C}`'s Cs coverage, so without this a future
      // narrowing of UNSAFE would pass every other test and fail only in a browser.
      { input: 'lazy\uD800giraffe', label: 'a literal lone surrogate' },
    ])('refuses $label without throwing', ({ input }) => {
      expect(() => parseSessionCode(input)).not.toThrow()
      expect(parseSessionCode(input)).toBeUndefined()
    })

    it('never returns a value that encodeURIComponent would reject', () => {
      // The guarantee the caller actually depends on, stated once as a property rather than as a
      // list of inputs: whatever comes out of here must survive being put into a URL path.
      const survivors = ['lazy giraffe', 'lazy-giraffe', 'pickatime.dbowland.com/lazy-giraffe', 'standup', '1234']
        .map((input) => parseSessionCode(input))
        .filter((code): code is string => code !== undefined)

      expect(survivors).toHaveLength(5)
      survivors.forEach((code) => expect(() => encodeURIComponent(code)).not.toThrow())
    })
  })

  describe('this is a safety rule, not a format rule', () => {
    // Poll codes come from another repository. A shape check here — word count, character set,
    // adjective-noun — makes every valid code unenterable the day that generator changes.
    it.each([
      { expected: 'standup', input: 'standup', label: 'a single word' },
      { expected: 'lazy-giraffe-2', input: 'lazy-giraffe-2', label: 'adjective-noun with a numeric suffix' },
      { expected: 'lazy-giraffe-runs', input: 'lazy-giraffe-runs', label: 'three words' },
      { expected: '1234', input: '1234', label: 'digits only' },
      { expected: 'q', input: 'q', label: 'a single character' },
      {
        expected: 'a-code-no-current-generator-would-produce',
        input: 'a-code-no-current-generator-would-produce',
        label: 'a long safe segment',
      },
      { expected: 'perezoso-jirafa-ñ', input: 'perezoso-jirafa-ñ', label: 'non-ASCII letters' },
      { expected: '🦒', input: '🦒', label: 'an emoji' },
    ])('returns $label rather than refusing it for its shape', ({ input, expected }) => {
      expect(parseSessionCode(input)).toBe(expected)
    })
  })
})
