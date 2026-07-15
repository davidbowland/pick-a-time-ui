import Cookies from 'js-cookie'
import { useCallback, useState } from 'react'

function getCookieName(sessionId: string): string {
  return `pat_user_${sessionId}`
}

function getCookiePath(sessionId: string): string {
  return `/p/${sessionId}`
}

export function setSessionCookie(sessionId: string, userId: string): void {
  Cookies.set(getCookieName(sessionId), userId, {
    path: getCookiePath(sessionId),
    expires: 14,
    sameSite: 'Strict',
    secure: typeof window !== 'undefined' && location.protocol === 'https:',
  })
}

export function clearSessionCookie(sessionId: string): void {
  Cookies.remove(getCookieName(sessionId), { path: getCookiePath(sessionId) })
}

export function useSessionCookie(sessionId: string) {
  const cookieName = getCookieName(sessionId)

  const [userId, setUserIdState] = useState<string | undefined>(() => Cookies.get(cookieName))

  const setUserId = useCallback(
    (id: string) => {
      setSessionCookie(sessionId, id)
      setUserIdState(id)
    },
    [sessionId],
  )

  const clearUserId = useCallback(() => {
    clearSessionCookie(sessionId)
    setUserIdState(undefined)
  }, [sessionId])

  return { userId, setUserId, clearUserId }
}
