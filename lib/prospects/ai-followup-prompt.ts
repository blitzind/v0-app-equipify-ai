import "server-only"

/**
 * Leads + Follow-Up Phase 2 — prospect AI follow-up draft prompt.
 *
 * Kept inline (not in `lib/ai/prompts/registry`) so prospect-specific
 * tone/copy can iterate independently of the central email registry. We
 * reuse the existing `customer_email` AI task for model selection, plan
 * gating, and usage logging, but pass a tailored prospect prompt body.
 *
 * The model is asked to produce a strict JSON object so the API route can
 * validate before returning to the UI:
 *
 *   { "subject": string, "body": string }
 */

export const PROSPECT_FOLLOWUP_SYSTEM_PROMPT = `You are an experienced field-service business development rep helping a service company write a short, professional follow-up to a sales prospect.

Return a single JSON object (no markdown, no commentary) with exactly:
{
  "subject": string,
  "body": string
}

Rules:
- Tone: warm, professional, genuinely helpful, never pushy.
- Length: keep the body to 60–140 words. No fluff.
- Do not invent customer names, dollar amounts, dates, or details that
  were not provided in the prospect context. If the prospect's name is
  missing, address them generically (e.g. "Hi there,").
- Always close with a single concrete call-to-action that is appropriate
  for the current pipeline status. For example:
    new           -> introduce yourself + ask one qualifying question
    contacted     -> reference prior touch + suggest a short call
    follow_up     -> nudge politely, offer to answer questions
    quoted        -> check whether they had questions, propose next step
    won           -> thank-you and onboarding nudge
    lost          -> a respectful "keeping the door open" check-in
- Do not include a signature block — leave the user's signature blank.
- Do not include automated disclaimers, legal text, or marketing footers.
- Output MUST be valid JSON parsable by JSON.parse.`

export type ProspectFollowupPromptVars = {
  companyName: string
  contactName: string | null
  status: string
  leadSource: string | null
  daysSinceLastContact: number | null
  daysUntilFollowUp: number | null
  estimatedValueLabel: string | null
  notes: string | null
  recentTimeline: string[]
}

export function buildProspectFollowupUserPrompt(vars: ProspectFollowupPromptVars): string {
  const lines: string[] = [
    `Prospect: ${vars.companyName}`,
    vars.contactName ? `Primary contact: ${vars.contactName}` : "Primary contact: (unknown)",
    `Pipeline status: ${vars.status}`,
  ]
  if (vars.leadSource) lines.push(`Lead source: ${vars.leadSource}`)
  if (vars.estimatedValueLabel) lines.push(`Estimated value: ${vars.estimatedValueLabel}`)

  if (vars.daysSinceLastContact != null) {
    lines.push(`Days since last contact: ${vars.daysSinceLastContact}`)
  } else {
    lines.push("Last contact: not recorded")
  }
  if (vars.daysUntilFollowUp != null) {
    lines.push(
      vars.daysUntilFollowUp < 0
        ? `Follow-up overdue by ${Math.abs(vars.daysUntilFollowUp)} day(s)`
        : `Next follow-up due in ${vars.daysUntilFollowUp} day(s)`,
    )
  }
  if (vars.notes) {
    lines.push("", "Notes about this prospect:", vars.notes.slice(0, 1500))
  }
  if (vars.recentTimeline.length > 0) {
    lines.push("", "Recent touches (most recent first):")
    for (const t of vars.recentTimeline.slice(0, 5)) {
      lines.push(`- ${t.slice(0, 240)}`)
    }
  }

  lines.push(
    "",
    "Draft a follow-up email tailored to this prospect's status. Output the JSON object only.",
  )
  return lines.join("\n")
}
