/**
 * Whether a thrown value carries a particular HTTP status.
 *
 * Read structurally rather than with `instanceof ApiError`: the status is the fact that matters, and
 * a check that depends on class identity fails quietly wherever the class is duplicated -- two
 * copies of the module, or an automocked `@services/api`, which is what every component test does.
 *
 * It lives in `utils` rather than beside `ApiError` for that second reason. A component that mocks
 * `@services/api` wholesale cannot import a predicate from it: the automock returns `undefined` for
 * every call, so the branch it guards silently disappears -- a refusal stops reading as a refusal
 * with nothing on screen to say so. Nothing mocks this module, so the check survives.
 */
export const hasStatusCode = (err: unknown, statusCode: number): boolean =>
  (err as { response?: { statusCode?: number } } | null | undefined)?.response?.statusCode === statusCode
