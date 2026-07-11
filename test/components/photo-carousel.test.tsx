import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import PhotoCarousel from '@components/photo-carousel'

// Embla mock that exposes select/reInit listeners so we can exercise onSelect + onThumbClick
let selectCb: (() => void) | null = null
let reInitCb: (() => void) | null = null

const mockMainApi: {
  selectedScrollSnap: jest.Mock
  scrollTo: jest.Mock
  on: jest.Mock
  off: jest.Mock
} = {
  selectedScrollSnap: jest.fn(() => 0),
  scrollTo: jest.fn(),
  on: jest.fn((event: string, cb: () => void) => {
    if (event === 'select') selectCb = cb
    if (event === 'reInit') reInitCb = cb
    return mockMainApi
  }),
  off: jest.fn(() => mockMainApi),
}

const mockThumbsApi = {
  scrollTo: jest.fn(),
}

jest.mock('embla-carousel-react', () => ({
  __esModule: true,
  default: jest.fn((opts?: Record<string, unknown>) => {
    if (opts && opts.dragFree) {
      return [React.createRef(), mockThumbsApi]
    }
    return [React.createRef(), mockMainApi]
  }),
}))

const images = [
  { src: 'https://example.com/1.jpg', alt: 'Photo 1 of 3' },
  { src: 'https://example.com/2.jpg', alt: 'Photo 2 of 3' },
  { src: 'https://example.com/3.jpg', alt: 'Photo 3 of 3' },
]

describe('PhotoCarousel', () => {
  beforeEach(() => {
    selectCb = null
    reInitCb = null
    mockMainApi.selectedScrollSnap.mockReturnValue(0)
    mockMainApi.scrollTo.mockClear()
    mockThumbsApi.scrollTo.mockClear()
    mockMainApi.on.mockClear()
    mockMainApi.off.mockClear()
  })

  it('should render all main images', () => {
    render(<PhotoCarousel images={images} />)
    const namedImgs = screen.getAllByRole('img').filter((img) => img.getAttribute('alt') !== '')
    expect(namedImgs).toHaveLength(3)
    expect(namedImgs[0]).toHaveAttribute('src', 'https://example.com/1.jpg')
    expect(namedImgs[2]).toHaveAttribute('src', 'https://example.com/3.jpg')
  })

  it('should render thumbnail buttons for each image', () => {
    render(<PhotoCarousel images={images} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveAttribute('aria-label', 'Photo 1 of 3')
    expect(buttons[2]).toHaveAttribute('aria-label', 'Photo 3 of 3')
  })

  it('should mark thumbnail images as decorative', () => {
    const { container } = render(<PhotoCarousel images={images} />)
    const thumbImgs = container.querySelectorAll('button img')
    thumbImgs.forEach((img) => expect(img).toHaveAttribute('alt', ''))
  })

  it('should highlight the first thumbnail by default', () => {
    render(<PhotoCarousel images={images} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0].className).toContain('ring-2')
    expect(buttons[1].className).toContain('opacity-50')
  })

  it('should scroll to the clicked thumbnail index', async () => {
    const user = userEvent.setup()
    render(<PhotoCarousel images={images} />)
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[1])
    expect(mockMainApi.scrollTo).toHaveBeenCalledWith(1)
  })

  it('should update selected index on select event', () => {
    render(<PhotoCarousel images={images} />)
    mockMainApi.selectedScrollSnap.mockReturnValue(2)
    act(() => {
      selectCb?.()
    })
    const buttons = screen.getAllByRole('button')
    expect(buttons[2].className).toContain('ring-2')
    expect(buttons[0].className).toContain('opacity-50')
  })

  it('should sync thumbs on reInit event', () => {
    render(<PhotoCarousel images={images} />)
    mockMainApi.selectedScrollSnap.mockReturnValue(1)
    act(() => {
      reInitCb?.()
    })
    expect(mockThumbsApi.scrollTo).toHaveBeenCalledWith(1)
  })

  it('should render dot indicators when showThumbnails is false', () => {
    render(<PhotoCarousel images={images} showThumbnails={false} />)
    const allButtons = screen.getAllByRole('button')
    const dots = allButtons.filter((btn) => btn.getAttribute('aria-label')?.startsWith('Photo'))
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveAttribute('aria-label', 'Photo 1')
  })

  it('should not render dots when showThumbnails is false and only one image', () => {
    render(<PhotoCarousel images={[images[0]]} showThumbnails={false} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('should render overlay when provided', () => {
    render(<PhotoCarousel images={images} overlay={<span>Overlay</span>} />)
    expect(screen.getByText('Overlay')).toBeInTheDocument()
  })

  it('should scroll to dot index when clicked', async () => {
    const user = userEvent.setup()
    render(<PhotoCarousel images={images} showThumbnails={false} />)
    const allButtons = screen.getAllByRole('button')
    const dots = allButtons.filter((btn) => btn.getAttribute('aria-label')?.startsWith('Photo'))
    await user.click(dots[2])
    expect(mockMainApi.scrollTo).toHaveBeenCalledWith(2)
  })

  describe('with null embla API', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const useEmblaCarousel = jest.mocked(require('embla-carousel-react').default)

    beforeEach(() => {
      useEmblaCarousel.mockImplementation(() => [React.createRef(), null])
    })

    afterEach(() => {
      useEmblaCarousel.mockImplementation((opts?: Record<string, unknown>) => {
        if (opts && opts.dragFree) return [React.createRef(), mockThumbsApi]
        return [React.createRef(), mockMainApi]
      })
    })

    it('should render without crashing', () => {
      render(<PhotoCarousel images={images} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
    })
  })
})
