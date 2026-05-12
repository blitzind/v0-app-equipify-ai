import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { aggregateBlitzpayTreasuryMetrics } from "@/lib/blitzpay/blitzpay-contractor-treasury"
import { buildComplianceAuditImmutableHash } from "@/lib/blitzpay/blitzpay-compliance-audit"
import { advanceExposureFromModelsCents } from "@/lib/blitzpay/blitzpay-contractor-advances"
import { ensureBlitzpayDefaultChartOfAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { BLITZPAY_FINANCING_COA_EXTENSION, normalBalanceForAccountType } from "@/lib/blitzpay/blitzpay-general-ledger"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  BLITZPAY_CONTRACTOR_ADVANCE_MODEL_LIST_CAP,
  BLITZPAY_FINANCING_APPLICATION_LIST_CAP,
  BLITZPAY_FINANCING_AUDIT_LIST_CAP,
  BLITZPAY_FINANCING_MATCH_LIST_CAP,
  BLITZPAY_FINANCING_OFFER_LIST_CAP,
  BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP,
  computeProviderCompatibilityScore0to100,
  daysUntilExpirationYmd,
  sortFinancingOffersForComparison,
  sortProviderMatchesDeterministic,
  treasuryImpactScoreFromCoverageBps,
  type MarketplaceProviderRowInput,
} from "@/lib/blitzpay/blitzpay-financing-marketplace"
import { computeFinancingQualificationScore0to100, type FinancingQualificationInputs } from "@/lib/blitzpay/blitzpay-financing-qualification"

export type BlitzpayFinancingMarketplaceReportingFields = {
  financingApplicationApprovalRate: number
  averageApprovedFinancingAmount: number
  financingMarketplaceCoverage: number
  contractorAdvanceExposure: number
  financingRevenueOpportunity: number
  financingRiskScore: number
  financingConversionRate: number
  financingTreasuryImpactScore: number
}

