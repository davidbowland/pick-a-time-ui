import { CalendarDate, getLocalTimeZone, today as calendarToday } from '@internationalized/date'
import { useMutation, useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import React, { useEffect, useId, useRef, useState } from 'react'

import { ChecklistSection } from './checklist-section'
import { CreateCard, CreateCardHeader, PollNameField, WeekCountStepper, WeekdayPicker } from './elements'
import {
  computeStartEndMinuteStep,
  computeWeekendOverride,
  formatDaysTimesSummary,
  formatTimeLabel,
  formatWeekdaysSummary,
  generateWeekdayDates,
  reconcilePatternDates,
  timeWindowError,
  updateExcludedDates,
} from './helpers'
import { ScenarioPreset, ScenarioPresets } from './scenario-presets'
import { SummaryDisclosure } from './summary-disclosure'
import { TimeEditorCoordinatorProvider } from './time-editor-coordinator'
import { SlotDurationPicker, TimeRangeField, TimesToggle, WeekendTimesToggle } from './time-fields'
import { useAuthContext } from '@components/auth-context'
import FeedbackMessage from '@components/feedback-message'
import { PillButton } from '@components/ui/pill-button'
import { VoterNameField } from '@components/ui/voter-name-field'
import { setSessionCookie } from '@hooks/useSessionCookie'
import {
  ApiError,
  createPoll,
  createPollAuthed,
  createUser,
  fetchConfig,
  parseApiMessage,
  patchUser,
} from '@services/api'
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

// HeroUI's Calendar and its react-aria tree are 20 KB gzip that cannot render until the `config`
// query resolves, so they were 20 KB of first-paint download the page was structurally incapable of
// using. Split out, and PREFETCHED from the mount effect below rather than fetched when the step
// opens: the visitor spends the intervening seconds on the name field, which is ample for 20 KB.
// `import()` is memoised by the module registry, so `dynamic()` resolves from this same promise
// without issuing a second request.
//
// No `loading` placeholder is needed. The calendar mounts inside a collapsed ChecklistSection, so
// nothing it replaces is in the layout and there is no shift to reserve space against.
const loadDatePicker = () => import('./date-picker')

const DatePickerCalendar = dynamic(async () => (await loadDatePicker()).DatePickerCalendar, {
  ssr: false,
})

export interface PollCreateProps {
  now?: () => CalendarDate
  name?: string
  onNameChange?: (name: string) => void
  registerFocusName?: (focus: () => void) => void
}

const PollCreate = ({
  now = () => calendarToday(getLocalTimeZone()),
  name: controlledName,
  onNameChange,
  registerFocusName,
}: PollCreateProps): React.ReactNode => {
  const router = useRouter()
  // Warms the calendar chunk while the visitor is still on the name field. Fire-and-forget: a
  // failed prefetch costs nothing, because `dynamic()` retries the same import when the date step
  // actually opens.
  useEffect(() => {
    loadDatePicker().catch(() => undefined)
  }, [])
  const [openSection, setOpenSection] = useState<OpenSection>('name')
  const [furthestIndex, setFurthestIndex] = useState(0)
  // The poll name is optionally controlled by the landing page so a hero starter can share it.
  // When left uncontrolled (the standalone default), it manages its own state — keeping every
  // existing caller and test working unchanged.
  const [internalName, setInternalName] = useState('')
  const name = controlledName ?? internalName
  const setName = (next: string): void => {
    if (onNameChange) onNameChange(next)
    else setInternalName(next)
  }
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
  const [weekendsDiffer, setWeekendsDiffer] = useState(false)
  const [weekendStartMinute, setWeekendStartMinute] = useState(DEFAULT_START_MINUTE)
  const [weekendEndMinute, setWeekendEndMinute] = useState(DEFAULT_END_MINUTE)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)

  // Mirrors `dates`/the pattern's last-generated set synchronously, so the regeneration effect
  // below and `handleDatesChange` never read a stale closure without needing `dates` itself in
  // the effect's dependency array (which would make the effect's own `setDates` call retrigger
  // itself on every run).
  const datesRef = useRef<string[]>([])
  const lastPatternDatesRef = useRef<string[]>([])
  const nameInputRef = useRef<HTMLInputElement>(null)
  const voterNameInputRef = useRef<HTMLInputElement>(null)
  const nameSectionRef = useRef<HTMLDivElement>(null)
  const daysTimesSectionRef = useRef<HTMLDivElement>(null)
  const reviewSectionRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef(name)
  nameRef.current = name
  const isFirstOpenSectionRenderRef = useRef(true)
  const calendarRef = useRef<HTMLDivElement>(null)
  const { isSignedIn, isLoading: isAuthLoading } = useAuthContext()
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
  const timesError = usesTimes ? timeWindowError(startMinute, endMinute, slotMinutes) : undefined
  const weekendTimesError =
    usesTimes && effectiveWeekendsDiffer
      ? timeWindowError(weekendStartMinute, weekendEndMinute, slotMinutes)
      : undefined
  const hasTimeWindowError = timesError !== undefined || weekendTimesError !== undefined

  useEffect(() => {
    if (config) setSlotMinutes(config.defaultSlotMinutes)
  }, [config])

  useEffect(() => {
    if (nameError) nameInputRef.current?.focus()
  }, [nameError])

  // Expose a focus handle so the hero starter's "Start" can move focus into the form after it
  // scrolls it into view. The hero already captured the poll name, so the first thing still to
  // type is "Your name" — land there rather than back in a field the visitor just filled. Falls
  // back to the poll-name field when there's nothing to skip (the hero handed over a blank name)
  // or nowhere to skip to (signed in, so no voter-name field renders). Reads the refs at call
  // time, so the handler registers once and still sees the current name and fields.
  // `preventScroll` keeps the focus from canceling that smooth scroll (the caller focuses
  // synchronously so iOS still opens the keyboard).
  useEffect(() => {
    registerFocusName?.(() => {
      const skipsFilledName = nameRef.current.trim() !== ''
      const target = (skipsFilledName ? voterNameInputRef.current : null) ?? nameInputRef.current
      target?.focus({ preventScroll: true })
    })
  }, [registerFocusName])

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

  // reCAPTCHA costs ~670 KiB of script and ~900 ms of CPU on a mid-range phone, and this form is
  // embedded in the landing page — loading it on mount made every visitor pay that just to read
  // the page. Hold it until the visitor shows create intent (touching either name field, or
  // advancing a step), which is still several steps and many seconds ahead of the submit that
  // actually needs a token. Signed-in visitors never load it at all: their submit path uses the
  // authenticated endpoint and skips reCAPTCHA entirely. The `isAuthLoading` guard keeps an
  // undecided session from loading it speculatively — once auth resolves to signed-out, this
  // effect reruns and loads it then.
  const [hasCreateIntent, setHasCreateIntent] = useState(false)
  const markCreateIntent = (): void => setHasCreateIntent(true)

  useEffect(() => {
    if (!hasCreateIntent || isSignedIn || isAuthLoading) return
    if (document.getElementById(RECAPTCHA_SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = RECAPTCHA_SCRIPT_ID
    script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`
    script.async = true
    document.body.appendChild(script)
  }, [hasCreateIntent, isSignedIn, isAuthLoading])

  // reCAPTCHA v3 scores the first, cold `execute` of a page load low (0.2–0.4) because it has
  // gathered almost no behavioral signal yet; the next execute, against a warmed session, scores
  // ~0.8. Fire one throwaway warm-up here so the user's real submission is never the cold first
  // token. Signed-out only (the signed-in path skips reCAPTCHA), once per mount, and best-effort —
  // a failed warm-up must never block or surface to the user.
  // Primed once the visitor shows create intent (the first "Continue"), not on every landing-page
  // view — so we only spend a reCAPTCHA assessment on people actually starting a poll. The name and
  // days/times steps between here and submit give the warmed session plenty of time to settle.
  // Signed-out only (the signed-in submit path skips reCAPTCHA), once, and best-effort — a failed
  // warm-up must never block or surface to the user.
  const hasPrimedRef = useRef(false)
  const primeRecaptcha = (): void => {
    if (isSignedIn || isAuthLoading || hasPrimedRef.current) return
    hasPrimedRef.current = true
    const prime = async (): Promise<void> => {
      try {
        await waitForRecaptcha()
        await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'WARMUP' })
      } catch {
        // best-effort priming; ignore failures
      }
    }
    void prime()
  }

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
      let identifiedUserId: string | undefined
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
        identifiedUserId = newUser.userId
      } catch (err) {
        // The poll itself was created successfully — a failure here just means the creator falls
        // back to the normal auto-create/picker flow on the poll page, same as any first-time visitor.
        console.warn('Post-creation voter setup failed; falling back to standard identity flow', err)
      }
      setIsNavigating(true)
      // Carry the creator's id in the URL rather than relying on the just-set cookie. During this
      // client-side navigation the poll page reads its identity cookie once, synchronously, as it
      // mounts — but a cookie scoped to `/p/{sessionId}` that was written moments ago on a
      // different path isn't yet visible to `document.cookie` in that first read, so the creator
      // would land on the "Who are you?" picker until a full refresh. The `?id=` param is the poll
      // page's built-in identity hand-off: it identifies the creator immediately and strips itself
      // from the URL, while the cookie still handles refreshes and return visits.
      const target = identifiedUserId
        ? `/p/${data.sessionId}?id=${encodeURIComponent(identifiedUserId)}`
        : `/p/${data.sessionId}`
      router.push(target)
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.response.statusCode === 403) {
        setErrorMessage("Our security check couldn't verify your browser. Please try again.")
        return
      }
      if (error instanceof ApiError && error.response.statusCode === 400) {
        setErrorMessage(parseApiMessage(error.response.body, 'Something went wrong setting up your poll. Try again.'))
        return
      }
      setErrorMessage('Something went wrong setting up your poll. Try again.')
    },
  })

  const goToNextSection = (): void => {
    // Advancing a step is create intent even when neither name field was ever focused — the hero
    // starter can hand the poll name over pre-filled. Marking it here is what guarantees the
    // script is on its way before the warm-up below starts waiting for it.
    markCreateIntent()
    // Warm up reCAPTCHA now so the eventual submit runs on a high-scoring token. `primeRecaptcha`
    // is a once-only no-op after the first call.
    primeRecaptcha()
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
    // Unreachable through the UI (Continue is gated on the same derived errors), kept so an
    // invalid window can never reach the API if section navigation changes.
    if (hasTimeWindowError) {
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
              onFocus={markCreateIntent}
              ref={nameInputRef}
              value={name}
            />
            {!isSignedIn && (
              <VoterNameField
                label="Your name"
                maxLength={config?.participantNameMaxLength}
                onChange={setVoterName}
                onFocus={markCreateIntent}
                ref={voterNameInputRef}
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
                      <TimeEditorCoordinatorProvider>
                        {canSplitWeekendTimes && (
                          <WeekendTimesToggle onChange={handleWeekendsDifferChange} weekendsDiffer={weekendsDiffer} />
                        )}
                        <TimeRangeField
                          endMinute={endMinute}
                          error={timesError}
                          label={effectiveWeekendsDiffer ? 'Weekdays' : undefined}
                          onChangeEnd={setEndMinute}
                          onChangeStart={setStartMinute}
                          startMinute={startMinute}
                          step={computeStartEndMinuteStep(slotMinutes, config.startEndMinuteStep)}
                        />
                        {effectiveWeekendsDiffer && (
                          <TimeRangeField
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
                      </TimeEditorCoordinatorProvider>
                    )}
                  </div>
                )}
                {hasTimeWindowError && !showTimeEditor && (
                  <span className="text-xs text-red-400" role="alert">
                    Fix the time window to continue.
                  </span>
                )}
                <PillButton
                  isDisabled={dates.length === 0 || hasTimeWindowError}
                  label="Continue"
                  onPress={goToNextSection}
                />
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
            {/* isAuthLoading disables rather than joining isLoading, which would swap the label to
                "Starting..." -- nothing is starting while we are only checking who you are, and the
                word implies the poll is already being created. It belongs here and not just on the
                reCAPTCHA guards above: handleSubmit feeds isSignedIn to createPollAuthed/createPoll,
                createUser, and patchUser, so submitting before auth resolves files a signed-in
                person's poll anonymously and gives them an anonymous user record, which cannot be
                attached to their account afterwards. */}
            <PillButton
              isDisabled={!config || isAuthLoading}
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
