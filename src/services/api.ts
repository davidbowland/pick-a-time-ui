import { ApiError, get, patch, post } from 'aws-amplify/api'
import { fetchAuthSession } from 'aws-amplify/auth'

import { apiName, apiNameUnauthenticated } from '@config/amplify'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBody = any

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

function endpointFor(authenticated: boolean): string {
  return authenticated ? apiName : apiNameUnauthenticated
}

// --- Helpers ---

async function apiGet<T>(
  path: string,
  queryParams?: Record<string, string>,
  headers?: Record<string, string>,
): Promise<T> {
  const { body } = await get({ apiName: apiNameUnauthenticated, path, options: { headers, queryParams } }).response
  return body.json() as Promise<T>
}

async function apiPost<T>(
  path: string,
  authenticated: boolean,
  reqBody?: AnyBody,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers = authenticated ? { ...(await authHeaders()), ...extraHeaders } : extraHeaders
  const { body } = await post({
    apiName: endpointFor(authenticated),
    path,
    options: { headers, body: reqBody },
  }).response
  return body.json() as Promise<T>
}

async function apiPatch<T>(path: string, authenticated: boolean, reqBody?: AnyBody): Promise<T> {
  const headers = authenticated ? await authHeaders() : undefined
  const { body } = await patch({
    apiName: endpointFor(authenticated),
    path,
    options: { headers, body: reqBody },
  }).response
  return body.json() as Promise<T>
}

// --- Public API ---

export const fetchConfig = (): Promise<ConfigData> => apiGet('/config')

export const createPoll = (poll: NewPollRequest, token: string): Promise<{ sessionId: string }> =>
  apiPost('/sessions', false, poll, { 'x-recaptcha-token': token })

export const createPollAuthed = (poll: NewPollRequest): Promise<{ sessionId: string }> =>
  apiPost('/sessions/authed', true, poll)

export const fetchPoll = (sessionId: string): Promise<PollData> => apiGet(`/sessions/${encodeURIComponent(sessionId)}`)

export const fetchUsers = (sessionId: string): Promise<User[]> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/users`)

export const createUser = async (sessionId: string, authenticated: boolean): Promise<User> => {
  const encodedId = encodeURIComponent(sessionId)
  if (!authenticated) {
    return apiPost(`/sessions/${encodedId}/users`, false, {})
  }
  try {
    return await apiPost<User>(`/sessions/${encodedId}/users/authed`, true, {})
  } catch (err) {
    if (err instanceof ApiError && err.response) {
      if (err.response.statusCode === 401) {
        try {
          await fetchAuthSession({ forceRefresh: true })
        } catch {
          return apiPost(`/sessions/${encodedId}/users`, false, {})
        }
        try {
          return await apiPost<User>(`/sessions/${encodedId}/users/authed`, true, {})
        } catch (retryErr) {
          if (
            retryErr instanceof ApiError &&
            retryErr.response &&
            (retryErr.response.statusCode === 401 || retryErr.response.statusCode === 403)
          ) {
            return apiPost(`/sessions/${encodedId}/users`, false, {})
          }
          throw retryErr
        }
      }
      if (err.response.statusCode === 403) {
        return apiPost(`/sessions/${encodedId}/users`, false, {})
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
  apiPatch(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}`, authenticated, operations)

export const fetchAvailability = (sessionId: string, userId: string): Promise<AvailabilityRecord> =>
  apiGet(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/availability`)

export const patchAvailability = (
  sessionId: string,
  userId: string,
  body: AvailabilityPatchRequest,
): Promise<AvailabilityRecord> =>
  apiPatch(`/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/availability`, false, body)

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
  excludedByCalendar: string[]
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
  if (err instanceof ApiError && err.response) {
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
