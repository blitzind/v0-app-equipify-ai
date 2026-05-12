import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildComplianceAuditImmutableHash } from "@/lib/blitzpay/blitzpay-compliance-audit"
import { ensureBlitzpayDefaultChartOfAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { BLITZPAY_TAX_COA_EXTENSION, hashAccountingSourceReference, normalBalanceForAccountType } from "@/lib/blitzpay/blitzpay-general-ledger"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { estimateEmployerPayrollTaxCents } from "@/lib/blitzpay/blitzpay-payroll-tax-estimates"
import { summarizePayrollHealth } from "@/lib/blitzpay/blitzpay-payroll-runs"
import {
  BLITZPAY_COMPLIANCE_AUDIT_LIST_CAP,
  BLITZPAY_ACH_AUTH_LIST_CAP,
  BLITZPAY_TAX_CALCULATION_LIST_CAP,
  BLITZPAY_TAX_JURISDICTION_LIST_CAP,
  BLITZPAY_TAX_RULE_LIST_CAP,
  BLITZPAY_VENDOR_TAX_PROFILE_LIST_CAP,
  calculateTaxCentsFromRule,
  computeComplianceRiskScore0to100,
  computeConvenienceFeeExposureRisk0to100,
  computeFilingReadinessScore0to100,
  computeVendor1099Readiness0to100,
  isAchAuthorizationRetained,
  parseConvenienceFeePolicyFromRuleMetadata,
  resolveActiveTaxRulesForAppliesTo,
  type TaxRuleRowInput,
} from "@/lib/blitzpay/blitzpay-tax-engine"

export type BlitzpayTaxComplianceReportingFields = {
  salesTaxPayableCents: number
  payrollTaxPayableCents: number
  contractorTaxEstimateCents: number
  convenienceFeeExposureRisk: number
  achAuthorizationCoverageRate: number
  vendor1099ReadinessRate: number
  filingReadinessScore: number
  complianceHealthScore: number
}

export async function ensureBlitzpayDefaultTaxAccounts(admin: SupabaseClient, organizationId: string): Promise<{ created: number }> {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultChartOfAccounts(admin, organizationId)
  let created = 0
  for (const row of BLITZPAY_TAX_COA_EXTENSION) {
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
      reporting_category: "system_seed_phase_3c",
      currency: "usd",
      metadata: { seed: "blitzpay_phase_3c_tax" },
    })
    if (error) throw new Error(error.message)
    created += 1
  }
  return { created }
}

