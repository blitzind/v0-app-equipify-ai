import type { LinkedInvoiceRow } from "@/lib/portal/work-order-invoices"
import { allLinkedInvoicesPaid } from "@/lib/portal/work-order-invoices"

export type CertificateReleaseMode =
  | "immediate_release"
  | "release_on_payment"
  | "manual_release"
  | "internal_only"

export type PortalCertAccess = {
  unlocked: boolean
  /** Stable code for UI/tests */
  reasonCode:
    | "immediate"
    | "paid"
    | "no_invoice_required"
    | "manual_released"
    | "internal_only"
    | "missing_invoice"
    | "locked_payment"
    | "locked_manual"
  /** Customer-facing explanation */
  reasonLabel: string
  effectiveMode: CertificateReleaseMode
}

export function normalizeReleaseMode(raw: string | null | undefined): CertificateReleaseMode {
  if (raw === "immediate" || raw === "immediate_release") return "immediate_release"
  if (raw === "after_invoice_paid" || raw === "release_on_payment") return "release_on_payment"
  if (raw === "manual" || raw === "manual_release") return "manual_release"
  if (raw === "internal_only") return "internal_only"
  return "manual_release"
}

function isReleaseMode(raw: string | null | undefined): raw is CertificateReleaseMode {
  return (
    raw === "immediate_release" ||
    raw === "release_on_payment" ||
    raw === "manual_release" ||
    raw === "internal_only"
  )
}

export function resolveEffectiveCertificateReleaseMode(args: {
  organizationMode: string | null | undefined
  customerMode: string | null | undefined
  /** If any linked invoice sets override, first non-null wins (future: refine per-cert). */
  invoiceOverrides: Array<string | null | undefined>
}): CertificateReleaseMode {
  for (const o of args.invoiceOverrides) {
    if (isReleaseMode(o)) {
      return o
    }
  }
  if (isReleaseMode(args.customerMode)) {
    return args.customerMode
  }
  return normalizeReleaseMode(args.organizationMode)
}

export function evaluateCertificatePortalAccess(
  effectiveMode: CertificateReleaseMode,
  ctx: {
    linkedInvoices: LinkedInvoiceRow[]
    portalReleasedAt: string | null
  },
): PortalCertAccess {
  if (effectiveMode === "immediate_release") {
    return {
      unlocked: true,
      reasonCode: "immediate",
      reasonLabel: "Certificate released immediately for your account.",
      effectiveMode,
    }
  }

  if (effectiveMode === "internal_only") {
    return {
      unlocked: false,
      reasonCode: "internal_only",
      reasonLabel: "Certificate is internal only.",
      effectiveMode,
    }
  }

  if (effectiveMode === "manual_release") {
    const released = Boolean(ctx.portalReleasedAt?.trim())
    return released
      ? {
          unlocked: true,
          reasonCode: "manual_released",
          reasonLabel: "Released by your service provider.",
          effectiveMode,
        }
      : {
          unlocked: false,
          reasonCode: "locked_manual",
          reasonLabel: "Certificate available when your service provider releases it.",
          effectiveMode,
        }
  }

  // release_on_payment
  const paid = allLinkedInvoicesPaid(ctx.linkedInvoices)
  if (ctx.linkedInvoices.length === 0) {
    return {
      unlocked: false,
      reasonCode: "missing_invoice",
      reasonLabel: "Certificate pending review until an invoice is linked.",
      effectiveMode,
    }
  }
  if (paid) {
    return {
      unlocked: true,
      reasonCode: "paid",
      reasonLabel: "Invoice paid — certificate available.",
      effectiveMode,
    }
  }
  return {
    unlocked: false,
    reasonCode: "locked_payment",
    reasonLabel: "Certificate available after invoice payment.",
    effectiveMode,
  }
}