export async function ensureBlitzpayDefaultFinancingAccounts(admin: SupabaseClient, organizationId: string): Promise<{ created: number }> {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultChartOfAccounts(admin, organizationId)
  let created = 0
  for (const row of BLITZPAY_FINANCING_COA_EXTENSION) {
    const normal = normalBalanceForAccountType(row.type)
    const { data: existing } = await admin
      .from("blitzpay_chart_of_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("account_code", row.code)
      .maybeSingle()
    if (existing) continue
    const { error } = await admin.from("blitzpay_chart_of_accounts").insert({
      organization_id: organizationId,
      account_code: row.code,
      account_name: row.name,
      account_type: row.type,
      parent_account_id: null,
      is_system_account: true,
      is_active: true,
      normal_balance: normal,
      reporting_category: "system_seed_phase_3d",
      currency: "usd",
      metadata: { seed: "blitzpay_phase_3d_financing" },
    })
    if (error) throw new Error(error.message)
    created += 1
  }
  return { created }
}

export async function insertFinancingAuditEntry(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    applicationId?: string | null
    auditType: string
    actorType: "system" | "admin" | "customer"
    actorId?: string | null
    auditSummary: string
    metadata?: Record<string, unknown>
  },
): Promise<{ id: string; immutableHash: string }> {
  assertUuid(organizationId, "organizationId")
  const meta = input.metadata ?? {}
  const hashPayload: Record<string, unknown> = {
    organization_id: organizationId,
    application_id: input.applicationId ?? null,
    audit_type: input.auditType,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    audit_summary: input.auditSummary,
    metadata: meta,
    at: new Date().toISOString().slice(0, 19),
  }
  const immutableHash = buildComplianceAuditImmutableHash(hashPayload)
  const { data, error } = await admin
    .from("blitzpay_financing_audit_log")
    .insert({
      organization_id: organizationId,
      application_id: input.applicationId ?? null,
      audit_type: input.auditType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      audit_summary: input.auditSummary,
      immutable_hash: immutableHash,
      metadata: meta,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return { id: (data as { id: string }).id, immutableHash }
}

export async function listMarketplaceFinancingProviders(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data: orgRows, error: oErr } = await admin
    .from("blitzpay_marketplace_financing_providers")
    .select(
      "id, organization_id, provider_name, provider_status, provider_type, minimum_amount_cents, maximum_amount_cents, supported_products, supported_regions, created_at",
    )
    .eq("organization_id", organizationId)
    .order("provider_name", { ascending: true })
    .limit(BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP)
  if (oErr) throw new Error(oErr.message)
  const { data: globalRows, error: gErr } = await admin
    .from("blitzpay_marketplace_financing_providers")
    .select(
      "id, organization_id, provider_name, provider_status, provider_type, minimum_amount_cents, maximum_amount_cents, supported_products, supported_regions, created_at",
    )
    .is("organization_id", null)
    .eq("provider_status", "active")
    .order("provider_name", { ascending: true })
    .limit(BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP)
  if (gErr) throw new Error(gErr.message)
  const merged = [...(orgRows ?? []), ...(globalRows ?? [])]
  merged.sort((a, b) => String((a as { provider_name: string }).provider_name).localeCompare(String((b as { provider_name: string }).provider_name)))
  return merged.slice(0, BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP)
}

export async function createMarketplaceFinancingProvider(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    providerName: string
    providerType?: string
    providerStatus?: string
    minimumAmountCents?: number | null
    maximumAmountCents?: number | null
    supportedProducts?: string[]
    supportedRegions?: string[]
    providerReferenceHash?: string | null
    contactEmail?: string | null
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultFinancingAccounts(admin, organizationId)
  const { data, error } = await admin
    .from("blitzpay_marketplace_financing_providers")
    .insert({
      organization_id: organizationId,
      provider_name: String(input.providerName || "").trim() || "Financing provider",
      provider_type: input.providerType ?? "customer_financing",
      provider_status: input.providerStatus ?? "active",
      minimum_amount_cents: input.minimumAmountCents ?? null,
      maximum_amount_cents: input.maximumAmountCents ?? null,
      supported_products: input.supportedProducts ?? [],
      supported_regions: input.supportedRegions ?? [],
      provider_reference_hash: input.providerReferenceHash?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertFinancingAuditEntry(admin, organizationId, {
    auditType: "manual_override",
    actorType: input.actorUserId ? "admin" : "system",
    actorId: input.actorUserId ?? null,
    auditSummary: "Marketplace financing provider created",
    metadata: { provider_id: id },
  })
  return { id }
}

export async function listFinancingApplications(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_financing_applications")
    .select(
      "id, customer_id, application_type, application_status, requested_amount_cents, approved_amount_cents, qualification_score, expiration_date, submitted_at, decisioned_at, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_FINANCING_APPLICATION_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listPortalFinancingApplications(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<
  Array<{
    id: string
    application_type: string
    application_status: string
    requested_amount_cents: number
    approved_amount_cents: number | null
    expiration_date: string | null
    submitted_at: string | null
    decisioned_at: string | null
    created_at: string
  }>
> {
  assertUuid(organizationId, "organizationId")
  assertUuid(customerId, "customerId")
  const { data, error } = await admin
    .from("blitzpay_financing_applications")
    .select(
      "id, application_type, application_status, requested_amount_cents, approved_amount_cents, expiration_date, submitted_at, decisioned_at, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(40)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    application_type: string
    application_status: string
    requested_amount_cents: number
    approved_amount_cents: number | null
    expiration_date: string | null
    submitted_at: string | null
    decisioned_at: string | null
    created_at: string
  }>
}

export async function listPortalFinancingOffers(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<
  Array<{
    id: string
    financing_application_id: string
    offer_status: string
    offer_amount_cents: number
    estimated_apr_basis_points: number | null
    estimated_payment_cents: number | null
    estimated_term_months: number | null
    requires_down_payment: boolean
    down_payment_cents: number | null
    created_at: string
  }>
> {
  assertUuid(organizationId, "organizationId")
  assertUuid(customerId, "customerId")
  const apps = await listPortalFinancingApplications(admin, organizationId, customerId)
  const appIds = apps.map((a) => a.id)
  if (!appIds.length) return []
  const { data, error } = await admin
    .from("blitzpay_financing_application_offers")
    .select(
      "id, financing_application_id, offer_status, offer_amount_cents, estimated_apr_basis_points, estimated_payment_cents, estimated_term_months, requires_down_payment, down_payment_cents, created_at",
    )
    .eq("organization_id", organizationId)
    .in("financing_application_id", appIds)
    .order("created_at", { ascending: false })
    .limit(60)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    financing_application_id: string
    offer_status: string
    offer_amount_cents: number
    estimated_apr_basis_points: number | null
    estimated_payment_cents: number | null
    estimated_term_months: number | null
    requires_down_payment: boolean
    down_payment_cents: number | null
    created_at: string
  }>
}

export async function createFinancingApplication(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    customerId?: string | null
    applicationType?: string
    requestedAmountCents: number
    linkedInvoiceId?: string | null
    linkedWorkOrderId?: string | null
    linkedEquipmentId?: string | null
    linkedMembershipId?: string | null
    expirationDate?: string | null
    qualificationInputs?: FinancingQualificationInputs
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultFinancingAccounts(admin, organizationId)
  const qIn = input.qualificationInputs ?? {
    recurringRevenueProxyCents: 0,
    invoicePaidCountWindow: 0,
    collectionHealthScore0to100: 50,
    membershipRenewalSuccessProxyPct: 50,
    treasuryCoverageBps: 0,
  }
  const qualification_score = computeFinancingQualificationScore0to100(qIn)
  const { data, error } = await admin
    .from("blitzpay_financing_applications")
    .insert({
      organization_id: organizationId,
      customer_id: input.customerId ?? null,
      application_type: input.applicationType ?? "customer_service",
      application_status: "draft",
      requested_amount_cents: Math.max(0, Math.round(input.requestedAmountCents)),
      qualification_score,
      linked_invoice_id: input.linkedInvoiceId ?? null,
      linked_work_order_id: input.linkedWorkOrderId ?? null,
      linked_equipment_id: input.linkedEquipmentId ?? null,
      linked_membership_id: input.linkedMembershipId ?? null,
      expiration_date: input.expirationDate?.slice(0, 10) ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertFinancingAuditEntry(admin, organizationId, {
    applicationId: id,
    auditType: "application_created",
    actorType: input.actorUserId ? "admin" : "system",
    actorId: input.actorUserId ?? null,
    auditSummary: "Financing application draft created",
    metadata: { qualification_score },
  })
  await insertFinancingAuditEntry(admin, organizationId, {
    applicationId: id,
    auditType: "qualification_scored",
    actorType: "system",
    auditSummary: "Deterministic qualification score computed",
    metadata: { qualification_score },
  })
  return { id, qualificationScore: qualification_score }
}

async function loadProvidersForMatching(admin: SupabaseClient, organizationId: string): Promise<MarketplaceProviderRowInput[]> {
  const rows = await listMarketplaceFinancingProviders(admin, organizationId)
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organization_id: (r.organization_id as string | null) ?? null,
    provider_name: String(r.provider_name),
    provider_status: String(r.provider_status),
    provider_type: String(r.provider_type),
    minimum_amount_cents: r.minimum_amount_cents != null ? Math.round(Number(r.minimum_amount_cents)) : null,
    maximum_amount_cents: r.maximum_amount_cents != null ? Math.round(Number(r.maximum_amount_cents)) : null,
    supported_products: r.supported_products,
  }))
}

export async function refreshProviderMatchesForApplication(
  admin: SupabaseClient,
  organizationId: string,
  applicationId: string,
  applicationType: string,
  requestedAmountCents: number,
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(applicationId, "applicationId")
  await admin.from("blitzpay_financing_provider_matches").delete().eq("financing_application_id", applicationId).eq("match_status", "suggested")
  const providers = (await loadProvidersForMatching(admin, organizationId)).filter((p) => p.provider_status === "active")
  const scored = providers.map((p) => {
    const { score, reason } = computeProviderCompatibilityScore0to100({
      applicationType,
      requestedAmountCents,
      provider: p,
    })
    return { providerId: p.id, score, providerName: p.provider_name, reason }
  })
  const ordered = sortProviderMatchesDeterministic(scored).slice(0, 20)
  for (const m of ordered) {
    const { error } = await admin.from("blitzpay_financing_provider_matches").insert({
      organization_id: organizationId,
      financing_application_id: applicationId,
      financing_provider_id: m.providerId,
      match_status: "suggested",
      compatibility_score: m.score,
      match_reason: m.reason.slice(0, 500),
      metadata: {},
    })
    if (error) throw new Error(error.message)
  }
  await insertFinancingAuditEntry(admin, organizationId, {
    applicationId,
    auditType: "provider_matched",
    actorType: "system",
    auditSummary: "Provider matches refreshed (deterministic)",
    metadata: { match_count: ordered.length },
  })
}

export async function submitFinancingApplication(admin: SupabaseClient, organizationId: string, applicationId: string, actorUserId?: string | null) {
  assertUuid(organizationId, "organizationId")
  assertUuid(applicationId, "applicationId")
  const { data: row, error } = await admin
    .from("blitzpay_financing_applications")
    .select("id, application_status, application_type, requested_amount_cents")
    .eq("organization_id", organizationId)
    .eq("id", applicationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!row || (row as { application_status: string }).application_status !== "draft") {
    throw new Error("invalid_application_state")
  }
  const r = row as { application_type: string; requested_amount_cents: number }
  const now = new Date().toISOString()
  const { error: uErr } = await admin
    .from("blitzpay_financing_applications")
    .update({
      application_status: "submitted",
      submitted_at: now,
      updated_at: now,
    })
    .eq("id", applicationId)
    .eq("organization_id", organizationId)
  if (uErr) throw new Error(uErr.message)
  await refreshProviderMatchesForApplication(admin, organizationId, applicationId, r.application_type, Math.round(Number(r.requested_amount_cents)))
  await insertFinancingAuditEntry(admin, organizationId, {
    applicationId,
    auditType: "submitted",
    actorType: actorUserId ? "admin" : "system",
    actorId: actorUserId ?? null,
    auditSummary: "Financing application submitted (orchestration only)",
    metadata: {},
  })
}

export async function cancelFinancingApplication(admin: SupabaseClient, organizationId: string, applicationId: string, actorUserId?: string | null) {
  assertUuid(organizationId, "organizationId")
  assertUuid(applicationId, "applicationId")
  const { data: row, error } = await admin
    .from("blitzpay_financing_applications")
    .select("id, application_status")
    .eq("organization_id", organizationId)
    .eq("id", applicationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) throw new Error("not_found")
  const st = (row as { application_status: string }).application_status
  if (!["draft", "submitted", "reviewing"].includes(st)) throw new Error("invalid_application_state")
  const now = new Date().toISOString()
  const { error: uErr } = await admin
    .from("blitzpay_financing_applications")
    .update({ application_status: "canceled", updated_at: now })
    .eq("id", applicationId)
    .eq("organization_id", organizationId)
  if (uErr) throw new Error(uErr.message)
  await insertFinancingAuditEntry(admin, organizationId, {
    applicationId,
    auditType: "manual_override",
    actorType: actorUserId ? "admin" : "system",
    actorId: actorUserId ?? null,
    auditSummary: "Financing application canceled",
    metadata: {},
  })
}

export async function listFinancingApplicationOffers(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_financing_application_offers")
    .select(
      "id, financing_application_id, offer_status, offer_amount_cents, estimated_apr_basis_points, estimated_payment_cents, estimated_term_months, requires_down_payment, down_payment_cents, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_FINANCING_OFFER_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listFinancingProviderMatches(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_financing_provider_matches")
    .select("id, financing_application_id, financing_provider_id, match_status, compatibility_score, match_reason, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_FINANCING_MATCH_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listContractorAdvanceModels(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_contractor_advance_models")
    .select(
      "id, model_status, advance_type, estimated_advance_amount_cents, estimated_payback_amount_cents, estimated_term_days, repayment_method, risk_score, treasury_impact_score, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_CONTRACTOR_ADVANCE_MODEL_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createContractorAdvanceModel(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    advanceType?: string
    estimatedAdvanceAmountCents: number
    estimatedPaybackAmountCents: number
    estimatedTermDays?: number | null
    repaymentMethod?: string
    riskScore?: number | null
    treasuryImpactScore?: number | null
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultFinancingAccounts(admin, organizationId)
  const { data, error } = await admin
    .from("blitzpay_contractor_advance_models")
    .insert({
      organization_id: organizationId,
      advance_type: input.advanceType ?? "receivables",
      estimated_advance_amount_cents: Math.max(0, Math.round(input.estimatedAdvanceAmountCents)),
      estimated_payback_amount_cents: Math.max(0, Math.round(input.estimatedPaybackAmountCents)),
      estimated_term_days: input.estimatedTermDays ?? null,
      repayment_method: input.repaymentMethod ?? "percentage_of_revenue",
      risk_score: input.riskScore ?? null,
      treasury_impact_score: input.treasuryImpactScore ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertFinancingAuditEntry(admin, organizationId, {
    auditType: "manual_override",
    actorType: input.actorUserId ? "admin" : "system",
    actorId: input.actorUserId ?? null,
    auditSummary: "Contractor advance model created (planning only)",
    metadata: { model_id: id },
  })
  return { id }
}

export async function fetchFinancingHealthDashboard(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const apps = await listFinancingApplications(admin, organizationId)
  const offers = await listFinancingApplicationOffers(admin, organizationId)
  const { data: auditRows, error: aErr } = await admin
    .from("blitzpay_financing_audit_log")
    .select("id, audit_type, audit_summary, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_FINANCING_AUDIT_LIST_CAP)
  if (aErr) throw new Error(aErr.message)
  const pipeline = {
    draft: 0,
    submitted: 0,
    reviewing: 0,
    approved: 0,
    funded: 0,
  }
  for (const a of apps as Array<{ application_status: string }>) {
    const s = a.application_status
    if (s in pipeline) (pipeline as Record<string, number>)[s] += 1
  }
  const sortedOffers = sortFinancingOffersForComparison(
    (offers as Array<{
      id: string
      offer_amount_cents: number
      estimated_apr_basis_points: number | null
      estimated_payment_cents: number | null
      estimated_term_months: number | null
    }>) ?? [],
  ).slice(0, 5)
  const today = new Date().toISOString().slice(0, 10)
  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Financing options are offered through third-party providers. Approval and terms are determined by the financing provider.",
    pipeline,
    activeOffersSample: sortedOffers,
    recentAudit: (auditRows ?? []).slice(0, 12),
    qualificationNote:
      "Qualification indicators are operational tools only — they do not guarantee approval and are not a substitute for a provider credit decision.",
  }
}

export async function fetchFinancingMarketplaceReportingFields(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayFinancingMarketplaceReportingFields> {
  assertUuid(organizationId, "organizationId")
  const { data: apps, error: appErr } = await admin
    .from("blitzpay_financing_applications")
    .select("application_status, requested_amount_cents, approved_amount_cents")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_FINANCING_APPLICATION_LIST_CAP)
  if (appErr) throw new Error(appErr.message)
  const rows = (apps ?? []) as Array<{ application_status: string; requested_amount_cents: number; approved_amount_cents: number | null }>
  let decisioned = 0
  let approved = 0
  let sumApproved = 0
  let nApproved = 0
  let submitted = 0
  let funded = 0
  for (const r of rows) {
    const s = r.application_status
    if (["approved", "conditionally_approved", "declined", "expired", "funded"].includes(s)) decisioned += 1
    if (["approved", "conditionally_approved", "funded"].includes(s)) approved += 1
    if (["approved", "conditionally_approved", "funded"].includes(s) && r.approved_amount_cents != null) {
      sumApproved += Math.round(Number(r.approved_amount_cents))
      nApproved += 1
    }
    if (s === "submitted" || s === "reviewing") submitted += 1
    if (s === "funded") funded += 1
  }
  const financingApplicationApprovalRate = decisioned === 0 ? 0 : Math.round((approved * 100) / decisioned)
  const averageApprovedFinancingAmount = nApproved === 0 ? 0 : Math.round(sumApproved / nApproved)
  const { data: provs, error: pErr } = await admin
    .from("blitzpay_marketplace_financing_providers")
    .select("id, organization_id, provider_status")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .limit(BLITZPAY_MARKETPLACE_PROVIDER_LIST_CAP)
  if (pErr) throw new Error(pErr.message)
  const activeProv = (provs ?? []).filter((p: { provider_status: string }) => p.provider_status === "active").length
  const financingMarketplaceCoverage = Math.min(100, Math.round((activeProv * 100) / Math.max(8, activeProv + 2)))
  const { data: models, error: mErr } = await admin
    .from("blitzpay_contractor_advance_models")
    .select("model_status, estimated_advance_amount_cents")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_CONTRACTOR_ADVANCE_MODEL_LIST_CAP)
  if (mErr) throw new Error(mErr.message)
  const contractorAdvanceExposure = advanceExposureFromModelsCents(
    (models ?? []) as Array<{ model_status: string; estimated_advance_amount_cents: number }>,
    BLITZPAY_CONTRACTOR_ADVANCE_MODEL_LIST_CAP,
  )
  let pendingReq = 0
  for (const r of rows) {
    if (r.application_status === "submitted" || r.application_status === "reviewing") {
      pendingReq += Math.round(Number(r.requested_amount_cents))
    }
  }
  const financingRevenueOpportunity = Math.min(pendingReq, 5_000_000)
  const financingRiskScore = Math.max(0, Math.min(100, 100 - financingApplicationApprovalRate))
  const submittedTotal = rows.filter((r) => ["submitted", "reviewing", "approved", "funded"].includes(r.application_status)).length
  const financingConversionRate = submittedTotal === 0 ? 0 : Math.round((funded * 100) / submittedTotal)
  let financingTreasuryImpactScore = 50
  try {
    const tm = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
    const coverageBps =
      pendingReq > 0 ? Math.min(1_000_000, Math.round((tm.operatingBalanceCents * 10_000) / Math.max(1, pendingReq))) : 100_000
    financingTreasuryImpactScore = treasuryImpactScoreFromCoverageBps(coverageBps)
  } catch {
    financingTreasuryImpactScore = treasuryImpactScoreFromCoverageBps(25_000)
  }
  return {
    financingApplicationApprovalRate,
    averageApprovedFinancingAmount,
    financingMarketplaceCoverage,
    contractorAdvanceExposure,
    financingRevenueOpportunity,
    financingRiskScore,
    financingConversionRate,
    financingTreasuryImpactScore,
  }
}
