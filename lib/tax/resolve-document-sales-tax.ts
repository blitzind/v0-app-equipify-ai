import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildSalesTaxSnapshot, calculateStackedSalesTax, summarizeJurisdictions } from "@/lib/tax/calculate-tax"
import { resolveStackedTaxComponents } from "@/lib/tax/jurisdiction-resolver"
import type {
  OrganizationTaxSettingsRow,
  SalesTaxCalculationResult,
  TaxAddressInput,
  TaxBasis,
  TaxJurisdictionRow,
  TaxRateRow,
  TaxableLineForEngine,
} from "@/lib/tax/types"

const LOG_SOURCE = "equipify-sales-tax"

function logLine(payload: Record<string, unknown>, level: "info" | "error" = "info") {
  const line = JSON.stringify({ source: LOG_SOURCE, ...payload })
  if (level === "error") console.error(line)
  else console.info(line)
}

const DEFAULT_SETTINGS: OrganizationTaxSettingsRow = {
  organization_id: "",
  auto_tax_enabled: false,
  fallback_tax_rate_percent: 0,
  taxable_labor_default: true,
  taxable_parts_default: true,
  sourcing_mode: "destination",
  manual_override_allowed: true,
  primary_provider: "equipify_native",
}

export async function fetchOrganizationTaxSettings(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationTaxSettingsRow> {
  const { data, error } = await supabase
    .from("organization_tax_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (error) {
    logLine({ event: "org_tax_settings_load_failed", organizationId, message: error.message }, "error")
    return { ...DEFAULT_SETTINGS, organization_id: organizationId }
  }
  if (!data) return { ...DEFAULT_SETTINGS, organization_id: organizationId }
  const r = data as Record<string, unknown>
  return {
    organization_id: organizationId,
    auto_tax_enabled: Boolean(r.auto_tax_enabled),
    fallback_tax_rate_percent: Number(r.fallback_tax_rate_percent ?? 0),
    taxable_labor_default: r.taxable_labor_default !== false,
    taxable_parts_default: r.taxable_parts_default !== false,
    sourcing_mode: r.sourcing_mode === "origin" ? "origin" : "destination",
    manual_override_allowed: r.manual_override_allowed !== false,
    primary_provider: String(r.primary_provider ?? "equipify_native"),
  }
}

async function loadCatalog(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ jurisdictions: TaxJurisdictionRow[]; rates: TaxRateRow[] }> {
  const { data: jRows, error: jErr } = await supabase
    .from("tax_jurisdictions")
    .select("*")
    .eq("active", true)
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
  if (jErr) {
    logLine({ event: "tax_catalog_jurisdictions_failed", organizationId, message: jErr.message }, "error")
    return { jurisdictions: [], rates: [] }
  }
  const jurisdictions = (jRows ?? []) as TaxJurisdictionRow[]
  const ids = jurisdictions.map((j) => j.id)
  if (ids.length === 0) return { jurisdictions: [], rates: [] }
  const { data: rRows, error: rErr } = await supabase
    .from("tax_rates")
    .select("*")
    .eq("active", true)
    .in("jurisdiction_id", ids)
  if (rErr) {
    logLine({ event: "tax_catalog_rates_failed", organizationId, message: rErr.message }, "error")
    return { jurisdictions, rates: [] }
  }
  return { jurisdictions, rates: (rRows ?? []) as TaxRateRow[] }
}

function pickBasisAddress(args: {
  basis: TaxBasis
  sourcing: OrganizationTaxSettingsRow["sourcing_mode"]
  service: TaxAddressInput | null
  billing: TaxAddressInput | null
}): { address: TaxAddressInput; basis: TaxBasis } {
  if (args.basis === "manual") {
    return {
      address: args.billing ?? args.service ?? { countryCode: "US", regionCode: "" },
      basis: "manual",
    }
  }
  if (args.basis === "billing_address") {
    return { address: args.billing ?? { countryCode: "US", regionCode: "" }, basis: "billing_address" }
  }
  // Origin sourcing without org HQ on file: billing address is used as a conservative proxy.
  if (args.sourcing === "origin" && args.billing) {
    return { address: args.billing, basis: "billing_address" }
  }
  return { address: args.service ?? args.billing ?? { countryCode: "US", regionCode: "" }, basis: args.basis }
}

function lineBaseTotals(
  lines: TaxableLineForEngine[],
  settings: OrganizationTaxSettingsRow,
): Pick<SalesTaxCalculationResult, "taxableSubtotal" | "nonTaxableSubtotal"> {
  return calculateStackedSalesTax({
    lines,
    components: [],
    taxableLabor: settings.taxable_labor_default,
    taxableParts: settings.taxable_parts_default,
    fallbackRatePercent: 0,
  })
}

export type ResolveSalesTaxInput = {
  organizationId: string
  customerId?: string | null
  /** When false, engine is skipped (flat/manual UI path). */
  preferAutomatic: boolean
  lines: TaxableLineForEngine[]
  taxBasis: TaxBasis
  serviceAddress: TaxAddressInput | null
  billingAddress: TaxAddressInput | null
  customerTaxExempt?: boolean | null
  asOfYmd: string
  persistLog?: boolean
  auditSourceType?: string
  idempotencyKey?: string | null
  actorUserId?: string | null
}

export async function resolveSalesTaxForLines(
  supabase: SupabaseClient,
  input: ResolveSalesTaxInput,
): Promise<SalesTaxCalculationResult> {
  const settings = await fetchOrganizationTaxSettings(supabase, input.organizationId)
  const autoOn = Boolean(input.preferAutomatic && settings.auto_tax_enabled)

  const baseTotals = lineBaseTotals(input.lines, settings)

  if (input.customerTaxExempt === true) {
    const addr = input.billingAddress ?? input.serviceAddress ?? { countryCode: "US", regionCode: "" }
    const snap = buildSalesTaxSnapshot({
      address: addr,
      basis: input.taxBasis,
      components: [],
      result: {
        status: "exempt",
        taxableSubtotal: baseTotals.taxableSubtotal,
        nonTaxableSubtotal: baseTotals.nonTaxableSubtotal,
        taxAmount: 0,
        combinedRatePercent: 0,
      },
      customerExempt: true,
      overrideUsed: false,
    })
    const out: SalesTaxCalculationResult = {
      status: "exempt",
      taxableSubtotal: baseTotals.taxableSubtotal,
      nonTaxableSubtotal: baseTotals.nonTaxableSubtotal,
      taxAmount: 0,
      combinedRatePercent: 0,
      components: [],
      jurisdictionSummary: "Customer tax exempt.",
      taxBasis: input.taxBasis,
      provider: "equipify_native",
      snapshot: snap,
    }
    await maybePersistLog(supabase, {
      organizationId: input.organizationId,
      input,
      result: out,
      persist: Boolean(input.persistLog),
      idempotencyKey: input.idempotencyKey,
      actorUserId: input.actorUserId,
    })
    return out
  }

  if (!autoOn) {
    const out: SalesTaxCalculationResult = {
      status: "skipped",
      taxableSubtotal: baseTotals.taxableSubtotal,
      nonTaxableSubtotal: baseTotals.nonTaxableSubtotal,
      taxAmount: 0,
      combinedRatePercent: 0,
      components: [],
      jurisdictionSummary: "Automatic tax disabled for this workspace or document.",
      taxBasis: input.taxBasis,
      provider: "equipify_native",
      snapshot: {
        engine: "equipify_native_v1",
        status: "skipped",
        reason: "auto_tax_disabled",
      },
    }
    await maybePersistLog(supabase, {
      organizationId: input.organizationId,
      input,
      result: out,
      persist: Boolean(input.persistLog),
      idempotencyKey: input.idempotencyKey,
      actorUserId: input.actorUserId,
    })
    return out
  }

  let overrideFixed: number | null = null
  let overrideExempt = false
  if (input.customerId) {
    const { data: ov } = await supabase
      .from("customer_tax_overrides")
      .select("fixed_combined_rate_percent, force_tax_exempt")
      .eq("organization_id", input.organizationId)
      .eq("customer_id", input.customerId)
      .maybeSingle()
    if (ov) {
      const o = ov as { fixed_combined_rate_percent?: number | null; force_tax_exempt?: boolean | null }
      overrideExempt = Boolean(o.force_tax_exempt)
      if (o.fixed_combined_rate_percent != null && Number.isFinite(Number(o.fixed_combined_rate_percent))) {
        overrideFixed = Number(o.fixed_combined_rate_percent)
      }
    }
  }

  if (overrideExempt) {
    const addr = input.billingAddress ?? input.serviceAddress ?? { countryCode: "US", regionCode: "" }
    const snap = buildSalesTaxSnapshot({
      address: addr,
      basis: input.taxBasis,
      components: [],
      result: {
        status: "exempt",
        taxableSubtotal: baseTotals.taxableSubtotal,
        nonTaxableSubtotal: baseTotals.nonTaxableSubtotal,
        taxAmount: 0,
        combinedRatePercent: 0,
      },
      customerExempt: true,
      overrideUsed: true,
    })
    const out: SalesTaxCalculationResult = {
      status: "exempt",
      taxableSubtotal: baseTotals.taxableSubtotal,
      nonTaxableSubtotal: baseTotals.nonTaxableSubtotal,
      taxAmount: 0,
      combinedRatePercent: 0,
      components: [],
      jurisdictionSummary: "Customer override — tax exempt.",
      taxBasis: input.taxBasis,
      provider: "equipify_native",
      snapshot: snap,
    }
    await maybePersistLog(supabase, {
      organizationId: input.organizationId,
      input,
      result: out,
      persist: Boolean(input.persistLog),
      idempotencyKey: input.idempotencyKey,
      actorUserId: input.actorUserId,
    })
    return out
  }

  const { address, basis } = pickBasisAddress({
    basis: input.taxBasis,
    sourcing: settings.sourcing_mode,
    service: input.serviceAddress,
    billing: input.billingAddress,
  })

  const { jurisdictions, rates } = await loadCatalog(supabase, input.organizationId)
  const components = resolveStackedTaxComponents({
    jurisdictions,
    rates,
    address,
    asOfYmd: input.asOfYmd,
  })

  let matched = components
  let usedOverride = false
  if (overrideFixed != null) {
    matched = [
      {
        jurisdictionId: "override",
        jurisdictionCode: "CUSTOMER_OVERRIDE",
        jurisdictionType: "special",
        displayName: "Customer fixed combined rate",
        rateId: "override",
        ratePercent: overrideFixed,
        appliesTo: "all",
        source: "customer_override",
      },
    ]
    usedOverride = true
  }

  const calc = calculateStackedSalesTax({
    lines: input.lines,
    components: matched,
    taxableLabor: settings.taxable_labor_default,
    taxableParts: settings.taxable_parts_default,
    fallbackRatePercent: settings.fallback_tax_rate_percent,
  })

  const status: SalesTaxCalculationResult["status"] =
    matched.length === 0 && (settings.fallback_tax_rate_percent > 0 || calc.taxAmount > 0) ? "fallback" : "success"

  const snap = buildSalesTaxSnapshot({
    address,
    basis,
    components: matched,
    result: { ...calc, status },
    customerExempt: false,
    overrideUsed: usedOverride,
  })

  const out: SalesTaxCalculationResult = {
    status,
    taxableSubtotal: calc.taxableSubtotal,
    nonTaxableSubtotal: calc.nonTaxableSubtotal,
    taxAmount: calc.taxAmount,
    combinedRatePercent: calc.combinedRatePercent,
    components: matched,
    jurisdictionSummary: summarizeJurisdictions(matched),
    taxBasis: basis,
    provider: "equipify_native",
    snapshot: snap,
  }

  logLine({
    event: "sales_tax_resolved",
    organizationId: input.organizationId,
    status: out.status,
    taxAmount: out.taxAmount,
    combinedRatePercent: out.combinedRatePercent,
    componentCount: matched.length,
  })

  await maybePersistLog(supabase, {
    organizationId: input.organizationId,
    input,
    result: out,
    persist: Boolean(input.persistLog),
    idempotencyKey: input.idempotencyKey,
    actorUserId: input.actorUserId,
  })

  return out
}

async function maybePersistLog(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    input: ResolveSalesTaxInput
    result: SalesTaxCalculationResult
    persist: boolean
    idempotencyKey?: string | null
    actorUserId?: string | null
  },
) {
  if (!args.persist) return
  const key = args.idempotencyKey?.trim() || null
  const row = {
    organization_id: args.organizationId,
    idempotency_key: key,
    source_type: args.input.auditSourceType?.trim() || "sales_tax_calculation",
    source_id: null as string | null,
    status:
      args.result.status === "exempt" || args.result.status === "success"
        ? "success"
        : args.result.status === "fallback"
          ? "fallback"
          : args.result.status === "skipped"
            ? "skipped"
            : "error",
    taxable_base_cents: Math.round(args.result.taxableSubtotal * 100),
    tax_cents: Math.round(args.result.taxAmount * 100),
    combined_rate_percent: args.result.combinedRatePercent,
    calculation_json: {
      snapshot: args.result.snapshot,
      basis: args.input.taxBasis,
    },
    error_code: null as string | null,
    actor_user_id: args.actorUserId ?? null,
  }
  if (args.result.status === "error") row.error_code = "calculation_error"
  const { error } = await supabase.from("tax_calculation_logs").insert(row)
  if (error) {
    logLine(
      {
        event: "tax_calculation_log_insert_failed",
        organizationId: args.organizationId,
        message: error.message,
      },
      "error",
    )
  }
}
