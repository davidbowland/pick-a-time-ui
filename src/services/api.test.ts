import { ApiError, get, patch, post } from 'aws-amplify/api'
import { fetchAuthSession } from 'aws-amplify/auth'

import {
  createPoll,
  createPollAuthed,
  createUser,
  fetchAvailability,
  fetchConfig,
  fetchOverlap,
  fetchPoll,
  fetchUsers,
  parseApiMessage,
  patchAvailability,
  patchUser,
} from './api'

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('aws-amplify/api')
jest.mock('aws-amplify/auth')
jest.mock('@config/amplify', () => ({
  apiName: 'PickATimeAPI',
  apiNameUnauthenticated: 'PickATimeAPIUnauthenticated',
}))

const mockGet = jest.mocked(get)
const mockPost = jest.mocked(post)
const mockPatch = jest.mocked(patch)
const mockFetchAuthSession = jest.mocked(fetchAuthSession)

const sessionId = 'fuzzy-penguin'
const userId = 'brave-tiger'

function mockResponse(data: any) {
  return { response: Promise.resolve({ body: { json: () => Promise.resolve(data) } }) } as any
}

function mockRejection(error: any) {
  return {
    response: Promise.resolve().then(() => {
      throw error
    }),
  } as any
}

beforeAll(() => {
  mockFetchAuthSession.mockResolvedValue({
    tokens: { idToken: { toString: () => 'mock-jwt-token', payload: {} } },
  } as any)
})

