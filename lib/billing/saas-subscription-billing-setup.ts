import { z } from "zod"
import { isValidEmail } from "@/lib/email/format"
import type { TenantWorkspace } from "@/lib/tenant-data"
import { ISO_3166_1_ALPHA2_CODES } from "@/lib/billing/iso-3166-alpha2-codes"

const iso2Set = new Set(ISO_3166_1_ALPHA2_CODES)

export const saasSubscriptionBillingFormSchema = z.object({
  billingName: z.string().trim().min(1, "Enter a billing name or company name.").max(200),
  billingEmail: z
    .string()
    .trim()
    .min(1, "Enter a billing email.")
    .max(320)
    .refine((s) => isValidEmail(s), "Enter a valid billing email."),
  billingPhone: z.string().trim().max(40).optional().default(""),
  addressLine1: z.string().trim().min(1, "Enter address line 1.").max(200),
  addressLine2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(1, "Enter a city.").max(100),
  state: z.string().trim().min(1, "Enter a state or region.").max(100),
  postalCode: z.string().trim().min(1, "Enter a postal code.").max(20),
  country: z
    .string()
    .trim()
    .min(2, "Select a country.")
    .max(2)
    .transform((s) => s.toUpperCase())
    .refine((c) => iso2Set.has(c), "Enter a valid two-letter country code."),
})

export type SaasSubscriptionBillingFormValues = z.infer<typeof saasSubscriptionBillingFormSchema>

export function emptySaasSubscriptionBillingForm(): SaasSubscriptionBillingFormValues {
  return {
    billingName: "",
    billingEmail: "",
    billingPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  }
}

function splitCompanyAddress(companyAddress: string): { line1: string; line2: string } {
  const lines = companyAddress
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { line1: "", line2: "" }
  if (lines.length === 1) return { line1: lines[0]!, line2: "" }
  return { line1: lines[0]!, line2: lines.slice(1).join(", ") }
}

/** Guess default ISO country from workspace currency (best-effort; user can edit). */
export function defaultCountryFromWorkspaceCurrency(currency: string | undefined): string {
  const c = (currency ?? "USD").trim().toUpperCase()
  if (c === "USD") return "US"
  if (c === "CAD") return "CA"
  if (c === "GBP") return "GB"
  if (c === "AUD") return "AU"
  return ""
}

export function defaultSaasBillingFormFromWorkspace(
  w: Pick<TenantWorkspace, "name" | "companyEmail" | "companyPhone" | "companyAddress" | "currency">,
): SaasSubscriptionBillingFormValues {
  const { line1, line2 } = splitCompanyAddress(w.companyAddress ?? "")
  const country = defaultCountryFromWorkspaceCurrency(w.currency)
  return {
    billingName: (w.name ?? "").trim(),
    billingEmail: (w.companyEmail ?? "").trim(),
    billingPhone: (w.companyPhone ?? "").trim(),
    addressLine1: line1,
    addressLine2: line2,
    city: "",
    state: "",
    postalCode: "",
    country,
  }
}

/** Overlay Stripe customer fields when present (preferred over workspace blanks). */
export function mergeStripeCustomerBillingPrefill(
  base: SaasSubscriptionBillingFormValues,
  stripe: Partial<SaasSubscriptionBillingFormValues> | null | undefined,
): SaasSubscriptionBillingFormValues {
  if (!stripe) return base
  const pick = <K extends keyof SaasSubscriptionBillingFormValues>(key: K) => {
    const v = stripe[key]
    if (v === undefined || v === null) return base[key]
    if (typeof v === "string" && !v.trim()) return base[key]
    return v as SaasSubscriptionBillingFormValues[K]
  }
  return {
    billingName: pick("billingName"),
    billingEmail: pick("billingEmail"),
    billingPhone: pick("billingPhone"),
    addressLine1: pick("addressLine1"),
    addressLine2: pick("addressLine2"),
    city: pick("city"),
    state: pick("state"),
    postalCode: pick("postalCode"),
    country: pick("country"),
  }
}

export type BillingCountryOption = { code: string; name: string }

export function getBillingCountrySelectOptions(): BillingCountryOption[] {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" })
    return [...ISO_3166_1_ALPHA2_CODES]
      .map((code) => ({ code, name: dn.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
  } catch {
    return [
      { code: "US", name: "United States" },
      { code: "CA", name: "Canada" },
    ]
  }
}
