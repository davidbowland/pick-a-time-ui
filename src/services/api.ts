// Requests go through `fetch`, not Amplify's REST client (`aws-amplify/api`), on purpose.
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
// Amplify still owns auth (`aws-amplify/auth`): the Cognito session and the OAuth redirect flow.
import { fetchAuthSession } from 'aws-amplify/auth'

import { baseUrl } from '@config/amplify'
import {
  AvailabilityPatchRequest,
  AvailabilityRecord,
  ConfigData,
  ErrorCode,
  NewPollRequest,
  PatchOperation,
  PollData,
  Slot,
  User,
} from '@types'

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
    const session = await fetchAuthSession()
    const token = session.tokens?.idToken?.toString()
    if (token) return { Authorization: `Bearer ${token}` }
  } catch {
    // Not signed in
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
          await fetchAuthSession({ forceRefresh: true })
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

export const patchUser = (
  sessionId: string,
  userId: string,
  operations: PatchOperation[],
  authenticated: boolean,
): Promise<User> =>
  apiSend(
    'PATCH',
    `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}`,
    authenticated,
    operations,
  )

export const fetchAvailability = (sessionId: string, userId: string): Promise<AvailabilityRecord> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/availability`)

export const patchAvailability = (
  sessionId: string,
  userId: string,
  body: AvailabilityPatchRequest,
): Promise<AvailabilityRecord> =>
  apiSend(
    'PATCH',
    `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/availability`,
    false,
    body,
  )

export interface CalendarState {
  status: 'not_connected' | 'connected' | 'error'
  lastSyncedAt: number | null
}

export interface CalendarSyncResult {
  applied: boolean
  markedBusyCount: number
  lastSyncedAt: number
  availability: AvailabilityRecord
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
