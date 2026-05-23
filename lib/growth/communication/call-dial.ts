/** Client-safe call dial href resolver (no telephony APIs). */

import {
  GROWTH_COMMUNICATION_HARD_DEFAULTS,
  type GrowthCommunicationDefaults,
  type GrowthCommunicationUserOverrides,
} from "@/lib/growth/communication/scope"
import {
  GROWTH_CALL_DIAL_MODES,
  type GrowthCallDialMode,
  type GrowthCallDialOption,
  type ResolvedGrowthDialPreferences,
} from "@/lib/growth/communication/types"

export { GROWTH_CALL_DIAL_MODES }

export type NormalizedPhone = {
  raw: string
  digits: string
  e164: string
}

const DIAL_MODE_LABELS: Record<GrowthCallDialMode, string> = {
  tel: "Phone (tel:)",
  facetime: "FaceTime",
  google_voice: "Google Voice",
  custom_url_template: "Custom dialer",
}

export function normalizeGrowthCallPhone(phone: string): NormalizedPhone | null {
  const raw = phone.trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, "")
  if (digits.length < 7) return null

  const e164 = digits.length === 10 ? `+1${digits}` : digits.startsWith("1") && digits.length === 11 ? `+${digits}` : `+${digits}`

  return { raw, digits, e164 }
}

function applyTemplate(template: string, phone: NormalizedPhone): string {
  return template
    .replaceAll("{{phone}}", phone.raw)
    .replaceAll("{{phone_e164}}", phone.e164)
    .replaceAll("{{phone_digits}}", phone.digits)
}

export function resolveGrowthCallHref(
  phone: string,
  mode: GrowthCallDialMode,
  customUrlTemplate?: string | null,
): string | null {
  const normalized = normalizeGrowthCallPhone(phone)
  if (!normalized) return null

  switch (mode) {
    case "tel":
      return `tel:${normalized.e164}`
    case "facetime":
      return `facetime-audio:${normalized.e164}`
    case "google_voice":
      return `https://voice.google.com/u/0/calls?a=nc,${encodeURIComponent(normalized.e164)}`
    case "custom_url_template": {
      const template = customUrlTemplate?.trim()
      if (!template) return `tel:${normalized.e164}`
      return applyTemplate(template, normalized)
    }
    default:
      return `tel:${normalized.e164}`
  }
}

export function buildGrowthCallDialOptions(
  phone: string,
  preferences: Pick<ResolvedGrowthDialPreferences, "callDialMode" | "customUrlTemplate" | "showAlternateDialers">,
): GrowthCallDialOption[] {
  const primaryHref = resolveGrowthCallHref(phone, preferences.callDialMode, preferences.customUrlTemplate)
  if (!primaryHref) return []

  const options: GrowthCallDialOption[] = [
    {
      mode: preferences.callDialMode,
      label: DIAL_MODE_LABELS[preferences.callDialMode],
      href: primaryHref,
    },
  ]

  if (!preferences.showAlternateDialers) return options

  for (const mode of GROWTH_CALL_DIAL_MODES) {
    if (mode === preferences.callDialMode) continue
    const href = resolveGrowthCallHref(phone, mode, preferences.customUrlTemplate)
    if (!href) continue
    if (options.some((option) => option.href === href)) continue
    options.push({ mode, label: DIAL_MODE_LABELS[mode], href })
  }

  return options
}

function preferenceSource(
  userValue: unknown,
  scopeValue: unknown,
): ResolvedGrowthDialPreferences["source"]["callDialMode"] {
  if (userValue !== undefined && userValue !== null && userValue !== "") return "user"
  if (scopeValue !== undefined && scopeValue !== null && scopeValue !== "") return "scope_defaults"
  return "hard_default"
}

/** Scope-neutral resolver: user overrides → scope defaults → hard defaults (tel). */
export function resolveGrowthDialPreferences(input: {
  scopeDefaults: GrowthCommunicationDefaults | null
  userOverrides: GrowthCommunicationUserOverrides | null
}): ResolvedGrowthDialPreferences {
  const scopeDefaults = input.scopeDefaults
  const userOverrides = input.userOverrides

  const callDialMode = (userOverrides?.callDialMode ??
    scopeDefaults?.callDialMode ??
    GROWTH_COMMUNICATION_HARD_DEFAULTS.callDialMode) as GrowthCallDialMode
  const customUrlTemplate =
    userOverrides?.customUrlTemplate ??
    scopeDefaults?.customUrlTemplate ??
    GROWTH_COMMUNICATION_HARD_DEFAULTS.customUrlTemplate
  const showAlternateDialers =
    userOverrides?.showAlternateDialers ??
    scopeDefaults?.showAlternateDialers ??
    GROWTH_COMMUNICATION_HARD_DEFAULTS.showAlternateDialers
  const preferredEmailConnectionId =
    userOverrides?.preferredEmailConnectionId ??
    scopeDefaults?.activeEmailConnectionId ??
    GROWTH_COMMUNICATION_HARD_DEFAULTS.preferredEmailConnectionId

  return {
    callDialMode,
    customUrlTemplate,
    showAlternateDialers,
    preferredEmailConnectionId,
    source: {
      callDialMode: preferenceSource(userOverrides?.callDialMode, scopeDefaults?.callDialMode),
      customUrlTemplate: preferenceSource(userOverrides?.customUrlTemplate, scopeDefaults?.customUrlTemplate),
      showAlternateDialers: preferenceSource(userOverrides?.showAlternateDialers, scopeDefaults?.showAlternateDialers),
      preferredEmailConnectionId: preferenceSource(
        userOverrides?.preferredEmailConnectionId,
        scopeDefaults?.activeEmailConnectionId,
      ),
    },
  }
}

/** Platform-admin internal ops: maps platform singleton + admin user row into the neutral resolver. */
export function resolveGrowthPlatformAdminDialPreferences(input: {
  platformDefaults: GrowthCommunicationDefaults | null
  adminUserOverrides: GrowthCommunicationUserOverrides | null
}): ResolvedGrowthDialPreferences {
  return resolveGrowthDialPreferences({
    scopeDefaults: input.platformDefaults,
    userOverrides: input.adminUserOverrides,
  })
}
