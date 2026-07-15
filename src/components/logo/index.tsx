import { Separator } from '@heroui/react'
import React from 'react'

import { Mark } from '@components/mark'

const Logo = (): React.ReactNode => (
  <>
    <div className="flex items-center justify-center gap-3">
      <Mark size={40} />
      <h2 className="text-4xl font-light" style={{ fontFamily: 'var(--font-display)' }}>
        Pick a Time
      </h2>
    </div>
    <Separator className="mb-8" />
  </>
)

export default Logo
