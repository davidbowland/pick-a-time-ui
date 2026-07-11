export type { Operation as PatchOperation } from 'fast-json-patch'

export type PriceLevel =
  | 'PRICE_LEVEL_UNSPECIFIED'
  | 'PRICE_LEVEL_FREE'
  | 'PRICE_LEVEL_INEXPENSIVE'
  | 'PRICE_LEVEL_MODERATE'
  | 'PRICE_LEVEL_EXPENSIVE'
  | 'PRICE_LEVEL_VERY_EXPENSIVE'

export enum ErrorCode {
  ROUND_NOT_CURRENT = 'ROUND_NOT_CURRENT',
}

export interface AddressResult {
  address: string
}

export interface PlaceTypeDisplay {
  value: string
  display: string
  defaultType?: boolean
  canBeExcluded?: boolean
  defaultExclude?: boolean
  mustBeSingleType?: boolean
}

export interface ChoiceDetail {
  choiceId: string
  name: string
  formattedAddress?: string
  formattedPhoneNumber?: string
  internationalPhoneNumber?: string
  priceLevel?: PriceLevel
  rating?: number
  ratingsTotal?: number
  photos: string[]
  openHours?: string[]
  openNow?: boolean
  isClosingSoon?: boolean
  placeTypes?: string[]
  website?: string
  distanceMiles?: number
}

export type ChoicesMap = Record<string, ChoiceDetail>

export interface SessionData {
  sessionId: string
  address: string
  location: { latitude: number; longitude: number }
  currentRound: number
  totalRounds: number
  bracket: [string, string][][]
  byes: (string | null)[]
  isReady: boolean
  errorMessage: string | null
  filterClosingSoon: boolean
  timeoutAt?: number
  users: string[]
  winner: string | null
  type: string[]
  exclude: string[]
  radius: number
  rankBy: string
  voterCount: number
  votersSubmitted: number
}

export interface User {
  userId: string
  name: string | null
  phone: string | null
  subscribedRounds: number[]
  votes: (string | null)[][]
  textsSent: number
}

export interface SortOption {
  value: string
  label: string
  description: string
  maxChoices: number
}

export interface RadiusConfig {
  defaultMiles: number
  minMiles: number
  maxMiles: number
}

export interface SessionConfig {
  placeTypes: PlaceTypeDisplay[]
  sortOptions: SortOption[]
  radius: RadiusConfig
}

export interface NewSessionRequest {
  address: string
  type: string[]
  exclude: string[]
  radiusMiles: number
  rankBy: string
  filterClosingSoon?: boolean
  maxChoices?: number
  latitude?: number
  longitude?: number
}
