/** Organization account classification for platform metrics exclusion (client-safe). */

export const ORGANIZATION_ACCOUNT_TYPES = [
  "customer",
  "demo",
  "internal",
  "test",
  "unbillable",
] as const

export type OrganizationAccountType = (typeof ORGANIZATION_ACCOUNT_TYPES)[number]

export type OrganizationMetricsClassificationRow = {
  account_type?: string | null
  exclude_from_platform_metrics?: boolean | null
  exclusion_reason?: string | null
  excluded_at?: string | null
  excluded_by?: string | null
}

export type OrganizationMetricsClassificationPatch = {
  account_type: OrganizationAccountType
  exclude_from_platform_metrics: boolean
  exclusion_reason: string | null
  excluded_at: string | null
  excluded_by: string | null
}

const ACCOUNT_TYPE_LABELS: Record<OrganizationAccountType, string> = {
  customer: "Real customer",
  demo: "Demo",
  internal: "Internal",
  test: "Test",
  unbillable: "Unbillable",
}

const ACCOUNT_TYPE_BADGE_LABELS: Record<Exclude<OrganizationAccountType, "customer">, string> = {
  demo: "Demo",
  internal: "Internal",
  test: "Test",
  unbillable: "Unbillable",
}

export function parseOrganizationAccountType(raw: unknown): OrganizationAccountType | null {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase()
  return (ORGANIZATION_ACCOUNT_TYPES as readonly string[]).includes(v) ? (v as OrganizationAccountType) : null
}

export function accountTypeExcludesFromPlatformMetrics(accountType: OrganizationAccountType): boolean {
  return accountType !== "customer"
}

export function isOrganizationIncludedInPlatformMetrics(
  row: Pick<OrganizationMetricsClassificationRow, "exclude_from_platform_metrics">,
): boolean {
  return row.exclude_from_platform_metrics !== true
}

export function organizationAccountTypeLabel(accountType: OrganizationAccountType): string {
  return ACCOUNT_TYPE_LABELS[accountType]
}

export function organizationAccountTypeBadgeLabel(
  accountType: OrganizationAccountType,
): string | null {
  if (accountType === "customer") return null
  return ACCOUNT_TYPE_BADGE_LABELS[accountType]
}

export function buildOrganizationMetricsClassificationPatch(input: {
  accountType: OrganizationAccountType
  exclusionReason?: string | null
  excludedByUserId?: string | null
  nowIso?: string
}): OrganizationMetricsClassificationPatch {
  const exclude = accountTypeExcludesFromPlatformMetrics(input.accountType)
  const reason = String(input.exclusionReason ?? "").trim()
  const nowIso = input.nowIso ?? new Date().toISOString()

  return {
    account_type: input.accountType,
    exclude_from_platform_metrics: exclude,
    exclusion_reason: exclude ? (reason || null) : null,
    excluded_at: exclude ? nowIso : null,
    excluded_by: exclude ? (input.excludedByUserId ?? null) : null,
  }
}

export function filterOrganizationsForPlatformMetrics<T extends OrganizationMetricsClassificationRow>(
  rows: T[],
): T[] {
  return rows.filter(isOrganizationIncludedInPlatformMetrics)
}

/** Use with Supabase `.eq("exclude_from_platform_metrics", …)` for platform metric org queries. */
export const PLATFORM_METRICS_INCLUDED_ORG_EQ = false as const

export function mapOrganizationMetricsClassificationFromRow(
  row: OrganizationMetricsClassificationRow,
): {
  accountType: OrganizationAccountType
  excludeFromPlatformMetrics: boolean
  exclusionReason: string | null
  excludedAt: string | null
  excludedBy: string | null
  accountTypeBadge: string | null
} {
  const accountType = parseOrganizationAccountType(row.account_type) ?? "customer"
  const excludeFromPlatformMetrics = row.exclude_from_platform_metrics === true
  return {
    accountType,
    excludeFromPlatformMetrics,
    exclusionReason: row.exclusion_reason ?? null,
    excludedAt: row.excluded_at ?? null,
    excludedBy: row.excluded_by ?? null,
    accountTypeBadge: organizationAccountTypeBadgeLabel(accountType),
  }
}

/** Human-friendly delete failure when immutable financial audit rows block cascade delete. */
export function parseOrganizationHardDeleteFailure(message: string): {
  userMessage: string
  code: string
  suggestMarkInternalOrExclude: boolean
} {
  const lower = message.toLowerCase()
  if (lower.includes("blitzpay_mobile_audit_immutable") || lower.includes("immutable")) {
    return {
      code: "immutable_audit_records",
      suggestMarkInternalOrExclude: true,
      userMessage:
        "This organization cannot be permanently deleted because it has immutable financial audit records (for example BlitzPay mobile audit history). Archive the account or mark it as internal/excluded instead — audit data stays intact for compliance.",
    }
  }
  if (lower.includes("organization_metrics_classification_protected")) {
    return {
      code: "classification_protected",
      suggestMarkInternalOrExclude: false,
      userMessage: "Account classification can only be changed by platform administrators.",
    }
  }
  return {
    code: "delete_failed",
    suggestMarkInternalOrExclude: false,
    userMessage: "Could not delete this organization. Try archiving or marking it as internal/excluded instead.",
  }
}
