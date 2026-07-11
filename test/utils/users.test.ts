import { User } from '@types'
import { displayName } from '@utils/users'

const makeUser = (overrides: Partial<User> = {}): User => ({
  userId: 'abc-123-def',
  name: null,
  phone: null,
  subscribedRounds: [],
  votes: [],
  textsSent: 0,
  ...overrides,
})

describe('displayName', () => {
  it('should return the user name when set', () => {
    expect(displayName(makeUser({ name: 'Alice' }))).toBe('Alice')
  })

  it('should fall back to userId when name is null', () => {
    expect(displayName(makeUser({ userId: 'curious-discussion' }))).toBe('curious discussion')
  })

  it('should collapse consecutive non-alpha characters into a single space', () => {
    expect(displayName(makeUser({ userId: 'abc--123--def' }))).toBe('abc def')
  })

  it('should trim leading and trailing non-alpha characters', () => {
    expect(displayName(makeUser({ userId: '123abc456' }))).toBe('abc')
  })

  it('should return empty string when userId is all non-alpha', () => {
    expect(displayName(makeUser({ userId: '123-456' }))).toBe('')
  })

  it('should prefer name over userId even if name is whitespace-only after trim', () => {
    // name is truthy ("  ") so it wins — this documents current behavior
    expect(displayName(makeUser({ name: '  ' }))).toBe('  ')
  })
})
