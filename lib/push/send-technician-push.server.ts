import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendExpoPushMessage, isExpoPushLiveSendEnabled } from "@/lib/push/expo-push-api.server"
import type { TechnicianPushAlertType } from "@/lib/push/technician-push-alert-types"
import {
  buildTechnicianPushMessage,
  technicianPushIdempotencyKey,
  type TechnicianPushMessageInput,
} from "@/lib/push/technician-push-messages"

export type SendTechnicianPushInput = TechnicianPushMessageInput & {
  organizationId: string
  recipientUserId: string
  relatedEntityType?: "work_order" | null
  relatedEntityId?: string | null
  idempotencyBucket?: string | null
  createdBy?: string | null
}

export type SendTechnicianPushResult =
  | { status: "sent"; communicationEventId: string; devicesSent: number }
  | { status: "noop_simulated"; communicationEventId: string }
  | { status: "skipped"; code: string; communicationEventId?: string }

type UserPushDeviceRow = {
  id: string
  expo_push_token: string
}

/**
 * Writes a communication_events audit row, delivers via Expo to registered devices,
 * and updates delivery status. Uses service role — never call from the browser.
 */
export async function sendTechnicianPushNotification(
  svc: SupabaseClient,
  input: SendTechnicianPushInput,
): Promise<SendTechnicianPushResult> {
  const {
    organizationId,
    recipientUserId,
    alertType,
    relatedEntityType = "work_order",
    relatedEntityId = null,
    idempotencyBucket = null,
    createdBy = null,
  } = input

  const message = buildTechnicianPushMessage(input)
  const reminderKey = technicianPushIdempotencyKey({
    alertType,
    organizationId,
    recipientUserId,
    relatedEntityId,
    bucket: idempotencyBucket,
  })

  const { data: existing } = await svc
    .from("communication_events")
    .select("id, delivery_status")
    .eq("organization_id", organizationId)
    .eq("scheduled_reminder_key", reminderKey)
    .maybeSingle()

  if (existing?.delivery_status === "sent" || existing?.delivery_status === "delivered") {
    return { status: "skipped", code: "already_sent", communicationEventId: existing.id }
  }

  const nowIso = new Date().toISOString()
  const insertRow = {
    organization_id: organizationId,
    channel: "push",
    direction: "outbound",
    event_type: alertType,
    title: message.title,
    summary: message.body,
    body: message.body,
    audience: "organization",
    counts_toward_unread: false,
    delivery_status: "queued",
    recipient_kind: "user",
    recipient_user_id: recipientUserId,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    provider: "expo",
    scheduled_reminder_key: reminderKey,
    metadata: {
      alert_type: alertType,
      push_surface: "technician_mobile",
    },
    created_by: createdBy,
  }

  let communicationEventId = existing?.id ?? null

  if (!communicationEventId) {
    const { data: inserted, error: insertErr } = await svc
      .from("communication_events")
      .insert(insertRow)
      .select("id")
      .maybeSingle()

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: raced } = await svc
          .from("communication_events")
          .select("id, delivery_status")
          .eq("organization_id", organizationId)
          .eq("scheduled_reminder_key", reminderKey)
          .maybeSingle()
        if (raced?.delivery_status === "sent" || raced?.delivery_status === "delivered") {
          return { status: "skipped", code: "already_sent", communicationEventId: raced.id }
        }
        communicationEventId = raced?.id ?? null
      } else {
        return { status: "skipped", code: "audit_insert_failed" }
      }
    } else {
      communicationEventId = inserted?.id ?? null
    }
  }

  if (!communicationEventId) {
    return { status: "skipped", code: "missing_audit_id" }
  }

  const { data: devices, error: devicesErr } = await svc
    .from("user_push_devices")
    .select("id, expo_push_token")
    .eq("organization_id", organizationId)
    .eq("user_id", recipientUserId)

  if (devicesErr) {
    await markPushEventFailed(svc, communicationEventId, "device_lookup_failed")
    return { status: "skipped", code: "device_lookup_failed", communicationEventId }
  }

  const rows = (devices ?? []) as UserPushDeviceRow[]
  if (rows.length === 0) {
    await svc
      .from("communication_events")
      .update({
        delivery_status: "skipped",
        error_message: "no_registered_devices",
        failed_at: nowIso,
      })
      .eq("id", communicationEventId)
    return { status: "skipped", code: "no_devices", communicationEventId }
  }

  if (!isExpoPushLiveSendEnabled()) {
    await svc
      .from("communication_events")
      .update({
        delivery_status: "sent",
        sent_at: nowIso,
        metadata: {
          ...insertRow.metadata,
          live_send: false,
          device_count: rows.length,
        },
      })
      .eq("id", communicationEventId)
    return { status: "noop_simulated", communicationEventId }
  }

  let sentCount = 0
  const ticketIds: string[] = []
  const staleDeviceIds: string[] = []

  for (const device of rows) {
    const result = await sendExpoPushMessage({
      to: device.expo_push_token,
      title: message.title,
      body: message.body,
      sound: "default",
      priority: input.alertType === "urgent_callback" ? "high" : "default",
      data: {
        alertType: input.alertType,
        organizationId,
        ...(relatedEntityId ? { workOrderId: relatedEntityId } : {}),
      },
    })

    if (result.ok) {
      sentCount += 1
      if (result.ticketId !== "noop_simulated") {
        ticketIds.push(result.ticketId)
      }
      continue
    }

    if (result.deviceNotRegistered) {
      staleDeviceIds.push(device.id)
    }
  }

  if (staleDeviceIds.length > 0) {
    await svc.from("user_push_devices").delete().in("id", staleDeviceIds)
  }

  if (sentCount === 0) {
    await markPushEventFailed(svc, communicationEventId, "all_devices_failed")
    return { status: "skipped", code: "delivery_failed", communicationEventId }
  }

  await svc
    .from("communication_events")
    .update({
      delivery_status: "sent",
      sent_at: nowIso,
      delivered_at: nowIso,
      provider_message_id: ticketIds[0] ?? null,
      metadata: {
        ...insertRow.metadata,
        live_send: true,
        device_count: rows.length,
        devices_sent: sentCount,
        ticket_ids: ticketIds,
        pruned_device_ids: staleDeviceIds,
      },
    })
    .eq("id", communicationEventId)

  return {
    status: "sent",
    communicationEventId,
    devicesSent: sentCount,
  }
}

