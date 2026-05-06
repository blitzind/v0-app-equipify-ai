/** Maps `organizations` row → workspace GET/PATCH JSON shape. */
export function serializeWorkspaceOrganization(row: Record<string, unknown>) {
  const wlRaw = row.white_label_settings
  const whiteLabelSettings =
    wlRaw && typeof wlRaw === "object" && !Array.isArray(wlRaw)
      ? (wlRaw as Record<string, unknown>)
      : {}
  const createdAt =
    row.created_at != null ? String(row.created_at as string | number | Date) : null
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    status: String(row.status ?? ""),
    createdAt,
    companyEmail: row.company_email != null ? String(row.company_email) : "",
    companyPhone: row.company_phone != null ? String(row.company_phone) : "",
    companyWebsite: row.company_website != null ? String(row.company_website) : "",
    companyAddress: row.company_address != null ? String(row.company_address) : "",
    timezone: row.timezone != null ? String(row.timezone) : "America/New_York",
    dateFormat: row.date_format != null ? String(row.date_format) : "MM/DD/YYYY",
    currency: row.currency != null ? String(row.currency) : "USD",
    logoUrl: row.logo_url != null ? String(row.logo_url) : "",
    documentLogoUrl:
      row.document_logo_url != null ? String(row.document_logo_url) : "",
    primaryColor: row.primary_color != null ? String(row.primary_color) : "#2563eb",
    secondaryBrandColor:
      row.secondary_brand_color != null ? String(row.secondary_brand_color) : "",
    whiteLabelSettings,
  }
}
