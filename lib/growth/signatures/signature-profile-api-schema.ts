import { z } from "zod"
import { GROWTH_SIGNATURE_TEMPLATES } from "@/lib/growth/signatures/signature-types"

export const growthSignatureProfileFieldsSchema = {
  companyName: z.string().trim().max(200).nullable().optional(),
  companyTagline: z.string().trim().max(500).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  linkedinUrl: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().trim().max(2000).nullable().optional(),
  logoUrl: z.string().trim().max(2000).nullable().optional(),
  bookingUrl: z.string().trim().max(500).nullable().optional(),
  bookingLabel: z.string().trim().max(200).nullable().optional(),
  showEmailInSignature: z.boolean().optional(),
  showPhoneInSignature: z.boolean().optional(),
  showWebsiteInSignature: z.boolean().optional(),
  showBookingCta: z.boolean().optional(),
  signatureTemplate: z.enum(GROWTH_SIGNATURE_TEMPLATES).optional(),
} as const

export function mapSignatureProfileApiFields(data: {
  companyName?: string | null
  companyTagline?: string | null
  website?: string | null
  linkedinUrl?: string | null
  avatarUrl?: string | null
  logoUrl?: string | null
  bookingUrl?: string | null
  bookingLabel?: string | null
  showEmailInSignature?: boolean
  showPhoneInSignature?: boolean
  showWebsiteInSignature?: boolean
  showBookingCta?: boolean
  signatureTemplate?: (typeof GROWTH_SIGNATURE_TEMPLATES)[number]
}) {
  return {
    company_name: data.companyName,
    company_tagline: data.companyTagline,
    website: data.website,
    linkedin_url: data.linkedinUrl,
    avatar_url: data.avatarUrl,
    logo_url: data.logoUrl,
    booking_url: data.bookingUrl,
    booking_label: data.bookingLabel,
    show_email_in_signature: data.showEmailInSignature,
    show_phone_in_signature: data.showPhoneInSignature,
    show_website_in_signature: data.showWebsiteInSignature,
    show_booking_cta: data.showBookingCta,
    signature_template: data.signatureTemplate,
  }
}
