import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { createBrowserIntakeContact } from "@/lib/growth/browser-intake/create-browser-intake-contact"
import { queueBrowserIntakeContactDiscovery } from "@/lib/growth/browser-intake/queue-browser-intake-contact-discovery"
import type {
  GrowthBrowserIntakeProspectQueueAction,
  GrowthBrowserIntakeProspectQueueItem,
  GrowthBrowserIntakeProspectQueueItemResult,
  GrowthBrowserIntakeProspectQueueProcessResult,
} from "@/lib/growth/browser-intake/prospect-queue-types"
import {
  buildEmailVerificationMetadata,
  verifyEmailWithProvider,
} from "@/lib/growth/contact-verification/email-verification-service"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function hasContactFields(item: GrowthBrowserIntakeProspectQueueItem): boolean {
  return Boolean(
    asString(item.contact_name) ||
      asString(item.email) ||
      asString(item.phone) ||
      asString(item.linkedin_url),
  )
}

async function createLeadFromQueueItem(
  admin: SupabaseClient,
  item: GrowthBrowserIntakeProspectQueueItem,
  actor: { userId: string | null; userEmail: string | null },
): Promise<GrowthBrowserIntakeProspectQueueItemResult> {
  const companyName = asString(item.company_name)
  if (!companyName) {
    return {
      queue_item_id: item.queue_item_id,
      ok: false,
      action: "create_leads",
      lead_id: item.lead_id ?? null,
      message: "Company name is required.",
    }
  }

  if (item.lead_id) {
    return {
      queue_item_id: item.queue_item_id,
      ok: true,
      action: "create_leads",
      lead_id: item.lead_id,
      message: "Lead already linked.",
    }
  }

  try {
    const result = await createBrowserIntakeContact(admin, {
      company_name: companyName,
      contact_name: item.contact_name,
      title: item.title,
      email: item.email,
      phone: item.phone,
      website: item.website,
      linkedin_url: item.linkedin_url,
      source_url: item.source_url,
      source_platform: item.source_platform,
      page_title: item.page_title,
      notes: item.notes,
      capture_method: "chrome_extension",
      company_only: !hasContactFields(item),
      queue_contact_discovery: false,
      verify_email: false,
      intake_mode: "default",
      created_by: actor.userId,
      actor_email: actor.userEmail,
    })

    if (result.status !== "created" && result.status !== "updated") {
      return {
        queue_item_id: item.queue_item_id,
        ok: false,
        action: "create_leads",
        lead_id: null,
        message: "message" in result ? asString(result.message) || "Could not create lead." : "Could not create lead.",
      }
    }

    return {
      queue_item_id: item.queue_item_id,
      ok: true,
      action: "create_leads",
      lead_id: result.lead_id,
      message: result.status === "created" ? "Lead created." : "Existing lead updated.",
      email_status: result.email_status ?? null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed"
    return {
      queue_item_id: item.queue_item_id,
      ok: false,
      action: "create_leads",
      lead_id: null,
      message,
    }
  }
}

async function verifyEmailForQueueItem(
  admin: SupabaseClient,
  item: GrowthBrowserIntakeProspectQueueItem,
): Promise<GrowthBrowserIntakeProspectQueueItemResult> {
  const leadId = asString(item.lead_id)
  const email = asString(item.email)

  if (!leadId) {
    return {
      queue_item_id: item.queue_item_id,
      ok: false,
      action: "verify_emails",
      lead_id: null,
      message: "Create the lead before verifying email.",
    }
  }

  const lead = await fetchGrowthLeadById(admin, leadId)
  const verifyTarget = email || asString(lead?.contactEmail)
  if (!verifyTarget) {
    return {
      queue_item_id: item.queue_item_id,
      ok: true,
      action: "verify_emails",
      lead_id: leadId,
      message: "Skipped — no email to verify.",
    }
  }

  try {
    const verification = await verifyEmailWithProvider(verifyTarget, { admin, leadId })
    if (!verification) {
      return {
        queue_item_id: item.queue_item_id,
        ok: false,
        action: "verify_emails",
        lead_id: leadId,
        message: "Email verification did not return a result.",
      }
    }

    const existing = await fetchGrowthLeadById(admin, leadId)
    if (existing) {
      await updateGrowthLeadFromImportMerge(admin, leadId, {
        metadata: {
          ...(existing.metadata ?? {}),
          ...buildEmailVerificationMetadata(verification),
        },
      })
      await recomputeGrowthLeadWorkflowSignals(admin, leadId)
    }

    return {
      queue_item_id: item.queue_item_id,
      ok: true,
      action: "verify_emails",
      lead_id: leadId,
      message: `Email verification: ${verification.email_status}.`,
      email_status: verification.email_status,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "verify_failed"
    return {
      queue_item_id: item.queue_item_id,
      ok: false,
      action: "verify_emails",
      lead_id: leadId,
      message,
    }
  }
}

async function queueDiscoveryForItem(
  admin: SupabaseClient,
  item: GrowthBrowserIntakeProspectQueueItem,
  actorUserId: string | null,
): Promise<GrowthBrowserIntakeProspectQueueItemResult> {
  const leadId = asString(item.lead_id)
  if (!leadId) {
    return {
      queue_item_id: item.queue_item_id,
      ok: false,
      action: "run_contact_discovery",
      lead_id: null,
      message: "Create the lead before queueing contact discovery.",
    }
  }

  try {
    const queued = await queueBrowserIntakeContactDiscovery(admin, {
      leadId,
      createdBy: actorUserId,
    })
    return {
      queue_item_id: item.queue_item_id,
      ok: true,
      action: "run_contact_discovery",
      lead_id: leadId,
      message: "Contact discovery queued.",
      contact_discovery_queued: queued.queued,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "queue_failed"
    return {
      queue_item_id: item.queue_item_id,
      ok: false,
      action: "run_contact_discovery",
      lead_id: leadId,
      message,
    }
  }
}

async function processSingleQueueItem(
  admin: SupabaseClient,
  item: GrowthBrowserIntakeProspectQueueItem,
  action: GrowthBrowserIntakeProspectQueueAction,
  actor: { userId: string | null; userEmail: string | null },
): Promise<GrowthBrowserIntakeProspectQueueItemResult> {
  const workingItem = { ...item }

  if (action === "process_queue") {
    const createResult = await createLeadFromQueueItem(admin, workingItem, actor)
    if (createResult.lead_id) workingItem.lead_id = createResult.lead_id

    const verifyResult = await verifyEmailForQueueItem(admin, workingItem)
    const discoveryResult = await queueDiscoveryForItem(admin, workingItem, actor.userId)

    const ok = createResult.ok && verifyResult.ok && discoveryResult.ok
    const message = [
      createResult.message,
      verifyResult.message,
      discoveryResult.message,
    ]
      .filter(Boolean)
      .join(" ")

    return {
      queue_item_id: item.queue_item_id,
      ok,
      action: "process_queue",
      lead_id: workingItem.lead_id ?? null,
      message,
      email_status: verifyResult.email_status ?? null,
      contact_discovery_queued: discoveryResult.contact_discovery_queued === true,
    }
  }

  if (action === "create_leads") {
    return await createLeadFromQueueItem(admin, workingItem, actor)
  }

  if (action === "verify_emails") {
    return await verifyEmailForQueueItem(admin, workingItem)
  }

  return await queueDiscoveryForItem(admin, workingItem, actor.userId)
}

export async function processBrowserIntakeProspectQueue(
  admin: SupabaseClient,
  input: {
    action: GrowthBrowserIntakeProspectQueueAction
    items: GrowthBrowserIntakeProspectQueueItem[]
    actorUserId: string | null
    actorEmail: string | null
  },
): Promise<GrowthBrowserIntakeProspectQueueProcessResult> {
  const results: GrowthBrowserIntakeProspectQueueItemResult[] = []

  for (const item of input.items) {
    const itemResult = await processSingleQueueItem(admin, item, input.action, {
      userId: input.actorUserId,
      userEmail: input.actorEmail,
    })
    results.push(itemResult)
  }

  const success_count = results.filter((result) => result.ok).length

  logGrowthEngine("browser_intake_prospect_queue_processed", {
    action: input.action,
    itemCount: input.items.length,
    resultCount: results.length,
    successCount: success_count,
    actorEmail: input.actorEmail,
  })

  return {
    action: input.action,
    processed_count: input.items.length,
    success_count,
    results,
  }
}
