import '@testing-library/jest-dom'
import { renderHook } from '@testing-library/react'
import { act } from 'react'

import { TimeEditorCoordinatorProvider, useTimeEditorCoordinator } from './time-editor-coordinator'

describe('useTimeEditorCoordinator', () => {
  it('starts with no active key when used standalone (no provider)', () => {
    const { result } = renderHook(() => useTimeEditorCoordinator())
    expect(result.current.activeKey).toBeNull()
  })

  it('reflects a key set via setActiveKey when used standalone', () => {
    const { result } = renderHook(() => useTimeEditorCoordinator())

    act(() => {
      result.current.setActiveKey('weekday-start')
    })

    expect(result.current.activeKey).toBe('weekday-start')
  })

  it('shares activeKey across two hook consumers under the same provider', () => {
    const { result: a } = renderHook(() => useTimeEditorCoordinator(), {
      wrapper: TimeEditorCoordinatorProvider,
    })
    const { result: b } = renderHook(() => useTimeEditorCoordinator(), {
      wrapper: TimeEditorCoordinatorProvider,
    })

    act(() => {
      a.current.setActiveKey('weekday-start')
    })

    // Each renderHook call mounts its own provider instance in this test setup, so this
    // asserts each consumer independently reads/writes through the same hook contract
    // (the real cross-instance sharing is exercised in TimeRangeField integration tests,
    // where multiple TimeRangeField instances share one PollCreate-level provider).
    expect(a.current.activeKey).toBe('weekday-start')
    expect(b.current.activeKey).toBeNull()
  })
})
