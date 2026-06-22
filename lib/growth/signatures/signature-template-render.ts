import type { GrowthRenderedSignature, GrowthSignatureTemplateId } from "@/lib/growth/signatures/signature-types"

export type SignatureRenderInput = {
  display_name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  linkedin_url?: string | null
  avatar_url?: string | null
  logo_url?: string | null
  company_name?: string | null
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

function companyFromWebsite(website: string | null, companyName: string | null): string {
  if (companyName?.trim()) return companyName.trim()
  if (!website) return "Equipify"
  try {
    const host = new URL(website.includes("://") ? website : `https://${website}`).hostname
    return host.replace(/^www\./, "")
  } catch {
    return website
  }
}

function formatWebsiteHref(website: string): string {
  return website.includes("://") ? website : `https://${website}`
}

export function renderSignatureTemplate(
  template: GrowthSignatureTemplateId,
  input: SignatureRenderInput,
): GrowthRenderedSignature {
  const name = trimOrNull(input.display_name) ?? "Sender"
  const title = trimOrNull(input.title)
  const phone = trimOrNull(input.phone)
  const website = trimOrNull(input.website)
  const linkedin = trimOrNull(input.linkedin_url)
  const company = companyFromWebsite(website, trimOrNull(input.company_name))
  const logoUrl = trimOrNull(input.logo_url)
  const avatarUrl = trimOrNull(input.avatar_url)

  const textLines: string[] = []
  const htmlParts: string[] = []

  if (template === "minimal") {
    const shortName = name.split(/\s+/)[0] ?? name
    textLines.push(`— ${shortName}`, company)
    htmlParts.push(
      `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#374151;">— ${esc(shortName)}<br/>${esc(company)}</p>`,
    )
    return { template, html: htmlParts.join(""), text: textLines.join("\n") }
  }

  if (template === "branded") {
    if (logoUrl) {
      htmlParts.push(
        `<p style="margin:0 0 8px 0;"><img src="${esc(logoUrl)}" alt="${esc(company)}" style="max-height:40px;max-width:160px;" /></p>`,
      )
    }
    htmlParts.push(`<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#111827;"><strong>${esc(name)}</strong></p>`)
    if (title) htmlParts.push(`<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#374151;">${esc(title)}</p>`)
    htmlParts.push(`<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#374151;">${esc(company)}</p>`)
    if (phone) htmlParts.push(`<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#4b5563;">${esc(phone)}</p>`)
    if (website) {
      const href = formatWebsiteHref(website)
      htmlParts.push(
        `<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#2563eb;"><a href="${esc(href)}" style="color:#2563eb;">${esc(website)}</a></p>`,
      )
    }
    if (linkedin) {
      const href = linkedin.includes("://") ? linkedin : `https://${linkedin}`
      htmlParts.push(
        `<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#2563eb;"><a href="${esc(href)}" style="color:#2563eb;">LinkedIn</a></p>`,
      )
    }
    if (avatarUrl && !logoUrl) {
      htmlParts.unshift(
        `<p style="margin:0 0 8px 0;"><img src="${esc(avatarUrl)}" alt="" style="width:48px;height:48px;border-radius:9999px;" /></p>`,
      )
    }

    textLines.push(name)
    if (title) textLines.push(title)
    textLines.push(company)
    if (phone) textLines.push(phone)
    if (website) textLines.push(website)
    if (linkedin) textLines.push(linkedin)
    return { template, html: htmlParts.join(""), text: textLines.join("\n") }
  }

  // simple (default)
  textLines.push(name)
  if (title) textLines.push(title)
  textLines.push(company)
  if (phone) textLines.push(phone)
  if (website) textLines.push(website)

  htmlParts.push(`<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#111827;line-height:1.45;">`)
  htmlParts.push(`<strong>${esc(name)}</strong><br/>`)
  if (title) htmlParts.push(`${esc(title)}<br/>`)
  htmlParts.push(`${esc(company)}`)
  if (phone) htmlParts.push(`<br/>${esc(phone)}`)
  if (website) htmlParts.push(`<br/>${esc(website)}`)
  htmlParts.push("</p>")

  return { template, html: htmlParts.join(""), text: textLines.join("\n") }
}
