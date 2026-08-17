// Requests go through `fetch`, not Amplify's REST client, on purpose.
//
// 1. Amplify v6 retries every failed request up to three times -- on a network error, a 429, or a
//    500/502/503/504 -- with no way to opt out per call. A gateway timeout on a request the server
//    did in fact process therefore replays it: `POST /sessions` creates a second poll, and
//    `POST /sessions/{id}/users` adds phantom voters to a poll that then reads as "full". Amplify
//    v5 never retried, so upgrading added that replay silently. A failed write must surface to the
//    person who made it, not be repeated behind their back.
// 2. The REST client was earning nothing here. There is no identity pool, so it never resolves
//    credentials and never signs anything with SigV4; the Cognito bearer token is attached by hand
//    below. What remained was joining a base URL to a path -- at the cost of typing bodies as
//    `DocumentType` (an `any` escape hatch) and casting every response.
//
// Amplify still owns auth -- the Cognito session and the OAuth redirect flow -- but this module
// reaches it only through `@services/auth`, which hides it behind a dynamic import. Importing it
// here would pull 78 KB gzip of Cognito client into the landing page's chunk, because `pages/index`
// imports this module.
import { baseUrl } from '@config/api'
import { getIdToken } from '@services/auth'
import {
  AvailabilityPatchRequest,
  AvailabilityRecord,
  CalendarStatus,
  ConfigData,
  DateWindow,
  ErrorCode,
  NewPollRequest,
  OwnerAvailabilityRecord,
  PatchOperation,
  PollData,
  Slot,
  User,
} from '@types'
import { hasStatusCode } from '@utils/http-status'

// --- Errors ---

export interface ApiErrorResponse {
  body: string
  headers: Record<string, string>
  statusCode: number
}

/**
 * Thrown for any non-2xx response. `response` carries the raw status and body so callers can
 * branch on the status and read the API's `message`/`errorCode` fields out of the body.
 */
export class ApiError extends Error {
  readonly response: ApiErrorResponse

  constructor(message: string, response: ApiErrorResponse) {
    super(message)
    this.name = 'ApiError'
    this.response = response
  }
}

// --- Auth ---

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const token = await getIdToken()
    if (token) return { Authorization: `Bearer ${token}` }
  } catch {
    // Not signed in, or the auth chunk could not be fetched. Either way, send the request
    // unauthenticated and let the API answer.
  }
  return {}
}

// --- Helpers ---

interface RequestOptions {
  body?: unknown
  headers?: Record<string, string>
}

async function send(method: string, path: string, { body, headers = {} }: RequestOptions = {}): Promise<Response> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    method,
  })
  if (!response.ok) {
    throw new ApiError(`${method} ${path} responded with ${response.status}`, {
      body: await response.text(),
      headers: Object.fromEntries(response.headers),
      statusCode: response.status,
    })
  }
  return response
}

async function sendJson<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
  const response = await send(method, path, options)
  return response.json() as Promise<T>
}

const apiGet = <T>(path: string): Promise<T> => sendJson<T>('GET', path)

const apiGetAuthed = async <T>(path: string): Promise<T> => sendJson<T>('GET', path, { headers: await authHeaders() })

// 204 No Content -- there is no body to parse, and calling response.json() on one throws.
const apiDel = async (path: string): Promise<void> => {
  await send('DELETE', path, { headers: await authHeaders() })
}

async function apiSend<T>(
  method: 'PATCH' | 'POST',
  path: string,
  authenticated: boolean,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers = authenticated ? { ...(await authHeaders()), ...extraHeaders } : extraHeaders
  return sendJson<T>(method, path, { body, headers })
}

// --- Public API ---

export const fetchConfig = (): Promise<ConfigData> => apiGet('/config')

export const createPoll = (poll: NewPollRequest, token: string): Promise<{ sessionId: string }> =>
  apiSend('POST', '/sessions', false, poll, { 'x-recaptcha-token': token })

export const createPollAuthed = (poll: NewPollRequest): Promise<{ sessionId: string }> =>
  apiSend('POST', '/sessions/authed', true, poll)

export const fetchPoll = (sessionId: string): Promise<PollData> => apiGet(`/sessions/${encodeURIComponent(sessionId)}`)

