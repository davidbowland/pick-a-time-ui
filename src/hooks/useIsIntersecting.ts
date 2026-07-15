import { RefObject, useEffect, useState } from 'react'

const defaultCreateObserver = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
): IntersectionObserver => new IntersectionObserver(callback, options)

export function useIsIntersecting(
  ref: RefObject<Element | null>,
  createObserver: (
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) => IntersectionObserver = defaultCreateObserver,
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = createObserver((entries) => {
      const entry = entries[0]
      if (entry) setIsIntersecting(entry.isIntersecting)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, createObserver])

  return isIntersecting
}
