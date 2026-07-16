import { CalendarDate, getLocalTimeZone, today as calendarToday } from '@internationalized/date'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import { useRouter } from 'next/router'
import React, { useEffect, useId, useRef, useState } from 'react'

import { ChecklistSection } from './checklist-section'
import { DatePickerCalendar } from './date-picker'
import { CreateCard, CreateCardHeader, PollNameField, WeekCountStepper, WeekdayPicker } from './elements'
import {
  computeStartEndMinuteStep,
  computeWeekendOverride,
  formatDaysTimesSummary,
  formatTimeLabel,
  formatWeekdaysSummary,
  generateWeekdayDates,
  reconcilePatternDates,
  updateExcludedDates,
} from './helpers'
import { ScenarioPreset, ScenarioPresets } from './scenario-presets'
import { SummaryDisclosure } from './summary-disclosure'
import { SlotDurationPicker, TimeRangeSlider, TimesToggle, WeekendTimesToggle } from './time-fields'
import { useAuthContext } from '@components/auth-context'
import FeedbackMessage from '@components/feedback-message'
import { PillButton } from '@components/ui/pill-button'
import { VoterNameField } from '@components/ui/voter-name-field'
import { setSessionCookie } from '@hooks/useSessionCookie'
import { createPoll, createPollAuthed, createUser, fetchConfig, parseApiMessage, patchUser } from '@services/api'
import { NewPollRequest } from '@types'
import { isWeekendDate } from '@utils/dates'

const RECAPTCHA_SCRIPT_ID = 'recaptcha-v3-script'
const RECAPTCHA_TIMEOUT_MS = 10_000
const DEFAULT_START_MINUTE = 540 // 9:00 AM
const DEFAULT_END_MINUTE = 1260 // 9:00 PM

type OpenSection = 'name' | 'daysTimes' | 'review'
const SECTION_ORDER: OpenSection[] = ['name', 'daysTimes', 'review']

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

export interface PollCreateProps {
  now?: () => CalendarDate
}

