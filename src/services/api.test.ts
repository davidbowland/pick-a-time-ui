import { ApiError, get, patch, post } from 'aws-amplify/api'
import { fetchAuthSession } from 'aws-amplify/auth'

import {
  createPlan,
  createUser,
  fetchAvailability,
  fetchPlan,
  fetchUsers,
  parseApiMessage,
  patchAvailability,
  patchUser,
  shareSession,
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
  describe('createPlan', () => {
    it('should POST to /sessions with the plan body and recaptcha header', async () => {
      jest.mocked(post).mockReturnValue({
        response: Promise.resolve({ body: { json: async () => ({ sessionId: 'amber-harbor' }) } }),
      } as any)

      const plan = {
        name: 'Fall rec soccer practice',
        weekdays: [4, 5, 6],
        startDate: '2025-09-04',
        weekCount: 6,
        startHour: 16,
        endHour: 20,
        timezone: 'America/Chicago',
      }
      const result = await createPlan(plan, 'recaptcha-token')

      expect(result).toEqual({ sessionId: 'amber-harbor' })
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/sessions',
          options: expect.objectContaining({ headers: { 'x-recaptcha-token': 'recaptcha-token' }, body: plan }),
        }),
      )
    })
  })

  describe('fetchPlan', () => {
    it('should GET /sessions/{id}', async () => {
      jest.mocked(get).mockReturnValue({
        response: Promise.resolve({ body: { json: async () => ({ sessionId: 'amber-harbor' }) } }),
      } as any)

      await fetchPlan('amber-harbor')

      expect(get).toHaveBeenCalledWith(expect.objectContaining({ path: '/sessions/amber-harbor' }))
    })
  })

  describe('fetchUsers', () => {
    it('should fetch users for session', async () => {
      const users = [{ userId, name: null, phone: null, textsSent: 0 }]
      mockGet.mockReturnValue(mockResponse(users))
      const result = await fetchUsers(sessionId)
      expect(result).toEqual(users)
    })
  })

  describe('createUser', () => {
    const newUser = { userId: 'clever-fox', name: null, phone: null, textsSent: 0 }

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

      // First call: /users/authed fails 401
      // fetchAuthSession called again with forceRefresh
      // Second call: retry /users/authed also fails 401
      // Third call: fallback to /users succeeds
      mockPost
        .mockReturnValueOnce(mockRejection(error))
        .mockReturnValueOnce(mockRejection(error))
        .mockReturnValueOnce(mockResponse(newUser))

      const result = await createUser(sessionId, true)

      // authHeaders() for initial call + forceRefresh + authHeaders() for retry
      expect(mockFetchAuthSession).toHaveBeenCalledTimes(3)
      expect(mockFetchAuthSession).toHaveBeenNthCalledWith(2, { forceRefresh: true })
      expect(mockPost).toHaveBeenCalledTimes(3)
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          path: `/sessions/${encodeURIComponent(sessionId)}/users/authed`,
        }),
      )
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          path: `/sessions/${encodeURIComponent(sessionId)}/users/authed`,
        }),
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

      // First call: /users/authed fails 401
      // Token refresh succeeds
      // Second call: retry /users/authed succeeds
      mockPost.mockReturnValueOnce(mockRejection(error)).mockReturnValueOnce(mockResponse(newUser))

      const result = await createUser(sessionId, true)

      // authHeaders() for initial call + forceRefresh + authHeaders() for retry
      expect(mockFetchAuthSession).toHaveBeenCalledTimes(3)
      expect(mockFetchAuthSession).toHaveBeenNthCalledWith(2, { forceRefresh: true })
      expect(mockPost).toHaveBeenCalledTimes(2)
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          path: `/sessions/${encodeURIComponent(sessionId)}/users/authed`,
        }),
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
      // 403 should not attempt token refresh, just fall back directly
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

      // First call: 401 triggers refresh+retry, retry returns 400
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
      jest.mocked(get).mockReturnValue({
        response: Promise.resolve({ body: { json: async () => ({ userId: 'quiet-falcon' }) } }),
      } as any)

      await fetchAvailability('amber-harbor', 'quiet-falcon')

      expect(get).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/sessions/amber-harbor/users/quiet-falcon/availability' }),
      )
    })
  })

  describe('patchAvailability', () => {
    it('should PATCH the availability body as-is (not JSON Patch)', async () => {
      jest.mocked(patch).mockReturnValue({
        response: Promise.resolve({ body: { json: async () => ({ userId: 'quiet-falcon' }) } }),
      } as any)

      const body = { weekIndex: null, cells: [{ hourIndex: 0, dayIndex: 0, value: true }], resetToPattern: false }
      await patchAvailability('amber-harbor', 'quiet-falcon', body)

      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/sessions/amber-harbor/users/quiet-falcon/availability',
          options: expect.objectContaining({ body }),
        }),
      )
    })
  })

  describe('shareSession', () => {
    it('should post share with phone and type (always authenticated)', async () => {
      const response = { userId: 'clever-fox' }
      mockPost.mockReturnValue(mockResponse(response))
      const result = await shareSession(sessionId, userId, '+15559876543')
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'PickATimeAPI',
        path: `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/share`,
        options: { headers: { Authorization: 'Bearer mock-jwt-token' }, body: { phone: '+15559876543', type: 'text' } },
      })
      expect(result).toEqual(response)
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
