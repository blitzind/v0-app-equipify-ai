/**
 * GE-AIOS-OPERATOR-EXPERIENCE-1A — Operator-facing language (client-safe).
 * Strips internal engine terminology from production UI copy.
 */

export const GROWTH_AIOS_OPERATOR_LANGUAGE_1A_QA_MARKER =
  "ge-aios-operator-language-1a-v1" as const

const ENGINE_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bqualification\s*:\s*research\b/gi, "Research this account before outreach"],
  [/\bqualification\s*:\s*expand_committee\b/gi, "Expand the buying committee"],
  [/\bqualification\s*:\s*verify\b/gi, "Verify contact details"],
  [/\bsequence\s*type\s*:\s*revalidation\b/gi, "Contact verification still required"],
  [/\bsequence\s*type\s*:\s*\w+/gi, "Sequence follow-up needed"],
  [/\bi\s+concluded\s*:\s*/gi, ""],
  [/\bdecision\s*fingerprint\b/gi, ""],
  [/\bfingerprint\b/gi, ""],
  [/\bengine\b/gi, ""],
  [/\bmaterialization\b/gi, "preparation"],
  [/\bcanonical\b/gi, ""],
  [/\bresolver\b/gi, ""],
  [/\bprojection\b/gi, ""],
  [/\bsend\s*plane\b/gi, "outreach send"],
  [/\boperator\s*review\s*required\b/gi, "Ready for review"],
  [/\btransport\s*blocked\b/gi, "Ready for review"],
  [/\bexpand_committee\b/gi, "Expand stakeholders on this account"],
  [/\bprepare_meeting\b/gi, "Prepare for the upcoming meeting"],
  [/\bfollow_up\b/gi, "Follow up after the last touch"],
  [/\bwait_until\b/gi, "Wait until the agreed date"],
  [/\bresearch\b(?=\s*before)/gi, "Research"],
]

const POSITIVE_CONCLUSION_PATTERNS: Array<[RegExp, string]> = [
  [/decision\s*maker\s*verified|champion\s*identified/i, "Decision maker verified"],
  [/company\s*matches?\s*(your\s*)?business\s*profile|icp\s*match/i, "Company matches your business profile"],
  [/contact\s*verification\s*still\s*required|email\s*unverified/i, "Contact verification still required"],
  [/waiting\s*for\s*your\s*approval|pending\s*approval|awaiting\s*operator/i, "Ready for review"],
  [/service\s*director|expand\s*committee|multi.?thread/i, "Expand stakeholders on this account"],
  [/meeting\s*booked|upcoming\s*meeting/i, "Prepare for the upcoming meeting"],
]

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim()
}

export function stripInternalEngineTerms(value: string): string {
  let next = value
  for (const [pattern, replacement] of ENGINE_TERM_REPLACEMENTS) {
    next = next.replace(pattern, replacement)
  }
  return collapseWhitespace(next)
}

export function humanizeOperatorFacingLine(value: string | null | undefined): string {
  const raw = collapseWhitespace(String(value ?? ""))
  if (!raw) return ""

  for (const [pattern, replacement] of POSITIVE_CONCLUSION_PATTERNS) {
    if (pattern.test(raw)) return replacement
  }

  const stripped = stripInternalEngineTerms(raw)
  if (!stripped) return raw

  const sentence = stripped.charAt(0).toUpperCase() + stripped.slice(1)
  return sentence.endsWith(".") ? sentence : sentence
}

export function humanizeOperatorDecisionTitle(
  title: string,
  primaryAction?: string | null,
): string {
  const fromTitle = humanizeOperatorFacingLine(title)
  if (fromTitle && fromTitle !== title) return fromTitle

  switch (primaryAction) {
    case "expand_committee":
      return "Expand stakeholders on this account"
    case "research":
      return "Research this account before outreach"
    case "prepare_meeting":
      return "Prepare for the upcoming meeting"
    case "follow_up":
      return "Follow up after the last touch"
    case "wait":
      return "Wait until the agreed follow-up date"
    case "approve_package":
      return "Review opportunity package"
    default:
      return humanizeOperatorFacingLine(title) || title
  }
}

export function humanizeOperatorBadgeLabel(label: string): string {
  const normalized = label.trim().toLowerCase()
  if (normalized.includes("operator review")) return "Ready for review"
  if (normalized.includes("send plane")) return "Ready for review"
  if (normalized.includes("transport blocked")) return "Ready for review"
  if (normalized.includes("freshness")) return "Recently updated"
  return stripInternalEngineTerms(label)
}

export function formatCanonicalDraftCount(count: number): string {
  const safe = Math.max(0, count)
  if (safe === 0) return "No editable drafts in this package"
  if (safe === 1) return "1 email draft prepared"
  return `${safe} email drafts prepared`
}

export function formatCanonicalPackageCount(count: number): string {
  const safe = Math.max(0, count)
  if (safe === 0) return "No opportunity packages waiting"
  if (safe === 1) return "1 opportunity package ready for review"
  return `${safe} opportunity packages ready for review`
}

import { formatTerminalReasonOperatorMessage } from "@/lib/growth/aios/execution/growth-terminal-reason-taxonomy-1a"
import { formatDegradedEnforcementOperatorMessage } from "@/lib/growth/aios/execution/growth-degraded-enforcement-policy-1a"

export { formatTerminalReasonOperatorMessage, formatDegradedEnforcementOperatorMessage }
