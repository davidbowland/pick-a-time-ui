import { ApiError, get, patch, post } from 'aws-amplify/api'
import { fetchAuthSession } from 'aws-amplify/auth'

import {
  closeRound,
  createSession,
  createUser,
  fetchAddress,
  fetchChoices,
  fetchSessionConfig,
  fetchSession,
  fetchUsers,
  parseApiMessage,
  patchUser,
  shareSession,
  subscribeToRound,
} from './api'

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('aws-amplify/api')
jest.mock('aws-amplify/auth')
jest.mock('@config/amplify', () => ({
  apiName: 'ChooseeAPI',
  apiNameUnauthenticated: 'ChooseeAPIUnauthenticated',
}))

const mockGet = jest.mocked(get)
const mockPost = jest.mocked(post)
const mockPatch = jest.mocked(patch)
const mockFetchAuthSession = jest.mocked(fetchAuthSession)

const sessionId = 'fuzzy-penguin'
const userId = 'brave-tiger'
const recaptchaToken = 'test-recaptcha-token'

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

beforeEach(() => {
  jest.clearAllMocks()
  mockFetchAuthSession.mockResolvedValue({
    tokens: { idToken: { toString: () => 'mock-jwt-token', payload: {} } },
  } as any)
})

describe('API service', () => {
  describe('fetchAddress', () => {
    const addressResult = { address: '1600 Pennsylvania Ave' }

    it('should call reverse-geocode with recaptcha header and coordinates', async () => {
      mockGet.mockReturnValue(mockResponse(addressResult))
      const result = await fetchAddress(38.897, -77.036, recaptchaToken)
      expect(mockGet).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
        path: '/reverse-geocode',
        options: {
          headers: { 'x-recaptcha-token': recaptchaToken },
          queryParams: { latitude: '38.897', longitude: '-77.036' },
        },
      })
      expect(result).toEqual(addressResult)
    })
  })

  describe('fetchSessionConfig', () => {
    it('should return session config from response', async () => {
      const config = { placeTypes: [], sortOptions: [], radius: { minMiles: 1, maxMiles: 30 } }
      mockGet.mockReturnValue(mockResponse(config))
      const result = await fetchSessionConfig()
      expect(mockGet).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
        path: '/sessions/config',
        options: { headers: undefined, queryParams: undefined },
      })
      expect(result).toEqual(config)
    })
  })

  describe('createSession', () => {
    const session = {
      address: 'Columbia, MO',
      type: ['restaurant'],
      exclude: [],
      radiusMiles: 2.33,
      rankBy: 'POPULARITY' as const,
    }

    it('should post session with recaptcha header (unauthenticated)', async () => {
      const response = { sessionId: 'fuzzy-penguin' }
      mockPost.mockReturnValue(mockResponse(response))
      const result = await createSession(session, recaptchaToken)
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
        path: '/sessions',
        options: { headers: { 'x-recaptcha-token': recaptchaToken }, body: session },
      })
      expect(result).toEqual(response)
    })
  })

  describe('fetchSession', () => {
    it('should encode sessionId in path', async () => {
      const session = { sessionId, isReady: true }
      mockGet.mockReturnValue(mockResponse(session))
      const result = await fetchSession(sessionId)
      expect(mockGet).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
        path: `/sessions/${encodeURIComponent(sessionId)}`,
        options: { headers: undefined, queryParams: undefined },
      })
      expect(result).toEqual(session)
    })
  })

  describe('fetchChoices', () => {
    it('should fetch choices for session', async () => {
      const choices = { 'choice-a': { choiceId: 'choice-a', name: 'Pizza Place', photos: [] } }
      mockGet.mockReturnValue(mockResponse(choices))
      const result = await fetchChoices(sessionId)
      expect(mockGet).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
        path: `/sessions/${encodeURIComponent(sessionId)}/choices`,
        options: { headers: undefined, queryParams: undefined },
      })
      expect(result).toEqual(choices)
    })
  })

  describe('fetchUsers', () => {
    it('should fetch users for session', async () => {
      const users = [{ userId, name: null, votes: [[]] }]
      mockGet.mockReturnValue(mockResponse(users))
      const result = await fetchUsers(sessionId)
      expect(result).toEqual(users)
    })
  })

  describe('createUser', () => {
    const newUser = { userId: 'clever-fox', name: null, votes: [[]] }

    it('should hit /users/authed with auth headers when authenticated', async () => {
      mockPost.mockReturnValue(mockResponse(newUser))
      const result = await createUser(sessionId, true)
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'ChooseeAPI',
        path: `/sessions/${encodeURIComponent(sessionId)}/users/authed`,
        options: { headers: { Authorization: 'Bearer mock-jwt-token' }, body: {} },
      })
      expect(result).toEqual(newUser)
    })

    it('should hit /users without auth when not authenticated', async () => {
      mockPost.mockReturnValue(mockResponse(newUser))
      const result = await createUser(sessionId, false)
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
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
          apiName: 'ChooseeAPIUnauthenticated',
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
        apiName: 'ChooseeAPI',
        path: `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}`,
        options: { headers: { Authorization: 'Bearer mock-jwt-token' }, body: operations },
      })
      expect(result).toEqual(updatedUser)
    })

    it('should use unauthenticated endpoint when not signed in', async () => {
      mockPatch.mockReturnValue(mockResponse(updatedUser))
      const result = await patchUser(sessionId, userId, operations, false)
      expect(mockPatch).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
        path: `/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}`,
        options: { headers: undefined, body: operations },
      })
      expect(result).toEqual(updatedUser)
    })
  })

  describe('closeRound', () => {
    it('should post to close round endpoint (unauthenticated)', async () => {
      const updatedSession = { sessionId, currentRound: 1 }
      mockPost.mockReturnValue(mockResponse(updatedSession))
      const result = await closeRound(sessionId, 0)
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'ChooseeAPIUnauthenticated',
        path: `/sessions/${encodeURIComponent(sessionId)}/rounds/0/close`,
        options: { headers: undefined, body: undefined },
      })
      expect(result).toEqual(updatedSession)
    })
  })

  describe('subscribeToRound', () => {
    it('should use authenticated endpoint when signed in', async () => {
      const updatedUser = { userId, subscribedRounds: [1] }
      mockPost.mockReturnValue(mockResponse(updatedUser))
      const result = await subscribeToRound(sessionId, 1, userId, true)
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'ChooseeAPI',
        path: `/sessions/${encodeURIComponent(sessionId)}/rounds/1/subscribe`,
        options: { headers: { Authorization: 'Bearer mock-jwt-token' }, body: { userId, roundId: 1 } },
      })
      expect(result).toEqual(updatedUser)
    })
  })

  describe('shareSession', () => {
    it('should post share with phone and type (always authenticated)', async () => {
      const response = { userId: 'clever-fox' }
      mockPost.mockReturnValue(mockResponse(response))
      const result = await shareSession(sessionId, userId, '+15559876543')
      expect(mockPost).toHaveBeenCalledWith({
        apiName: 'ChooseeAPI',
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
