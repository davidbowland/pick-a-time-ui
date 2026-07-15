import { useEffect, useRef, useState } from 'react'

const defaultGetDocument = (): Document => document

export function useScrollProgress(getDocument: () => Document = defaultGetDocument): number {
  const [progress, setProgress] = useState(0)
  const tickingRef = useRef(false)
  const frameIdRef = useRef<number | null>(null)

  useEffect(() => {
    const doc = getDocument()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const measure = (): void => {
      const el = doc.documentElement
      const max = el.scrollHeight - el.clientHeight
      setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0)
      tickingRef.current = false
    }

    measure()
    if (reduceMotion) return

    const onScroll = (): void => {
      if (tickingRef.current) return
      tickingRef.current = true
      frameIdRef.current = requestAnimationFrame(measure)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frameIdRef.current !== null) cancelAnimationFrame(frameIdRef.current)
      tickingRef.current = false
    }
  }, [getDocument])

  return progress
}
