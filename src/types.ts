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
}

export interface AvailabilityRecord {
  userId: string
  free: boolean[][] // [dateIndex][slotIndex]; slotIndex always 0 when the poll's usesTimes is false
  expiration: number
}

// Three states, not two, and the distinction is load-bearing: an errored connection and a connected
// calendar with nothing booked both arrive as an all-false grid, so without this the client cannot
// tell "we could not reach your calendar" from "your calendar is clear".
export type CalendarStatus = 'connected' | 'error' | 'not_connected'

// The range the calendar was actually read over. Not the poll's own dates: a poll outside the
// server's retention window comes back 'connected' with a window that does not reach it.
export interface DateWindow {
  start: string // ISO "YYYY-MM-DD", inclusive
  end: string // ISO "YYYY-MM-DD", inclusive
}

/**
 * An availability record read as its owner, so it may carry that owner's calendar.
 *
 * The three calendar fields are optional as a set, and their absence is a real state rather than a
 * defaulted one: it is what `fetchAvailabilityAuthed` resolves with when the authenticated read
 * refuses (AC-044). Absent means this read learned nothing about a calendar -- which is not the
 * same claim as `calendarStatus: 'not_connected'`, since the person may well have one connected and
 * simply not be linked to this participant yet.
 *
 * `busy` shares its dimensions with `free` by construction: the server builds both from the same
 * poll in the same request, which is why they arrive on one response rather than two.
 */
export interface OwnerAvailabilityRecord extends AvailabilityRecord {
  // [dateIndex][slotIndex], where slotIndex is the slot's index WITHIN ITS OWN DATE'S window -- not
  // its position among the grid's union columns. The two diverge on any poll with a per-date
  // override, and PaintGrid reads it this way, so nothing between here and the grid may reshape it.
  busy?: boolean[][]
  calendarStatus?: CalendarStatus
  busyWindow?: DateWindow | null
}

export interface AvailabilityCell {
  dateIndex: number
  slotIndex: number
  value: boolean
}

export interface AvailabilityPatchRequest {
  cells: AvailabilityCell[]
}
