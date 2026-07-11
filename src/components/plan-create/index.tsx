import { useMutation } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'

import { CreateCard, HourRangeFields, PlanNameField, WeekCountStepper, WeekdayPicker } from './elements'
import FeedbackMessage from '@components/feedback-message'
import { PillArrowButton } from '@components/pill-arrow-button'
import { createPlan, parseApiMessage } from '@services/api'

const RECAPTCHA_SCRIPT_ID = 'recaptcha-v3-script'
const RECAPTCHA_TIMEOUT_MS = 10_000

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

const MIN_HOUR = 0
const MAX_HOUR = 24

function nextOccurrenceOf(weekday: number, now: () => Date = () => new Date()): string {
  const from = now()
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const diff = (weekday - date.getDay() + 7) % 7
  date.setDate(date.getDate() + diff)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const PlanCreate = (): React.ReactNode => {
  const router = useRouter()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [weekCount, setWeekCount] = useState(6)
  const [startHour, setStartHour] = useState(16)
  const [endHour, setEndHour] = useState(20)
  const [hourError, setHourError] = useState<string | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    if (!document.getElementById(RECAPTCHA_SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = RECAPTCHA_SCRIPT_ID
      script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const planMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createPlan>[0]) => {
      await waitForRecaptcha()
      const token = await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'CREATE_PLAN' })
      return createPlan(input, token)
    },
    onSuccess: (data) => {
      setIsNavigating(true)
      router.push(`/p/${data.sessionId}`)
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.response?.statusCode === 403) {
        setErrorMessage("You're going a bit fast — try again in a minute.")
        return
      }
      if (error instanceof ApiError && error.response?.statusCode === 400) {
        setErrorMessage(parseApiMessage(error.response.body, 'Something went wrong setting up your plan. Try again.'))
        return
      }
      setErrorMessage('Something went wrong setting up your plan. Try again.')
    },
  })

  const handleSubmit = (): void => {
    if (!name.trim()) {
      setNameError("Name your plan so people know what they're joining")
      return
    }
    setNameError(undefined)
    if (weekdays.length === 0) {
      setErrorMessage('Pick at least one day of the week')
      return
    }
    const isValidHour = (hour: number): boolean => Number.isInteger(hour) && hour >= MIN_HOUR && hour <= MAX_HOUR
    if (!isValidHour(startHour) || !isValidHour(endHour)) {
      setHourError('Pick a valid start and end time')
      return
    }
    if (endHour <= startHour) {
      setHourError('End time must be after the start time')
      return
    }
    setHourError(undefined)

    planMutation.mutate({
      name: name.trim(),
      weekdays,
      startDate: nextOccurrenceOf(weekdays[0]),
      weekCount,
      startHour,
      endHour,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  }

  const isLoading = planMutation.isPending || isNavigating

  return (
    <>
      <CreateCard>
        <PlanNameField error={nameError} onChange={setName} value={name} />
        <WeekdayPicker onChange={setWeekdays} selected={weekdays} />
        <WeekCountStepper onChange={setWeekCount} value={weekCount} />
        <HourRangeFields
          endHour={endHour}
          error={hourError}
          onChangeEnd={setEndHour}
          onChangeStart={setStartHour}
          startHour={startHour}
        />
        <PillArrowButton isLoading={isLoading} label="Start a plan" loadingLabel="Starting..." onPress={handleSubmit} />
      </CreateCard>
      <FeedbackMessage
        autoHideDuration={15_000}
        message={errorMessage}
        onClose={() => setErrorMessage(undefined)}
        severity="error"
      />
    </>
  )
}

export default PlanCreate
