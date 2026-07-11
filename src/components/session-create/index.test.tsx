import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { sessionConfigResult, recaptchaToken, sessionId } from '@test/__mocks__'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from 'aws-amplify/api'
import { useRouter } from 'next/router'
import React from 'react'

import SessionCreate from './index'
import * as api from '@services/api'

const mockPush = jest.fn()
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockReturnValue({ push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('@components/auth-context')
jest.mock('@services/api')

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('SessionCreate component', () => {
  const address = '90210'

  const grecaptchaExecute = jest.fn()
  const grecaptchaReady = jest.fn((cb: () => void) => cb())
  const originalRandom = Math.random

  beforeAll(() => {
    Math.random = jest.fn(() => 0.5)
    jest.mocked(api).fetchSessionConfig.mockResolvedValue(sessionConfigResult)
    jest.mocked(api).fetchAddress.mockResolvedValue({ address })
    jest.mocked(api).createSession.mockResolvedValue({ sessionId })
    jest.mocked(useRouter).mockReturnValue({ push: mockPush, replace: jest.fn() } as any)

    console.error = jest.fn()
    Object.defineProperty(window, 'grecaptcha', {
      configurable: true,
      value: { execute: grecaptchaExecute, ready: grecaptchaReady },
    })
    grecaptchaExecute.mockResolvedValue(recaptchaToken)
  })

  afterAll(() => {
    Math.random = originalRandom
  })

  describe('form validation', () => {
    it('should show error when no address entered', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      expect(await screen.findByText(/Please enter your address to begin/i)).toBeInTheDocument()
    })

    it('should show error when no restaurant type is selected', async () => {
      jest.mocked(api).fetchSessionConfig.mockResolvedValueOnce({
        ...sessionConfigResult,
        placeTypes: [],
      })
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const addressInput = await screen.findByLabelText(/Your location/i)
      await act(async () => {
        await user.clear(addressInput)
        await user.type(addressInput, address)
      })

      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      expect(await screen.findByText(/Please select at least one restaurant type/i)).toBeInTheDocument()
    })
  })

  describe('session creation', () => {
    it('should call createSession with correct payload and redirect on success', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const addressInput = await screen.findByLabelText(/Your location/i)
      await act(async () => {
        await user.clear(addressInput)
        await user.type(addressInput, address)
      })

      const milesSliderInput = await screen.findByRole('slider', { name: /Maximum distance/i })
      fireEvent.change(milesSliderInput, { target: { value: 1 } })

      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      await waitFor(() => expect(api.createSession).toHaveBeenCalled())
      expect(grecaptchaExecute).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, {
        action: 'CREATE_SESSION',
      })
      expect(api.createSession).toHaveBeenCalledWith(
        {
          address: '90210',
          exclude: ['fast_food_restaurant'],
          filterClosingSoon: false,
          maxChoices: 20,
          radiusMiles: 1,
          rankBy: 'POPULARITY',
          type: ['restaurant'],
        },
        recaptchaToken,
      )
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/s/${sessionId}`))
    })

    it('should show 403 error message', async () => {
      const error = new ApiError({
        message: 'Forbidden',
        name: 'ApiError',
        recoverySuggestion: '',
      })
      Object.defineProperty(error, 'response', {
        get: () => ({ statusCode: 403, headers: {}, body: '{}' }),
      })
      jest.mocked(api).createSession.mockRejectedValueOnce(error)
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const addressInput = await screen.findByLabelText(/Your location/i)
      await act(async () => {
        await user.clear(addressInput)
        await user.type(addressInput, address)
      })

      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      expect(await screen.findByText(/Unusual traffic detected/i)).toBeInTheDocument()
    })

    it('should show generic error message on non-403 error', async () => {
      jest.mocked(api).createSession.mockRejectedValueOnce(new Error('Server error'))
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const addressInput = await screen.findByLabelText(/Your location/i)
      await act(async () => {
        await user.clear(addressInput)
        await user.type(addressInput, address)
      })

      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      expect(await screen.findByText(/Something went wrong setting up your restaurants/i)).toBeInTheDocument()
    })
  })

  describe('type selection', () => {
    it('should handle mustBeSingleType selection', async () => {
      const singleTypeChoice = { display: 'Single Type', mustBeSingleType: true, value: 'single_type' }
      const regularChoice = { display: 'Regular Type', value: 'regular_type' }
      jest.mocked(api).fetchSessionConfig.mockResolvedValueOnce({
        ...sessionConfigResult,
        placeTypes: [singleTypeChoice, regularChoice],
      })

      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const trigger = await screen.findByLabelText(/Restaurant type/i, { selector: 'button' })
      await act(async () => {
        await user.click(trigger)
      })

      const singleTypeOption = await screen.findByRole('option', { name: 'Single Type' })
      await act(async () => {
        await user.click(singleTypeOption)
      })

      expect(screen.getAllByText('Single Type').length).toBeGreaterThanOrEqual(1)
    })

    it('should handle excluded types selection', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const trigger = await screen.findByLabelText(/Excluded types/i, { selector: 'button' })
      await act(async () => {
        await user.click(trigger)
      })

      const fastFoodOption = await screen.findByRole('option', { name: 'Fast food' })
      await act(async () => {
        await user.click(fastFoodOption)
      })

      expect(trigger).toBeInTheDocument()
    })

    it('should toggle restaurant type off when already selected', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      // "Any restaurant" is selected by default (defaultType: true)
      const trigger = await screen.findByLabelText(/Restaurant type/i, { selector: 'button' })
      await act(async () => {
        await user.click(trigger)
      })

      // Click "Any restaurant" to deselect it
      const restaurantOption = await screen.findByRole('option', { name: 'Any restaurant' })
      await act(async () => {
        await user.click(restaurantOption)
      })

      expect(trigger).toBeInTheDocument()
    })

    it('should add a non-single type alongside existing types', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const trigger = await screen.findByLabelText(/Restaurant type/i, { selector: 'button' })
      await act(async () => {
        await user.click(trigger)
      })

      // Add "Cat cafe" alongside the default "Any restaurant"
      const catCafeOption = await screen.findByRole('option', { name: 'Cat cafe' })
      await act(async () => {
        await user.click(catCafeOption)
      })

      expect(trigger).toBeInTheDocument()
    })

    it('should toggle excluded type off when already selected', async () => {
      // Fast food is defaultExclude: true, so it starts selected
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const trigger = await screen.findByLabelText(/Excluded types/i, { selector: 'button' })

      // Wait for defaults to apply
      await screen.findByText(/Find restaurants/i)

      await act(async () => {
        await user.click(trigger)
      })

      // Click "Fast food" to deselect it (it's already selected as default exclude)
      const fastFoodOption = await screen.findByRole('option', { name: 'Fast food' })
      await act(async () => {
        await user.click(fastFoodOption)
      })

      expect(trigger).toBeInTheDocument()
    })

    it('should remove a tag when the remove button is clicked', async () => {
      renderWithClient(<SessionCreate />)

      // Wait for defaults to apply - "Any restaurant" should be a tag in the Restaurant type field
      await screen.findByText(/Find restaurants/i)

      const user = userEvent.setup()
      // Find the remove button on the "Any restaurant" tag
      const removeButtons = await screen.findAllByLabelText(/Remove tag/i)
      expect(removeButtons.length).toBeGreaterThan(0)

      await act(async () => {
        await user.click(removeButtons[0])
      })

      expect(screen.getByText(/Find restaurants/i)).toBeInTheDocument()
    })
  })

  describe('sort by', () => {
    it('should default to Most popular (POPULARITY)', async () => {
      renderWithClient(<SessionCreate />)

      const popularRadio = await screen.findByRole('radio', { name: /Most popular/i })
      expect(popularRadio).toBeChecked()
    })

    it('should change rankBy when radio clicked', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const closestRadio = await screen.findByRole('radio', { name: /Closest/i })
      await act(async () => {
        await user.click(closestRadio)
      })

      expect(closestRadio).toBeChecked()
    })

    it('should allow selecting Both after Most popular', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const bothRadio = await screen.findByRole('radio', { name: /Both/i })
      await act(async () => {
        await user.click(bothRadio)
      })

      expect(bothRadio).toBeChecked()
      expect(screen.getByRole('radio', { name: /Most popular/i })).not.toBeChecked()
    })
  })

  describe('max choices slider', () => {
    it('should render with the default maxChoices from the first sort option', async () => {
      renderWithClient(<SessionCreate />)

      await screen.findByText(/Find restaurants/i)
      const slider = screen.getByRole('slider', { name: /Maximum restaurants/i }) as HTMLInputElement
      expect(Number(slider.value)).toBe(20)
    })

    it('should update the vote count hint when slider value changes', async () => {
      renderWithClient(<SessionCreate />)

      await screen.findByText(/Find restaurants/i)
      const slider = screen.getByRole('slider', { name: /Maximum restaurants/i })
      fireEvent.change(slider, { target: { value: 10 } })

      // The hint shows votes per person (maxChoices - 1 = 9), which only appears in the hint
      expect(await screen.findByText(/Up to/i)).toBeInTheDocument()
      expect(screen.getByText('9')).toBeInTheDocument()
    })

    it('should jump to new max when switching sort option from its max value', async () => {
      renderWithClient(<SessionCreate />)

      // Default: POPULARITY (max 20), maxChoices defaults to 20 (the max)
      await screen.findByText(/Find restaurants/i)

      const user = userEvent.setup()
      const bothRadio = await screen.findByRole('radio', { name: /Both/i })
      await act(async () => {
        await user.click(bothRadio)
      })

      // Was at max (20/20), switching to Both (max 40) → should become 40
      const slider = screen.getByRole('slider', { name: /Maximum restaurants/i }) as HTMLInputElement
      expect(Number(slider.value)).toBe(40)
    })

    it('should keep value when switching to a higher-ceiling sort option below old max', async () => {
      renderWithClient(<SessionCreate />)

      await screen.findByText(/Find restaurants/i)
      const slider = screen.getByRole('slider', { name: /Maximum restaurants/i })
      fireEvent.change(slider, { target: { value: 15 } })

      const user = userEvent.setup()
      const bothRadio = await screen.findByRole('radio', { name: /Both/i })
      await act(async () => {
        await user.click(bothRadio)
      })

      // Was at 15/20, switching to Both (max 40) → stays 15
      expect(Number((screen.getByRole('slider', { name: /Maximum restaurants/i }) as HTMLInputElement).value)).toBe(15)
    })

    it('should clamp to new max when switching to a lower-ceiling sort option', async () => {
      renderWithClient(<SessionCreate />)

      await screen.findByText(/Find restaurants/i)

      // Start on Both (max 40)
      const user = userEvent.setup()
      const bothRadio = await screen.findByRole('radio', { name: /Both/i })
      await act(async () => {
        await user.click(bothRadio)
      })

      // Set slider to 30
      const slider = screen.getByRole('slider', { name: /Maximum restaurants/i })
      fireEvent.change(slider, { target: { value: 30 } })

      // Switch to POPULARITY (max 20) → should clamp to 20
      const popularRadio = await screen.findByRole('radio', { name: /Most popular/i })
      await act(async () => {
        await user.click(popularRadio)
      })

      expect(Number((screen.getByRole('slider', { name: /Maximum restaurants/i }) as HTMLInputElement).value)).toBe(20)
    })

    it('should include maxChoices in the createSession payload', async () => {
      renderWithClient(<SessionCreate />)

      await screen.findByText(/Find restaurants/i)
      const slider = screen.getByRole('slider', { name: /Maximum restaurants/i })
      fireEvent.change(slider, { target: { value: 12 } })

      const user = userEvent.setup()
      const addressInput = await screen.findByLabelText(/Your location/i)
      await act(async () => {
        await user.clear(addressInput)
        await user.type(addressInput, address)
      })

      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      await waitFor(() => expect(api.createSession).toHaveBeenCalled())
      expect(api.createSession).toHaveBeenCalledWith(expect.objectContaining({ maxChoices: 12 }), recaptchaToken)
    })
  })

  describe('filter closing soon toggle', () => {
    it('should render the toggle defaulting to off', async () => {
      renderWithClient(<SessionCreate />)
      const toggle = await screen.findByRole('switch', { name: /Skip closed & closing places/i })
      expect(toggle).toBeInTheDocument()
      expect(toggle).not.toBeChecked()
    })

    it('should send filterClosingSoon true when toggle is enabled', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const toggle = await screen.findByRole('switch', { name: /Skip closed & closing places/i })
      await act(async () => {
        await user.click(toggle)
      })
      expect(toggle).toBeChecked()

      const addressInput = await screen.findByLabelText(/Your location/i)
      await act(async () => {
        await user.clear(addressInput)
        await user.type(addressInput, '90210')
      })

      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      await waitFor(() => expect(api.createSession).toHaveBeenCalled())
      expect(api.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ filterClosingSoon: true }),
        recaptchaToken,
      )
    })
  })

  describe('default miles from config', () => {
    it('should send defaultMiles as radiusMiles when user does not change slider', async () => {
      renderWithClient(<SessionCreate />)

      const user = userEvent.setup()
      const addressInput = await screen.findByLabelText(/Your location/i)
      await act(async () => {
        await user.clear(addressInput)
        await user.type(addressInput, address)
      })

      const chooseButton = await screen.findByRole('button', { name: /Find restaurants/i })
      await act(async () => {
        await user.click(chooseButton)
      })

      await waitFor(() => expect(api.createSession).toHaveBeenCalled())
      expect(api.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ radiusMiles: sessionConfigResult.radius.defaultMiles }),
        recaptchaToken,
      )
    })

    it('should display the defaultMiles value in the distance label', async () => {
      renderWithClient(<SessionCreate />)

      await screen.findByText(/Find restaurants/i)
      expect(screen.getByText(`${sessionConfigResult.radius.defaultMiles} miles`)).toBeInTheDocument()
    })

    it('should respect a different defaultMiles value from backend', async () => {
      jest.mocked(api).fetchSessionConfig.mockResolvedValueOnce({
        ...sessionConfigResult,
        radius: { defaultMiles: 5, minMiles: 1, maxMiles: 20 },
      })
      renderWithClient(<SessionCreate />)

      await screen.findByText(/Find restaurants/i)
      expect(screen.getByText('5 miles')).toBeInTheDocument()
    })
  })

  describe('config loading', () => {
    it('should show loading state while config is being fetched', () => {
      jest.mocked(api).fetchSessionConfig.mockReturnValueOnce(new Promise(() => {}))
      renderWithClient(<SessionCreate />)

      expect(screen.getByText(/Scouting the competition/i)).toBeInTheDocument()
      expect(screen.queryByText(/Find restaurants/i)).not.toBeInTheDocument()
    })

    it('should show error message when config fetch fails', async () => {
      jest.mocked(api).fetchSessionConfig.mockRejectedValueOnce(new Error('Network error'))
      renderWithClient(<SessionCreate />)

      expect(await screen.findByText(/We couldn't load your options/i)).toBeInTheDocument()
      expect(screen.queryByText(/Find restaurants/i)).not.toBeInTheDocument()
    })

    it('should call reload when Refresh button is clicked on error state', async () => {
      jest.mocked(api).fetchSessionConfig.mockRejectedValueOnce(new Error('Network error'))
      const reloadMock = jest.fn()
      Object.defineProperty(window, 'location', { configurable: true, value: { reload: reloadMock } })

      const user = userEvent.setup()
      renderWithClient(<SessionCreate />)

      const refreshButton = await screen.findByText('Refresh')
      await user.click(refreshButton)

      expect(reloadMock).toHaveBeenCalled()
    })
  })
})
