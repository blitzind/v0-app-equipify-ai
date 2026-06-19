import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function probeSequenceVideoAttachmentsSchema(
  admin: SupabaseClient,
): Promise<{ sequence_video_attachments_ready: boolean; error?: string | null }> {
  const { error } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("id")
    .limit(1)

  if (error) {
    return { sequence_video_attachments_ready: false, error: error.message }
  }
  return { sequence_video_attachments_ready: true, error: null }
}

export async function isSequenceVideoAttachmentsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const probe = await probeSequenceVideoAttachmentsSchema(admin)
  return probe.sequence_video_attachments_ready
}
