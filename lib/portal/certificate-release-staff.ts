import type { CertificateReleaseMode } from "@/lib/portal/certificate-release"
import { normalizeReleaseMode, resolveEffectiveCertificateReleaseMode } from "@/lib/portal/certificate-release"

/** Human-readable labels for settings dropdowns (staff UI). */
export const CERTIFICATE_RELEASE_OPTIONS = [
  { value: "immediate_release" as const, label: "Release immediately", helper: "Customers can download portal-visible certificates as soon as they exist." },
  { value: "release_on_payment" as const, label: "Release after invoice is paid", helper: "Certificate stays locked until linked invoices are paid." },
  { value: "manual_release" as const, label: "Manual release only", helper: "Staff must explicitly release each certificate to the portal." },
  { value: "internal_only" as const, label: "Internal only", helper: "Certificates are withheld from the portal unless the customer rule is changed." },
] as const

export const CUSTOMER_CERT_RELEASE_OPTIONS = [
  { value: "" as const, label: "Use organization default", helper: "Follow the workspace setting below." },
  ...CERTIFICATE_RELEASE_OPTIONS.map((o) => ({ value: o.value, label: o.label, helper: o.helper })),
]

export const INVOICE_CERT_RELEASE_OPTIONS = [
  {
    value: "" as const,
    label: "No invoice override",
    helper: "Customer settings control certificate release by default. Use this only when this invoice needs a different rule.",
  },
  ...CERTIFICATE_RELEASE_OPTIONS.map((o) => ({ value: o.value, label: o.label, helper: o.helper })),
]

export function modeLabel(mode: CertificateReleaseMode | null | undefined): string {
  const m = normalizeReleaseMode(mode ?? undefined)
  return CERTIFICATE_RELEASE_OPTIONS.find((o) => o.value === m)?.label ?? "Manual release only"
}

export function isCertificateReleaseMode(raw: string | null | undefined): raw is CertificateReleaseMode {
  return (
    raw === "immediate_release" ||
    raw === "release_on_payment" ||
    raw === "manual_release" ||
    raw === "internal_only"
  )
}

/** Which setting wins first for staff tooltip (invoice > customer > org). */
export function describeEffectiveReleaseRuleSource(args: {
  organizationMode: string | null | undefined
  customerMode: string | null | undefined
  invoiceOverride: string | null | undefined
}): string {
  const eff = resolveEffectiveCertificateReleaseMode({
    organizationMode: args.organizationMode,
    customerMode: args.customerMode,
    invoiceOverrides: [args.invoiceOverride],
  })
  if (isCertificateReleaseMode(args.invoiceOverride)) {
    return `Effective rule: ${modeLabel(eff)} (this invoice overrides customer and organization defaults).`
  }
  if (isCertificateReleaseMode(args.customerMode)) {
    return `Effective rule: ${modeLabel(eff)} (customer setting).`
  }
  return `Effective rule: ${modeLabel(eff)} (organization default).`
}

export type StaffPortalCertLine = { tone: "neutral" | "info" | "warning" | "success"; text: string }

/** Short bullets for invoice / WO detail — avoids exposing UUIDs. */
export function staffPortalCertificateBullets(args: {
  organizationMode: string | null | undefined
  customerMode: string | null | undefined
  invoiceOverride: string | null | undefined
  /** From calibration_records.portal_released_at when applicable */
  portalReleasedAt: string | null | undefined
  /** Invoice paid (any status considered paid in portal sense) */
  invoicesAllPaid: boolean
  /** Has at least one linked invoice row */
  hasLinkedInvoices: boolean
}): StaffPortalCertLine[] {
  const lines: StaffPortalCertLine[] = []
  lines.push({
    tone: "neutral",
    text: describeEffectiveReleaseRuleSource({
      organizationMode: args.organizationMode,
      customerMode: args.customerMode,
      invoiceOverride: args.invoiceOverride,
    }),
  })

  const eff = resolveEffectiveCertificateReleaseMode({
    organizationMode: args.organizationMode,
    customerMode: args.customerMode,
    invoiceOverrides: [args.invoiceOverride],
  })

  if (eff === "immediate_release") {
    lines.push({ tone: "success", text: "Portal: certificates available immediately once issued (subject to completion)." })
  } else if (eff === "release_on_payment") {
    if (!args.hasLinkedInvoices) {
      lines.push({
        tone: "warning",
        text: "Portal: pending manual review until an invoice is linked.",
      })
    } else if (args.invoicesAllPaid) {
      lines.push({ tone: "success", text: "Portal: linked invoices are paid — certificate access unlocked." })
    } else {
      lines.push({
        tone: "warning",
        text: "Portal: locked until linked invoice(s) are paid.",
      })
    }
  } else if (eff === "manual_release") {
    if (args.portalReleasedAt?.trim()) {
      const d = new Date(args.portalReleasedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      lines.push({ tone: "success", text: `Released to portal manually on ${d}.` })
    } else {
      lines.push({
        tone: "warning",
        text: "Portal: locked until a team member releases this certificate.",
      })
    }
  } else {
    lines.push({
      tone: "warning",
      text: "Portal: internal only for this customer.",
    })
  }

  return lines
}