async function markPushEventFailed(
  svc: SupabaseClient,
  communicationEventId: string,
  errorMessage: string,
): Promise<void> {
  await svc
    .from("communication_events")
    .update({
      delivery_status: "failed",
      failed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", communicationEventId)
}

/** Deliver an existing queued push audit row (cron / ops). */
export async function deliverQueuedPushCommunicationEvent(
  svc: SupabaseClient,
  communicationEventId: string,
): Promise<SendTechnicianPushResult> {
  const { data: row, error } = await svc
    .from("communication_events")
    .select("id, organization_id, event_type, title, summary, recipient_user_id, delivery_status")
    .eq("id", communicationEventId)
    .eq("channel", "push")
    .eq("provider", "expo")
    .maybeSingle()

  if (error || !row) {
    return { status: "skipped", code: "not_found" }
  }

  if (row.delivery_status === "sent" || row.delivery_status === "delivered") {
    return { status: "skipped", code: "already_sent", communicationEventId: row.id }
  }

  const recipientUserId = row.recipient_user_id
  if (!recipientUserId) {
    await markPushEventFailed(svc, row.id, "missing_recipient")
    return { status: "skipped", code: "missing_recipient", communicationEventId: row.id }
  }

  const message = {
    title: row.title,
    body: row.summary ?? row.title,
  }

  const { data: devices, error: devicesErr } = await svc
    .from("user_push_devices")
    .select("id, expo_push_token")
    .eq("organization_id", row.organization_id)
    .eq("user_id", recipientUserId)

  if (devicesErr) {
    await markPushEventFailed(svc, row.id, "device_lookup_failed")
    return { status: "skipped", code: "device_lookup_failed", communicationEventId: row.id }
  }

  const deviceRows = (devices ?? []) as UserPushDeviceRow[]
  if (deviceRows.length === 0) {
    await svc
      .from("communication_events")
      .update({
        delivery_status: "skipped",
        error_message: "no_registered_devices",
        failed_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    return { status: "skipped", code: "no_devices", communicationEventId: row.id }
  }

  if (!isExpoPushLiveSendEnabled()) {
    const nowIso = new Date().toISOString()
    await svc
      .from("communication_events")
      .update({ delivery_status: "sent", sent_at: nowIso })
      .eq("id", row.id)
    return { status: "noop_simulated", communicationEventId: row.id }
  }

  const nowIso = new Date().toISOString()
  let sentCount = 0
  const ticketIds: string[] = []
  const staleDeviceIds: string[] = []
  const priority =
    row.event_type === "urgent_callback" ? ("high" as const) : ("default" as const)

  for (const device of deviceRows) {
    const result = await sendExpoPushMessage({
      to: device.expo_push_token,
      title: message.title,
      body: message.body,
      sound: "default",
      priority,
    })
    if (result.ok) {
      sentCount += 1
      if (result.ticketId !== "noop_simulated") ticketIds.push(result.ticketId)
    } else if (result.deviceNotRegistered) {
      staleDeviceIds.push(device.id)
    }
  }

  if (staleDeviceIds.length > 0) {
    await svc.from("user_push_devices").delete().in("id", staleDeviceIds)
  }

  if (sentCount === 0) {
    await markPushEventFailed(svc, row.id, "all_devices_failed")
    return { status: "skipped", code: "delivery_failed", communicationEventId: row.id }
  }

  await svc
    .from("communication_events")
    .update({
      delivery_status: "sent",
      sent_at: nowIso,
      delivered_at: nowIso,
      provider_message_id: ticketIds[0] ?? null,
    })
    .eq("id", row.id)

  return {
    status: "sent",
    communicationEventId: row.id,
    devicesSent: sentCount,
  }
}

/** Re-process push rows stuck in queued (cron / ops). */
export async function processQueuedTechnicianPushEvents(
  svc: SupabaseClient,
  limit = 50,
): Promise<{ processed: number; sent: number; skipped: number; failed: number }> {
  const { data: rows, error } = await svc
    .from("communication_events")
    .select("id")
    .eq("channel", "push")
    .eq("provider", "expo")
    .eq("delivery_status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error || !rows?.length) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 }
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const result = await deliverQueuedPushCommunicationEvent(svc, row.id)
    if (result.status === "sent" || result.status === "noop_simulated") sent += 1
    else if (result.status === "skipped" && result.code === "delivery_failed") failed += 1
    else skipped += 1
  }

  return { processed: rows.length, sent, skipped, failed }
}
