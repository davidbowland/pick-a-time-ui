import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import RestaurantCard from '@components/restaurant-card'
import { ChoiceDetail } from '@types'

// Mock Embla — jsdom lacks matchMedia which Embla requires internally
jest.mock('embla-carousel-react', () => ({
  __esModule: true,
  default: () => [React.createRef(), null],
}))

const baseChoice: ChoiceDetail = {
  choiceId: 'abc123',
  name: "Dave's Place",
  formattedAddress: '123 Main St, Columbia',
  formattedPhoneNumber: '(555) 123-4567',
  priceLevel: 'PRICE_LEVEL_MODERATE',
  rating: 4.5,
  ratingsTotal: 200,
  photos: ['https://example.com/photo.jpg'],
  openHours: ['Monday: 9:00 AM – 5:00 PM', 'Tuesday: 9:00 AM – 5:00 PM'],
  placeTypes: ['Cafe', 'Bar', 'American'],
  website: 'https://example.com',
}

describe('RestaurantCard (default variant)', () => {
  it('should render the restaurant name', () => {
    render(<RestaurantCard choice={baseChoice} />)
    expect(screen.getByText("Dave's Place")).toBeInTheDocument()
  })

  it('should render the formatted address', () => {
    render(<RestaurantCard choice={baseChoice} />)
    expect(screen.getByText('123 Main St, Columbia')).toBeInTheDocument()
  })

  it('should render the phone number as a tel link', () => {
    render(<RestaurantCard choice={baseChoice} />)
    const link = screen.getByRole('link', { name: '(555) 123-4567' })
    expect(link).toHaveAttribute('href', 'tel:(555) 123-4567')
  })

  it('should render the price level', () => {
    render(<RestaurantCard choice={baseChoice} />)
    expect(screen.getByText('$$')).toBeInTheDocument()
  })

  it('should render the rating and ratings count', () => {
    render(<RestaurantCard choice={baseChoice} />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('(200)')).toBeInTheDocument()
  })

  it('should render the website as a link', () => {
    render(<RestaurantCard choice={baseChoice} />)
    const link = screen.getByRole('link', { name: 'https://example.com' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('should render a photo when available', () => {
    render(<RestaurantCard choice={baseChoice} />)
    const img = screen.getByRole('img', { name: "Dave's Place" })
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('should render a placeholder icon when no photos', () => {
    const noPhotoChoice = { ...baseChoice, photos: [] }
    render(<RestaurantCard choice={noPhotoChoice} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('should not render address when not provided', () => {
    const noAddr = { ...baseChoice, formattedAddress: undefined }
    render(<RestaurantCard choice={noAddr} />)
    expect(screen.queryByText('123 Main St, Columbia')).not.toBeInTheDocument()
  })

  it('should not render phone when not provided', () => {
    const noPhone = { ...baseChoice, formattedPhoneNumber: undefined }
    render(<RestaurantCard choice={noPhone} />)
    expect(screen.queryByRole('link', { name: /555/ })).not.toBeInTheDocument()
  })

  it('should apply selected ring class when selected', () => {
    const { container } = render(<RestaurantCard choice={baseChoice} selected />)
    expect(container.querySelector('.ring-2')).toBeInTheDocument()
  })

  it('should apply winner border class when variant is winner', () => {
    const { container } = render(<RestaurantCard choice={baseChoice} variant="winner" />)
    expect(container.querySelector('.border-2')).toBeInTheDocument()
  })

  it('should render a Choose button that triggers onClick', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    render(<RestaurantCard choice={baseChoice} onClick={handleClick} />)
    const button = screen.getByRole('button', { name: 'Choose' })
    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not render a Choose button when not clickable', () => {
    render(<RestaurantCard choice={baseChoice} />)
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument()
  })

  it('should show a disabled Choose button with loading text when disabled', () => {
    const handleClick = jest.fn()
    render(<RestaurantCard choice={baseChoice} disabled onClick={handleClick} />)
    const button = screen.getByRole('button', { name: /Choosing/ })
    expect(button).toBeDisabled()
  })

  it('should render a carousel when multiple photos are provided', () => {
    const multiPhotoChoice = {
      ...baseChoice,
      photos: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    }
    render(<RestaurantCard choice={multiPhotoChoice} />)
    const imgs = screen.getAllByRole('img')
    const namedImgs = imgs.filter((img) => img.getAttribute('alt') !== '')
    expect(namedImgs).toHaveLength(2)
    expect(namedImgs[0]).toHaveAttribute('alt', "Dave's Place photo 1 of 2")
  })
})

describe('RestaurantCard (voting variant)', () => {
  it('should render name in photo overlay', () => {
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    expect(screen.getByText("Dave's Place")).toBeInTheDocument()
  })

  it('should render rating in overlay', () => {
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('should render price label in overlay', () => {
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    expect(screen.getByText('$$')).toBeInTheDocument()
  })

  it('should render address as a map link', () => {
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    expect(screen.getByText('123 Main St, Columbia')).toBeInTheDocument()
  })

  it('should render More details toggle when details exist', async () => {
    const user = userEvent.setup()
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    const toggle = screen.getByText('More details')
    await user.click(toggle)
    expect(screen.getByText('Hide details')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '(555) 123-4567' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://example.com' })).toBeInTheDocument()
  })

  it('should render hours in details', async () => {
    const user = userEvent.setup()
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    await user.click(screen.getByText('More details'))
    expect(screen.getByText('Monday: 9:00 AM – 5:00 PM')).toBeInTheDocument()
  })

  it('should call onClick when card is clicked', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    render(<RestaurantCard choice={baseChoice} onClick={handleClick} variant="voting" />)
    await user.click(screen.getByText("Dave's Place"))
    expect(handleClick).toHaveBeenCalled()
  })

  it('should not call onClick when disabled', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    render(<RestaurantCard choice={baseChoice} disabled onClick={handleClick} variant="voting" />)
    await user.click(screen.getByText("Dave's Place"))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should show chosen overlay when selected is true', () => {
    const { container } = render(<RestaurantCard choice={baseChoice} selected={true} variant="voting" />)
    expect(container.querySelector('[class*="0A0A0B"]')).toBeInTheDocument()
  })

  it('should show rejected overlay when selected is false', () => {
    const { container } = render(<RestaurantCard choice={baseChoice} selected={false} variant="voting" />)
    expect(container.querySelector('.bg-black\\/60')).toBeInTheDocument()
  })

  it('should render carousel when multiple photos in voting variant', () => {
    const multiPhotoChoice = {
      ...baseChoice,
      photos: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    }
    render(<RestaurantCard choice={multiPhotoChoice} variant="voting" />)
    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBeGreaterThanOrEqual(2)
  })

  it('should render single image when only one photo in voting variant', () => {
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    const img = screen.getByRole('img', { name: "Dave's Place" })
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('should render placeholder when no photos in voting variant', () => {
    const noPhotoChoice = { ...baseChoice, photos: [] }
    const { container } = render(<RestaurantCard choice={noPhotoChoice} variant="voting" />)
    // Should render the UtensilsCrossed placeholder
    expect(container.querySelector('.h-60')).toBeInTheDocument()
  })

  it('should not render details section when no address or details', () => {
    const minimalChoice = {
      ...baseChoice,
      formattedAddress: undefined,
      formattedPhoneNumber: undefined,
      openHours: undefined,
      placeTypes: undefined,
      website: undefined,
    }
    render(<RestaurantCard choice={minimalChoice} variant="voting" />)
    expect(screen.queryByText('More details')).not.toBeInTheDocument()
  })

  it('should handle image load event', () => {
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    const img = screen.getByRole('img', { name: "Dave's Place" })
    fireEvent.load(img)
    expect(img.className).toContain('opacity-100')
  })

  it('should render without priceLevel', () => {
    const noPriceChoice = { ...baseChoice, priceLevel: undefined }
    render(<RestaurantCard choice={noPriceChoice} variant="voting" />)
    expect(screen.getByText("Dave's Place")).toBeInTheDocument()
  })

  it('should render without rating', () => {
    const noRatingChoice = { ...baseChoice, rating: undefined, ratingsTotal: undefined }
    render(<RestaurantCard choice={noRatingChoice} variant="voting" />)
    expect(screen.getByText("Dave's Place")).toBeInTheDocument()
  })
})

describe('RestaurantCard place type chips', () => {
  it('should render place type chips alphabetically in voting details', async () => {
    const user = userEvent.setup()
    render(<RestaurantCard choice={baseChoice} variant="voting" />)
    await user.click(screen.getByText('More details'))
    const chips = screen.getAllByText(/^(American|Bar|Cafe)$/)
    expect(chips).toHaveLength(3)
    // Verify alphabetical order
    expect(chips[0]).toHaveTextContent('American')
    expect(chips[1]).toHaveTextContent('Bar')
    expect(chips[2]).toHaveTextContent('Cafe')
  })

  it('should not render chips in voting details when placeTypes is empty', async () => {
    const user = userEvent.setup()
    const noTypesChoice = { ...baseChoice, placeTypes: [] }
    render(<RestaurantCard choice={noTypesChoice} variant="voting" />)
    await user.click(screen.getByText('More details'))
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
  })

  it('should not render chips in voting details when placeTypes is undefined', async () => {
    const user = userEvent.setup()
    const noTypesChoice = { ...baseChoice, placeTypes: undefined }
    render(<RestaurantCard choice={noTypesChoice} variant="voting" />)
    await user.click(screen.getByText('More details'))
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
  })

  it('should show More details toggle when placeTypes is the only detail', () => {
    const typesOnlyChoice = {
      ...baseChoice,
      formattedPhoneNumber: undefined,
      openHours: undefined,
      website: undefined,
    }
    render(<RestaurantCard choice={typesOnlyChoice} variant="voting" />)
    expect(screen.getByText('More details')).toBeInTheDocument()
  })

  it('should render place type chips on winner card without toggle', () => {
    render(<RestaurantCard choice={baseChoice} variant="winner" />)
    // Chips should be visible immediately — no "More details" toggle
    expect(screen.queryByText('More details')).not.toBeInTheDocument()
    expect(screen.getByText('American')).toBeInTheDocument()
    expect(screen.getByText('Bar')).toBeInTheDocument()
    expect(screen.getByText('Cafe')).toBeInTheDocument()
  })

  it('should render place type chips alphabetically on winner card', () => {
    const reverseChoice = { ...baseChoice, placeTypes: ['Sushi', 'Italian', 'BBQ'] }
    render(<RestaurantCard choice={reverseChoice} variant="winner" />)
    const chips = screen.getAllByText(/^(BBQ|Italian|Sushi)$/)
    expect(chips[0]).toHaveTextContent('BBQ')
    expect(chips[1]).toHaveTextContent('Italian')
    expect(chips[2]).toHaveTextContent('Sushi')
  })

  it('should not render chips on winner card when placeTypes is undefined', () => {
    const noTypesChoice = { ...baseChoice, placeTypes: undefined }
    render(<RestaurantCard choice={noTypesChoice} variant="winner" />)
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
  })

  it('should render place type chips on default card without toggle', () => {
    render(<RestaurantCard choice={baseChoice} />)
    expect(screen.queryByText('More details')).not.toBeInTheDocument()
    expect(screen.getByText('American')).toBeInTheDocument()
    expect(screen.getByText('Bar')).toBeInTheDocument()
    expect(screen.getByText('Cafe')).toBeInTheDocument()
  })

  it('should render place type chips alphabetically on default card', () => {
    const reverseChoice = { ...baseChoice, placeTypes: ['Sushi', 'Italian', 'BBQ'] }
    render(<RestaurantCard choice={reverseChoice} />)
    const chips = screen.getAllByText(/^(BBQ|Italian|Sushi)$/)
    expect(chips[0]).toHaveTextContent('BBQ')
    expect(chips[1]).toHaveTextContent('Italian')
    expect(chips[2]).toHaveTextContent('Sushi')
  })

  it('should not render chips on default card when placeTypes is undefined', () => {
    const noTypesChoice = { ...baseChoice, placeTypes: undefined }
    render(<RestaurantCard choice={noTypesChoice} />)
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
  })
})

describe('RestaurantCard winner variant hours', () => {
  it('should render hours expanded without a toggle on winner card', () => {
    render(<RestaurantCard choice={baseChoice} variant="winner" />)
    // Hours should be visible immediately
    expect(screen.getByText('Monday: 9:00 AM – 5:00 PM')).toBeInTheDocument()
    expect(screen.getByText('Tuesday: 9:00 AM – 5:00 PM')).toBeInTheDocument()
    // No accordion trigger or toggle
    expect(screen.queryByText('More details')).not.toBeInTheDocument()
    expect(screen.queryByText('Hide details')).not.toBeInTheDocument()
  })

  it('should render hours on default variant expanded without a toggle', () => {
    render(<RestaurantCard choice={baseChoice} />)
    expect(screen.getByText('Monday: 9:00 AM – 5:00 PM')).toBeInTheDocument()
    expect(screen.getByText('Tuesday: 9:00 AM – 5:00 PM')).toBeInTheDocument()
  })
})
