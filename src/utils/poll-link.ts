import { parseSessionCode } from './session-code'

/** Every `/p/` in the pasted text. Two of them means the text is ambiguous about which poll it names. */
const POLL_PATHS = /\/p\//g

/** Where the segment ends: the next path separator, query, fragment or whitespace. */
const SEGMENT_END = /[/?#\s]/

/** `https://`, `//`, or nothing — whatever precedes the authority. */
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\/|^\/\//i

/**
 * The authority in whatever precedes `/p/`, or `undefined` when the link is relative.
 *
 * Only the last whitespace-delimited token counts, because a pasted link usually arrives inside a
 * message ("Join us: https://pick-a-time.com/p/lazy-giraffe thanks!"). And a token only counts as an
 * authority if it looks like one — a dot, or `localhost` — so the prose in "Join us: /p/lazy-giraffe"
 * is not mistaken for a foreign host.
 */
const hostOf = (prefix: string): string | undefined => {
  const token = prefix.trim().split(/\s+/).pop() ?? ''
  const authority = token.replace(SCHEME, '').split('/')[0].toLowerCase()
  const looksLikeHost = authority.includes('.') || authority.startsWith('localhost')
  return looksLikeHost ? authority : undefined
}

/**
 * The code inside an unambiguous poll link *of ours*, or nothing.
 *
 * Deliberately narrower than `parseSessionCode`, and the difference is the whole point. That function
 * is a SAFETY rule, not a format rule — its own comment says so — which is why it turns `Game night`
 * into `game-night`. Gating a page-wide paste on it alone would fire on every two-word paste anywhere
 * on the landing page, including `lazy giraffe` typed as a poll NAME into "Name your poll".
 *
 * So the question asked here is provenance: did this text arrive as a poll LINK, on this origin?
 * Exactly one `/p/`, a non-empty segment after it, that segment surviving the parser — and a host that
 * is either absent (a relative link) or ours.
 *
 * **The host check is not optional, and it is stricter than the join FIELD's rule on purpose.** A code
 * typed into the field is a deliberate act, so taking the segment from any host is right there: someone
 * holding a link from another deployment still gets in, and the segment is re-encoded onto this origin,
 * so a foreign host can never route them away. But this function gates an ambient, document-level paste
 * listener that pre-empts the visitor's own paste. Without the host check,
 * `https://www.instagram.com/p/DAbc_123/` qualifies — one `/p/`, and the parser happily lowercases and
 * maps `_` to `-` into `dabc-123` — so pasting an Instagram link into "Name your poll" would swallow
 * the paste and announce "That link goes to a poll", which is a lie. Any `…/p/…` URL on the web has the
 * same shape.
 */
export const extractPollLinkCode = (
  text: string,
  ourHost: string | undefined = globalThis.location?.host,
): string | undefined => {
  const matches = text.match(POLL_PATHS)
  if (matches?.length !== 1) return undefined

  const [prefix, rest] = text.split('/p/')
  const segment = rest?.split(SEGMENT_END)[0]
  if (!segment) return undefined

  const host = hostOf(prefix ?? '')
  if (host !== undefined && host !== ourHost?.toLowerCase()) return undefined

  return parseSessionCode(segment)
}
