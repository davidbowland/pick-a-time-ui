import React from 'react'

import { Chip } from '@components/ui/chip'

export const Toolbar = ({
  onSelectAll,
  onClear,
}: {
  onSelectAll: () => void
  onClear: () => void
}): React.ReactNode => (
  <div className="flex gap-2">
    <Chip onPress={onSelectAll}>Select all</Chip>
    <Chip onPress={onClear}>Clear all</Chip>
  </div>
)
