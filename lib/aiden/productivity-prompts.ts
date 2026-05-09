import type { DraftKind } from "@/lib/aiden/productivity-schemas"

const BASE_RULES = `You are AIden, Equipify's in-app assistant. Output MUST be valid JSON only (no markdown fences).
Rules:
- Read-only analysis from the provided workspace snapshot only. Do not invent records, IDs, or schedules.
- Do not instruct the user to click buttons or perform mutations; suggestions are optional plain-language next steps only.
- Never claim an email, SMS, invoice, or record was sent or saved.
- Keep a professional, neutral tone suitable for field service operations.`

export function buildCustomerSummaryPrompt(snapshotJson: string): { system: string; user: string } {
  return {
    system: `${BASE_RULES}

Return a JSON object with keys:
- profileSummary (string): concise overview of the customer record.
- recentWorkSummary (string): patterns from recent jobs (no fabricated dates beyond what is given).
- openWorkSummary (string): non-terminal work orders only, or state none/open when applicable.
- notableIssues (string[]): recurring problems, warranty flags, or risks visible in the data (empty array if none).
- suggestedNextSteps (string[]): 3–6 practical follow-ups for staff (not automated actions).`,
    user: `Customer and recent work snapshot (JSON):\n${snapshotJson}`,
  }
}

export function buildWorkOrderProductivityPrompt(snapshotJson: string): { system: string; user: string } {
  return {
    system: `${BASE_RULES}

Return a JSON object with keys:
- issueAndStatusSummary (string): reported issue, diagnosis hints, and workflow status.
- equipmentSummary (string): assets involved and key identifiers (no speculation).
- tasksSummary (string): checklist / task progress.
- notesSummary (string): internal notes and technician notes at a high level.
- partsSummary (string): parts mentioned without implying billing approval.
- missingInformation (string[]): concrete gaps (access, model numbers, approvals, etc.).
- suggestedNextSteps (string[]): internal staff next steps only.
- customerFriendlyUpdateDraft (string): short, polite status update suitable to paste to a customer (no promises of dispatch times unless in data).`,
    user: `Work order snapshot (JSON):\n${snapshotJson}`,
  }
}

const draftKindInstructions: Record<DraftKind, string> = {
  service_note: "Internal service note summarizing findings and follow-ups (for technicians/staff).",
  customer_update:
    "Customer-facing status update — polite, concise, no internal jargon; suitable to paste after human review.",
  quote_explanation:
    "Plain-language explanation of scope/pricing context — avoid guaranteeing totals not in the snapshot.",
  payment_reminder:
    "Polite payment reminder — neutral tone; do not threaten or fabricate invoice numbers or amounts.",
  technician_handoff:
    "Shift/handovers summary for the next technician — facts from snapshot, safety-relevant gaps called out.",
}

export function buildDraftPrompt(args: {
  draftKind: DraftKind
  snapshotJson: string
  extraContext?: string | null
}): { system: string; user: string } {
  const kindLine = draftKindInstructions[args.draftKind]
  const extra =
    args.extraContext?.trim() ?
      `\nOptional user hint from the teammate (may be empty):\n${args.extraContext.trim().slice(0, 4000)}`
    : ""

  return {
    system: `${BASE_RULES}

Draft kind: ${args.draftKind}
Objective: ${kindLine}

Return JSON with keys:
- draft (string): the copy-ready draft only.
- copyReminder (string[]): 1–4 short reminders (e.g., verify invoice total before sending).`,
    user: `Workspace snapshot for drafting (JSON):\n${args.snapshotJson}${extra}`,
  }
}
