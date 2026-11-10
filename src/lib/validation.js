// The email and password rules, checked here so people see a problem before anything is sent. The backend
// (app/validation.py) checks the same rules again; keep the two in step.

export const EMAIL_MAX = 254
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

const EMAIL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

const COMMON_PASSWORDS = new Set([
  'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'qwerty123', 'qwertz123',
  'abc12345', 'abcd1234', '1q2w3e4r', '1qaz2wsx', 'iloveyou1', 'welcome1', 'welcome123', 'letmein1',
  'admin123', 'admin1234', 'administrator1', 'changeme1', 'football1', 'baseball1', 'sunshine1', 'monkey123',
  'trustno1!', 'zaq12wsx', 'q1w2e3r4', 'asdf1234', 'scan4reuse', 'scan4reuse1', 'scan4resource',
])

export const normalizeEmail = (value) => (value || '').trim().toLowerCase()

/** '' when the email looks valid, else a sentence to show under the field. */
export function emailProblem(raw) {
  const value = normalizeEmail(raw)
  if (!value) return 'Enter your email address.'
  if (value.length > EMAIL_MAX) return `An email address can have at most ${EMAIL_MAX} characters.`
  if (value.split('@')[0].length > 64 || !EMAIL.test(value)) return 'Enter a valid email address, like name@example.ch.'
  return ''
}

const isLetter = (c) => c.toLowerCase() !== c.toUpperCase()

/** '' when the password is good enough for a new account, else a sentence to show under the field. */
export function passwordProblem(password, email = '') {
  if (password.length < PASSWORD_MIN) return `The password needs at least ${PASSWORD_MIN} characters.`
  if (password.length > PASSWORD_MAX) return `The password can have at most ${PASSWORD_MAX} characters.`
  if (!password.trim()) return 'The password cannot be only spaces.'
  const chars = [...password]
  if (!chars.some(isLetter) || chars.every(isLetter)) return 'Use at least one letter and at least one number, space or symbol.'
  const lowered = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lowered) || new Set(lowered).size < 4) return 'That password is too easy to guess. Choose another one.'
  const local = normalizeEmail(email).split('@')[0]
  if (local.length >= 4 && lowered.includes(local)) return 'The password must not contain your email address.'
  return ''
}

/** Login only checks the shape: older accounts may predate a password rule. */
export function loginPasswordProblem(password) {
  if (!password) return 'Enter your password.'
  if (password.length > PASSWORD_MAX) return 'Wrong email or password.'
  return ''
}
