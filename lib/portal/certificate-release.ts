import type { LinkedInvoiceRow } from "@/lib/portal/work-order-invoices"
import { allLinkedInvoicesPaid } from "@/lib/portal/work-order-invoices"

export type CertificateReleaseMode =
  | "immediate_release"
  | "release_on_payment"
  | "manual_release"

export type PortalCertAccess = {
  unlocked: boolean
  /** Stable code for UI/tests */
  reasonCode:
    | "immediate"
    | "paid"
    | "no_invoice_required"
    | "manual_released"
    | "locked_payment"
    | "locked_manual"
  /** Customer-facing explanation */
  reasonLabel: string
  effectiveMode: CertificateReleaseMode
}

export function normalizeReleaseMode(raw: string | null | undefined): CertificateReleaseMode {
  if (raw === "release_on_payment" || raw === "manual_release") return raw
  return "immediate_release"
}

export function resolveEffectiveCertificateReleaseMode(args: {
  organizationMode: string | null | undefined
  customerMode: string | null | undefined
  /** If any linked invoice sets override, first non-null wins (future: refine per-cert). */
  invoiceOverrides: Array<string | null | undefined>
}): CertificateReleaseMode {
  for (const o of args.invoiceOverrides) {
    if (o === "immediate_release" || o === "release_on_payment" || o === "manual_release") {
      return o
    }
  }
  if (
    args.customerMode === "immediate_release" ||
    args.customerMode === "release_on_payment" ||
    args.customerMode === "manual_release"
  ) {
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
      unlocked: true,
      reasonCode: "no_invoice_required",
      reasonLabel: "No invoice is linked to this job yet — certificate is available.",
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
