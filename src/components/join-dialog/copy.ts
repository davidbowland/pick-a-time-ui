/**
 * Every string the join surfaces can put on screen, in one place.
 *
 * Final after a three-lens copy review (UX, Pinker, voice-against-sample). The diagnosis comes
 * first and the recovery is an imperative; pre-request validation is a fragment with no stop, and
 * post-request failures are full sentences with one. Changing a string here is a copy decision, not
 * a code change.
 *
 * **This lives in its own module, apart from `elements.tsx`, for a bundling reason.** `elements.tsx`
 * opens with `import { Modal } from '@heroui/react'`, and `JoinTrigger` — which ships in the landing
 * page's prerendered markup and is therefore statically imported by `pages/index.tsx` — needs two of
 * these strings for the `door` and `dock` labels. Reading them from `elements.tsx` pulls HeroUI's
 * `Modal` and the react-aria overlay tree into `/`'s first-paint chunk, measured: `modal__dialog`
 * moves out of the async chunks and into a chunk `out/index.html` loads on first paint. Splitting
 * the strings out is what lets the trigger name itself without paying for the surface it opens.
 *
 * `elements.tsx` re-exports this so every existing `from './elements'` import keeps working.
 */
export const JOIN_COPY = {
  closeLabel: 'Close',
  empty: 'Enter your poll code or link',
  fieldLabel: 'Poll code or link',
  /** Shown while the lookup is in flight, on the submit button and in the status region. */
  finding: 'Finding your poll…',
  firstMiss: (spokenCode: string): string => `Couldn't find ${spokenCode}. Check the spelling and try again.`,
  firstMissLong: "Couldn't find that poll code. Check the spelling and try again.",
  firstMissNote: "If it's right, the poll may have closed.",
  heading: 'Join a poll',
  hint: 'Like lazy giraffe. A whole poll link works too.',
  offline: "Couldn't look that up. Check your connection and try again.",
  /**
   * Shown when a pasted poll link opens the panel. It names what was pasted before it names what
   * happened, because the visitor's own action is the only context they have for why a panel
   * appeared. "Goes to a poll" rather than "is a poll link" — the link's destination is the fact
   * that matters, and it is stated as an outcome, not a classification.
   */
  pasteNotice: "That link goes to a poll — here's the code to join it.",
  placeholder: 'lazy giraffe',
  refusal: "Couldn't read that as a poll code.",
  refusalNote: 'Enter the poll code, like lazy giraffe, or paste the whole poll link.',
  secondMiss: 'Still no poll with that code. Check it against what you were sent.',
  secondMissNote: 'If it matches, the poll may have closed. Ask whoever sent it for the link.',
  serverFailure: 'Something went wrong looking that up. Try again.',
  submit: 'Join poll',
  successCode: (spokenCode: string): string => `Poll code: ${spokenCode}`,
  successHeadline: (pollName: string): string => `Opening ${pollName}…`,
}
