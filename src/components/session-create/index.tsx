import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useState } from 'react'

import {
  AddressField,
  CreateCard,
  DistanceSlider,
  FilterClosingSoonToggle,
  LoadingCard,
  MaxChoicesSlider,
  MultiSelect,
  SortByFieldset,
  SubmitButton,
  UseMyLocationButton,
  VoteCountHint,
} from './elements'
import FeedbackMessage from '@components/feedback-message'
import { createSession, fetchAddress, fetchSessionConfig } from '@services/api'
import { NewSessionRequest, PlaceTypeDisplay, SessionConfig } from '@types'

const RECAPTCHA_SCRIPT_ID = 'recaptcha-v3-script'

const RECAPTCHA_TIMEOUT_MS = 10_000

/** Polls for the reCAPTCHA global then waits for it to be ready. Handles the case where
    the script tag hasn't finished loading yet when this is called. */
const waitForRecaptcha = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + RECAPTCHA_TIMEOUT_MS
    const check = () => {
      if (typeof grecaptcha !== 'undefined' && grecaptcha.ready) {
        grecaptcha.ready(resolve)
      } else if (Date.now() > deadline) {
        reject(new Error('reCAPTCHA failed to load'))
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })

const SessionCreate = (): React.ReactNode => {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [addressError, setAddressError] = useState<string | undefined>()
  const [choiceTypes, setChoiceTypes] = useState<PlaceTypeDisplay[]>([])
  const [excludedTypes, setExcludedTypes] = useState<PlaceTypeDisplay[]>([])
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [maxChoices, setMaxChoices] = useState<number | undefined>()
  const [radiusMiles, setRadiusMiles] = useState<number | undefined>()
  const [rankBy, setRankBy] = useState<string | undefined>()
  const [filterClosingSoon, setFilterClosingSoon] = useState(false)
  const [defaultsApplied, setDefaultsApplied] = useState(false)
  const [locationError, setLocationError] = useState<string | undefined>()
  const [isLocating, setIsLocating] = useState(false)

  const clearError = useCallback(() => setErrorMessage(undefined), [])
  const [isNavigating, setIsNavigating] = useState(false)

  const {
    data: config,
    isLoading: isConfigLoading,
    isError: isConfigError,
  } = useQuery<SessionConfig>({
    queryKey: ['sessionConfig'],
    queryFn: fetchSessionConfig,
    staleTime: Infinity,
  })

  const sessionMutation = useMutation({
    mutationFn: async (session: NewSessionRequest) => {
      await waitForRecaptcha()
      const token = await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'CREATE_SESSION' })
      return createSession(session, token)
    },
    onSuccess: (data) => {
      setIsNavigating(true)
      router.push(`/s/${data.sessionId}`)
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.response?.statusCode === 403) {
        setErrorMessage('Unusual traffic detected. Please try again later.')
      } else {
        setErrorMessage('Something went wrong setting up your restaurants. Try again.')
      }
    },
  })

  useEffect(() => {
    if (!config || defaultsApplied) return
    setChoiceTypes(config.placeTypes.filter((t) => t.defaultType))
    setExcludedTypes(config.placeTypes.filter((t) => t.defaultExclude))
    setRankBy(config.sortOptions[0]?.value)
    setRadiusMiles(config.radius.defaultMiles)
    setMaxChoices(config.sortOptions[0]?.maxChoices)
    setDefaultsApplied(true)
  }, [config, defaultsApplied])

  useEffect(() => {
    if (!document.getElementById(RECAPTCHA_SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = RECAPTCHA_SCRIPT_ID
      script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const handleUseMyLocation = (): void => {
    if (!navigator.geolocation) {
      setLocationError("Location services aren't supported by your browser. Please enter your address manually.")
      return
    }
    setIsLocating(true)
    setLocationError(undefined)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await waitForRecaptcha()
          const token = await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'GEOCODE' })
          const result = await fetchAddress(pos.coords.latitude, pos.coords.longitude, token)
          setAddress(result.address)
        } catch {
          setLocationError("Couldn't look up your address. Please enter it manually.")
        } finally {
          setIsLocating(false)
        }
      },
      (err) => {
        setIsLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access was denied. Please enter your address manually.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('Your location could not be determined. Please enter your address manually.')
        } else if (err.code === err.TIMEOUT) {
          setLocationError('Location request timed out. Please enter your address manually.')
        } else {
          setLocationError('Location is unavailable. Please enter your address manually.')
        }
      },
      { enableHighAccuracy: true },
    )
  }

  const handleRankByChange = (value: string): void => {
    if (!config) return
    const newOption = config.sortOptions.find((o) => o.value === value)
    const oldOption = config.sortOptions.find((o) => o.value === rankBy)
    if (!newOption) return
    setRankBy(value)
    if (maxChoices !== undefined) {
      const oldMax = oldOption?.maxChoices ?? maxChoices
      setMaxChoices(maxChoices >= oldMax ? newOption.maxChoices : Math.min(maxChoices, newOption.maxChoices))
    }
  }

  const handleChoiceTypeChange = (value: string): void => {
    if (!config) return
    const selected = config.placeTypes.find((t) => t.value === value)
    if (!selected) return
    if (selected.mustBeSingleType) {
      setChoiceTypes([selected])
    } else {
      const exists = choiceTypes.find((t) => t.value === value)
      if (exists) {
        setChoiceTypes(choiceTypes.filter((t) => t.value !== value))
      } else {
        setChoiceTypes([...choiceTypes.filter((t) => !t.mustBeSingleType), selected])
      }
    }
  }

  const handleExcludedTypeChange = (value: string): void => {
    if (!config) return
    const selected = config.placeTypes.find((t) => t.value === value && t.canBeExcluded !== false)
    if (!selected) return
    const exists = excludedTypes.find((t) => t.value === value)
    if (exists) {
      setExcludedTypes(excludedTypes.filter((t) => t.value !== value))
    } else {
      setExcludedTypes([...excludedTypes, selected])
    }
  }

  const handleSubmit = (): void => {
    if (radiusMiles === undefined || rankBy === undefined || maxChoices === undefined) return

    if (!address) {
      setAddressError('Please enter your address to begin')
      return
    }
    setAddressError(undefined)

    if (choiceTypes.length === 0) {
      setErrorMessage('Please select at least one restaurant type')
      return
    }

    sessionMutation.mutate({
      address,
      type: choiceTypes.map((t) => t.value),
      exclude: excludedTypes.map((t) => t.value),
      radiusMiles,
      rankBy,
      filterClosingSoon,
      maxChoices,
    })
  }

  if (isConfigLoading) {
    return <LoadingCard />
  }

  if (isConfigError || !config) {
    return <LoadingCard error="We couldn't load your options. Refresh and try again." />
  }

  const isLoading = sessionMutation.isPending || isNavigating

  const selectedSortOption = config.sortOptions.find((o) => o.value === (rankBy ?? config.sortOptions[0]?.value))

  return (
    <>
      <CreateCard>
        <AddressField disabled={isLoading} error={addressError} onChange={(v) => setAddress(v)} value={address} />
        <UseMyLocationButton error={locationError} isLoading={isLocating} onPress={handleUseMyLocation} />
        <MultiSelect
          disabled={isLoading}
          items={config.placeTypes.map((t) => ({ id: t.value, name: t.display }))}
          label="Restaurant type"
          onChange={handleChoiceTypeChange}
          selectedKeys={choiceTypes.map((t) => t.value)}
        />
        <MultiSelect
          disabled={isLoading}
          items={config.placeTypes
            .filter((type) => type.canBeExcluded !== false)
            .map((t) => ({ id: t.value, name: t.display }))}
          label="Excluded types"
          onChange={handleExcludedTypeChange}
          selectedKeys={excludedTypes.map((t) => t.value)}
        />
        <SortByFieldset
          isLoading={isLoading}
          onChange={handleRankByChange}
          options={config.sortOptions}
          rankBy={rankBy ?? config.sortOptions[0]?.value}
        />
        {maxChoices !== undefined && selectedSortOption && (
          <MaxChoicesSlider
            disabled={isLoading}
            max={selectedSortOption.maxChoices}
            min={2}
            onChange={setMaxChoices}
            value={maxChoices}
          />
        )}
        {maxChoices !== undefined && <VoteCountHint maxChoices={maxChoices} />}
        <DistanceSlider
          disabled={isLoading}
          max={config.radius.maxMiles}
          min={config.radius.minMiles}
          onChange={(v) => setRadiusMiles(v)}
          value={radiusMiles ?? config.radius.defaultMiles}
        />
        <FilterClosingSoonToggle checked={filterClosingSoon} disabled={isLoading} onChange={setFilterClosingSoon} />
        <p className="text-center text-xs">Sessions usually expire within 24 hours</p>
        <SubmitButton isLoading={isLoading} onPress={handleSubmit} />
        <p className="text-center text-[10px] text-[#4B5563]">
          Protected by reCAPTCHA &mdash;{' '}
          <a className="underline" href="https://policies.google.com/privacy" rel="noreferrer" target="_blank">
            Privacy
          </a>{' '}
          &amp;{' '}
          <a className="underline" href="https://policies.google.com/terms" rel="noreferrer" target="_blank">
            Terms
          </a>
        </p>
      </CreateCard>
      <FeedbackMessage autoHideDuration={15_000} message={errorMessage} onClose={clearError} severity="error" />
    </>
  )
}

export default SessionCreate
