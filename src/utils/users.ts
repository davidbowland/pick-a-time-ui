import { User } from '@types'

export function displayName(user: User): string {
  if (user.name) return user.name
  return user.userId
    .replace(/[^a-z]+/gi, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
