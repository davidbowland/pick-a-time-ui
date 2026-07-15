import { User } from '@types'
import { displayName } from '@utils/users'

const makeUser = (overrides: Partial<User> = {}): User => ({
  userId: 'abc-123-def',
  name: null,
  calendarStatus: 'not_connected',
  ...overrides,
})

describe('displayName', () => {
  it('should return the user name when set', () => {
    expect(displayName(makeUser({ name: 'Alice' }))).toBe('Alice')
  })

  it('should title-case an adjective-noun userId when name is null', () => {
    expect(displayName(makeUser({ userId: 'quiet-falcon' }))).toBe('Quiet Falcon')
  })

  it('should collapse consecutive non-alpha characters into a single space', () => {
    expect(displayName(makeUser({ userId: 'abc--123--def' }))).toBe('Abc Def')
  })

  it('should trim leading and trailing non-alpha characters', () => {
    expect(displayName(makeUser({ userId: '123abc456' }))).toBe('Abc')
  })

  it('should return empty string when userId is all non-alpha', () => {
    expect(displayName(makeUser({ userId: '123-456' }))).toBe('')
  })
})
