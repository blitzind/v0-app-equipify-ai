/** Client-safe Google Voice bridge helpers (no credentials, no scraping). */

import { resolveGrowthCallHref } from "@/lib/growth/communication/call-dial"
import type { NativeCallWorkspaceSessionPublicView, NativeDialerProviderId } from "@/lib/growth/native-dialer/native-dialer-types"

export const GOOGLE_VOICE_BRIDGE_QA_MARKER = "google-voice-bridge-manual-flow-v2" as const

/** Operator opens Google Voice manually — no phone prefill in URL (per slice spec). */
export const GOOGLE_VOICE_BRIDGE_CALLS_URL = "https://voice.google.com/u/0/calls" as const

export const GOOGLE_VOICE_BRIDGE_COPY_SUCCESS_TOAST =
  "Number copied. Paste it in Google Voice to place the call." as const

export const GOOGLE_VOICE_BRIDGE_COPY_BLOCKED_TOAST =
  "Copy blocked by browser. Use Copy Number." as const

export const GOOGLE_VOICE_BRIDGE_MANUAL_FLOW_INSTRUCTION =
  "Google Voice is open. Paste or select the copied number in Google Voice, place the call, then return here." as const

export function isGoogleVoiceBridgeProvider(provider: NativeDialerProviderId): boolean {
  return provider === "google_voice_bridge"
}

export function isExternalBridgeSession(
  session: Pick<NativeCallWorkspaceSessionPublicView, "provider" | "status"> | null | undefined,
): boolean {
  if (!session) return false
  return (
    isGoogleVoiceBridgeProvider(session.provider) ||
    session.status === "external_bridge_pending"
  )
}

export function buildGoogleVoiceBridgeCopyHref(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber?.trim()) return null
  return resolveGrowthCallHref(phoneNumber, "google_voice")
}

export async function copyPhoneNumberToClipboard(phoneNumber: string | null | undefined): Promise<boolean> {
  const raw = phoneNumber?.trim()
  if (!raw || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(raw)
    return true
  } catch {
    return false
  }
}

export function openGoogleVoiceBridgeTab(): void {
  if (typeof window === "undefined") return
  window.open(GOOGLE_VOICE_BRIDGE_CALLS_URL, "_blank", "noopener,noreferrer")
}

/** Opens Google Voice externally and attempts a safe clipboard copy (no auto-dial APIs). */
export async function beginGoogleVoiceBridgeDialFlow(
  phoneNumber: string | null | undefined,
): Promise<{ copied: boolean }> {
  openGoogleVoiceBridgeTab()
  const copied = await copyPhoneNumberToClipboard(phoneNumber)
  return { copied }
}
