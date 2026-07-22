import { Button } from '@heroui/react'
import { Plus } from 'lucide-react'
import React, { RefObject } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'
import { useIsIntersecting } from '@hooks/useIsIntersecting'

export const BackToFormCta = ({
  heroRef,
  formRef,
  footerRef,
  onJump,
}: {
  heroRef: RefObject<HTMLDivElement | null>
  formRef: RefObject<HTMLDivElement | null>
  footerRef: RefObject<HTMLDivElement | null>
  onJump: () => void
}): React.ReactNode => {
  const heroInView = useIsIntersecting(heroRef)
  const formInView = useIsIntersecting(formRef)
  const footerInView = useIsIntersecting(footerRef)
  // Stay hidden on the hero (the starter row already lives above the fold there) and while the
  // create form or footer is in view — only surface once the user has scrolled past the form.
  const visible = !heroInView && !formInView && !footerInView

  if (!visible) return null

  return (
    <div className="fixed right-5 bottom-5 z-40">
      <Button
        aria-label="Start a poll"
        className={`group flex h-14 min-w-14 items-center gap-0 rounded-full bg-[var(--accent)] p-0 text-[var(--ink)] shadow-[0_10px_28px_rgba(0,0,0,0.4)] transition-[padding] duration-200 ease-out hover:pr-5 focus-visible:pr-5 motion-reduce:transition-none ${FOCUS_RING}`}
        onPress={onJump}
      >
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center">
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <span
          aria-hidden="true"
          className="max-w-0 overflow-hidden pl-0 text-[13px] font-bold whitespace-nowrap opacity-0 transition-[max-width,opacity,padding-left] duration-200 ease-out group-hover:max-w-[120px] group-hover:pl-2 group-hover:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:pl-2 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          Start a poll
        </span>
      </Button>
    </div>
  )
}
