/** Client-safe Call Workspace live coaching types (Google Voice Bridge coaching fix). */

export const GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER = "google-voice-bridge-coaching-v1" as const

export const CALL_WORKSPACE_COACHING_MODES = ["lead_linked", "transcript_only"] as const
export type CallWorkspaceCoachingMode = (typeof CALL_WORKSPACE_COACHING_MODES)[number]

export const CALL_WORKSPACE_TRANSCRIPT_ONLY_COACHING_COPY =
  "No lead linked. Coaching will run using transcript-only guidance." as const

export const CALL_WORKSPACE_COACHING_NO_LEAD_COPY =
  "Lead not linked. Start coaching for transcript guidance only, or attach a lead for full intelligence." as const

export const CALL_WORKSPACE_TRANSCRIPT_ANCHOR_METADATA_KEY = "call_workspace_transcript_anchor" as const

export function isCallWorkspaceTranscriptAnchorLead(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[CALL_WORKSPACE_TRANSCRIPT_ANCHOR_METADATA_KEY] === true
}

export type CallWorkspacePhoneLeadMatch = {
  leadId: string
  matchedVia:
    | "growth_lead_contact_phone"
    | "growth_decision_maker_phone"
    | "growth_outbound_contact"
    | "growth_prospect_promoted"
    | "public_prospect_phone"
    | "customer_contact_phone"
    | "relationship_memory_lead"
  confidence: number
  label: string
}
