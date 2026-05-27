/** Client-safe job signal taxonomy + deterministic classification (Milestone C). */

export const GROWTH_JOB_SIGNAL_DEPARTMENTS = [
  "Field Service",
  "Operations",
  "Dispatch",
  "Biomedical",
  "Facilities",
  "Engineering",
  "Sales",
  "Customer Support",
  "Warehouse",
  "Compliance",
  "IT",
  "Executive",
  "Unknown",
] as const

export type GrowthJobSignalDepartment = (typeof GROWTH_JOB_SIGNAL_DEPARTMENTS)[number]

export const GROWTH_JOB_ROLE_FAMILIES = [
  "Technician",
  "Manager",
  "Director",
  "Coordinator",
  "Dispatcher",
  "Executive",
  "Specialist",
  "Unknown",
] as const

export type GrowthJobRoleFamily = (typeof GROWTH_JOB_ROLE_FAMILIES)[number]

export type GrowthJobOperationalRelevance = "high" | "medium" | "low"

export type GrowthHiringIntensity = "low" | "medium" | "high"

const DEPARTMENT_KEYWORDS: Record<Exclude<GrowthJobSignalDepartment, "Unknown">, readonly string[]> = {
  "Field Service": ["field service", "field tech", "service tech", "field engineer", "mobile tech"],
  Operations: ["operations", "ops ", "operational", "service manager", "service director"],
  Dispatch: ["dispatch", "dispatcher", "scheduling coordinator"],
  Biomedical: ["biomedical", "biomed", "clinical engineer", "medical equipment", "bmet"],
  Facilities: ["facilities", "facility", "maintenance", "plant engineer", "building engineer"],
  Engineering: ["engineer", "engineering", "design", "r&d"],
  Sales: ["sales", "account executive", "business development", "bd "],
  "Customer Support": ["customer support", "customer service", "help desk", "call center"],
  Warehouse: ["warehouse", "inventory", "logistics", "supply chain", "parts clerk"],
  Compliance: ["compliance", "regulatory", "quality assurance", "qa manager"],
  IT: ["information technology", " it ", "systems admin", "network engineer", "software"],
  Executive: ["chief", "ceo", "cfo", "cto", "president", "vp ", "vice president", "executive"],
}

const ROLE_FAMILY_KEYWORDS: Record<Exclude<GrowthJobRoleFamily, "Unknown">, readonly string[]> = {
  Technician: ["technician", "tech ", "technician", "repair", "installer", "mechanic"],
  Manager: ["manager", "supervisor", "lead "],
  Director: ["director", "head of"],
  Coordinator: ["coordinator", "planner", "scheduler"],
  Dispatcher: ["dispatcher", "dispatch"],
  Executive: ["chief", "ceo", "cfo", "cto", "president", "vp ", "vice president"],
  Specialist: ["specialist", "analyst", "consultant"],
}

const ICP_DEPARTMENTS = new Set<GrowthJobSignalDepartment>([
  "Field Service",
  "Operations",
  "Dispatch",
  "Biomedical",
  "Facilities",
  "Warehouse",
])

const HIRING_INTENT_KEYWORDS: Record<string, readonly string[]> = {
  technician_hiring: ["technician", "tech ", "repair", "service tech", "biomed", "maintenance"],
  dispatch_hiring: ["dispatch", "dispatcher", "scheduling"],
  field_ops_expansion: ["field service", "field ops", "regional", "mobile", "route"],
  multi_location_hiring: ["regional", "multi-site", "multiple locations", "branch", "hub"],
}

function buildHaystack(input: {
  title?: string | null
  department?: string | null
  excerpt?: string | null
}): string {
  return [input.title, input.department, input.excerpt].filter(Boolean).join(" ").toLowerCase()
}

function matchFromKeywords<T extends string>(
  haystack: string,
  keywordsByKey: Record<string, readonly string[]>,
  orderedKeys: readonly T[],
  fallback: T,
): T {
  if (!haystack.trim()) return fallback
  for (const key of orderedKeys) {
    if (key === fallback) continue
    const keywords = keywordsByKey[key as string]
    if (keywords?.some((keyword) => haystack.includes(keyword))) {
      return key
    }
  }
  return fallback
}

