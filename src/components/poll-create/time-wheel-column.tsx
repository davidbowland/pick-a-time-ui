import React, { useEffect, useId, useRef } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

export interface TimeWheelOption {
  value: string
  label: string
}

const VISIBLE_ROW_COUNT = 3
const ROW_HEIGHT_PX = 32

export const TimeWheelColumn = ({
  options,
  value,
  onChange,
  autoFocus,
  'aria-label': ariaLabel,
}: {
  options: TimeWheelOption[]
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  'aria-label': string
}): React.ReactNode => {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedIndex = options.findIndex((option) => option.value === value)

  useEffect(() => {
    document.getElementById(`${listId}-${selectedIndex}`)?.scrollIntoView({ block: 'center' })
  }, [listId, selectedIndex])

  const selectByIndex = (index: number): void => {
    if (options.length === 0) return
    const clamped = Math.max(0, Math.min(options.length - 1, index))
    if (clamped === selectedIndex) return
    onChange(options[clamped].value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectByIndex(selectedIndex - 1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectByIndex(selectedIndex + 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectByIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectByIndex(options.length - 1)
    }
  }

  return (
    <div
      aria-activedescendant={`${listId}-${selectedIndex}`}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      className={`relative w-14 overflow-y-auto text-center [scroll-snap-type:y_mandatory] ${FOCUS_RING}`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="listbox"
      style={{ height: ROW_HEIGHT_PX * VISIBLE_ROW_COUNT }}
      tabIndex={0}
    >
      <div aria-hidden="true" style={{ height: ROW_HEIGHT_PX }} />
      {options.map((option, index) => (
        <div
          aria-selected={index === selectedIndex}
          className={`flex items-center justify-center text-sm [scroll-snap-align:center] ${
            index === selectedIndex ? 'font-bold text-[var(--bone)]' : 'text-[var(--slate)]'
          }`}
          id={`${listId}-${index}`}
          key={option.value}
          onClick={() => {
            containerRef.current?.focus()
            selectByIndex(index)
          }}
          role="option"
          style={{ height: ROW_HEIGHT_PX }}
        >
          {option.label}
        </div>
      ))}
      <div aria-hidden="true" style={{ height: ROW_HEIGHT_PX }} />
    </div>
  )
}
