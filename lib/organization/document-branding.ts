import type { SupabaseClient } from "@supabase/supabase-js"

import type { TenantWorkspace } from "@/lib/tenant-data"
import { escapeHtml } from "@/lib/email/format"

/** Logo slot constraints for PDFs / print (mirrored in certificate CSS + React header). */
export const DOCUMENT_LOGO_MAX_HEIGHT_PX = 48
export const DOCUMENT_LOGO_MAX_WIDTH_PX = 280

/** Resolved branding for PDFs, certificates, invoices, and customer-facing previews. */
export type OrganizationDocumentBranding = {
  organizationName: string
  documentLogoUrl: string | null
  appLogoUrl: string | null
  preferredLogoUrl: string | null
  accentColor: string | null
  companyEmail: string | null
  companyPhone: string | null
  companyWebsite: string | null
  companyAddress: string | null
}

/** Prefer landscape document logo, then square app logo. */
export function pickPreferredDocumentLogoUrl(
  documentLogoUrl: string | null | undefined,
  appLogoUrl: string | null | undefined,
): string | null {
  const doc = documentLogoUrl?.trim() ?? ""
  if (doc.length > 0) return doc
  const app = appLogoUrl?.trim() ?? ""
  if (app.length > 0) return app
  return null
}

/** Build branding from partial organization fields (client or server). */
export function documentBrandingFromFields(args: {
  name?: string | null
  documentLogoUrl?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  companyEmail?: string | null
  companyPhone?: string | null
  companyWebsite?: string | null
  companyAddress?: string | null
}): OrganizationDocumentBranding {
  const rawName = args.name?.trim() ?? ""
  const organizationName = rawName.length > 0 ? rawName : "Organization"
  const documentLogoUrl =
    args.documentLogoUrl != null && String(args.documentLogoUrl).trim()
      ? String(args.documentLogoUrl).trim()
      : null
  const appLogoUrl =
    args.logoUrl != null && String(args.logoUrl).trim() ? String(args.logoUrl).trim() : null

  return {
    organizationName,
    documentLogoUrl,
    appLogoUrl,
    preferredLogoUrl: pickPreferredDocumentLogoUrl(documentLogoUrl, appLogoUrl),
    accentColor:
      args.primaryColor != null && String(args.primaryColor).trim()
        ? String(args.primaryColor).trim()
        : null,
    companyEmail:
      args.companyEmail != null && String(args.companyEmail).trim()
        ? String(args.companyEmail).trim()
        : null,
    companyPhone:
      args.companyPhone != null && String(args.companyPhone).trim()
        ? String(args.companyPhone).trim()
        : null,
    companyWebsite:
      args.companyWebsite != null && String(args.companyWebsite).trim()
        ? String(args.companyWebsite).trim()
        : null,
    companyAddress:
      args.companyAddress != null && String(args.companyAddress).trim()
        ? String(args.companyAddress).trim()
        : null,
  }
}

export function documentBrandingFromTenantWorkspace(
  ws: Pick<
    TenantWorkspace,
    | "name"
    | "logoUrl"
    | "documentLogoUrl"
    | "primaryColor"
    | "companyEmail"
    | "companyPhone"
    | "companyWebsite"
    | "companyAddress"
  >,
): OrganizationDocumentBranding {
  return documentBrandingFromFields({
    name: ws.name,
    documentLogoUrl: ws.documentLogoUrl,
    logoUrl: ws.logoUrl,
    primaryColor: ws.primaryColor,
    companyEmail: ws.companyEmail,
    companyPhone: ws.companyPhone,
    companyWebsite: ws.companyWebsite,
    companyAddress: ws.companyAddress,
  })
}

