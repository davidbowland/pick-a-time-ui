# Project Guidelines

**Always commit changes** after completing work unless explicitly told not to.

Use functional programming style where practical, including dependency injection, avoiding mutating objects or values, etc.

## Testing Standards

**Jest clears all mocks automatically** (`clearMocks: true` in jest.config.js). Never manually clear mocks.

**Mock state:** Set shared defaults in `beforeAll`. Override per-test with `mockReturnValueOnce` / `mockResolvedValueOnce` / `mockRejectedValueOnce`. Never use `beforeEach` — write a named `setup()` function if repeated arrangement is needed and call it explicitly.

**Typing mocks:** Use `jest.mocked(fn)` to get a typed mock, not `fn as jest.Mock`. Call it inline at each use site — it doesn't need to be hoisted into its own variable:

```ts
// avoid
;(getIdToken as jest.Mock).mockReturnValue('token')

// prefer
jest.mocked(getIdToken).mockReturnValue('token')
```

**Non-determinism:** Any function that uses `Date.now()`, `Math.random()`, or `crypto.randomUUID()` to produce a value that affects test outcomes MUST accept it as an injectable parameter with a default:

```ts
// source
export const createThing = (input: Input, now = Date.now): Thing => ({ ...input, createdAt: now() })

// test
it('sets createdAt', () => {
  expect(createThing(input, () => 1_000_000).createdAt).toBe(1_000_000)
})
```

**Fake timers:** Use `jest.useFakeTimers()` in `beforeAll` (and `jest.useRealTimers()` in `afterAll`) when the code under test calls `setTimeout`, `setInterval`, or `Date` internally without injection.

**No CSS or style assertions.** Test observable behavior: return values, thrown errors, calls to collaborators.

**No `if` statements in tests.** No live `Date.now()` or `Math.random()` calls in test bodies. No date arithmetic that depends on the current wall-clock time.

**Deterministic above all.** A test that passes today and fails tomorrow is broken.

## Accessibility

**All designs must meet WCAG AA.** This includes: sufficient color contrast (4.5:1 for normal text, 3:1 for large text), full keyboard navigability, visible focus indicators, appropriate ARIA roles/labels, and no content that relies on color alone. Run an accessibility audit before marking UI work complete.

## Copy and UX Writing

**All user-facing copy, CTAs, labels, and error messages must be reviewed by a UX expert and by Steven Pinker's principles** (plain language, active voice, concrete nouns, no jargon, no weasel words). Apply the suggested changes unless they conflict with technical constraints.
