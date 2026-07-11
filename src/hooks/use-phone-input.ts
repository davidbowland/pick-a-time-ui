import { useCallback, useMemo, useState } from 'react'

import { formatPhoneUS, isValidPhoneUS } from '@utils/phone'

export interface UsePhoneInputReturn {
  value: string
  error: string
  isValid: boolean
  onChange: (raw: string) => void
  showError: () => void
  reset: () => void
}

export const usePhoneInput = (): UsePhoneInputReturn => {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const onChange = useCallback((raw: string) => {
    setSubmitted(false)
    setValue(formatPhoneUS(raw))
  }, [])

  const showError = useCallback(() => setSubmitted(true), [])
  const reset = useCallback(() => {
    setValue('')
    setSubmitted(false)
  }, [])

  const isValid = useMemo(() => isValidPhoneUS(value), [value])
  const error = useMemo(() => {
    if (!submitted || value === '' || isValid) return ''
    return 'Invalid phone number. Be sure to include area code.'
  }, [submitted, value, isValid])

  return { value, error, isValid, onChange, showError, reset }
}