export const fetchUsers = (sessionId: string): Promise<User[]> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/users`)

export const createUser = async (sessionId: string, authenticated: boolean): Promise<User> => {
  const encodedId = encodeURIComponent(sessionId)
  if (!authenticated) {
    return apiSend('POST', `/sessions/${encodedId}/users`, false, {})
  }
  try {
    return await apiSend<User>('POST', `/sessions/${encodedId}/users/authed`, true, {})
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.response.statusCode === 401) {
        try {
          await getIdToken({ forceRefresh: true })
        } catch {
          return apiSend('POST', `/sessions/${encodedId}/users`, false, {})
        }
        try {
          return await apiSend<User>('POST', `/sessions/${encodedId}/users/authed`, true, {})
        } catch (retryErr) {
          if (
            retryErr instanceof ApiError &&
            (retryErr.response.statusCode === 401 || retryErr.response.statusCode === 403)
          ) {
            return apiSend('POST', `/sessions/${encodedId}/users`, false, {})
          }
          throw retryErr
        }
      }
      if (err.response.statusCode === 403) {
        return apiSend('POST', `/sessions/${encodedId}/users`, false, {})
      }
    }
    throw err
  }
}

// The authenticated variant is a different ROUTE, not the same route with a header: the unsuffixed
// one is deployed with `Authorizer: NONE`, so API Gateway strips Authorization before the handler
// runs and every authed-only side effect is silently skipped. See `claimUser` for the one that
// matters.
const userPath = (sessionId: string, userId: string, authenticated: boolean): string =>
  `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}${authenticated ? '/authed' : ''}`

export const patchUser = (
  sessionId: string,
  userId: string,
  operations: PatchOperation[],
  authenticated: boolean,
): Promise<User> => apiSend('PATCH', userPath(sessionId, userId, authenticated), authenticated, operations)

/**
 * Links a participant to the signed-in Google account, so the calendar routes recognize it as
 * theirs.
 *
 * Somebody who joins a poll before signing in gets a participant with no account attached, and
 * signing in afterwards does not attach one. The API links the two on any authenticated PATCH of an
 * unlinked participant -- the body is beside the point, so this sends no operations and changes
 * nothing else. It is a no-op on a participant already linked to this account.
 *
 * On one linked to a DIFFERENT account it answers 403, and that answer is the only way a client can
 * learn whose participant it is: `GET /users` strips googleSub from every response. Callers should
 * treat the refusal as "this is not you", not as a failure to retry.
 */
export const claimUser = (sessionId: string, userId: string): Promise<User> =>
  apiSend('PATCH', userPath(sessionId, userId, true), true, [])

export const fetchAvailability = (sessionId: string, userId: string): Promise<AvailabilityRecord> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/availability`)

const availabilityPath = (sessionId: string, userId: string, authenticated: boolean): string =>
  `${userPath(sessionId, userId, false)}/availability${authenticated ? '/authed' : ''}`

/**
 * Reads a participant's availability as its owner, so the response may carry their calendar.
 *
 * The authenticated route is the only one in the API that serves busy data, and it serves it only
 * to the participant it belongs to. Everything else -- `GET .../availability`, `GET .../overlap`,
 * `GET /users` -- is deliberately incapable of emitting it.
 *
 * **On 401 or 403 this resolves, it does not reject.** Somebody who joined a poll before signing in
 * has a participant with a null `googleSub` until an authenticated PATCH links it, and the
 * authenticated read refuses an unlinked record rather than claiming it. That claim fires in the
 * poll's parent component, *after* this query has already mounted, so every signed-in joiner's first
 * load races it and would otherwise see the caller render nothing at all: a blank grid, not a
 * calendar-less one (AC-044). A participant with no linked record is a normal state.
 *
 * The fallback lives here rather than in the caller for two reasons. It keeps the refusal from ever
 * reaching react-query, which would latch it as a query error and needs a second query to recover
 * from; and it means a caller can treat this as "the availability read" with one result shape and
 * no knowledge that two routes exist. `createUser` handles its own 401/403 the same way.
 *
 * What comes back from the fallback is the open record and nothing else -- no `busy`, no
 * `calendarStatus`, no `busyWindow`. That read genuinely learned nothing about a calendar, and
 * synthesizing `not_connected` here would assert something this client cannot know.
 *
 * `busy` is returned exactly as the server built it. See `OwnerAvailabilityRecord`.
 */