/** Load branding from `organizations` for PDF/email pipelines (service role or user client). */
export async function getOrganizationDocumentBranding(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationDocumentBranding> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "name, logo_url, document_logo_url, primary_color, company_email, company_phone, company_website, company_address",
    )
    .eq("id", organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const row = data as Record<string, unknown> | null
  if (!row) {
    return documentBrandingFromFields({})
  }

  return documentBrandingFromFields({
    name: row.name != null ? String(row.name) : null,
    documentLogoUrl: row.document_logo_url != null ? String(row.document_logo_url) : null,
    logoUrl: row.logo_url != null ? String(row.logo_url) : null,
    primaryColor: row.primary_color != null ? String(row.primary_color) : null,
    companyEmail: row.company_email != null ? String(row.company_email) : null,
    companyPhone: row.company_phone != null ? String(row.company_phone) : null,
    companyWebsite: row.company_website != null ? String(row.company_website) : null,
    companyAddress: row.company_address != null ? String(row.company_address) : null,
  })
}

/**
 * Header snippet for HTML/PDF documents: preferred logo with graceful fallback to organization name.
 * Logo CSS (max-height 48px, max-width 280px, object-fit contain) should live in the template stylesheet.
 */
export function buildDocumentLogoHtml(branding: Pick<OrganizationDocumentBranding, "preferredLogoUrl" | "organizationName">): string {
  const name = escapeHtml(branding.organizationName.trim() || "Organization")
  const url = branding.preferredLogoUrl?.trim()
  if (!url) {
    return `<div class="logo-text">${name}</div>`
  }
  const escUrl = escapeHtml(url)
  return `<span class="logo-slot"><img class="logo" src="${escUrl}" alt="" decoding="async" onerror="this.style.display='none';var fb=this.nextElementSibling;if(fb){fb.style.display='block';}" /><div class="logo-text logo-fallback" style="display:none" aria-hidden="true">${name}</div></span>`
}

/** Accept #RGB / #RRGGBB / #RRGGBBAA for safe CSS injection in print templates. */
export function sanitizeCssAccentColor(input: string | null | undefined): string | null {
  const t = input?.trim() ?? ""
  if (!t) return null
  if (/^#[0-9a-fA-F]{3}$/.test(t)) return t
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t
  if (/^#[0-9a-fA-F]{8}$/.test(t)) return t
  return null
}

/** Inline declarations for `<style>:root { … }</style>` in HTML documents. */
export function buildDocumentRootCssDeclarations(accentColor: string | null): string {
  const hex = sanitizeCssAccentColor(accentColor)
  if (!hex) return ""
  return `--doc-accent: ${hex};`
}

/** Organization contact lines (HTML fragment, escaped). */
export function buildOrganizationContactLinesHtml(branding: OrganizationDocumentBranding): string {
  const parts: string[] = []
  const addr = branding.companyAddress?.trim()
  if (addr) {
    for (const line of addr.split(/\r?\n/)) {
      const x = line.trim()
      if (x) parts.push(`<p class="doc-org-contact-line">${escapeHtml(x)}</p>`)
    }
  }
  if (branding.companyPhone?.trim()) {
    parts.push(`<p class="doc-org-contact-line">${escapeHtml(branding.companyPhone.trim())}</p>`)
  }
  if (branding.companyEmail?.trim()) {
    parts.push(`<p class="doc-org-contact-line">${escapeHtml(branding.companyEmail.trim())}</p>`)
  }
  if (branding.companyWebsite?.trim()) {
    parts.push(`<p class="doc-org-contact-line">${escapeHtml(branding.companyWebsite.trim())}</p>`)
  }
  return parts.join("")
}

/**
 * Stacked logo (or name fallback) + optional contact block for print/PDF headers.
 * Uses {@link buildDocumentLogoHtml} (image onerror → text).
 */
export function buildOrganizationDocumentHeaderHtml(branding: OrganizationDocumentBranding): string {
  const logo = buildDocumentLogoHtml({
    preferredLogoUrl: branding.preferredLogoUrl,
    organizationName: branding.organizationName,
  })
  const contact = buildOrganizationContactLinesHtml(branding)
  const contactBlock =
    contact ?
      `<div class="doc-org-contact">${contact}</div>`
    : ""
  return `<div class="doc-org-header-inner">${logo}${contactBlock}</div>`
}
