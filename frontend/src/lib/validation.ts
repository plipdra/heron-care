// Frontend mirror of the backend validation rules. This is a UX nicety for
// instant inline feedback — the backend (care.heron.api.dto.* + the custom
// constraints) is the authoritative gate. Keep these in sync with that spec;
// when they disagree, the backend wins and surfaces problem.detail.
//
// Each validator returns null when the value is acceptable, or a short
// user-facing message when it is not.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors @NotBlank + @Email + @Size(max=254) on the signup DTOs.
export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Email is required.';
  if (v.length > 254) return 'Email is too long.';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address.';
  return null;
}

// Mirrors @StrongPassword: 8–72 chars, at least one letter and one digit.
export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 72) return 'Password must be at most 72 characters.';
  if (!/[A-Za-z]/.test(value)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Password must include at least one number.';
  return null;
}

// Mirrors @NotBlank + @Size(max=200) + @MeaningfulText for a required name.
export function validateRequiredName(value: string): string | null {
  if (!value.trim()) return 'Name is required.';
  if (value.length > 200) return 'Name must be at most 200 characters.';
  return null;
}

// Optional name (patch-style profile): empty is fine, but if present it must
// carry readable text. Mirrors @Size + @MeaningfulText.
export function validateOptionalName(value: string): string | null {
  if (!value) return null;
  if (value.length > 200) return 'Name must be at most 200 characters.';
  if (!value.trim()) return 'Name must contain readable text.';
  return null;
}

// Optional phone. The backend uses libphonenumber (region PH + E.164); the
// frontend can't replicate the full numbering plan, so this is a light shape
// check that still rejects the obvious junk (too few/many digits, letters).
// The backend remains the real validator.
export function validatePhone(value: string): string | null {
  if (!value.trim()) return null;
  if (!/^[+0-9 ()-]+$/.test(value)) return 'Enter a valid phone number.';
  const digits = (value.match(/\d/g) ?? []).length;
  if (digits < 7 || digits > 15) return 'Enter a valid phone number.';
  return null;
}

// Optional birthday (yyyy-mm-dd from a <input type="date">). Mirrors
// @PastWithinYears(120): a real past date, age 0–120.
export function validateBirthday(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Enter a valid date.';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) return 'Birthday cannot be in the future.';
  const earliest = new Date(today);
  earliest.setFullYear(earliest.getFullYear() - 120);
  if (date.getTime() < earliest.getTime()) return 'Enter a realistic birth date.';
  return null;
}

// Optional http(s) URL. Mirrors @HttpUrl.
export function validateHttpUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Enter an http or https link.';
    }
    if (!url.hostname) return 'Enter a valid link.';
    return null;
  } catch {
    return 'Enter a valid link.';
  }
}

// Optional numeric range check, shared by weight/height/years.
export function validateNumberInRange(
  value: string,
  min: number,
  max: number,
  label: string,
): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return null;
}
