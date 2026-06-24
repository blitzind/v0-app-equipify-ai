import type { GrowthRenderedSignature, GrowthSignatureTemplateId } from "@/lib/growth/signatures/signature-types"
import {
  formatSignatureWebsiteHref,
  resolveSignatureCompanyFields,
} from "@/lib/growth/signatures/signature-company-fields"
import { GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL } from "@/lib/growth/signatures/signature-profile-defaults"

export type SignatureRenderInput = {
  display_name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  company_name?: string | null
  company_tagline?: string | null
  /** Website URL used for hyperlinks (legacy column: website). */
  website?: string | null
  linkedin_url?: string | null
  avatar_url?: string | null
  logo_url?: string | null
  booking_url?: string | null
  booking_label?: string | null
  show_email_in_signature?: boolean | null
  show_phone_in_signature?: boolean | null
  show_website_in_signature?: boolean | null
  show_booking_cta?: boolean | null
}

type ResolvedRenderOptions = {
  showEmail: boolean
  showPhone: boolean
  showWebsite: boolean
  showBookingCta: boolean
  bookingLabel: string
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

function resolveRenderOptions(input: SignatureRenderInput): ResolvedRenderOptions {
  return {
    showEmail: input.show_email_in_signature === true,
    showPhone: input.show_phone_in_signature !== false,
    showWebsite: input.show_website_in_signature !== false,
    showBookingCta: input.show_booking_cta !== false,
    bookingLabel: trimOrNull(input.booking_label) ?? GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
  }
}

function externalHref(url: string): string {
  return formatSignatureWebsiteHref(url)
}

function anchor(href: string, label: string, style?: string): string {
  const linkStyle = style ?? "color:#2563eb;text-decoration:none;"
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${label.startsWith("<") ? label : esc(label)}</a>`
}

function renderCompanyHtml(
  companyLabel: string,
  websiteHref: string | null,
  showWebsite: boolean,
): string {
  if (showWebsite && websiteHref) {
    return anchor(websiteHref, companyLabel)
  }
  return esc(companyLabel)
}

function renderLogoHtml(
  logoUrl: string,
  companyLabel: string,
  websiteHref: string | null,
  showWebsite: boolean,
  sizePx: number,
): string {
  const img = `<img src="${esc(logoUrl)}" alt="${esc(companyLabel)}" width="${sizePx}" height="${sizePx}" style="display:block;width:${sizePx}px;height:${sizePx}px;object-fit:cover;border-radius:4px;" />`
  if (showWebsite && websiteHref) {
    return anchor(websiteHref, img, "text-decoration:none;border:none;")
  }
  return img
}

function renderBookingCtaHtml(bookingUrl: string, bookingLabel: string, asButton: boolean): string {
  const href = externalHref(bookingUrl)
  if (asButton) {
    return `<p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:13px;">${anchor(
      href,
      bookingLabel,
      "display:inline-block;padding:8px 14px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:600;",
    )}</p>`
  }
  return `<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;">${anchor(href, bookingLabel)}</p>`
}

function renderBookingCtaText(_bookingUrl: string, bookingLabel: string): string {
  return bookingLabel
}

function renderProfessionalLayout(
  name: string,
  title: string | null,
  companyLabel: string,
  companyTagline: string | null,
  email: string | null,
  phone: string | null,
  logoUrl: string | null,
  avatarUrl: string | null,
  websiteHref: string | null,
  bookingUrl: string | null,
  options: ResolvedRenderOptions,
): { html: string; textLines: string[] } {
  const imageUrl = logoUrl ?? avatarUrl
  const textLines: string[] = [name]
  if (title) textLines.push(title)
  textLines.push(companyLabel)
  if (companyTagline) textLines.push(companyTagline)
  if (options.showEmail && email) textLines.push(email)
  if (options.showPhone && phone) textLines.push(phone)
  if (options.showBookingCta && bookingUrl) textLines.push(renderBookingCtaText(bookingUrl, options.bookingLabel))

  const rightParts: string[] = [
    `<p style="margin:0;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#111827;line-height:1.35;">${esc(name)}</p>`,
  ]
  if (title) {
    rightParts.push(
      `<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#6b7280;line-height:1.35;">${esc(title)}</p>`,
    )
  }
  rightParts.push(
    `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#111827;line-height:1.35;">${renderCompanyHtml(companyLabel, websiteHref, options.showWebsite)}</p>`,
  )
  if (companyTagline) {
    rightParts.push(
      `<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.4;">${esc(companyTagline)}</p>`,
    )
  }
  if (options.showEmail && email) {
    rightParts.push(
      `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#374151;line-height:1.35;">${esc(email)}</p>`,
    )
  }
  if (options.showPhone && phone) {
    rightParts.push(
      `<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#374151;line-height:1.35;">${esc(phone)}</p>`,
    )
  }
  if (options.showBookingCta && bookingUrl) {
    rightParts.push(
      `<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;">${anchor(externalHref(bookingUrl), options.bookingLabel)}</p>`,
    )
  }

  const leftCell = imageUrl
    ? `<td style="vertical-align:top;padding:0 14px 0 0;width:72px;">${renderLogoHtml(imageUrl, companyLabel, websiteHref, options.showWebsite, 72)}</td>`
    : ""

  const html = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,sans-serif;"><tr>${leftCell}<td style="vertical-align:top;">${rightParts.join("")}</td></tr></table>`

  return { html, textLines }
}