export async function insertComplianceAuditEntry(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    auditType: string
    actorType: "system" | "admin" | "user"
    actorId?: string | null
    relatedEntityType?: string | null
    relatedEntityId?: string | null
    auditSummary: string
    metadata?: Record<string, unknown>
  },
): Promise<{ id: string; immutableHash: string }> {
  assertUuid(organizationId, "organizationId")
  const meta = input.metadata ?? {}
  const hashPayload: Record<string, unknown> = {
    organization_id: organizationId,
    audit_type: input.auditType,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
    audit_summary: input.auditSummary,
    metadata: meta,
    at: new Date().toISOString().slice(0, 19),
  }
  const immutableHash = buildComplianceAuditImmutableHash(hashPayload)
  const { data, error } = await admin
    .from("blitzpay_compliance_audit_log")
    .insert({
      organization_id: organizationId,
      audit_type: input.auditType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      audit_summary: input.auditSummary,
      immutable_hash: immutableHash,
      metadata: meta,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return { id: (data as { id: string }).id, immutableHash }
}

export async function listTaxJurisdictions(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_tax_jurisdictions")
    .select("id, jurisdiction_name, jurisdiction_type, jurisdiction_code, country_code, region_code, tax_status, created_at")
    .eq("organization_id", organizationId)
    .order("jurisdiction_name", { ascending: true })
    .limit(BLITZPAY_TAX_JURISDICTION_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTaxJurisdiction(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    jurisdictionName: string
    jurisdictionType?: string
    jurisdictionCode?: string | null
    countryCode?: string
    regionCode?: string | null
    taxStatus?: string
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultTaxAccounts(admin, organizationId)
  const { data, error } = await admin
    .from("blitzpay_tax_jurisdictions")
    .insert({
      organization_id: organizationId,
      jurisdiction_name: String(input.jurisdictionName || "").trim() || "Jurisdiction",
      jurisdiction_type: input.jurisdictionType ?? "state",
      jurisdiction_code: input.jurisdictionCode?.trim() || null,
      country_code: (input.countryCode ?? "US").slice(0, 2).toUpperCase(),
      region_code: input.regionCode?.trim() || null,
      tax_status: input.taxStatus ?? "active",
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertComplianceAuditEntry(admin, organizationId, {
    auditType: "compliance_review",
    actorType: input.actorUserId ? "user" : "admin",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "blitzpay_tax_jurisdictions",
    relatedEntityId: id,
    auditSummary: "Tax jurisdiction created",
    metadata: { jurisdiction_name: input.jurisdictionName },
  })
  return { id }
}

async function loadRulesWithJurisdictions(admin: SupabaseClient, organizationId: string): Promise<TaxRuleRowInput[]> {
  const { data: rules, error } = await admin
    .from("blitzpay_tax_rules")
    .select(
      "id, jurisdiction_id, tax_rule_type, calculation_method, rate_basis_points, flat_amount_cents, threshold_amount_cents, applies_to, effective_start_date, effective_end_date, compliance_status",
    )
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_TAX_RULE_LIST_CAP)
  if (error) throw new Error(error.message)
  if (!rules?.length) return []
  const jids = [...new Set(rules.map((r) => (r as { jurisdiction_id: string }).jurisdiction_id))]
  const { data: juris, error: jErr } = await admin
    .from("blitzpay_tax_jurisdictions")
    .select("id, jurisdiction_type")
    .eq("organization_id", organizationId)
    .in("id", jids)
  if (jErr) throw new Error(jErr.message)
  const jt = new Map((juris ?? []).map((j) => [(j as { id: string }).id, (j as { jurisdiction_type: string }).jurisdiction_type]))
  return (rules as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    jurisdiction_id: String(r.jurisdiction_id),
    jurisdiction_type: jt.get(String(r.jurisdiction_id)) ?? "state",
    tax_rule_type: String(r.tax_rule_type),
    calculation_method: String(r.calculation_method),
    rate_basis_points: r.rate_basis_points != null ? Math.round(Number(r.rate_basis_points)) : null,
    flat_amount_cents: r.flat_amount_cents != null ? Math.round(Number(r.flat_amount_cents)) : null,
    threshold_amount_cents: r.threshold_amount_cents != null ? Math.round(Number(r.threshold_amount_cents)) : null,
    applies_to: String(r.applies_to),
    effective_start_date: String(r.effective_start_date).slice(0, 10),
    effective_end_date: r.effective_end_date ? String(r.effective_end_date).slice(0, 10) : null,
    compliance_status: String(r.compliance_status),
  }))
}

export async function listTaxRules(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_tax_rules")
    .select(
      "id, jurisdiction_id, tax_rule_name, tax_rule_type, calculation_method, rate_basis_points, flat_amount_cents, threshold_amount_cents, applies_to, effective_start_date, effective_end_date, compliance_status, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .order("effective_start_date", { ascending: false })
    .limit(BLITZPAY_TAX_RULE_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTaxRule(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    jurisdictionId: string
    taxRuleName: string
    taxRuleType?: string
    calculationMethod?: string
    rateBasisPoints?: number | null
    flatAmountCents?: number | null
    thresholdAmountCents?: number | null
    appliesTo?: string
    effectiveStartDate: string
    effectiveEndDate?: string | null
    complianceStatus?: string
    metadata?: Record<string, unknown>
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(input.jurisdictionId, "jurisdictionId")
  await ensureBlitzpayDefaultTaxAccounts(admin, organizationId)
  const { data, error } = await admin
    .from("blitzpay_tax_rules")
    .insert({
      organization_id: organizationId,
      jurisdiction_id: input.jurisdictionId,
      tax_rule_name: String(input.taxRuleName || "").trim() || "Rule",
      tax_rule_type: input.taxRuleType ?? "sales_tax",
      calculation_method: input.calculationMethod ?? "percentage",
      rate_basis_points: input.rateBasisPoints ?? null,
      flat_amount_cents: input.flatAmountCents ?? null,
      threshold_amount_cents: input.thresholdAmountCents ?? null,
      applies_to: input.appliesTo ?? "invoice",
      effective_start_date: input.effectiveStartDate.slice(0, 10),
      effective_end_date: input.effectiveEndDate?.slice(0, 10) ?? null,
      compliance_status: input.complianceStatus ?? "active",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertComplianceAuditEntry(admin, organizationId, {
    auditType: "tax_rule_change",
    actorType: input.actorUserId ? "user" : "admin",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "blitzpay_tax_rules",
    relatedEntityId: id,
    auditSummary: "Tax rule created",
    metadata: { tax_rule_name: input.taxRuleName },
  })
  return { id }
}

export async function listTaxCalculations(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_tax_calculations")
    .select(
      "id, source_type, source_id, jurisdiction_id, tax_rule_id, taxable_amount_cents, calculated_tax_cents, effective_rate_basis_points, calculation_status, calculation_date, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_TAX_CALCULATION_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export type TaxCalculateResult = {
  taxableAmountCents: number
  calculatedTaxCents: number
  effectiveRateBasisPoints: number | null
  matchedRuleId: string | null
  jurisdictionId: string | null
  asOfDate: string
}

export async function runDeterministicTaxCalculation(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    taxableAmountCents: number
    appliesTo: string
    asOfYmd?: string
    jurisdictionId?: string | null
    persist?: boolean
    sourceType?: string
    sourceId?: string
    actorUserId?: string | null
  },
): Promise<TaxCalculateResult> {
  assertUuid(organizationId, "organizationId")
  const asOf = (input.asOfYmd ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
  const taxable = Math.max(0, Math.round(input.taxableAmountCents))
  const rules = await loadRulesWithJurisdictions(admin, organizationId)
  let pool = resolveActiveTaxRulesForAppliesTo(rules, input.appliesTo, asOf)
  if (input.jurisdictionId) {
    assertUuid(input.jurisdictionId, "jurisdictionId")
    pool = pool.filter((r) => r.jurisdiction_id === input.jurisdictionId)
  }
  const rule = pool[0] ?? null
  if (!rule) {
    return {
      taxableAmountCents: taxable,
      calculatedTaxCents: 0,
      effectiveRateBasisPoints: null,
      matchedRuleId: null,
      jurisdictionId: input.jurisdictionId ?? null,
      asOfDate: asOf,
    }
  }
  const { taxCents, effectiveBps } = calculateTaxCentsFromRule(taxable, rule)
  if (input.persist && input.sourceType && input.sourceId) {
    assertUuid(input.sourceId, "sourceId")
    const { data: calc, error } = await admin
      .from("blitzpay_tax_calculations")
      .insert({
        organization_id: organizationId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        jurisdiction_id: rule.jurisdiction_id,
        tax_rule_id: rule.id,
        taxable_amount_cents: taxable,
        calculated_tax_cents: taxCents,
        effective_rate_basis_points: effectiveBps,
        calculation_status: "estimated",
        calculation_date: asOf,
        metadata: { applies_to: input.appliesTo },
      })
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    if (calc) {
      await insertComplianceAuditEntry(admin, organizationId, {
        auditType: "tax_calculation",
        actorType: input.actorUserId ? "user" : "system",
        actorId: input.actorUserId ?? null,
        relatedEntityType: "blitzpay_tax_calculations",
        relatedEntityId: (calc as { id: string }).id,
        auditSummary: "Tax calculation recorded (estimated)",
        metadata: { calculated_tax_cents: taxCents, applies_to: input.appliesTo },
      })
    }
  }
  return {
    taxableAmountCents: taxable,
    calculatedTaxCents: taxCents,
    effectiveRateBasisPoints: effectiveBps,
    matchedRuleId: rule.id,
    jurisdictionId: rule.jurisdiction_id,
    asOfDate: asOf,
  }
}

export async function listComplianceAuditLog(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_compliance_audit_log")
    .select("id, audit_type, actor_type, actor_id, related_entity_type, related_entity_id, audit_summary, immutable_hash, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_COMPLIANCE_AUDIT_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listAchAuthorizations(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_ach_authorizations")
    .select("id, customer_id, authorization_status, authorization_method, authorized_at, expires_at, revoked_at, created_at")
    .eq("organization_id", organizationId)
    .order("authorized_at", { ascending: false })
    .limit(BLITZPAY_ACH_AUTH_LIST_CAP)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createAchAuthorization(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    customerId?: string | null
    authorizationMethod?: string
    authorizationReference?: string | null
    authorizedAtIso: string
    expiresAtIso?: string | null
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  if (input.customerId) {
    assertUuid(input.customerId, "customerId")
    const { data: cust } = await admin
      .from("customers")
      .select("id")
      .eq("id", input.customerId)
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (!cust) throw new Error("customer_org_mismatch")
  }
  const refHash = input.authorizationReference?.trim() ? hashAccountingSourceReference(input.authorizationReference.trim()) : null
  const { data, error } = await admin
    .from("blitzpay_ach_authorizations")
    .insert({
      organization_id: organizationId,
      customer_id: input.customerId ?? null,
      authorization_status: "active",
      authorization_method: input.authorizationMethod ?? "digital",
      authorization_reference_hash: refHash,
      authorized_at: input.authorizedAtIso,
      expires_at: input.expiresAtIso ?? null,
      metadata: {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertComplianceAuditEntry(admin, organizationId, {
    auditType: "ach_authorization",
    actorType: input.actorUserId ? "user" : "admin",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "blitzpay_ach_authorizations",
    relatedEntityId: id,
    auditSummary: "ACH authorization retention record created",
    metadata: { has_reference_hash: Boolean(refHash) },
  })
  return { id }
}

export async function listVendorTaxProfiles(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_vendor_tax_profiles")
    .select(
      "id, vendor_id, tax_profile_status, tax_classification, requires_1099, w9_received_at, last_reviewed_at, created_at",
    )
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_VENDOR_TAX_PROFILE_LIST_CAP)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ vendor_id: string } & Record<string, unknown>>
  if (!rows.length) return rows
  const vids = [...new Set(rows.map((r) => r.vendor_id))]
  const { data: vendors } = await admin.from("blitzpay_vendors").select("id, vendor_name").in("id", vids)
  const names = new Map((vendors ?? []).map((v) => [(v as { id: string }).id, (v as { vendor_name: string }).vendor_name]))
  return rows.map((r) => ({ ...r, vendor_name: names.get(r.vendor_id) ?? null }))
}

export async function upsertVendorTaxProfile(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    vendorId: string
    taxProfileStatus?: string
    taxClassification?: string
    requires1099?: boolean
    tinReference?: string | null
    w9ReceivedAt?: string | null
    actorUserId?: string | null
  },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(input.vendorId, "vendorId")
  const tinHash = input.tinReference?.trim() ? hashAccountingSourceReference(`tin:${input.tinReference.trim()}`) : null
  const row = {
    organization_id: organizationId,
    vendor_id: input.vendorId,
    tax_profile_status: input.taxProfileStatus ?? "pending",
    tax_classification: input.taxClassification ?? "llc",
    requires_1099: Boolean(input.requires1099),
    tin_reference_hash: tinHash,
    w9_received_at: input.w9ReceivedAt ?? null,
    last_reviewed_at: new Date().toISOString(),
    metadata: {},
  }
  const { data, error } = await admin.from("blitzpay_vendor_tax_profiles").upsert(row, { onConflict: "organization_id,vendor_id" }).select("id").single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertComplianceAuditEntry(admin, organizationId, {
    auditType: "vendor_tax_status",
    actorType: input.actorUserId ? "user" : "admin",
    actorId: input.actorUserId ?? null,
    relatedEntityType: "blitzpay_vendor_tax_profiles",
    relatedEntityId: id,
    auditSummary: "Vendor tax profile updated",
    metadata: { requires_1099: row.requires_1099 },
  })
  return { id }
}

export async function fetchTaxLiabilitySummary(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data: snap } = await admin
    .from("blitzpay_tax_liability_snapshots")
    .select(
      "snapshot_date, sales_tax_payable_cents, payroll_tax_payable_cents, contractor_tax_estimate_cents, convenience_fee_collected_cents, total_tax_liability_cents, filing_readiness_score, compliance_risk_score",
    )
    .eq("organization_id", organizationId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (snap) return { source: "snapshot" as const, snapshot: snap }
  const rep = await fetchTaxComplianceReportingFields(admin, organizationId)
  return {
    source: "live" as const,
    snapshot: {
      snapshot_date: new Date().toISOString().slice(0, 10),
      sales_tax_payable_cents: rep.salesTaxPayableCents,
      payroll_tax_payable_cents: rep.payrollTaxPayableCents,
      contractor_tax_estimate_cents: rep.contractorTaxEstimateCents,
      convenience_fee_collected_cents: 0,
      total_tax_liability_cents: rep.salesTaxPayableCents + rep.payrollTaxPayableCents + rep.contractorTaxEstimateCents,
      filing_readiness_score: rep.filingReadinessScore,
      compliance_risk_score: rep.complianceHealthScore,
    },
  }
}

export async function fetchComplianceHealthDashboard(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  await ensureBlitzpayDefaultTaxAccounts(admin, organizationId)
  const reporting = await fetchTaxComplianceReportingFields(admin, organizationId)
  const jurisdictions = await listTaxJurisdictions(admin, organizationId)
  const rules = await listTaxRules(admin, organizationId)
  const audit = await listComplianceAuditLog(admin, organizationId)
  const feeRules = (rules as Array<{ tax_rule_type: string; metadata?: Record<string, unknown> }>).filter((r) => r.tax_rule_type === "convenience_fee")
  const policy = feeRules.length ? parseConvenienceFeePolicyFromRuleMetadata(feeRules[0].metadata) : "allowed"
  const convenienceWarnings =
    policy === "prohibited" ?
      ["Convenience-fee rules are marked not allowed for your configuration — review before pass-through."]
    : policy === "conditional" ?
      ["Conditional convenience fee: ensure customer disclosure is documented outside Equipify."]
    : []
  return {
    generatedAt: new Date().toISOString(),
    reporting,
    jurisdictionCount: jurisdictions.length,
    activeRuleCount: (rules as Array<{ compliance_status?: string }>).filter((r) => r.compliance_status === "active").length,
    recentAudit: audit.slice(0, 12),
    convenienceFeeWarnings: convenienceWarnings,
    disclaimer:
      "Compliance indicators are operational guidance tools and do not replace professional tax or legal advice.",
  }
}

export async function fetchTaxComplianceReportingFields(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayTaxComplianceReportingFields> {
  assertUuid(organizationId, "organizationId")
  const defaults: BlitzpayTaxComplianceReportingFields = {
    salesTaxPayableCents: 0,
    payrollTaxPayableCents: 0,
    contractorTaxEstimateCents: 0,
    convenienceFeeExposureRisk: 0,
    achAuthorizationCoverageRate: 0,
    vendor1099ReadinessRate: 0,
    filingReadinessScore: 0,
    complianceHealthScore: 0,
  }
  try {
    const { data: snapRow } = await admin
      .from("blitzpay_tax_liability_snapshots")
      .select(
        "sales_tax_payable_cents, payroll_tax_payable_cents, contractor_tax_estimate_cents, filing_readiness_score, compliance_risk_score",
      )
      .eq("organization_id", organizationId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (snapRow) {
      const s = snapRow as {
        sales_tax_payable_cents: number
        payroll_tax_payable_cents: number
        contractor_tax_estimate_cents: number
        filing_readiness_score: number | null
        compliance_risk_score: number | null
      }
      const live = await computeLiveComplianceRates(admin, organizationId)
      return {
        salesTaxPayableCents: Math.round(Number(s.sales_tax_payable_cents)),
        payrollTaxPayableCents: Math.round(Number(s.payroll_tax_payable_cents)),
        contractorTaxEstimateCents: Math.round(Number(s.contractor_tax_estimate_cents)),
        convenienceFeeExposureRisk: live.convenienceFeeExposureRisk,
        achAuthorizationCoverageRate: live.achAuthorizationCoverageRate,
        vendor1099ReadinessRate: live.vendor1099ReadinessRate,
        filingReadinessScore: s.filing_readiness_score ?? live.filingReadinessScore,
        complianceHealthScore: s.compliance_risk_score ?? live.complianceHealthScore,
      }
    }
    const liveFull = await computeLiveTaxLiabilitiesAndScores(admin, organizationId)
    return liveFull
  } catch {
    return defaults
  }
}

async function computeLiveComplianceRates(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  convenienceFeeExposureRisk: number
  achAuthorizationCoverageRate: number
  vendor1099ReadinessRate: number
  filingReadinessScore: number
  complianceHealthScore: number
}> {
  const full = await computeLiveTaxLiabilitiesAndScores(admin, organizationId)
  return {
    convenienceFeeExposureRisk: full.convenienceFeeExposureRisk,
    achAuthorizationCoverageRate: full.achAuthorizationCoverageRate,
    vendor1099ReadinessRate: full.vendor1099ReadinessRate,
    filingReadinessScore: full.filingReadinessScore,
    complianceHealthScore: full.complianceHealthScore,
  }
}

async function computeLiveTaxLiabilitiesAndScores(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayTaxComplianceReportingFields> {
  let salesTaxPayableCents = 0
  let payrollTaxPayableCents = 0
  let contractorTaxEstimateCents = 0
  const { data: calcs } = await admin
    .from("blitzpay_tax_calculations")
    .select("calculated_tax_cents, calculation_status, tax_rule_id")
    .eq("organization_id", organizationId)
    .in("calculation_status", ["estimated", "finalized", "adjusted", "voided"])
    .order("created_at", { ascending: false })
    .limit(200)
  const ruleIds = [...new Set((calcs ?? []).map((c) => (c as { tax_rule_id: string | null }).tax_rule_id).filter(Boolean))] as string[]
  let typeByRule = new Map<string, string>()
  if (ruleIds.length) {
    const { data: rrows } = await admin.from("blitzpay_tax_rules").select("id, tax_rule_type").in("id", ruleIds.slice(0, 80))
    typeByRule = new Map((rrows ?? []).map((r) => [(r as { id: string }).id, (r as { tax_rule_type: string }).tax_rule_type]))
  }
  let voided = 0
  const total = calcs?.length ?? 0
  for (const c of calcs ?? []) {
    const row = c as { calculated_tax_cents: number; calculation_status: string; tax_rule_id: string | null }
    if (row.calculation_status === "voided") {
      voided += 1
      continue
    }
    const t = row.tax_rule_id ? typeByRule.get(row.tax_rule_id) : null
    const amt = Math.max(0, Math.round(Number(row.calculated_tax_cents)))
    if (t === "sales_tax") salesTaxPayableCents += amt
    else if (t === "payroll_tax") payrollTaxPayableCents += amt
    else if (t === "contractor_tax") contractorTaxEstimateCents += amt
  }

  const payrollHealth = await summarizePayrollHealth(admin, organizationId).catch(() => null)
  const payrollBase = payrollHealth
    ? payrollHealth.pendingCommissionCents +
      payrollHealth.contractorSettlementPendingCents +
      payrollHealth.revenueSharePendingCents
    : 0
  if (contractorTaxEstimateCents === 0) {
    contractorTaxEstimateCents = estimateEmployerPayrollTaxCents(Math.max(payrollBase, payrollTaxPayableCents))
  }

  const rules = await listTaxRules(admin, organizationId)
  const feeRules = (rules as Array<{ tax_rule_type: string; metadata?: Record<string, unknown> }>).filter((r) => r.tax_rule_type === "convenience_fee")
  const policy = feeRules.length ? parseConvenienceFeePolicyFromRuleMetadata(feeRules[0].metadata) : "allowed"
  const convenienceFeeExposureRisk = computeConvenienceFeeExposureRisk0to100(policy, feeRules.length > 0)

  const { count: achCustomers } = await admin
    .from("blitzpay_customer_payment_methods")
    .select("customer_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("payment_method_type", "bank_account")
    .eq("status", "active")
  const { data: achAuths } = await admin
    .from("blitzpay_ach_authorizations")
    .select("authorization_status, expires_at, revoked_at")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_ACH_AUTH_LIST_CAP)
  const now = Date.now()
  const retained = (achAuths ?? []).filter((a) =>
    isAchAuthorizationRetained({
      authorization_status: (a as { authorization_status: string }).authorization_status,
      expires_at: (a as { expires_at: string | null }).expires_at,
      revoked_at: (a as { revoked_at: string | null }).revoked_at,
      nowMs: now,
    }),
  ).length
  const bankN = achCustomers ?? 0
  const achAuthorizationCoverageRate =
    bankN <= 0 ? (retained > 0 ? 50 : 100) : Math.max(0, Math.min(100, Math.round((retained * 100) / Math.max(bankN, 1))))

  const { data: profiles } = await admin
    .from("blitzpay_vendor_tax_profiles")
    .select("requires_1099, tax_profile_status, w9_received_at, tin_reference_hash")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_VENDOR_TAX_PROFILE_LIST_CAP)
  let v1099 = 0
  let v1099n = 0
  for (const p of profiles ?? []) {
    const row = p as {
      requires_1099: boolean
      tax_profile_status: string
      w9_received_at: string | null
      tin_reference_hash: string | null
    }
    if (!row.requires_1099) continue
    v1099n += 1
    v1099 += computeVendor1099Readiness0to100(true, {
      tax_profile_status: row.tax_profile_status,
      w9_received_at: row.w9_received_at,
      tin_reference_hash: row.tin_reference_hash,
    })
  }
  const vendor1099ReadinessRate = v1099n === 0 ? 100 : Math.round(v1099 / v1099n)

  const jurisdictions = await listTaxJurisdictions(admin, organizationId)
  const activeRules = (rules as Array<{ compliance_status?: string }>).filter((r) => r.compliance_status === "active").length
  const filingReadinessScore = computeFilingReadinessScore0to100({
    jurisdictionsConfigured: jurisdictions.length,
    activeTaxRules: activeRules,
    vendor1099ReadinessPct: vendor1099ReadinessRate,
    achAuthorizationCoveragePct: achAuthorizationCoverageRate,
  })
  const voidedRatio = total === 0 ? 0 : Math.round((voided * 100) / total)
  const complianceHealthScore = computeComplianceRiskScore0to100({
    convenienceFeeExposureRisk,
    overdueComplianceFlags: (rules as Array<{ compliance_status?: string }>).filter((r) => r.compliance_status === "pending_review").length,
    voidedCalculationRatioPct: voidedRatio,
  })

  return {
    salesTaxPayableCents: Math.min(9e12, salesTaxPayableCents),
    payrollTaxPayableCents: Math.min(9e12, payrollTaxPayableCents),
    contractorTaxEstimateCents: Math.min(9e12, contractorTaxEstimateCents),
    convenienceFeeExposureRisk,
    achAuthorizationCoverageRate,
    vendor1099ReadinessRate,
    filingReadinessScore,
    complianceHealthScore,
  }
}
