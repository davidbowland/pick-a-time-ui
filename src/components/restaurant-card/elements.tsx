import { Button, CardContent, CardRoot, Spinner } from '@heroui/react'
import {
  Check,
  Clock,
  Info,
  MapPin,
  Navigation,
  Phone,
  Star,
  Store,
  Tag as TagIcon,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import PhotoCarousel from '@components/photo-carousel'

export const CardContainer = ({
  children,
  disabled,
  selected,
  winner,
}: {
  children: React.ReactNode
  disabled?: boolean
  selected?: boolean
  winner?: boolean
}): React.ReactNode => (
  <CardRoot
    className={`w-full transition-shadow ${selected ? 'ring-2 ring-[#F59E0B]' : ''} ${
      winner ? 'border-2 border-[#F59E0B]' : ''
    } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
  >
    <CardContent className="flex flex-col gap-3 p-4">{children}</CardContent>
  </CardRoot>
)

export const VotingCardImage = ({
  alt,
  overlay,
  src,
}: {
  alt: string
  overlay?: React.ReactNode
  src?: string
}): React.ReactNode => {
  const [loaded, setLoaded] = useState(!src)

  if (!src) {
    return (
      <div className="relative flex h-60 w-full items-center justify-center bg-white/[0.03]">
        <UtensilsCrossed className="h-20 w-20 text-[#374151]" />
        {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
      </div>
    )
  }

  return (
    <div className="relative h-60 w-full overflow-hidden bg-white/[0.03]">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/[0.06] border-t-[#F59E0B]" />
        </div>
      )}
      <img
        alt={alt}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        src={src}
      />
      {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
    </div>
  )
}

export const VotingPhotoOverlay = ({
  name,
  priceLabel,
  rating,
  ratingsTotal,
  openNow,
  isClosingSoon = false,
  todayHours,
}: {
  name: string
  priceLabel: string | null
  rating?: number
  ratingsTotal?: number
  openNow?: boolean
  isClosingSoon?: boolean
  todayHours?: string | null
}): React.ReactNode => {
  const chip = isClosingSoon ? (
    <div className="flex items-center gap-1 rounded-full bg-amber-950/80 px-2 py-0.5 text-xs font-semibold text-amber-400 backdrop-blur-sm">
      <Clock className="h-3 w-3" />
      {todayHours ? `Closing soon · ${todayHours}` : 'Closing soon'}
    </div>
  ) : openNow === false ? (
    <div className="flex items-center gap-1 rounded-full bg-red-950/80 px-2 py-0.5 text-xs font-semibold text-red-400 backdrop-blur-sm">
      <Clock className="h-3 w-3" />
      Closed
    </div>
  ) : openNow === true ? (
    <div className="flex items-center gap-1 rounded-full bg-emerald-950/80 px-2 py-0.5 text-xs font-semibold text-emerald-400 backdrop-blur-sm">
      <Clock className="h-3 w-3" />
      {todayHours ? `Open · ${todayHours}` : 'Open'}
    </div>
  ) : null

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      {chip && <div className="absolute right-2 top-2">{chip}</div>}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="choosee-brand text-[20px] leading-snug tracking-[0.06em] text-white drop-shadow">{name}</h3>
        <div className="mt-1 flex items-center gap-3">
          {rating != null && (
            <span className="flex items-center gap-1 text-sm text-[#F59E0B]">
              <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
              {rating}
              {ratingsTotal != null && <span className="text-xs text-white/50">({ratingsTotal})</span>}
            </span>
          )}
          {priceLabel && <span className="text-sm font-medium text-white/80">{priceLabel}</span>}
        </div>
      </div>
    </>
  )
}

export const ChosenOverlay = (): React.ReactNode => (
  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[rgba(245,158,11,0.25)]">
    <div className="rounded-full bg-[rgba(245,158,11,0.9)] p-3 shadow-lg">
      <Check className="h-10 w-10 stroke-[2.5] text-[#0A0A0B]" />
    </div>
  </div>
)

export const RejectedOverlay = (): React.ReactNode => (
  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60">
    <div className="rounded-full bg-black/70 p-3 shadow-lg">
      <X className="h-10 w-10 stroke-[2.5] text-white/60" />
    </div>
  </div>
)

export const HoursList = ({ hours, size = 'md' }: { hours: string[]; size?: 'sm' | 'md' }): React.ReactNode => {
  const sm = size === 'sm'
  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center ${sm ? 'gap-1.5 text-xs text-[#374151]' : 'gap-2 text-sm text-[#4B5563]'}`}>
        <Clock className={sm ? 'h-3 w-3' : 'h-4 w-4'} />
        <span className="font-medium">Hours</span>
      </div>
      <ul className={sm ? 'space-y-0.5 pl-4 text-xs text-[#4B5563]' : 'space-y-1 pl-6 text-sm text-[#4B5563]'}>
        {hours.map((hour) => (
          <li key={hour}>{hour}</li>
        ))}
      </ul>
    </div>
  )
}

const MAX_VISIBLE_TYPES = 5

