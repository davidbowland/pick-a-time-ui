/**
 * Returns true when the session error message indicates the closing-soon
 * filter removed too many restaurants.
 */
export function isClosingSoonError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) return false
  return errorMessage.includes('closing-soon filter')
}
