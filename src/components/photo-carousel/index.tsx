import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

export interface CarouselImage {
  src: string
  alt: string
}

export interface PhotoCarouselProps {
  images: CarouselImage[]
  overlay?: React.ReactNode
  showThumbnails?: boolean
}

const PhotoCarousel = ({ images, overlay, showThumbnails = true }: PhotoCarouselProps): React.ReactNode => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [emblaMainRef, emblaMainApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ])
  const [emblaThumbsRef, emblaThumbsApi] = useEmblaCarousel({
    containScroll: 'keepSnaps',
    dragFree: true,
  })

  const onThumbClick = useCallback(
    (index: number) => {
      if (!emblaMainApi || !emblaThumbsApi) return
      emblaMainApi.scrollTo(index)
    },
    [emblaMainApi, emblaThumbsApi],
  )

  const onSelect = useCallback(() => {
    if (!emblaMainApi) return
    setSelectedIndex(emblaMainApi.selectedScrollSnap())
    if (emblaThumbsApi) emblaThumbsApi.scrollTo(emblaMainApi.selectedScrollSnap())
  }, [emblaMainApi, emblaThumbsApi])

  useEffect(() => {
    if (!emblaMainApi) return
    onSelect()
    emblaMainApi.on('select', onSelect).on('reInit', onSelect)
    return () => {
      emblaMainApi.off('select', onSelect).off('reInit', onSelect)
    }
  }, [emblaMainApi, onSelect])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-md" ref={emblaMainRef}>
        <div className="flex">
          {images.map((image) => (
            <div className="min-w-0 flex-[0_0_100%]" key={image.src}>
              <img alt={image.alt} className="h-60 w-full object-cover" src={image.src} />
            </div>
          ))}
        </div>
        {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
        {!showThumbnails && images.length > 1 && (
          <>
            <button
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation()
                emblaMainApi?.scrollPrev()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white/80 hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation()
                emblaMainApi?.scrollNext()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {showThumbnails && (
        <div className="overflow-hidden" ref={emblaThumbsRef}>
          <div className="flex justify-center gap-2">
            {images.map((image, index) => (
              <button
                aria-label={image.alt}
                className={`min-w-0 flex-[0_0_20%] overflow-hidden rounded transition-opacity ${
                  index === selectedIndex ? 'opacity-100 ring-2 ring-inset ring-primary' : 'opacity-50'
                }`}
                key={image.src}
                onClick={(e) => {
                  e.stopPropagation()
                  onThumbClick(index)
                }}
                type="button"
              >
                <img alt="" className="h-12 w-full object-cover" src={image.src} />
              </button>
            ))}
          </div>
        </div>
      )}

      {!showThumbnails && images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-1">
          {images.map((_, index) => (
            <button
              aria-label={`Photo ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                index === selectedIndex ? 'w-4 bg-primary' : 'w-1.5 bg-default-300'
              }`}
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                onThumbClick(index)
              }}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default PhotoCarousel
