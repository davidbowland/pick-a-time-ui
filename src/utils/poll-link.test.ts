/**
 * @jest-environment-options {"url": "https://pick-a-time.com/"}
 */
import { extractPollLinkCode } from './poll-link'

describe('extractPollLinkCode', () => {
  it('takes the segment from a full poll link', () => {
    expect(extractPollLinkCode('https://pick-a-time.com/p/lazy-giraffe')).toBe('lazy-giraffe')
  })

  // Stricter than the join FIELD's rule, on purpose. Typing a code into the field is deliberate, so
  // taking the segment from any host is right there. This gate pre-empts the visitor's own paste, and
  // any `.../p/...` URL on the web has the shape of a poll link -- Instagram's most famously.
  it("refuses a poll-shaped path on somebody else's host", () => {
    expect(extractPollLinkCode('https://evil.example/p/lazy-giraffe')).toBeUndefined()
  })

  it('refuses an Instagram link, which is exactly this shape', () => {
    // One `/p/`, and parseSessionCode lowercases and maps `_` to `-` into a valid `dabc-123`.
    expect(extractPollLinkCode('https://www.instagram.com/p/DAbc_123/')).toBeUndefined()
  })

  it('takes a link on our own host', () => {
    expect(extractPollLinkCode('https://pick-a-time.com/p/lazy-giraffe')).toBe('lazy-giraffe')
  })

  it('reads the host case-insensitively', () => {
    expect(extractPollLinkCode('https://PICK-A-TIME.com/p/lazy-giraffe')).toBe('lazy-giraffe')
  })

  it('takes the segment from a link with no host at all', () => {
    expect(extractPollLinkCode('/p/lazy-giraffe')).toBe('lazy-giraffe')
  })

  it('drops the query and fragment a share sheet appended', () => {
    expect(extractPollLinkCode('https://pick-a-time.com/p/lazy-giraffe?utm=sms#top')).toBe('lazy-giraffe')
  })

  it('finds the link inside the message it was pasted with', () => {
    expect(extractPollLinkCode('Join us: https://pick-a-time.com/p/lazy-giraffe thanks!')).toBe('lazy-giraffe')
  })

  // The one that decides the whole design. `parseSessionCode` accepts this happily, so a gate built on
  // shape would fire on every two-word paste on the page -- including a poll NAME being pasted into
  // "Name your poll", which is the same two words.
  it('ignores two spoken words, because those are also a poll name', () => {
    expect(extractPollLinkCode('lazy giraffe')).toBeUndefined()
  })

  it('ignores a bare hyphenated code, which is also a poll name', () => {
    expect(extractPollLinkCode('lazy-giraffe')).toBeUndefined()
  })

  it('refuses an ambiguous string carrying two poll paths', () => {
    expect(extractPollLinkCode('/p/one and /p/two')).toBeUndefined()
  })

  it('refuses a poll path with nothing after it', () => {
    expect(extractPollLinkCode('https://pick-a-time.com/p/')).toBeUndefined()
  })

  it('refuses a poll path followed only by a query', () => {
    expect(extractPollLinkCode('https://pick-a-time.com/p/?utm=sms')).toBeUndefined()
  })

  it('refuses a segment the parser rejects', () => {
    expect(extractPollLinkCode('https://pick-a-time.com/p/..%2F..')).toBeUndefined()
  })

  it('refuses empty text', () => {
    expect(extractPollLinkCode('')).toBeUndefined()
  })
})
