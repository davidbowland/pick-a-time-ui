import React, { RefObject } from 'react'

import { PillButton } from '@components/ui/pill-button'
import { useIsIntersecting } from '@hooks/useIsIntersecting'

export const BackToFormCta = ({
  formRef,
  footerRef,
  onJump,
}: {
  formRef: RefObject<HTMLDivElement | null>
  footerRef: RefObject<HTMLDivElement | null>
  onJump: () => void
}): React.ReactNode => {
  const formInView = useIsIntersecting(formRef)
  const footerInView = useIsIntersecting(footerRef)
  const visible = !formInView && !footerInView

  if (!visible) return null

  return (
    <div className="fixed right-5 bottom-5 z-40 w-44">
      <PillButton label="Start a poll" onPress={onJump} />
    </div>
  )
}
