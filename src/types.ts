export type { Operation as PatchOperation } from 'fast-json-patch'

export enum ErrorCode {
  ROUND_NOT_CURRENT = 'ROUND_NOT_CURRENT',
}

export interface PlanData {
  sessionId: string
  name: string
  weekdays: number[] // 0=Sun..6=Sat, display column order
  startDate: string // "YYYY-MM-DD"
  weekCount: number
  startHour: number
  endHour: number
  timezone: string
  participantCount: number
}

export interface User {
  userId: string
  name: string | null
  phone: string | null
  textsSent: number
}

export interface AvailabilityRecord {
  userId: string
  template: boolean[][] // [hourIndex][dayIndex]
  overrides: Record<number, boolean[][]>
}

export interface NewPlanRequest {
  name: string
  weekdays: number[]
  startDate: string
  weekCount: number
  startHour: number
  endHour: number
  timezone: string
}

export interface AvailabilityCell {
  hourIndex: number
  dayIndex: number
  value: boolean
}

export interface AvailabilityPatchRequest {
  weekIndex: number | null
  cells: AvailabilityCell[]
  resetToPattern: boolean
}
