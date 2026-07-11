/**
 * US phone number utilities.
 * All formatting assumes +1 country code (US/Canada).
 */

/** Strip non-digits, prepend +1 if the number starts with a valid US digit (2-9), and cap at 12 chars (+1 + 10 digits). */
export const formatPhoneUS = (raw: string): string => {
  const digits = raw.replace(/\D/g, '')
  const withCountry = digits.replace(/^1?([2-9]\d*)/, '+1$1')
  return withCountry.substring(0, 12)
}

/** +1 followed by a 10-digit number starting with 2-9. */
export const isValidPhoneUS = (value: string): boolean => /^\+1[2-9]\d{9}$/.test(value)
