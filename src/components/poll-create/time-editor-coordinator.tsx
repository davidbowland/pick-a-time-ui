import React, { createContext, useContext, useState } from 'react'

interface TimeEditorCoordinatorValue {
  activeKey: string | null
  setActiveKey: (key: string | null) => void
}

const TimeEditorCoordinatorContext = createContext<TimeEditorCoordinatorValue | undefined>(undefined)

export const TimeEditorCoordinatorProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  return (
    <TimeEditorCoordinatorContext.Provider value={{ activeKey, setActiveKey }}>
      {children}
    </TimeEditorCoordinatorContext.Provider>
  )
}

export function useTimeEditorCoordinator(): TimeEditorCoordinatorValue {
  const context = useContext(TimeEditorCoordinatorContext)
  const [localActiveKey, setLocalActiveKey] = useState<string | null>(null)
  if (context) return context
  return { activeKey: localActiveKey, setActiveKey: setLocalActiveKey }
}
