/**
 * Password policy enforced by the Kernel (same as the web front): at least 10
 * characters, one uppercase, one lowercase, one digit and one symbol.
 */
export function checkPasswordStrength(password: string) {
  return {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordScore(password: string): number {
  return Object.values(checkPasswordStrength(password)).filter(Boolean).length;
}

export function isPasswordStrong(password: string): boolean {
  return passwordScore(password) === 5;
}
