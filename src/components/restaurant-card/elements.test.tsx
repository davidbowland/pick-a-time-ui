import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { PlaceTypeChips } from './elements'

describe('PlaceTypeChips component', () => {
  const fewTypes = ['Italian', 'Pizza', 'Cafe']
  const manyTypes = ['Italian', 'Pizza', 'Cafe', 'Bar', 'Bakery', 'Seafood', 'Sushi', 'Grill']

  describe('with types within the limit', () => {
    it('should render all types as pills', () => {
      render(<PlaceTypeChips types={fewTypes} />)

      expect(screen.getByText('Cafe')).toBeInTheDocument()
      expect(screen.getByText('Italian')).toBeInTheDocument()
      expect(screen.getByText('Pizza')).toBeInTheDocument()
    })

    it('should sort types alphabetically', () => {
      render(<PlaceTypeChips types={['Zebra', 'Apple', 'Mango']} />)

      const pills = screen.getAllByText(/Zebra|Apple|Mango/)
      expect(pills[0]).toHaveTextContent('Apple')
      expect(pills[1]).toHaveTextContent('Mango')
      expect(pills[2]).toHaveTextContent('Zebra')
    })

    it('should not show a toggle button', () => {
      render(<PlaceTypeChips types={fewTypes} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('with types exceeding the limit', () => {
    it('should show only 5 types initially', () => {
      render(<PlaceTypeChips types={manyTypes} />)

      const sorted = [...manyTypes].sort()
      sorted.slice(0, 5).forEach((type) => {
        expect(screen.getByText(type)).toBeInTheDocument()
      })
      sorted.slice(5).forEach((type) => {
        expect(screen.queryByText(type)).not.toBeInTheDocument()
      })
    })

    it('should show a button with the hidden count', () => {
      render(<PlaceTypeChips types={manyTypes} />)

      expect(screen.getByRole('button', { name: /show 3 more place types/i })).toBeInTheDocument()
      expect(screen.getByText('Show 3 more')).toBeInTheDocument()
    })

    it('should expand to show all types when button is clicked', async () => {
      const user = userEvent.setup()
      render(<PlaceTypeChips types={manyTypes} />)

      await user.click(screen.getByRole('button', { name: /show 3 more place types/i }))

      const sorted = [...manyTypes].sort()
      sorted.forEach((type) => {
        expect(screen.getByText(type)).toBeInTheDocument()
      })
    })

    it('should show "Show less" button after expanding', async () => {
      const user = userEvent.setup()
      render(<PlaceTypeChips types={manyTypes} />)

      await user.click(screen.getByRole('button', { name: /show 3 more place types/i }))

      expect(screen.getByRole('button', { name: /show fewer place types/i })).toBeInTheDocument()
      expect(screen.getByText('Show less')).toBeInTheDocument()
    })

    it('should collapse back when "Show less" is clicked', async () => {
      const user = userEvent.setup()
      render(<PlaceTypeChips types={manyTypes} />)

      await user.click(screen.getByRole('button', { name: /show 3 more place types/i }))
      await user.click(screen.getByRole('button', { name: /show fewer place types/i }))

      const sorted = [...manyTypes].sort()
      sorted.slice(5).forEach((type) => {
        expect(screen.queryByText(type)).not.toBeInTheDocument()
      })
      expect(screen.getByText('Show 3 more')).toBeInTheDocument()
    })
  })

  describe('with exactly 5 types', () => {
    it('should render all types without a toggle button', () => {
      const exactTypes = ['A', 'B', 'C', 'D', 'E']
      render(<PlaceTypeChips types={exactTypes} />)

      exactTypes.forEach((type) => {
        expect(screen.getByText(type)).toBeInTheDocument()
      })
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
