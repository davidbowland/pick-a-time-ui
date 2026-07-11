import Cookies from 'js-cookie'
import { useCallback, useState } from 'react'

function getCookieName(sessionId: string): string {
  return `choosee_user_${sessionId}`
}

function getCookiePath(sessionId: string): string {
  return `/s/${sessionId}`
}

export function useSessionCookie(sessionId: string) {
  const cookieName = getCookieName(sessionId)
  const cookiePath = getCookiePath(sessionId)

  const [userId, setUserIdState] = useState<string | undefined>(() => Cookies.get(cookieName))

  const setUserId = useCallback(
    (id: string) => {
      Cookies.set(cookieName, id, {
        path: cookiePath,
        expires: 1,
        sameSite: 'Strict',
        secure: typeof window !== 'undefined' && location.protocol === 'https:',
      })
      setUserIdState(id)
    },
    [cookieName, cookiePath],
  )

  const clearUserId = useCallback(() => {
    Cookies.remove(cookieName, { path: cookiePath })
    setUserIdState(undefined)
  }, [cookieName, cookiePath])

  return { userId, setUserId, clearUserId }
}