export const PlaceTypeChips = ({ types, size = 'md' }: { types: string[]; size?: 'sm' | 'md' }): React.ReactNode => {
  const sorted = useMemo(() => [...types].sort((a, b) => a.localeCompare(b)), [types])
  const [expanded, setExpanded] = useState(false)
  const sm = size === 'sm'

  const hasOverflow = sorted.length > MAX_VISIBLE_TYPES
  const visible = expanded || !hasOverflow ? sorted : sorted.slice(0, MAX_VISIBLE_TYPES)
  const hiddenCount = sorted.length - MAX_VISIBLE_TYPES

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex items-center ${sm ? 'gap-1.5 text-xs text-[#374151]' : 'gap-2 text-sm text-[#4B5563]'}`}>
        <TagIcon className={sm ? 'h-3 w-3' : 'h-4 w-4'} />
        <span className="font-medium">Type</span>
      </div>
      <div className={`flex flex-wrap ${sm ? 'gap-1.5 pl-4' : 'gap-2 pl-6'}`}>
        {visible.map((type) => (
          <span
            className={`inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] font-medium text-[#9CA3AF] ${
              sm ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
            }`}
            key={type}
          >
            {type}
          </span>
        ))}
      </div>
      {hasOverflow && (
        <Button
          aria-label={expanded ? 'Show fewer place types' : `Show ${hiddenCount} more place types`}
          className={`${sm ? 'ml-4' : 'ml-6'} mt-0.5 rounded-full border-white/[0.09] bg-white/[0.05] text-[#6B7280]`}
          onPress={() => setExpanded((prev) => !prev)}
          size="sm"
          variant="outline"
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </Button>
      )}
    </div>
  )
}

export const VotingInfoToggle = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        className="flex items-center gap-1.5 py-0.5 text-xs text-[#374151] hover:text-[#6B7280]"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        type="button"
      >
        <Info className="h-3 w-3" />
        {open ? 'Hide details' : 'More details'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  )
}

export const AddressMapLink = ({
  address,
  distanceMiles,
}: {
  address: string
  distanceMiles?: number
}): React.ReactNode => (
  <a
    className="flex items-start gap-1.5 text-xs text-[#4B5563] hover:text-[#F59E0B]"
    href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
    onClick={(e) => e.stopPropagation()}
    rel="noopener noreferrer"
    target="_blank"
  >
    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
    <span>
      {address}
      {distanceMiles != null && <span className="text-[#374151]"> · {distanceMiles.toFixed(1)} mi</span>}
    </span>
  </a>
)

export const DistanceDisplay = ({ distanceMiles }: { distanceMiles: number }): React.ReactNode => (
  <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
    <Navigation className="h-3 w-3 shrink-0" />
    <span>{distanceMiles.toFixed(1)} mi</span>
    <span
      className="inline-flex cursor-default text-[#374151]"
      title="Distance is measured from the address you entered and may not reflect your exact location if you used a city name or ZIP code."
    >
      <Info className="h-3 w-3" />
    </span>
  </div>
)

export const TodayHoursLine = ({ hours }: { hours: string }): React.ReactNode => (
  <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
    <Clock className="h-3 w-3 shrink-0" />
    <span>
      <span className="font-medium text-[#6B7280]">Today</span> {hours}
    </span>
  </div>
)

const PhotoImage = ({ alt, src }: { alt: string; src: string }): React.ReactNode => (
  <img alt={alt} className="h-48 w-full rounded-md object-cover" src={src} />
)

const PhotoPlaceholder = (): React.ReactNode => (
  <div className="flex h-48 w-full items-center justify-center rounded-md bg-white/[0.03]">
    <UtensilsCrossed className="h-16 w-16 text-[#374151]" />
  </div>
)

export const AddressLine = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <a
    className="flex items-start gap-2 text-sm text-[#4B5563] hover:text-[#F59E0B]"
    href={`https://maps.google.com/?q=${encodeURIComponent(String(children))}`}
    rel="noopener noreferrer"
    target="_blank"
  >
    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{children}</span>
  </a>
)

export const PhoneLink = ({ phone }: { phone: string }): React.ReactNode => (
  <div className="flex items-center gap-2 text-sm">
    <Phone className="h-4 w-4 shrink-0 text-[#4B5563]" />
    <a className="text-[#F59E0B] underline" href={`tel:${phone}`}>
      {phone}
    </a>
  </div>
)

export const CardName = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <h3 className="choosee-brand text-[22px] tracking-[0.05em] text-[#F5F5F5]">{children}</h3>
)

export const CardMeta = ({
  priceLabel,
  rating,
  ratingsTotal,
}: {
  priceLabel: string | null
  rating?: number
  ratingsTotal?: number
}): React.ReactNode => (
  <div className="flex flex-wrap items-center gap-3 text-sm">
    {priceLabel && <span className="font-medium text-[#6B7280]">{priceLabel}</span>}
    {rating != null && (
      <span className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
        <span className="text-[#D4D4D4]">{rating}</span>
        {ratingsTotal != null && <span className="text-[#4B5563]">({ratingsTotal})</span>}
      </span>
    )}
  </div>
)

export const WebsiteLink = ({ url }: { url: string }): React.ReactNode => (
  <div className="flex min-w-0 max-w-[250px] items-center gap-2 overflow-hidden text-sm">
    <Store className="h-4 w-4 shrink-0 text-[#4B5563]" />
    <a
      className="min-w-0 truncate text-[#F59E0B] underline"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
      title={url}
    >
      {url}
    </a>
  </div>
)

export const PhotoGallery = ({ name, photos }: { name: string; photos: string[] }): React.ReactNode => {
  if (photos.length === 0) return <PhotoPlaceholder />
  if (photos.length === 1) return <PhotoImage alt={name} src={photos[0]} />

  const images = photos.map((src, i) => ({
    src,
    alt: `${name} photo ${i + 1} of ${photos.length}`,
  }))
  return <PhotoCarousel images={images} />
}

export const ChooseButton = ({ disabled, onClick }: { disabled?: boolean; onClick: () => void }): React.ReactNode => (
  <Button
    className="w-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] font-bold text-[#0A0A0B]"
    isDisabled={disabled}
    onPress={onClick}
    variant="primary"
  >
    {disabled && <Spinner color="current" size="sm" />}
    {disabled ? 'Choosing...' : 'Choose'}
  </Button>
)