describe('API service', () => {
  describe('fetchConfig', () => {
    it('should GET /config', async () => {
      const config = {
        maxPollDates: 90,
        pollNameMaxLength: 100,
        participantNameMaxLength: 50,
        allowedSlotMinutes: [15, 30, 60, 90, 120],
        defaultSlotMinutes: 60,
        startEndMinuteStep: 15,
        maxPollDateRangeDays: 365,
        maxUsersPerSession: 20,
        sessionExpireHours: 336,
      }
      mockGet.mockReturnValue(mockResponse(config))

      const result = await fetchConfig()

      expect(get).toHaveBeenCalledWith(expect.objectContaining({ path: '/config' }))
      expect(result).toEqual(config)
    })
  })

  describe('createPoll', () => {
    it('should POST to /sessions with the poll body and recaptcha header', async () => {
      mockPost.mockReturnValue(mockResponse({ sessionId: 'amber-harbor' }))

      const poll = {
        name: 'Lunch with friends',
        dates: ['2025-09-04', '2025-09-05', '2025-09-06'],
        usesTimes: true as const,
        startMinute: 960,
        endMinute: 1080,
        slotMinutes: 60 as const,
        timezone: 'America/Chicago',
      }
      const result = await createPoll(poll, 'recaptcha-token')

      expect(result).toEqual({ sessionId: 'amber-harbor' })
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/sessions',
          options: expect.objectContaining({ headers: { 'x-recaptcha-token': 'recaptcha-token' }, body: poll }),
        }),
      )
    })

    it('should POST a dates-only poll body (no startMinute/endMinute/slotMinutes)', async () => {
      mockPost.mockReturnValue(mockResponse({ sessionId: 'amber-harbor' }))

      const poll = {
        name: 'Weekend clean-up',
        dates: ['2025-09-06', '2025-09-13'],
        usesTimes: false as const,
        timezone: 'America/Chicago',
      }
      const result = await createPoll(poll, 'recaptcha-token')

      expect(result).toEqual({ sessionId: 'amber-harbor' })
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/sessions',
          options: expect.objectContaining({ headers: { 'x-recaptcha-token': 'recaptcha-token' }, body: poll }),
        }),
      )
    })
  })

  describe('createPollAuthed', () => {
    it('should POST to /sessions/authed with auth headers and no recaptcha header', async () => {
      mockPost.mockReturnValue(mockResponse({ sessionId: 'amber-harbor' }))

      const poll = {
        name: 'Lunch with friends',
        dates: ['2025-09-04', '2025-09-05', '2025-09-06'],
        usesTimes: true as const,
        startMinute: 960,
        endMinute: 1080,
        slotMinutes: 60 as const,
        timezone: 'America/Chicago',
      }
      const result = await createPollAuthed(poll)

      expect(result).toEqual({ sessionId: 'amber-harbor' })
      expect(post).toHaveBeenCalledWith({
        apiName: 'PickATimeAPI',
        path: '/sessions/authed',
        options: { headers: { Authorization: 'Bearer mock-jwt-token' }, body: poll },
      })
    })
  })

  describe('fetchPoll', () => {
    it('should GET /sessions/{id}', async () => {
      mockGet.mockReturnValue(mockResponse({ sessionId: 'amber-harbor' }))

      await fetchPoll('amber-harbor')

      expect(get).toHaveBeenCalledWith(expect.objectContaining({ path: '/sessions/amber-harbor' }))
    })
  })

  describe('fetchUsers', () => {
    it('should fetch users for session', async () => {
      const users = [{ userId, name: null, calendarStatus: 'not_connected' as const }]
      mockGet.mockReturnValue(mockResponse(users))
      const result = await fetchUsers(sessionId)
      expect(result).toEqual(users)
    })
  })

  describe('createUser', () => {
    const newUser = { userId: 'clever-fox', name: null, calendarStatus: 'not_connected' as const }

    it('should hit /users/authed with auth headers when authenticated', async () => {
      mockPost.mockReturnValue(mockResponse(newUser))
      const result = await createUser(sessionId, true)
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'PickATimeAPI',
        path: `/sessions/${encodeURIComponent(sessionId)}/users/authed`,
        options: { headers: { Authorization: 'Bearer mock-jwt-token' }, body: {} },
      })
      expect(result).toEqual(newUser)
    })

    it('should hit /users without auth when not authenticated', async () => {
      mockPost.mockReturnValue(mockResponse(newUser))
      const result = await createUser(sessionId, false)
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'PickATimeAPIUnauthenticated',
        path: `/sessions/${encodeURIComponent(sessionId)}/users`,
        options: { headers: undefined, body: {} },
      })
      expect(result).toEqual(newUser)
    })

    it('should fall back to /users when /users/authed returns 401', async () => {
      const error = Object.assign(new Error('Unauthorized'), {
        response: { statusCode: 401, headers: {}, body: '{"message":"Unauthorized"}' },
      })
      Object.setPrototypeOf(error, ApiError.prototype)

      mockPost
        .mockReturnValueOnce(mockRejection(error))
        .mockReturnValueOnce(mockRejection(error))
        .mockReturnValueOnce(mockResponse(newUser))

      const result = await createUser(sessionId, true)

      expect(mockFetchAuthSession).toHaveBeenCalledTimes(3)
      expect(mockFetchAuthSession).toHaveBeenNthCalledWith(2, { forceRefresh: true })
      expect(mockPost).toHaveBeenCalledTimes(3)
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ path: `/sessions/${encodeURIComponent(sessionId)}/users/authed` }),
      )
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ path: `/sessions/${encodeURIComponent(sessionId)}/users/authed` }),
      )
      expect(mockPost).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          apiName: 'PickATimeAPIUnauthenticated',
          path: `/sessions/${encodeURIComponent(sessionId)}/users`,
        }),
      )
      expect(result).toEqual(newUser)
    })

    it('should succeed on retry after token refresh when /users/authed initially returns 401', async () => {
      const error = Object.assign(new Error('Unauthorized'), {
        response: { statusCode: 401, headers: {}, body: '{"message":"Unauthorized"}' },
      })
      Object.setPrototypeOf(error, ApiError.prototype)

      mockPost.mockReturnValueOnce(mockRejection(error)).mockReturnValueOnce(mockResponse(newUser))

      const result = await createUser(sessionId, true)

      expect(mockFetchAuthSession).toHaveBeenCalledTimes(3)
      expect(mockFetchAuthSession).toHaveBeenNthCalledWith(2, { forceRefresh: true })
      expect(mockPost).toHaveBeenCalledTimes(2)
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ path: `/sessions/${encodeURIComponent(sessionId)}/users/authed` }),
      )
      expect(result).toEqual(newUser)
    })

    it('should fall back to /users when /users/authed returns 403', async () => {
      const error = Object.assign(new Error('Forbidden'), {
        response: { statusCode: 403, headers: {}, body: '{"message":"Forbidden"}' },
      })
      Object.setPrototypeOf(error, ApiError.prototype)

      mockPost.mockReturnValueOnce(mockRejection(error)).mockReturnValueOnce(mockResponse(newUser))

      const result = await createUser(sessionId, true)
      expect(mockFetchAuthSession).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledTimes(2)
      expect(result).toEqual(newUser)
    })

    it('should rethrow non-auth errors from /users/authed', async () => {
      const error = Object.assign(new Error('Bad Request'), {
        response: { statusCode: 400, headers: {}, body: '{"message":"Max players"}' },
      })
      Object.setPrototypeOf(error, ApiError.prototype)

      mockPost.mockReturnValueOnce(mockRejection(error))

      await expect(createUser(sessionId, true)).rejects.toThrow()
      expect(mockPost).toHaveBeenCalledTimes(1)
    })

    it('should rethrow non-auth errors from retry after token refresh', async () => {
      const authError = Object.assign(new Error('Unauthorized'), {
        response: { statusCode: 401, headers: {}, body: '{"message":"Unauthorized"}' },
      })
      Object.setPrototypeOf(authError, ApiError.prototype)

      const capacityError = Object.assign(new Error('Bad Request'), {
        response: { statusCode: 400, headers: {}, body: '{"message":"Max players"}' },
      })
      Object.setPrototypeOf(capacityError, ApiError.prototype)

      mockPost.mockReturnValueOnce(mockRejection(authError)).mockReturnValueOnce(mockRejection(capacityError))

      await expect(createUser(sessionId, true)).rejects.toThrow('Bad Request')
      expect(mockPost).toHaveBeenCalledTimes(2)
    })
  })

  describe('patchUser', () => {
    const operations = [{ op: 'replace' as const, path: '/name', value: 'Alice' }]
    const updatedUser = { userId, name: 'Alice' }

    it('should use authenticated endpoint when signed in', async () => {
      mockPatch.mockReturnValue(mockResponse(updatedUser))
      const result = await patchUser(sessionId, userId, operations, true)
      expect(mockPatch).toHaveBeenCalledWith({
        apiName: 'PickATimeAPI',
        path: `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}`,
        options: { headers: { Authorization: 'Bearer mock-jwt-token' }, body: operations },
      })
      expect(result).toEqual(updatedUser)
    })

    it('should use unauthenticated endpoint when not signed in', async () => {
      mockPatch.mockReturnValue(mockResponse(updatedUser))
      const result = await patchUser(sessionId, userId, operations, false)
      expect(mockPatch).toHaveBeenCalledWith({
        apiName: 'PickATimeAPIUnauthenticated',
        path: `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}`,
        options: { headers: undefined, body: operations },
      })
      expect(result).toEqual(updatedUser)
    })
  })

  describe('fetchAvailability', () => {
    it('should GET /sessions/{id}/users/{userId}/availability', async () => {
      mockGet.mockReturnValue(mockResponse({ userId: 'quiet-falcon' }))

      await fetchAvailability('amber-harbor', 'quiet-falcon')

      expect(get).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/sessions/amber-harbor/users/quiet-falcon/availability' }),
      )
    })
  })

  describe('patchAvailability', () => {
    it('should PATCH the availability body as-is (not JSON Patch)', async () => {
      mockPatch.mockReturnValue(mockResponse({ userId: 'quiet-falcon' }))

      const body = { cells: [{ dateIndex: 0, slotIndex: 0, value: true }] }
      await patchAvailability('amber-harbor', 'quiet-falcon', body)

      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/sessions/amber-harbor/users/quiet-falcon/availability',
          options: expect.objectContaining({ body }),
        }),
      )
    })
  })

  describe('fetchOverlap', () => {
    it('should GET /sessions/{id}/overlap with no query params', async () => {
      mockGet.mockReturnValue(
        mockResponse({
          grid: { cells: [], bestSlot: { dateIndex: 0, slotIndex: 0, freeCount: 0 } },
          recommendedMeetings: [],
        }),
      )

      await fetchOverlap('amber-harbor')

      expect(get).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/sessions/amber-harbor/overlap',
          options: expect.objectContaining({ queryParams: undefined }),
        }),
      )
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
