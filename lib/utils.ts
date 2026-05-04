import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Detects UUID-shaped strings so UI can avoid showing raw database ids in customer-facing surfaces. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function looksLikeUuid(value: string | null | undefined): boolean {
  if (value == null) return false
  return UUID_RE.test(value.trim())
}
