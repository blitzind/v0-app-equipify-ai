import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  refreshCompanyContactVerification,
  updateCompanyContactStatus,
} from "@/lib/growth/contact-discovery/company-contact-repository"
import {
  GROWTH_COMPANY_CONTACTS_SCHEMA_SETUP_MESSAGE,
  isGrowthCompanyContactsSchemaReady,
} from "@/lib/growth/contact-discovery/company-contact-schema-health"
import { GROWTH_COMPANY_CONTACT_STATUSES } from "@/lib/growth/contact-discovery/company-contact-types"

export const runtime = "nodejs"

export async function PATCH(_request: Request, context: { params: Promise<{ contactId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCompanyContactsSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_incomplete", message: GROWTH_COMPANY_CONTACTS_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const { contactId } = await context.params
  if (!z.string().uuid().safeParse(contactId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid contact id." }, { status: 400 })
  }

  const body = (await _request.json().catch(() => ({}))) as {
    action?: string
    contact_status?: string
  }

  try {
    if (body.action === "refresh") {
      const contact = await refreshCompanyContactVerification(access.admin, contactId)
      if (!contact) return NextResponse.json({ error: "not_found", message: "Contact not found." }, { status: 404 })
      return NextResponse.json({ ok: true, contact })
    }

    if (body.contact_status && GROWTH_COMPANY_CONTACT_STATUSES.includes(body.contact_status as never)) {
      const contact = await updateCompanyContactStatus(access.admin, contactId, body.contact_status as never)
      if (!contact) return NextResponse.json({ error: "not_found", message: "Contact not found." }, { status: 404 })
      return NextResponse.json({ ok: true, contact })
    }

    return NextResponse.json({ error: "invalid_action", message: "Unsupported action." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "update_failed", message: "Could not update contact." }, { status: 500 })
  }
}
