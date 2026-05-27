/** Committee completion scoring with expanded role coverage. Client-safe. */

export const COMMITTEE_COMPLETION_ROLES = [
  "owner",
  "operations",
  "service_manager",
  "finance",
  "dispatcher",
  "field_leadership",
] as const
export type CommitteeCompletionRole = (typeof COMMITTEE_COMPLETION_ROLES)[number]

export type CommitteeCompletionContactInput = {
  full_name?: string | null
  job_title?: string | null
  title?: string | null
}

const ROLE_PATTERNS: Record<CommitteeCompletionRole, RegExp[]> = {
  owner: [/\bowner\b/i, /\bfounder\b/i, /\bpresident\b/i, /\bceo\b/i],
  operations: [/\boperations\b/i, /\bcoo\b/i, /\bgeneral manager\b/i],
  service_manager: [/\bservice manager\b/i, /\bfield service manager\b/i, /\bservice director\b/i],
  finance: [/\bfinance\b/i, /\bcfo\b/i, /\bcontroller\b/i, /\bprocurement\b/i],
  dispatcher: [/\bdispatcher\b/i, /\bdispatch manager\b/i, /\bdispatch coordinator\b/i],
  field_leadership: [/\bfield (?:service )?(?:director|lead|supervisor)\b/i, /\bregional manager\b/i, /\bbranch manager\b/i],
}

function titleBlob(contact: CommitteeCompletionContactInput): string {
  return `${contact.job_title ?? contact.title ?? ""} ${contact.full_name ?? ""}`.trim()
}

export function detectCommitteeRoles(contacts: CommitteeCompletionContactInput[]): CommitteeCompletionRole[] {
  const found = new Set<CommitteeCompletionRole>()
  for (const contact of contacts) {
    const blob = titleBlob(contact)
    if (!blob) continue
    for (const role of COMMITTEE_COMPLETION_ROLES) {
      if (ROLE_PATTERNS[role].some((pattern) => pattern.test(blob))) found.add(role)
    }
  }
  return [...found]
}

export function computeCommitteeCompletion(contacts: CommitteeCompletionContactInput[]): {
  completion_pct: number
  completion_label: "0%" | "25%" | "50%" | "75%" | "100%"
  roles_found: CommitteeCompletionRole[]
  missing_roles: CommitteeCompletionRole[]
} {
  const rolesFound = detectCommitteeRoles(contacts)
  const missing = COMMITTEE_COMPLETION_ROLES.filter((role) => !rolesFound.includes(role))
  const ratio = rolesFound.length / COMMITTEE_COMPLETION_ROLES.length
  const completion_pct = Math.round(ratio * 100)

  let completion_label: "0%" | "25%" | "50%" | "75%" | "100%" = "0%"
  if (completion_pct >= 100) completion_label = "100%"
  else if (completion_pct >= 75) completion_label = "75%"
  else if (completion_pct >= 50) completion_label = "50%"
  else if (completion_pct >= 25) completion_label = "25%"

  return {
    completion_pct,
    completion_label,
    roles_found: rolesFound,
    missing_roles: missing,
  }
}

export function committeeCompletionToCoverageConfidence(completion_pct: number): number {
  return Math.max(0, Math.min(100, completion_pct))
}