export function classifyJobDepartment(input: {
  title?: string | null
  department?: string | null
  excerpt?: string | null
}): GrowthJobSignalDepartment {
  const explicit = input.department?.trim()
  if (explicit) {
    const normalized = explicit.toLowerCase()
    for (const dept of GROWTH_JOB_SIGNAL_DEPARTMENTS) {
      if (dept === "Unknown") continue
      if (normalized.includes(dept.toLowerCase())) return dept
    }
  }

  const haystack = buildHaystack(input)
  return matchFromKeywords(
    haystack,
    DEPARTMENT_KEYWORDS as Record<string, readonly string[]>,
    GROWTH_JOB_SIGNAL_DEPARTMENTS,
    "Unknown",
  )
}

export function classifyJobRoleFamily(input: {
  title?: string | null
  excerpt?: string | null
}): GrowthJobRoleFamily {
  const haystack = buildHaystack({ title: input.title, excerpt: input.excerpt })
  return matchFromKeywords(
    haystack,
    ROLE_FAMILY_KEYWORDS as Record<string, readonly string[]>,
    GROWTH_JOB_ROLE_FAMILIES,
    "Unknown",
  )
}

export function classifyJobOperationalRelevance(input: {
  department: GrowthJobSignalDepartment
  title?: string | null
  excerpt?: string | null
}): GrowthJobOperationalRelevance {
  if (ICP_DEPARTMENTS.has(input.department)) return "high"

  const haystack = buildHaystack({ title: input.title, excerpt: input.excerpt })
  const icpHits = ["field", "service", "maintenance", "equipment", "facilities", "dispatch", "biomed"].filter(
    (word) => haystack.includes(word),
  ).length
  if (icpHits >= 2) return "high"
  if (icpHits === 1) return "medium"
  return "low"
}

export function classifyHiringIntentIndicators(input: {
  title?: string | null
  department?: string | null
  excerpt?: string | null
  location?: string | null
}): string[] {
  const haystack = buildHaystack({
    title: input.title,
    department: input.department,
    excerpt: input.excerpt,
  })
  const indicators: string[] = []

  for (const [indicator, keywords] of Object.entries(HIRING_INTENT_KEYWORDS)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      indicators.push(indicator)
    }
  }

  const locationCount = (input.location ?? "")
    .split(/[,;/|]/)
    .map((part) => part.trim())
    .filter(Boolean).length
  if (locationCount >= 2 && !indicators.includes("multi_location_hiring")) {
    indicators.push("multi_location_hiring")
  }

  return indicators
}

/** Deterministic open-role intensity from aggregate job count. */
export function classifyHiringIntensity(openRoleCount: number): GrowthHiringIntensity {
  if (openRoleCount >= 6) return "high"
  if (openRoleCount >= 3) return "medium"
  if (openRoleCount >= 1) return "low"
  return "low"
}

export function formatJobDepartmentLabel(department: string | null | undefined): string {
  return department?.trim() || "—"
}

export function formatHiringIntensityLabel(intensity: string | null | undefined): string {
  if (!intensity?.trim()) return "—"
  return intensity.charAt(0).toUpperCase() + intensity.slice(1)
}

/** Example queue payload for operator/manual Jobs ingestion (Milestone C). */
export const GROWTH_JOB_POSTING_MANUAL_QUEUE_SAMPLE_INPUT = [
  {
    title: "Biomedical Equipment Technician",
    company_name: "Acme Health Systems",
    domain: "acmehealth.com",
    department: "Field Service",
    location: "Nashville, TN",
    employment_type: "Full-time",
    posted_at: "2026-05-20T12:00:00Z",
    source_url: "https://example.com/jobs/123",
    publisher: "Linked Careers",
    excerpt: "Seeking experienced biomedical repair technician for regional service coverage.",
  },
] as const

export const GROWTH_JOB_POSTING_MANUAL_QUEUE_SQL_EXAMPLE = `
-- Manual Job posting ingestion (Milestone C): enqueue then run growth-signal-ingest cron/worker.
insert into growth.signal_ingestion_queue (provider_key, status, cursor, scheduled_for)
values (
  'job_posting_manual',
  'pending',
  jsonb_build_object(
    'sample_input',
    jsonb_build_array(
      jsonb_build_object(
        'title', 'Biomedical Equipment Technician',
        'company_name', 'Acme Health Systems',
        'domain', 'acmehealth.com',
        'department', 'Field Service',
        'location', 'Nashville, TN',
        'employment_type', 'Full-time',
        'posted_at', '2026-05-20T12:00:00Z',
        'source_url', 'https://example.com/jobs/123',
        'publisher', 'Linked Careers',
        'excerpt', 'Seeking experienced biomedical repair technician for regional service coverage.'
      )
    )
  ),
  now()
);
`.trim()
