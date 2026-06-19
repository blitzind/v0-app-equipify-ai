import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthSequenceVideoAttachmentView } from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import {
  attachGrowthSequenceVideoAsset,
  mapSequenceVideoAttachmentRow,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-service"
import { enrichSequenceVideoAttachmentView } from "@/lib/growth/sequences/growth-sequence-video-preview-service"
import { buildSequenceVideoAttachmentAiPayload } from "@/lib/growth/sequences/growth-sequence-video-render-service"

export async function approveGrowthSequenceVideoAttachment(
  admin: SupabaseClient,
  input: { organizationId: string; attachmentId: string; approvedBy: string },
): Promise<GrowthSequenceVideoAttachmentView> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.attachmentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("not_found")

  const record = mapSequenceVideoAttachmentRow(data as Record<string, unknown>)
  if (record.attachmentStatus === "removed") throw new Error("attachment_already_removed")

  const now = new Date().toISOString()
  const aiPayload = buildSequenceVideoAttachmentAiPayload({ attachment: record })

  const { data: updated, error: updateError } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .update({
      attachment_status: "approved",
      approved_by: input.approvedBy,
      approved_at: now,
      ai_payload: aiPayload,
    })
    .eq("id", input.attachmentId)
    .select("*")
    .single()

  if (updateError || !updated) throw new Error(updateError?.message ?? "update_failed")

  return enrichSequenceVideoAttachmentView(admin, {
    organizationId: input.organizationId,
    row: updated as Record<string, unknown>,
  })
}

export async function removeGrowthSequenceVideoAttachment(
  admin: SupabaseClient,
  input: { organizationId: string; attachmentId: string; approvedBy: string },
): Promise<GrowthSequenceVideoAttachmentView> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.attachmentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("not_found")

  const { data: updated, error: updateError } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .update({
      attachment_status: "removed",
      approved_by: input.approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", input.attachmentId)
    .select("*")
    .single()

  if (updateError || !updated) throw new Error(updateError?.message ?? "update_failed")

  return enrichSequenceVideoAttachmentView(admin, {
    organizationId: input.organizationId,
    row: updated as Record<string, unknown>,
  })
}

export async function replaceGrowthSequenceVideoAttachment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    attachmentId: string
    approvedBy: string
    replaceWith: Parameters<typeof attachGrowthSequenceVideoAsset>[1]
  },
): Promise<GrowthSequenceVideoAttachmentView> {
  await removeGrowthSequenceVideoAttachment(admin, {
    organizationId: input.organizationId,
    attachmentId: input.attachmentId,
    approvedBy: input.approvedBy,
  })

  return attachGrowthSequenceVideoAsset(admin, {
    ...input.replaceWith,
    organizationId: input.organizationId,
    createdBy: input.approvedBy,
  })
}

export async function reviewGrowthSequenceVideoAttachment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    attachmentId: string
    approvedBy: string
    action: "approve" | "remove" | "replace"
    replaceWith?: Parameters<typeof attachGrowthSequenceVideoAsset>[1] | null
  },
): Promise<GrowthSequenceVideoAttachmentView> {
  if (input.action === "approve") {
    return approveGrowthSequenceVideoAttachment(admin, {
      organizationId: input.organizationId,
      attachmentId: input.attachmentId,
      approvedBy: input.approvedBy,
    })
  }
  if (input.action === "remove") {
    return removeGrowthSequenceVideoAttachment(admin, {
      organizationId: input.organizationId,
      attachmentId: input.attachmentId,
      approvedBy: input.approvedBy,
    })
  }
  if (!input.replaceWith) throw new Error("invalid_body")
  return replaceGrowthSequenceVideoAttachment(admin, {
    organizationId: input.organizationId,
    attachmentId: input.attachmentId,
    approvedBy: input.approvedBy,
    replaceWith: input.replaceWith,
  })
}