const PollCreate = ({ now = () => calendarToday(getLocalTimeZone()) }: PollCreateProps): React.ReactNode => {
  const router = useRouter()
  const [openSection, setOpenSection] = useState<OpenSection>('name')
  const [furthestIndex, setFurthestIndex] = useState(0)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [dates, setDates] = useState<string[]>([])
  const [datesError, setDatesError] = useState<string | undefined>()
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [daysAreCustom, setDaysAreCustom] = useState(false)
  const [weekCount, setWeekCount] = useState(1)
  const [excludedDates, setExcludedDates] = useState<string[]>([])
  const [usesTimes, setUsesTimes] = useState(false)
  const [showDaysEditor, setShowDaysEditor] = useState(false)
  const [showTimeEditor, setShowTimeEditor] = useState(false)
  const [startMinute, setStartMinute] = useState(DEFAULT_START_MINUTE)
  const [endMinute, setEndMinute] = useState(DEFAULT_END_MINUTE)
  const [slotMinutes, setSlotMinutes] = useState(60)
  const [timesError, setTimesError] = useState<string | undefined>()
  const [weekendsDiffer, setWeekendsDiffer] = useState(false)
  const [weekendStartMinute, setWeekendStartMinute] = useState(DEFAULT_START_MINUTE)
  const [weekendEndMinute, setWeekendEndMinute] = useState(DEFAULT_END_MINUTE)
  const [weekendTimesError, setWeekendTimesError] = useState<string | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)

  // Mirrors `dates`/the pattern's last-generated set synchronously, so the regeneration effect
  // below and `handleDatesChange` never read a stale closure without needing `dates` itself in
  // the effect's dependency array (which would make the effect's own `setDates` call retrigger
  // itself on every run).
  const datesRef = useRef<string[]>([])
  const lastPatternDatesRef = useRef<string[]>([])
  const nameInputRef = useRef<HTMLInputElement>(null)
  const nameSectionRef = useRef<HTMLDivElement>(null)
  const daysTimesSectionRef = useRef<HTMLDivElement>(null)
  const reviewSectionRef = useRef<HTMLDivElement>(null)
  const isFirstOpenSectionRenderRef = useRef(true)
  const calendarRef = useRef<HTMLDivElement>(null)
  const { isSignedIn } = useAuthContext()
  const isSignedInRef = useRef(isSignedIn)
  isSignedInRef.current = isSignedIn
  const [voterName, setVoterName] = useState('')

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: fetchConfig, staleTime: Infinity })
  const daysPanelId = useId()
  const timePanelId = useId()

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hasWeekdayDate = dates.some((d) => !isWeekendDate(d, timezone))
  const hasWeekendDate = dates.some((d) => isWeekendDate(d, timezone))
  const canSplitWeekendTimes =
    hasWeekdayDate && hasWeekendDate && config !== undefined && config.maxPollOverrideGroups >= 1
  const effectiveWeekendsDiffer = weekendsDiffer && canSplitWeekendTimes

  useEffect(() => {
    if (config) setSlotMinutes(config.defaultSlotMinutes)
  }, [config])

  useEffect(() => {
    if (nameError) nameInputRef.current?.focus()
  }, [nameError])

  // Opening the next section can grow or shrink the page height above/around the current scroll
  // position by hundreds of pixels (e.g. the Days & times editor expanding from a one-line
  // summary, or collapsing back to one). scrollTop doesn't move when that happens, so the content
  // that reflows into view at that same offset can land well above or below the section that was
  // just opened. Scrolling the whole (multi-section) card with `block: 'nearest'` only fixes the
  // shrinking case — when the newly-open section is the tall one, the card is taller than the
  // viewport and already partly onscreen, so 'nearest' has nothing to do. Scrolling the
  // newly-opened section itself to the top of the viewport works in both directions. Skipped on
  // the very first render, since 'name' is already in view then.
  useEffect(() => {
    if (isFirstOpenSectionRenderRef.current) {
      isFirstOpenSectionRenderRef.current = false
      return
    }
    const sectionRef = { name: nameSectionRef, daysTimes: daysTimesSectionRef, review: reviewSectionRef }[openSection]
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sectionRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }, [openSection])

  useEffect(() => {
    if (!document.getElementById(RECAPTCHA_SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = RECAPTCHA_SCRIPT_ID
      script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  useEffect(() => {
    if (!config) return
    const anchor = now().toString()
    const maxDate = now().add({ days: config.maxPollDateRangeDays }).toString()
    const rawGenerated = generateWeekdayDates(weekdays, weekCount, anchor)
    const rawPatternDates = rawGenerated.filter((d) => d <= maxDate)
    const droppedForRange = rawGenerated.length - rawPatternDates.length

    const merged = reconcilePatternDates({
      currentDates: datesRef.current,
      previousPatternDates: lastPatternDatesRef.current,
      newPatternDates: rawPatternDates,
      excludedDates,
    })
    const droppedForCap = merged.length > config.maxPollDates
    const finalDates = merged.slice(0, config.maxPollDates)

    const messages: string[] = []
    if (droppedForRange > 0) {
      const noun = droppedForRange === 1 ? 'date' : 'dates'
      const verb = droppedForRange === 1 ? "wasn't" : "weren't"
      messages.push(
        `${droppedForRange} ${noun} beyond the ${config.maxPollDateRangeDays}-day planning window ${verb} added.`,
      )
    }
    if (droppedForCap) {
      messages.push(
        `That pattern generates more dates than this poll allows (max ${config.maxPollDates}) — kept the earliest ${config.maxPollDates} and dropped the rest.`,
      )
    }
    setDatesError(messages.length > 0 ? messages.join(' ') : undefined)

    datesRef.current = finalDates
    lastPatternDatesRef.current = rawPatternDates
    setDates(finalDates)
    // `now` and `dates` are intentionally omitted from this dependency array (this project has no
    // react-hooks/exhaustive-deps lint rule configured, so no suppression comment is needed here):
    // `now`'s default value is a fresh function identity on every render, and this pattern is
    // always anchored to "today," not to whichever render created it; and `dates` itself is
    // deliberately excluded so this effect's own `setDates` call below doesn't retrigger the
    // effect on every run. `datesRef`/`lastPatternDatesRef` give the effect a synchronous read of
    // current state without needing either as a dependency.
  }, [weekdays, weekCount, excludedDates, config])

  const pollMutation = useMutation({
    mutationFn: async (input: NewPollRequest) => {
      if (isSignedInRef.current) return createPollAuthed(input)
      await waitForRecaptcha()
      const token = await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'CREATE_POLL' })
      return createPoll(input, token)
    },
    onSuccess: async (data) => {
      try {
        const newUser = await createUser(data.sessionId, isSignedInRef.current)
        const trimmedVoterName = voterName.trim()
        if (trimmedVoterName && !isSignedInRef.current) {
          await patchUser(
            data.sessionId,
            newUser.userId,
            [{ op: 'replace', path: '/name', value: trimmedVoterName }],
            isSignedInRef.current,
          )
        }
        setSessionCookie(data.sessionId, newUser.userId)
      } catch (err) {
        // The poll itself was created successfully — a failure here just means the creator falls
        // back to the normal auto-create/picker flow on the poll page, same as any first-time visitor.
        console.warn('Post-creation voter setup failed; falling back to standard identity flow', err)
      }
      setIsNavigating(true)
      router.push(`/p/${data.sessionId}`)
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.response?.statusCode === 403) {
        setErrorMessage("You're going a bit fast — try again in a minute.")
        return
      }
      if (error instanceof ApiError && error.response?.statusCode === 400) {
        setErrorMessage(parseApiMessage(error.response.body, 'Something went wrong setting up your poll. Try again.'))
        return
      }
      setErrorMessage('Something went wrong setting up your poll. Try again.')
    },
  })

  const goToNextSection = (): void => {
    const idx = SECTION_ORDER.indexOf(openSection)
    if (idx < SECTION_ORDER.length - 1) {
      const nextIdx = idx + 1
      setOpenSection(SECTION_ORDER[nextIdx])
      setFurthestIndex((prev) => Math.max(prev, nextIdx))
    }
  }

  const handleDatesChange = (next: string[]): void => {
    const previousDates = datesRef.current
    setExcludedDates((prev) =>
      updateExcludedDates({
        excludedDates: prev,
        previousDates,
        nextDates: next,
        patternDates: lastPatternDatesRef.current,
      }),
    )
    datesRef.current = next
    setDates(next)
    setDaysAreCustom(true)
  }

  const handleWeekdaysChange = (next: number[]): void => {
    setWeekdays(next)
    setDaysAreCustom(false)
    setExcludedDates([])
  }

  const handleWeekendsDifferChange = (next: boolean): void => {
    if (next && !weekendsDiffer) {
      setWeekendStartMinute(startMinute)
      setWeekendEndMinute(endMinute)
    }
    setWeekendsDiffer(next)
  }

  const handleApplyScenarioPreset = (preset: ScenarioPreset): void => {
    setWeekdays([...preset.weekdays])
    setDaysAreCustom(false)
    setExcludedDates([])
    setUsesTimes(preset.usesTimes)
    if (preset.usesTimes) {
      setStartMinute(preset.startMinute)
      setEndMinute(preset.endMinute)
      setSlotMinutes(preset.slotMinutes)
    }
    setShowDaysEditor(false)
    // The quick-fill buttons sit above the calendar, so applying one can leave the (now-updated)
    // calendar off-screen below the fold — scroll it into view so the result is actually visible.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    calendarRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' })
  }

  const handleSubmit = (): void => {
    if (!name.trim()) {
      setNameError("Name your poll so people know what they're joining")
      setOpenSection('name')
      return
    }
    setNameError(undefined)
    if (dates.length === 0) {
      setDatesError('Pick at least one date')
      setOpenSection('daysTimes')
      return
    }
    if (config && dates.length > config.maxPollDates) {
      setDatesError(`Pick ${config.maxPollDates} dates or fewer`)
      setOpenSection('daysTimes')
      return
    }
    setDatesError(undefined)
    // Clear both time-window errors up front, before either check runs — otherwise fixing the
    // weekend window but breaking the weekday one (or vice versa) would leave the other field's
    // stale error on screen even though its own condition is now satisfied.
    setTimesError(undefined)
    setWeekendTimesError(undefined)
    if (usesTimes && endMinute - startMinute < slotMinutes) {
      setTimesError('Pick a longer time window, or a shorter meeting length.')
      setOpenSection('daysTimes')
      return
    }
    if (usesTimes && effectiveWeekendsDiffer && weekendEndMinute - weekendStartMinute < slotMinutes) {
      setWeekendTimesError('Pick a longer time window, or a shorter meeting length.')
      setOpenSection('daysTimes')
      return
    }

    const override = effectiveWeekendsDiffer
      ? computeWeekendOverride(dates, timezone, weekendStartMinute, weekendEndMinute)
      : undefined
    const poll: NewPollRequest = usesTimes
      ? {
        name: name.trim(),
        dates,
        usesTimes: true,
        startMinute,
        endMinute,
        slotMinutes: slotMinutes as 15 | 30 | 60 | 90 | 120,
        timezone,
        ...(override ? { overrides: [override] } : {}),
      }
      : { name: name.trim(), dates, usesTimes: false, timezone }

    pollMutation.mutate(poll)
  }

  const isLoading = pollMutation.isPending || isNavigating
  const daysLabel = daysAreCustom ? 'Custom' : formatWeekdaysSummary(weekdays)
  const daysTimesSummary = formatDaysTimesSummary({
    dateCount: dates.length,
    daysLabel,
    usesTimes,
    startMinute,
    endMinute,
    slotMinutes,
    weekendsDiffer: effectiveWeekendsDiffer,
    weekendStartMinute,
    weekendEndMinute,
  })

  return (
    <>
      <CreateCard>
        <CreateCardHeader />

        <div ref={nameSectionRef}>
          <ChecklistSection
            isDone={furthestIndex > 0}
            isOpen={openSection === 'name'}
            onEdit={() => setOpenSection('name')}
            stepNumber={1}
            summary={name.trim() || 'No name yet'}
            title="Name"
          >
            <PollNameField
              error={nameError}
              maxLength={config?.pollNameMaxLength}
              onChange={setName}
              ref={nameInputRef}
              value={name}
            />
            {!isSignedIn && (
              <VoterNameField
                label="Your name"
                maxLength={config?.participantNameMaxLength}
                onChange={setVoterName}
                value={voterName}
              />
            )}
            <PillButton label="Continue" onPress={goToNextSection} />
          </ChecklistSection>
        </div>

        <div ref={daysTimesSectionRef}>
          <ChecklistSection
            isDone={furthestIndex > 1}
            isOpen={openSection === 'daysTimes'}
            onEdit={() => setOpenSection('daysTimes')}
            stepNumber={2}
            summary={daysTimesSummary}
            title="Days & times"
          >
            {config ? (
              <>
                <ScenarioPresets onApply={handleApplyScenarioPreset} />
                <div className="flex flex-col gap-[18px]" ref={calendarRef}>
                  <WeekCountStepper onChange={setWeekCount} value={weekCount} />
                  <DatePickerCalendar
                    dates={dates}
                    maxDates={config.maxPollDates}
                    maxRangeDays={config.maxPollDateRangeDays}
                    now={now}
                    onChange={handleDatesChange}
                  />
                </div>
                {datesError && (
                  <span className="text-xs text-red-400" role="alert">
                    {datesError}
                  </span>
                )}
                <SummaryDisclosure
                  expanded={showDaysEditor}
                  label="Which days"
                  onToggle={() => setShowDaysEditor((prev) => !prev)}
                  panelId={daysPanelId}
                  value={daysLabel}
                />
                {showDaysEditor && (
                  <div id={daysPanelId}>
                    <WeekdayPicker onChange={handleWeekdaysChange} selected={weekdays} />
                  </div>
                )}
                <SummaryDisclosure
                  expanded={showTimeEditor}
                  label="When"
                  onToggle={() => setShowTimeEditor((prev) => !prev)}
                  panelId={timePanelId}
                  value={formatTimeLabel({
                    usesTimes,
                    startMinute,
                    endMinute,
                    slotMinutes,
                    weekendsDiffer: effectiveWeekendsDiffer,
                    weekendStartMinute,
                    weekendEndMinute,
                  })}
                />
                {showTimeEditor && (
                  <div className="flex flex-col gap-[18px]" id={timePanelId}>
                    <TimesToggle onChange={setUsesTimes} usesTimes={usesTimes} />
                    {usesTimes && (
                      <>
                        {canSplitWeekendTimes && (
                          <WeekendTimesToggle onChange={handleWeekendsDifferChange} weekendsDiffer={weekendsDiffer} />
                        )}
                        <TimeRangeSlider
                          endMinute={endMinute}
                          error={timesError}
                          label={effectiveWeekendsDiffer ? 'Weekdays' : undefined}
                          onChangeEnd={setEndMinute}
                          onChangeStart={setStartMinute}
                          startMinute={startMinute}
                          step={computeStartEndMinuteStep(slotMinutes, config.startEndMinuteStep)}
                        />
                        {effectiveWeekendsDiffer && (
                          <TimeRangeSlider
                            endMinute={weekendEndMinute}
                            error={weekendTimesError}
                            label="Weekends"
                            onChangeEnd={setWeekendEndMinute}
                            onChangeStart={setWeekendStartMinute}
                            startMinute={weekendStartMinute}
                            step={computeStartEndMinuteStep(slotMinutes, config.startEndMinuteStep)}
                          />
                        )}
                        <SlotDurationPicker
                          allowedSlotMinutes={config.allowedSlotMinutes}
                          onChange={setSlotMinutes}
                          value={slotMinutes}
                        />
                      </>
                    )}
                  </div>
                )}
                <PillButton isDisabled={dates.length === 0} label="Continue" onPress={goToNextSection} />
              </>
            ) : (
              <p className="text-sm text-[var(--slate)]" role="status">
                Loading…
              </p>
            )}
          </ChecklistSection>
        </div>

        <div ref={reviewSectionRef}>
          <ChecklistSection
            isDone={furthestIndex > 2}
            isOpen={openSection === 'review'}
            stepNumber={3}
            title="Review & create"
          >
            <div className="rounded-xl border border-[var(--hair)] bg-[var(--bone)]/[0.04] px-4 py-3">
              <p className="text-sm font-bold text-[var(--bone)]">{name.trim() || 'No name yet'}</p>
              <p className="text-xs text-[var(--slate)]">{daysTimesSummary}</p>
            </div>
            <PillButton
              isDisabled={!config}
              isLoading={isLoading}
              label="Create poll"
              loadingLabel="Starting..."
              onPress={handleSubmit}
            />
            <p className="text-xs text-[var(--slate)]">This site is protected by reCAPTCHA.</p>
          </ChecklistSection>
        </div>
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

export default PollCreate
