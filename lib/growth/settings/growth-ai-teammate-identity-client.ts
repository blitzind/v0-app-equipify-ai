/** GE-AI-UX-3B — Client helpers for AI teammate identity API (no server-only). */

import {
  GROWTH_AI_TEAMMATE_IDENTITY_API_PATH,
  type AiTeammateIdentity,
  type AiTeammateIdentityApiResponse,
  type AiTeammateIdentityPatch,
} from "@/lib/growth/settings/growth-ai-teammate-identity-types"

export async function fetchAiTeammateIdentity(): Promise<{
  identity: AiTeammateIdentity | null
  loadError: string | null
}> {
  try {
    const res = await fetch(GROWTH_AI_TEAMMATE_IDENTITY_API_PATH, { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as AiTeammateIdentityApiResponse
    if (!res.ok || !data.ok || !data.identity) {
      return {
        identity: null,
        loadError: data.message ?? "Could not load AI teammate identity.",
      }
    }
    return { identity: data.identity, loadError: null }
  } catch {
    return { identity: null, loadError: "Could not load AI teammate identity." }
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
