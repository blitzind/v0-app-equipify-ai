/** GE-AI-UX-3B — Client helpers for AI teammate identity API (no server-only). */

import {
  GROWTH_AI_TEAMMATE_IDENTITY_API_PATH,
  type AiTeammateIdentity,
  type AiTeammateIdentityApiResponse,
  type AiTeammateIdentityPatch,
} from "@/lib/growth/settings/growth-ai-teammate-identity-types"

export async function fetchAiTeammateIdentity(): Promise<AiTeammateIdentity | null> {
  try {
    const res = await fetch(GROWTH_AI_TEAMMATE_IDENTITY_API_PATH, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as AiTeammateIdentityApiResponse
    if (!res.ok || !data.ok || !data.identity) return null
    return data.identity
  } catch {
    return null
  }
}

export async function patchAiTeammateIdentity(
  patch: AiTeammateIdentityPatch,
): Promise<{ identity: AiTeammateIdentity | null; error: string | null }> {
  try {
    const res = await fetch(GROWTH_AI_TEAMMATE_IDENTITY_API_PATH, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const data = (await res.json().catch(() => ({}))) as AiTeammateIdentityApiResponse
    if (!res.ok || !data.ok || !data.identity) {
      return { identity: null, error: data.message ?? "Could not save AI teammate identity." }
    }
    return { identity: data.identity, error: null }
  } catch {
    return { identity: null, error: "Could not save AI teammate identity." }
  }
}
