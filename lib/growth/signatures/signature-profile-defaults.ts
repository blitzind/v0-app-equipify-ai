/** GS-GROWTH-SIGNATURES-BRANDED-1C — sender profile render defaults (client-safe). */

import type { GrowthSenderProfile } from "@/lib/growth/signatures/signature-types"
import type { SignatureRenderInput } from "@/lib/growth/signatures/signature-template-render"

export const GROWTH_SIGNATURE_DEFAULT_COMPANY_NAME = "Equipify.ai" as const
export const GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL = "Schedule a 15-minute demo" as const

export const GROWTH_SIGNATURE_TOGGLES_DEFAULT = {
  show_email_in_signature: false,
  show_phone_in_signature: true,
  show_website_in_signature: true,
  show_booking_cta: true,
} as const

export const GROWTH_SIGNATURE_PROFILE_FIELD_DEFAULTS = {
  company_tagline: null as string | null,
  booking_url: null as string | null,
  booking_label: null as string | null,
  ...GROWTH_SIGNATURE_TOGGLES_DEFAULT,
}

export type SignatureProfileLike = Pick<
  GrowthSenderProfile,
  | "display_name"
  | "title"
  | "email"
  | "phone"
  | "company_name"
  | "company_tagline"
  | "website"
  | "linkedin_url"
  | "avatar_url"
  | "logo_url"
  | "booking_url"
  | "booking_label"
  | "show_email_in_signature"
  | "show_phone_in_signature"
  | "show_website_in_signature"
  | "show_booking_cta"
>

export function buildSignatureRenderInput(profile: SignatureProfileLike): SignatureRenderInput {
  return {
    display_name: profile.display_name,
    title: profile.title,
    email: profile.email,
    phone: profile.phone,
    company_name: profile.company_name,
    company_tagline: profile.company_tagline,
    website: profile.website,
    linkedin_url: profile.linkedin_url,
    avatar_url: profile.avatar_url,
    logo_url: profile.logo_url,
    booking_url: profile.booking_url,
    booking_label: profile.booking_label ?? GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
    show_email_in_signature: profile.show_email_in_signature,
    show_phone_in_signature: profile.show_phone_in_signature,
    show_website_in_signature: profile.show_website_in_signature,
    show_booking_cta: profile.show_booking_cta,
  }
}
