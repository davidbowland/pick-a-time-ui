import { CardContent, CardRoot } from '@heroui/react'
import { motion } from 'framer-motion'
import React from 'react'

import {
  AddressLine,
  AddressMapLink,
  CardContainer,
  CardMeta,
  CardName,
  ChooseButton,
  ChosenOverlay,
  DistanceDisplay,
  HoursList,
  PhoneLink,
  PhotoGallery,
  PlaceTypeChips,
  RejectedOverlay,
  VotingCardImage,
  VotingInfoToggle,
  VotingPhotoOverlay,
  WebsiteLink,
} from './elements'
import PhotoCarousel from '@components/photo-carousel'
import { ChoiceDetail, PriceLevel } from '@types'
import { getTodayHours } from '@utils/hours'

export interface RestaurantCardProps {
  choice: ChoiceDetail
  disabled?: boolean
  onClick?: () => void
  selected?: boolean
  variant?: 'voting' | 'winner'
}

const priceLevelLabels: Record<PriceLevel, string> = {
  PRICE_LEVEL_UNSPECIFIED: '',
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
}

const RestaurantCard = ({ choice, disabled, onClick, selected, variant }: RestaurantCardProps): React.ReactNode => {
  const priceLabel = choice.priceLevel ? priceLevelLabels[choice.priceLevel] : null
  const isVoting = variant === 'voting'

  if (isVoting) {
    const images =
      choice.photos.length > 1 ? choice.photos.map((src, i) => ({ src, alt: `${choice.name} photo ${i + 1}` })) : null

    const hasDetails =
      choice.formattedPhoneNumber ||
      (choice.openHours && choice.openHours.length > 0) ||
      choice.website ||
      (choice.placeTypes && choice.placeTypes.length > 0)

    const todayHours = choice.openHours ? getTodayHours(choice.openHours) : null

    const photoOverlay = (
      <VotingPhotoOverlay
        isClosingSoon={choice.isClosingSoon}
        name={choice.name}
        openNow={choice.openNow}
        priceLabel={priceLabel}
        rating={choice.rating}
        ratingsTotal={choice.ratingsTotal}
        todayHours={todayHours}
      />
    )

    return (
      <motion.div
        className={`relative w-full ${onClick && !disabled ? 'cursor-pointer' : ''}`}
        onClick={onClick && !disabled ? onClick : undefined}
        transition={{ duration: 0.12, ease: 'easeInOut' }}
        whileHover={disabled ? undefined : { scale: 1.02, y: -4 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
      >
        <CardRoot className={`w-full overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
          <CardContent className="flex flex-col gap-0 p-0">
            {/* Photo with name/rating overlay */}
            {images ? (
              <PhotoCarousel images={images} overlay={photoOverlay} showThumbnails={false} />
            ) : (
              <VotingCardImage alt={choice.name} overlay={photoOverlay} src={choice.photos[0]} />
            )}

            {/* Info area — stop propagation so taps here never trigger a vote.
               Pointer events are stopped to prevent Framer Motion whileTap on the parent card. */}
            {(choice.formattedAddress || hasDetails) && (
              <div
                className="flex flex-col gap-1.5 px-3 pb-3 pt-2"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {choice.formattedAddress && (
                  <AddressMapLink address={choice.formattedAddress} distanceMiles={choice.distanceMiles ?? undefined} />
                )}
                {hasDetails && (
                  <VotingInfoToggle>
                    {choice.formattedPhoneNumber && <PhoneLink phone={choice.formattedPhoneNumber} />}
                    {choice.website && <WebsiteLink url={choice.website} />}
                    {choice.openHours && choice.openHours.length > 0 && (
                      <HoursList hours={choice.openHours} size="sm" />
                    )}
                    {choice.placeTypes && choice.placeTypes.length > 0 && (
                      <PlaceTypeChips size="sm" types={choice.placeTypes} />
                    )}
                  </VotingInfoToggle>
                )}
              </div>
            )}
          </CardContent>
        </CardRoot>

        {/* Vote result overlays */}
        {selected === true && <ChosenOverlay />}
        {selected === false && <RejectedOverlay />}
      </motion.div>
    )
  }

  return (
    <CardContainer disabled={disabled} selected={selected} winner={variant === 'winner'}>
      <PhotoGallery name={choice.name} photos={choice.photos} />
      <CardName>{choice.name}</CardName>
      {choice.formattedAddress && <AddressLine>{choice.formattedAddress}</AddressLine>}
      {choice.distanceMiles != null && <DistanceDisplay distanceMiles={choice.distanceMiles} />}
      {choice.formattedPhoneNumber && <PhoneLink phone={choice.formattedPhoneNumber} />}
      <CardMeta priceLabel={priceLabel} rating={choice.rating} ratingsTotal={choice.ratingsTotal} />
      {choice.website && <WebsiteLink url={choice.website} />}
      {choice.openHours && choice.openHours.length > 0 && <HoursList hours={choice.openHours} />}
      {choice.placeTypes && choice.placeTypes.length > 0 && <PlaceTypeChips types={choice.placeTypes} />}
      {onClick && <ChooseButton disabled={disabled} onClick={onClick} />}
    </CardContainer>
  )
}

export default RestaurantCard
