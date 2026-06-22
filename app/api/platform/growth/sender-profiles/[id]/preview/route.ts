import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { getSenderProfile } from "@/lib/growth/signatures/sender-profile-repository"
import { isGrowthSenderProfilesSchemaReady } from "@/lib/growth/signatures/sender-profile-schema-health"
import { renderSignatureFromProfile } from "@/lib/growth/signatures/signature-resolver"
import { GROWTH_SIGNATURE_TEMPLATES } from "@/lib/growth/signatures/signature-types"
import { renderSignatureTemplate } from "@/lib/growth/signatures/signature-template-render"

export const runtime = "nodejs"

const PreviewBodySchema = z.object({
  signatureTemplate: z.enum(GROWTH_SIGNATURE_TEMPLATES).optional(),
  displayName: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().max(320).optional(),
  phone: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  linkedinUrl: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().trim().max(2000).nullable().optional(),
  logoUrl: z.string().trim().max(2000).nullable().optional(),
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

  const previewProfile = {
    ...profile,
    display_name: overrides.displayName ?? profile.display_name,
    title: overrides.title !== undefined ? overrides.title : profile.title,
    email: overrides.email ?? profile.email,
    phone: overrides.phone !== undefined ? overrides.phone : profile.phone,
    website: overrides.website !== undefined ? overrides.website : profile.website,
    linkedin_url: overrides.linkedinUrl !== undefined ? overrides.linkedinUrl : profile.linkedin_url,
    avatar_url: overrides.avatarUrl !== undefined ? overrides.avatarUrl : profile.avatar_url,
    logo_url: overrides.logoUrl !== undefined ? overrides.logoUrl : profile.logo_url,
    signature_template: overrides.signatureTemplate ?? profile.signature_template,
  }

  const signature =
    overrides.signatureTemplate || overrides.displayName
      ? renderSignatureTemplate(previewProfile.signature_template, {
          display_name: previewProfile.display_name,
          title: previewProfile.title,
          email: previewProfile.email,
          phone: previewProfile.phone,
          website: previewProfile.website,
          linkedin_url: previewProfile.linkedin_url,
          avatar_url: previewProfile.avatar_url,
          logo_url: previewProfile.logo_url,
        })
      : renderSignatureFromProfile(previewProfile)

  return NextResponse.json({ ok: true, signature, profile: previewProfile })
}
