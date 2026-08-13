import {
  ApiError,
  claimUser,
  connectCalendar,
  createPoll,
  createPollAuthed,
  createUser,
  disconnectCalendar,
  fetchAvailability,
  fetchCalendarState,
  fetchConfig,
  fetchOverlap,
  fetchPoll,
  fetchUsers,
  parseApiMessage,
  patchAvailability,
  patchUser,
  syncCalendar,
} from './api'
import { getIdToken } from '@services/auth'

jest.mock('@services/auth')
jest.mock('@config/api', () => ({
  baseUrl: 'http://localhost/v1',
}))

const mockFetch = jest.fn()

const baseUrl = 'http://localhost/v1'
const sessionId = 'fuzzy-penguin'
const userId = 'brave-tiger'
const authHeaders = { Authorization: 'Bearer mock-jwt-token' }
const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }, status })
}

beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch
  jest.mocked(getIdToken).mockResolvedValue('mock-jwt-token')
})

describe('API service', () => {
  describe('request handling', () => {
    it('should throw an ApiError carrying the status and body when the response is not ok', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Nope' }, 400))

      await expect(fetchConfig()).rejects.toMatchObject({
        response: { body: JSON.stringify({ message: 'Nope' }), statusCode: 400 },
      })
    })

    it('should throw an ApiError instance so callers can branch on the status', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Nope' }, 400))

      await expect(fetchConfig()).rejects.toBeInstanceOf(ApiError)
    })

    it('should not replay a failed mutation', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Gateway timeout' }, 504))

      await expect(
        createPoll({ dates: [], name: 'Lunch', timezone: 'UTC', usesTimes: false }, 'token'),
      ).rejects.toThrow('POST /sessions responded with 504')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // getIdToken rejects only when the auth chunk itself cannot be fetched -- a network problem,
    // not evidence about the session. The request still goes out, unauthenticated.
    it('should send no authorization header when the auth chunk cannot be loaded', async () => {
      jest.mocked(getIdToken).mockRejectedValueOnce(new Error('chunk load failed'))
      mockFetch.mockResolvedValueOnce(jsonResponse({ lastSyncedAt: null, status: 'not_connected' }))

      await fetchCalendarState()

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/calendar`, { body: undefined, headers: {}, method: 'GET' })
    })

    it('should send no authorization header when there is no session', async () => {
      jest.mocked(getIdToken).mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce(jsonResponse({ lastSyncedAt: null, status: 'not_connected' }))

      await fetchCalendarState()

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/calendar`, { body: undefined, headers: {}, method: 'GET' })
    })
  })

  describe('fetchConfig', () => {
    it('should GET /config', async () => {
      const config = {
        allowedSlotMinutes: [15, 30, 60, 90, 120],
        defaultSlotMinutes: 60,
        maxPollDateRangeDays: 365,
        maxPollDates: 90,
        maxPollOverrideGroups: 10,
        maxUsersPerSession: 20,
        participantNameMaxLength: 50,
        pollNameMaxLength: 100,
        sessionExpireHours: 336,
        startEndMinuteStep: 15,
      }
      mockFetch.mockResolvedValueOnce(jsonResponse(config))

      const result = await fetchConfig()

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/config`, { body: undefined, headers: {}, method: 'GET' })
      expect(result).toEqual(config)
    })
  })

  describe('createPoll', () => {
    it('should POST to /sessions with the poll body and recaptcha header', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ sessionId: 'amber-harbor' }))

      const poll = {
        dates: ['2025-09-04', '2025-09-05', '2025-09-06'],
        endMinute: 1080,
        name: 'Lunch with friends',
        slotMinutes: 60 as const,
        startMinute: 960,
        timezone: 'America/Chicago',
        usesTimes: true as const,
      }
      const result = await createPoll(poll, 'recaptcha-token')

      expect(result).toEqual({ sessionId: 'amber-harbor' })
      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions`, {
        body: JSON.stringify(poll),
        headers: { 'Content-Type': 'application/json', 'x-recaptcha-token': 'recaptcha-token' },
        method: 'POST',
      })
    })

    it('should POST a dates-only poll body (no startMinute/endMinute/slotMinutes)', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ sessionId: 'amber-harbor' }))

      const poll = {
        dates: ['2025-09-06', '2025-09-13'],
        name: 'Weekend clean-up',
        timezone: 'America/Chicago',
        usesTimes: false as const,
      }
      const result = await createPoll(poll, 'recaptcha-token')

      expect(result).toEqual({ sessionId: 'amber-harbor' })
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/sessions`,
        expect.objectContaining({ body: JSON.stringify(poll), method: 'POST' }),
      )
    })
  })

  describe('createPollAuthed', () => {
    it('should POST to /sessions/authed with auth headers and no recaptcha header', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ sessionId: 'amber-harbor' }))

      const poll = {
        dates: ['2025-09-04', '2025-09-05', '2025-09-06'],
        endMinute: 1080,
        name: 'Lunch with friends',
        slotMinutes: 60 as const,
        startMinute: 960,
        timezone: 'America/Chicago',
        usesTimes: true as const,
      }
      const result = await createPollAuthed(poll)

      expect(result).toEqual({ sessionId: 'amber-harbor' })
      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/authed`, {
        body: JSON.stringify(poll),
        headers: jsonHeaders,
        method: 'POST',
      })
    })
  })

  describe('fetchPoll', () => {
    it('should GET /sessions/{id}', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ sessionId: 'amber-harbor' }))

      await fetchPoll('amber-harbor')

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/amber-harbor`, {
        body: undefined,
        headers: {},
        method: 'GET',
      })
    })
  })

  describe('fetchUsers', () => {
    it('should fetch users for session', async () => {
      const users = [{ name: null, userId }]
      mockFetch.mockResolvedValueOnce(jsonResponse(users))

      const result = await fetchUsers(sessionId)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/${sessionId}/users`, {
        body: undefined,
        headers: {},
        method: 'GET',
      })
      expect(result).toEqual(users)
    })
  })

  describe('createUser', () => {
    const newUser = { name: null, userId: 'clever-fox' }
    const unauthorized = () => jsonResponse({ message: 'Unauthorized' }, 401)
    const forbidden = () => jsonResponse({ message: 'Forbidden' }, 403)

    it('should hit /users/authed with auth headers when authenticated', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(newUser))

      const result = await createUser(sessionId, true)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/${sessionId}/users/authed`, {
        body: '{}',
        headers: jsonHeaders,
        method: 'POST',
      })
      expect(result).toEqual(newUser)
    })

    it('should hit /users without auth when not authenticated', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(newUser))

      const result = await createUser(sessionId, false)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/${sessionId}/users`, {
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      expect(result).toEqual(newUser)
    })

    it('should fall back to /users when /users/authed returns 401', async () => {
      mockFetch
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(jsonResponse(newUser))

      const result = await createUser(sessionId, true)

      expect(jest.mocked(getIdToken)).toHaveBeenCalledTimes(3)
      expect(jest.mocked(getIdToken)).toHaveBeenNthCalledWith(2, { forceRefresh: true })
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockFetch).toHaveBeenNthCalledWith(1, `${baseUrl}/sessions/${sessionId}/users/authed`, expect.anything())
      expect(mockFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/sessions/${sessionId}/users/authed`, expect.anything())
      expect(mockFetch).toHaveBeenNthCalledWith(3, `${baseUrl}/sessions/${sessionId}/users`, expect.anything())
      expect(result).toEqual(newUser)
    })

    it('should fall back to /users when the auth chunk cannot be loaded for the refresh', async () => {
      mockFetch.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(jsonResponse(newUser))
      // getIdToken rejects only when the dynamic import fails -- a refresh that fails resolves to
      // null instead (see the test below). The first call reads the still-valid session for the
      // initial request; the second is the forced refresh, which cannot load the chunk.
      jest.mocked(getIdToken).mockResolvedValueOnce('mock-jwt-token').mockRejectedValueOnce(new Error('chunk failed'))

      const result = await createUser(sessionId, true)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/sessions/${sessionId}/users`, expect.anything())
      expect(result).toEqual(newUser)
    })

    // The refresh-failed path proper: getIdToken swallows a dead or unreachable session and returns
    // null, so the retry goes out with no Authorization header, earns a second 401, and only then
    // falls back. One extra round trip versus the old behavior, same destination.
    it('should fall back to /users when the refresh yields no token', async () => {
      mockFetch
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(jsonResponse(newUser))
      jest
        .mocked(getIdToken)
        .mockResolvedValueOnce('mock-jwt-token')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const result = await createUser(sessionId, true)

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockFetch).toHaveBeenNthCalledWith(3, `${baseUrl}/sessions/${sessionId}/users`, expect.anything())
      expect(result).toEqual(newUser)
    })

    it('should succeed on retry after token refresh when /users/authed initially returns 401', async () => {
      mockFetch.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(jsonResponse(newUser))

      const result = await createUser(sessionId, true)

      expect(jest.mocked(getIdToken)).toHaveBeenCalledTimes(3)
      expect(jest.mocked(getIdToken)).toHaveBeenNthCalledWith(2, { forceRefresh: true })
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/sessions/${sessionId}/users/authed`, expect.anything())
      expect(result).toEqual(newUser)
    })

    it('should fall back to /users when /users/authed returns 403', async () => {
      mockFetch.mockResolvedValueOnce(forbidden()).mockResolvedValueOnce(jsonResponse(newUser))

      const result = await createUser(sessionId, true)

      expect(jest.mocked(getIdToken)).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual(newUser)
    })

    it('should fall back to /users when the retry after token refresh returns 403', async () => {
      mockFetch
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(forbidden())
        .mockResolvedValueOnce(jsonResponse(newUser))

      const result = await createUser(sessionId, true)

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockFetch).toHaveBeenNthCalledWith(3, `${baseUrl}/sessions/${sessionId}/users`, expect.anything())
      expect(result).toEqual(newUser)
    })

    it('should rethrow non-auth errors from /users/authed', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Max players' }, 400))

      await expect(createUser(sessionId, true)).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should rethrow non-auth errors from retry after token refresh', async () => {
      mockFetch
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(jsonResponse({ message: 'Max players' }, 400))

      await expect(createUser(sessionId, true)).rejects.toMatchObject({ response: { statusCode: 400 } })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('patchUser', () => {
    const operations = [{ op: 'replace' as const, path: '/name', value: 'Alice' }]
    const updatedUser = { name: 'Alice', userId }

    // The /authed suffix is the whole point of the flag, not the header: the unsuffixed route is
    // deployed with `Authorizer: NONE`, so API Gateway drops the Authorization header before the
    // handler sees it and the participant is never linked to the signed-in Google account.
    it('should use authenticated endpoint when signed in', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(updatedUser))

      const result = await patchUser(sessionId, userId, operations, true)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/${sessionId}/users/${userId}/authed`, {
        body: JSON.stringify(operations),
        headers: jsonHeaders,
        method: 'PATCH',
      })
      expect(result).toEqual(updatedUser)
    })

    it('should send no auth header when not signed in', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(updatedUser))

      const result = await patchUser(sessionId, userId, operations, false)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/${sessionId}/users/${userId}`, {
        body: JSON.stringify(operations),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })
      expect(result).toEqual(updatedUser)
    })
  })

  describe('claimUser', () => {
    it('should PATCH the authenticated route with no operations', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ name: 'Alice', userId }))

      await claimUser(sessionId, userId)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/${sessionId}/users/${userId}/authed`, {
        body: JSON.stringify([]),
        headers: jsonHeaders,
        method: 'PATCH',
      })
    })
  })

  describe('fetchAvailability', () => {
    it('should GET /sessions/{id}/users/{userId}/availability', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ userId: 'quiet-falcon' }))

      await fetchAvailability('amber-harbor', 'quiet-falcon')

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/sessions/amber-harbor/users/quiet-falcon/availability`,
        expect.objectContaining({ method: 'GET' }),
      )
    })
  })

  describe('patchAvailability', () => {
    it('should PATCH the availability body as-is (not JSON Patch)', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ userId: 'quiet-falcon' }))

      const body = { cells: [{ dateIndex: 0, slotIndex: 0, value: true }] }
      await patchAvailability('amber-harbor', 'quiet-falcon', body)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/amber-harbor/users/quiet-falcon/availability`, {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })
    })
  })

  describe('fetchOverlap', () => {
    it('should GET /sessions/{id}/overlap', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          grid: { bestSlot: { dateIndex: 0, freeCount: 0, slotIndex: 0 }, cells: [] },
          recommendedMeetings: [],
        }),
      )

      await fetchOverlap('amber-harbor')

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/amber-harbor/overlap`, {
        body: undefined,
        headers: {},
        method: 'GET',
      })
    })
  })

  describe('calendar', () => {
    it('should post to the connect endpoint authenticated with no body', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ alreadyConnected: false, authUrl: 'https://auth' }))

      const result = await connectCalendar('spring-owl', 'brave-tiger')

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/spring-owl/users/brave-tiger/calendar/connect`, {
        body: undefined,
        headers: authHeaders,
        method: 'POST',
      })
      expect(result.authUrl).toEqual('https://auth')
    })

    it('should report an already-connected calendar without an auth url', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ alreadyConnected: true }))

      const result = await connectCalendar('spring-owl', 'brave-tiger')

      expect(result).toEqual({ alreadyConnected: true })
    })

    it('should post force to the sync endpoint', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ applied: true, markedBusyCount: 4 }))

      const result = await syncCalendar('spring-owl', 'brave-tiger', true)

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/spring-owl/users/brave-tiger/calendar/sync`, {
        body: JSON.stringify({ force: true }),
        headers: jsonHeaders,
        method: 'POST',
      })
      expect(result.markedBusyCount).toEqual(4)
    })

    it('should get calendar state with no path parameters', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ lastSyncedAt: 1754006400, status: 'connected' }))

      const result = await fetchCalendarState()

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/calendar`, {
        body: undefined,
        headers: authHeaders,
        method: 'GET',
      })
      expect(result.status).toEqual('connected')
    })

    it('should delete the calendar without parsing the empty 204 body', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))

      await expect(disconnectCalendar()).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/calendar`, {
        body: undefined,
        headers: authHeaders,
        method: 'DELETE',
      })
    })
  })

  describe('parseApiMessage', () => {
    it('should extract message from valid JSON body', () => {
      expect(parseApiMessage(JSON.stringify({ message: 'Phone required' }), 'fallback')).toBe('Phone required')
    })

    it('should return fallback when body is undefined', () => {
      expect(parseApiMessage(undefined, 'fallback')).toBe('fallback')
    })

    it('should return fallback when body is not valid JSON', () => {
      expect(parseApiMessage('not json', 'fallback')).toBe('fallback')
    })

    it('should return fallback when message field is missing', () => {
      expect(parseApiMessage(JSON.stringify({ error: 'oops' }), 'fallback')).toBe('fallback')
    })
  })
})
