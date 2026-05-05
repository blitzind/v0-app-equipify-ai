/**
 * Whole calendar days until trial end (ceil). Negative when trial has ended.
 * Uses the same instant semantics as `new Date(iso)` vs `Date.now()`.
 */
export function trialDaysLeftFromIso(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null
  const endMs = new Date(trialEndsAt).getTime()
  if (Number.isNaN(endMs)) return null
  return Math.ceil((endMs - Date.now()) / 86_400_000)
}
