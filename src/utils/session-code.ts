/**
 * Turns whatever a person types or pastes into a poll code, or into nothing.
 *
 * The two accepted inputs are the same thing wearing different clothes: the two words somebody read
 * out (`lazy giraffe`), and the link they couldn't open (`https://…/p/lazy-giraffe`). Asking which one
 * they're holding is the question this function exists to stop the UI from asking.
 *
 * A second copy of this file lives at `../choosee-ui/src/utils/session-code.ts`. The two were kept as
 * copies rather than extracted into a shared package, so a fix made here is NOT a fix made there.
 * Change both, or the divergence starts on the day of the first bug.
 */

/** Long enough for any real URL, short enough that nothing pathological reaches the work below. */
const MAX_INPUT_LENGTH = 512

const SESSION_PATH = /\/p\/([^/?#]*)/
const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i
const HOST_LIKE = /^[^/\s]+\.[^/\s]+\//

/**
 * Anything that would let the value mean something other than itself once it reaches a URL.
 *
 * `%` is the subtle one and the reason this rule terminates where it does. `%252e%252e` decodes ONCE
 * to `%2e%2e`, which contains none of the obvious offenders — and `/p/%2e%2e` resolves to `/`, because
 * the URL parser treats a percent-encoded double dot as a double-dot segment. Decoding twice does not
 * fix that; it moves the same problem up one level. Refusing a residual `%` is what ends the regress.
 *
 * `\p{C}` covers control and format characters — NUL, zero-width spaces, right-to-left overrides.
 * `\s` matches U+FEFF but not U+200B and not the bidi overrides, so without this a code could carry
 * invisible payload into the confirmation line that tells the user what was read.
 *
 * `\p{C}` also subsumes `Cs`, which is the reason a lone surrogate never reaches the caller. That
 * matters more than it looks: `encodeURIComponent('\uD800')` throws `URIError`, so a surrogate that
 * slipped through here would throw at the point of use — the exact failure the try/catch below
 * exists to keep out of a React event handler. `session-code.test.ts` pins it.
 *
 * This is a safety rule, not a format rule. It says "could be a path segment that means itself", never
 * "looks like adjective-noun" — the API owns the shape, and hard-coding it here would make valid codes
 * unenterable behind a silent local refusal the day the generator changes.
 */
const UNSAFE = /[/\\\s?#.%:]|\p{C}/u

/** The part of the input that could be an identifier, before it is decoded or normalized. */
const extractCandidate = (input: string): string | undefined => {
  // A link to a poll, whatever origin it claims. Only the segment is taken, so a foreign origin
  // resolves to a poll code this origin will route rather than to somewhere else entirely.
  const sessionPath = SESSION_PATH.exec(input)
  if (sessionPath) return sessionPath[1]

  // A URL with no `/p/` in it — take its last segment and let the lookup decide.
  //
  // This branch is not dead, and it is not speculative. It is what rescues
  // `pickatime.dbowland.com/lazy-giraffe`: a poll link that lost its `/p/` when it was retyped or
  // truncated in transit. That input misses SESSION_PATH, matches HOST_LIKE, and resolves to the code
  // the person was actually sent. Delete this and that recovery goes with it.
  if (ABSOLUTE_URL.test(input) || HOST_LIKE.test(input)) {
    const segments = input
      .replace(/[?#].*$/, '')
      .split('/')
      .filter(Boolean)
    return segments[segments.length - 1]
  }

  // Bare input. Deliberately returned untouched: a stray `/`, `?` or `#` in something the user typed
  // as a code is a reason to refuse it, not something to quietly strip until it parses.
  return input
}

export const parseSessionCode = (raw: string): string | undefined => {
  if (raw.length > MAX_INPUT_LENGTH) return undefined

  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const candidate = extractCandidate(trimmed)
  if (!candidate) return undefined

  // Throws URIError on `50% off`, `100%`, `%zz`. Uncaught, that escapes a React event handler, where
  // ErrorBoundary cannot catch it, and the submit dies with nothing on screen to explain it.
  let decoded: string
  try {
    decoded = decodeURIComponent(candidate)
  } catch {
    return undefined
  }

  const normalized = decoded
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!normalized || UNSAFE.test(normalized)) return undefined

  return normalized
}