export function renderSignatureTemplate(
  template: GrowthSignatureTemplateId,
  input: SignatureRenderInput,
): GrowthRenderedSignature {
  const name = trimOrNull(input.display_name) ?? "Sender"
  const title = trimOrNull(input.title)
  const email = trimOrNull(input.email)
  const phone = trimOrNull(input.phone)
  const companyTagline = trimOrNull(input.company_tagline)
  const linkedin = trimOrNull(input.linkedin_url)
  const bookingUrl = trimOrNull(input.booking_url)
  const { companyLabel, websiteHref } = resolveSignatureCompanyFields({
    company_name: input.company_name,
    website: input.website,
  })
  const logoUrl = trimOrNull(input.logo_url)
  const avatarUrl = trimOrNull(input.avatar_url)
  const options = resolveRenderOptions(input)

  const textLines: string[] = []
  const htmlParts: string[] = []

  if (template === "minimal") {
    const line2 = title ? `${title} | ${companyLabel}` : companyLabel
    textLines.push(name, line2)
    if (options.showPhone && phone) textLines.push(phone)
    if (options.showEmail && email) textLines.push(email)
    if (options.showBookingCta && bookingUrl) textLines.push(renderBookingCtaText(bookingUrl, options.bookingLabel))

    const htmlLine2 = title
      ? `${esc(title)} | ${renderCompanyHtml(companyLabel, websiteHref, options.showWebsite)}`
      : renderCompanyHtml(companyLabel, websiteHref, options.showWebsite)
    htmlParts.push(
      `<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#374151;line-height:1.45;"><strong>${esc(name)}</strong><br/>${htmlLine2}</p>`,
    )
    if (options.showPhone && phone) {
      htmlParts.push(`<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#4b5563;">${esc(phone)}</p>`)
    }
    if (options.showEmail && email) {
      htmlParts.push(`<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#4b5563;">${esc(email)}</p>`)
    }
    if (options.showBookingCta && bookingUrl) {
      htmlParts.push(renderBookingCtaHtml(bookingUrl, options.bookingLabel, false))
    }
    return { template, html: htmlParts.join(""), text: textLines.join("\n") }
  }

  if (template === "professional") {
    const { html, textLines: proLines } = renderProfessionalLayout(
      name,
      title,
      companyLabel,
      companyTagline,
      email,
      phone,
      logoUrl,
      avatarUrl,
      websiteHref,
      bookingUrl,
      options,
    )
    return { template, html, text: proLines.join("\n") }
  }

  if (template === "branded") {
    if (logoUrl) {
      htmlParts.push(
        `<p style="margin:0 0 10px 0;">${renderLogoHtml(logoUrl, companyLabel, websiteHref, options.showWebsite, 48)}</p>`,
      )
    } else if (avatarUrl) {
      htmlParts.push(
        `<p style="margin:0 0 10px 0;">${renderLogoHtml(avatarUrl, companyLabel, websiteHref, options.showWebsite, 48)}</p>`,
      )
    }
    htmlParts.push(`<p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#111827;"><strong>${esc(name)}</strong></p>`)
    if (title) {
      htmlParts.push(`<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#6b7280;">${esc(title)}</p>`)
    }
    htmlParts.push(
      `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#374151;">${renderCompanyHtml(companyLabel, websiteHref, options.showWebsite)}</p>`,
    )
    if (companyTagline) {
      htmlParts.push(
        `<p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;">${esc(companyTagline)}</p>`,
      )
    }
    if (options.showEmail && email) {
      htmlParts.push(`<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#4b5563;">${esc(email)}</p>`)
    }
    if (options.showPhone && phone) {
      htmlParts.push(`<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#4b5563;">${esc(phone)}</p>`)
    }
    if (linkedin) {
      htmlParts.push(
        `<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;">${anchor(externalHref(linkedin), "LinkedIn")}</p>`,
      )
    }
    if (options.showBookingCta && bookingUrl) {
      htmlParts.push(renderBookingCtaHtml(bookingUrl, options.bookingLabel, true))
    }

    textLines.push(name)
    if (title) textLines.push(title)
    textLines.push(companyLabel)
    if (companyTagline) textLines.push(companyTagline)
    if (options.showEmail && email) textLines.push(email)
    if (options.showPhone && phone) textLines.push(phone)
    if (linkedin) textLines.push("LinkedIn")
    if (options.showBookingCta && bookingUrl) textLines.push(renderBookingCtaText(bookingUrl, options.bookingLabel))
    return { template, html: htmlParts.join(""), text: textLines.join("\n") }
  }

  // simple (default)
  textLines.push(name)
  if (title) textLines.push(title)
  textLines.push(companyLabel)
  if (options.showPhone && phone) textLines.push(phone)
  if (options.showEmail && email) textLines.push(email)
  if (options.showBookingCta && bookingUrl) textLines.push(renderBookingCtaText(bookingUrl, options.bookingLabel))

  htmlParts.push(`<p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#111827;line-height:1.45;">`)
  htmlParts.push(`<strong>${esc(name)}</strong><br/>`)
  if (title) htmlParts.push(`${esc(title)}<br/>`)
  htmlParts.push(renderCompanyHtml(companyLabel, websiteHref, options.showWebsite))
  if (options.showPhone && phone) htmlParts.push(`<br/>${esc(phone)}`)
  if (options.showEmail && email) htmlParts.push(`<br/>${esc(email)}`)
  htmlParts.push("</p>")
  if (options.showBookingCta && bookingUrl) {
    htmlParts.push(renderBookingCtaHtml(bookingUrl, options.bookingLabel, false))
  }

  return { template, html: htmlParts.join(""), text: textLines.join("\n") }
}
