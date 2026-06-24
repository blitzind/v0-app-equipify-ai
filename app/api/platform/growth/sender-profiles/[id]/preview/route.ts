import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { getSenderProfile } from "@/lib/growth/signatures/sender-profile-repository"
import { isGrowthSenderProfilesSchemaReady } from "@/lib/growth/signatures/sender-profile-schema-health"
import {
  growthSignatureProfileFieldsSchema,
  mapSignatureProfileApiFields,
} from "@/lib/growth/signatures/signature-profile-api-schema"
import { buildSignatureRenderInput } from "@/lib/growth/signatures/signature-profile-defaults"
import { renderSignatureFromProfile } from "@/lib/growth/signatures/signature-resolver"
import { renderSignatureTemplate } from "@/lib/growth/signatures/signature-template-render"

export const runtime = "nodejs"

const PreviewBodySchema = z.object({
  displayName: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().max(320).optional(),
  phone: z.string().trim().max(80).nullable().optional(),
  ...growthSignatureProfileFieldsSchema,
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  const profile = await getSenderProfile(access.admin, id)
  if (!profile) {
    return NextResponse.json({ error: "not_found", message: "Sender profile not found." }, { status: 404 })
  }

  const body = PreviewBodySchema.safeParse(await request.json().catch(() => ({})))
  const overrides = body.success ? body.data : {}
  const mapped = mapSignatureProfileApiFields(overrides)

  const previewProfile = {
    ...profile,
    display_name: overrides.displayName ?? profile.display_name,
    title: overrides.title !== undefined ? overrides.title : profile.title,
    email: overrides.email ?? profile.email,
    phone: overrides.phone !== undefined ? overrides.phone : profile.phone,
    company_name: mapped.company_name !== undefined ? mapped.company_name ?? null : profile.company_name,
    company_tagline:
      mapped.company_tagline !== undefined ? mapped.company_tagline ?? null : profile.company_tagline,
    website: mapped.website !== undefined ? mapped.website ?? null : profile.website,
    linkedin_url: mapped.linkedin_url !== undefined ? mapped.linkedin_url ?? null : profile.linkedin_url,
    avatar_url: mapped.avatar_url !== undefined ? mapped.avatar_url ?? null : profile.avatar_url,
    logo_url: mapped.logo_url !== undefined ? mapped.logo_url ?? null : profile.logo_url,
    booking_url: mapped.booking_url !== undefined ? mapped.booking_url ?? null : profile.booking_url,
    booking_label: mapped.booking_label !== undefined ? mapped.booking_label ?? null : profile.booking_label,
    show_email_in_signature:
      mapped.show_email_in_signature !== undefined
        ? mapped.show_email_in_signature
        : profile.show_email_in_signature,
    show_phone_in_signature:
      mapped.show_phone_in_signature !== undefined
        ? mapped.show_phone_in_signature
        : profile.show_phone_in_signature,
    show_website_in_signature:
      mapped.show_website_in_signature !== undefined
        ? mapped.show_website_in_signature
        : profile.show_website_in_signature,
    show_booking_cta:
      mapped.show_booking_cta !== undefined ? mapped.show_booking_cta : profile.show_booking_cta,
    signature_template: mapped.signature_template ?? profile.signature_template,
  }

  const hasOverrides = body.success && Object.keys(overrides).length > 0
  const signature = hasOverrides
    ? renderSignatureTemplate(previewProfile.signature_template, buildSignatureRenderInput(previewProfile))
    : renderSignatureFromProfile(previewProfile)

  return NextResponse.json({ ok: true, signature, profile: previewProfile })
}
