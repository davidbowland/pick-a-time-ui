export type { Operation as PatchOperation } from 'fast-json-patch'

export enum ErrorCode {
  ROUND_NOT_CURRENT = 'ROUND_NOT_CURRENT',
}

export interface Slot {
  slotIndex: number
  startMinute: number
  endMinute: number
}

export interface TimeOverride {
  dates: string[]
  startMinute: number
  endMinute: number
}

export interface DatesOnlyPoll {
  usesTimes: false
}

export interface TimedPoll {
  usesTimes: true
  startMinute: number
  endMinute: number
  slotMinutes: 15 | 30 | 60 | 90 | 120
  overrides?: TimeOverride[]
}

export type PollData = (DatesOnlyPoll | TimedPoll) & {
  sessionId: string
  name: string
  dates: string[] // ISO "YYYY-MM-DD", sorted ascending
  timezone: string
  expiration: number
  participantCount: number
  slots: Slot[][] // server-computed, one array per date (same order as `dates`); always a single 0-1440 slot when usesTimes is false
}

export type NewPollRequest = (DatesOnlyPoll | TimedPoll) & {
  name: string
  dates: string[]
  timezone: string
}

export interface ConfigData {
  maxPollDates: number
  pollNameMaxLength: number
  participantNameMaxLength: number
  allowedSlotMinutes: number[]
  defaultSlotMinutes: number
  startEndMinuteStep: number
  maxPollDateRangeDays: number
  maxPollOverrideGroups: number
  maxUsersPerSession: number
  sessionExpireHours: number
}

export interface User {
  userId: string
  name: string | null
  calendarStatus: 'not_connected' | 'connected' | 'error'
}

export interface AvailabilityRecord {
  userId: string
  free: boolean[][] // [dateIndex][slotIndex]; slotIndex always 0 when the poll's usesTimes is false
  expiration: number
}

export interface AvailabilityCell {
  dateIndex: number
  slotIndex: number
  value: boolean
}

export interface AvailabilityPatchRequest {
  cells: AvailabilityCell[]
}