export const fetchAvailabilityAuthed = async (sessionId: string, userId: string): Promise<OwnerAvailabilityRecord> => {
  try {
    return await apiGetAuthed<OwnerAvailabilityRecord>(availabilityPath(sessionId, userId, true))
  } catch (err) {
    if (err instanceof ApiError && (err.response.statusCode === 401 || err.response.statusCode === 403)) {
      return apiGet<AvailabilityRecord>(availabilityPath(sessionId, userId, false))
    }
    // Any other status is a real failure. Swallowing it into a calendar-less grid would render an
    // outage as a permanent, silent "you have no calendar".
    throw err
  }
}

/**
 * Writes painted cells. Signed in, this goes through the authenticated route.
 *
 * Not for the sake of the write -- it is the same write either way -- but for what the API can see:
 * the anonymous route is deployed with `Authorizer: NONE`, so it cannot tell that the participant
 * being painted belongs to a different Google account. The authenticated one refuses that, which is
 * how somebody finds out before they have filled in a grid they will be refused the calendar on.
 */
export const patchAvailability = (
  sessionId: string,
  userId: string,
  body: AvailabilityPatchRequest,
  authenticated: boolean,
): Promise<AvailabilityRecord> =>
  apiSend('PATCH', availabilityPath(sessionId, userId, authenticated), authenticated, body)

export interface CalendarState {
  status: CalendarStatus
  lastSyncedAt: number | null
}

/**
 * What a calendar check answers with.
 *
 * A check writes nothing. It refreshes the cached intervals from Google and returns the grid it
 * just read, so there is no `applied` (nothing is applied), no `markedBusyCount` (nothing is
 * marked), and no `availability` (stored availability is not read, let alone written). What is left
 * is the same three calendar values the authenticated read serves -- assembled server-side as one
 * unit so they can never come from different reads -- plus the timestamp of the check.
 *
 * `busy` carries the same indexing caveat as `OwnerAvailabilityRecord['busy']`: slot indices are
 * per-date, not per union column.
 */
export interface CalendarSyncResult {
  busy: boolean[][]
  busyWindow: DateWindow | null
  calendarStatus: CalendarStatus
  lastSyncedAt: number
}

export const connectCalendar = (
  sessionId: string,
  userId: string,
): Promise<{ alreadyConnected: boolean; authUrl?: string }> =>
  apiSend(
    'POST',
    `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/calendar/connect`,
    true,
  )

export const syncCalendar = (sessionId: string, userId: string, force: boolean): Promise<CalendarSyncResult> =>
  apiSend(
    'POST',
    `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/calendar/sync`,
    true,
    {
      force,
    },
  )

// No arguments: a calendar connection belongs to a Google account, not a poll, and the JWT
// identifies it. Disconnecting therefore works with no poll in context.
export const fetchCalendarState = (): Promise<CalendarState> => apiGetAuthed('/calendar')

export const disconnectCalendar = (): Promise<void> => apiDel('/calendar')

export interface OverlapCell extends Slot {
  dateIndex: number
  freeCount: number
  freeUserIds: string[]
}

export interface RecommendedMeeting extends Slot {
  dateIndex: number
  date: string
  freeCount: number
  freeUserIds: string[]
}

export interface OverlapResponse {
  grid: {
    cells: OverlapCell[][]
    bestSlot: { dateIndex: number; slotIndex: number; freeCount: number; freeUserIds: string[] }
  }
  recommendedMeetings: RecommendedMeeting[]
}

export const fetchOverlap = (sessionId: string): Promise<OverlapResponse> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/overlap`)

export function parseApiMessage(body: string | undefined, fallback: string): string {
  return parseBodyField(body, 'message') ?? fallback
}

/**
 * Re-exported so callers already holding this module keep one import.
 *
 * The implementation lives in `@utils/http-status` because a component that mocks this module
 * wholesale cannot use the copy exported from here -- see the note there.
 */
export { hasStatusCode }

export function hasErrorCode(err: unknown, code: ErrorCode): boolean {
  if (err instanceof ApiError) {
    if (err.response.statusCode !== 400 || !err.response.body) return false
    return parseBodyField(err.response.body, 'errorCode') === code
  }
  return false
}

function parseBodyField(body: string | undefined, field: string): string | undefined {
  try {
    const parsed = JSON.parse(body ?? '{}') as Record<string, unknown>
    const value = parsed[field]
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}
