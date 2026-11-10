/**
 * A poll code as people read it aloud: `lazy-giraffe` becomes `lazy giraffe`.
 *
 * Codes are stored hyphenated, and everything on screen uses this spoken form — the poll header, the
 * QR modal and the join dialog's messages — because the point of a code is being said out loud.
 */
export const toSpokenCode = (code: string): string => code.replace(/-/g, ' ')
