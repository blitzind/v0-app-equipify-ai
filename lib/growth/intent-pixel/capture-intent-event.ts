import type { SupabaseClient } from "@supabase/supabase-js"
import {
  allowsMarketingAttribution,
  allowsPersonalizationTracking,
  normalizeConsentStatus,
  resolveConsentCategories,
  resolveTrackingMode,
} from "@/lib/growth/intent-pixel/consent-gate"
import { normalizeConsentCategories } from "@/lib/growth/intent-pixel/intent-consent-categories"
import {
  buildCollectRejectionDiagnostics,
  type GrowthIntentPixelCollectRejectionDiagnostics,
} from "@/lib/growth/intent-pixel/intent-pixel-collect-debug"
import {
  attachIdentifiedContact,
  closeLastPageviewDuration,
  fetchIntentPixelSite,
  fetchVisitHistory,
  isDomainAllowed,
  recordConversion,
  recordPageview,
  upsertVisitorSession,
} from "@/lib/growth/intent-pixel/intent-pixel-repository"
import { trackingModeFromSite } from "@/lib/growth/intent-pixel/intent-pixel-site-config"
import {
  GROWTH_INTENT_PIXEL_EVENT_TYPES,
  GROWTH_INTENT_PIXEL_QA_MARKER,
  type GrowthIntentPixelCaptureResult,
  type GrowthIntentPixelCollectPayload,
  type GrowthIntentPixelEventType,
  type GrowthIntentPixelSite,
  type GrowthIntentPixelVisitHistory,
} from "@/lib/growth/intent-pixel/intent-pixel-types"
import { GROWTH_INTENT_PIXEL_PRIVACY_NOTE, resolvePiiCaptureSource, sanitizeSubmittedIdentity } from "@/lib/growth/intent-pixel/pii-policy"
import {
  GROWTH_INTENT_PIXEL_SCHEMA_SETUP_MESSAGE,
  isGrowthIntentPixelSchemaReady,
} from "@/lib/growth/intent-pixel/intent-pixel-schema-health"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEventType(value: unknown): GrowthIntentPixelEventType | null {
  const raw = asString(value).toLowerCase()
  return GROWTH_INTENT_PIXEL_EVENT_TYPES.includes(raw as GrowthIntentPixelEventType)
    ? (raw as GrowthIntentPixelEventType)
    : null
}

export function normalizeCollectPayload(body: Record<string, unknown>): GrowthIntentPixelCollectPayload | null {
  const site_key = asString(body.site_key)
  const event_type = normalizeEventType(body.event_type)
  if (!site_key || !event_type) return null

  return {
    site_key,
    event_type,
    visitor_key: asString(body.visitor_key) || undefined,
    session_key: asString(body.session_key) || undefined,
    consent_status: normalizeConsentStatus(body.consent_status),
    consent_categories:
      body.consent_categories && typeof body.consent_categories === "object"
        ? normalizeConsentCategories(body.consent_categories)
        : undefined,
    personalization_segment:
      body.personalization_segment && typeof body.personalization_segment === "object"
        ? (body.personalization_segment as GrowthIntentPixelCollectPayload["personalization_segment"])
        : undefined,
    page_url: asString(body.page_url) || undefined,
    page_path: asString(body.page_path) || undefined,
    page_title: asString(body.page_title) || undefined,
    referrer: asString(body.referrer) || undefined,
    utm:
      body.utm && typeof body.utm === "object"
        ? (body.utm as GrowthIntentPixelCollectPayload["utm"])
        : undefined,
    duration_ms:
      typeof body.duration_ms === "number" && Number.isFinite(body.duration_ms)
        ? Math.max(0, Math.round(body.duration_ms))
        : undefined,
    device:
      body.device && typeof body.device === "object"
        ? (body.device as GrowthIntentPixelCollectPayload["device"])
        : undefined,
    browser:
      body.browser && typeof body.browser === "object"
        ? (body.browser as GrowthIntentPixelCollectPayload["browser"])
        : undefined,
    conversion_type:
      typeof body.conversion_type === "string"
        ? (body.conversion_type as GrowthIntentPixelCollectPayload["conversion_type"])
        : undefined,
    conversion_label: asString(body.conversion_label) || undefined,
    conversion_metadata:
      body.conversion_metadata && typeof body.conversion_metadata === "object"
        ? (body.conversion_metadata as Record<string, unknown>)
        : undefined,
    submitted_identity:
      body.submitted_identity && typeof body.submitted_identity === "object"
        ? (body.submitted_identity as GrowthIntentPixelCollectPayload["submitted_identity"])
        : undefined,
  }
}

export type GrowthIntentPixelCaptureOptions = {
  include_visit_history?: boolean
}

export type GrowthIntentPixelCaptureResponse = GrowthIntentPixelCaptureResult & {
  privacy_note: typeof GROWTH_INTENT_PIXEL_PRIVACY_NOTE
  visit_history?: GrowthIntentPixelVisitHistory
  pii_attached?: boolean
  pii_reason?: string
  rejection?: GrowthIntentPixelCollectRejectionDiagnostics
}

function buildRejectedCapture(
  base: GrowthIntentPixelCaptureResponse,
  input: {
    reason: string
    payload: GrowthIntentPixelCollectPayload
    site?: GrowthIntentPixelSite | null
    domainAllowed?: boolean | null
  },
): GrowthIntentPixelCaptureResponse {
  const rejection = buildCollectRejectionDiagnostics({
    reason: input.reason,
    payload: input.payload,
    site: input.site ?? null,
    domainAllowed: input.domainAllowed ?? null,
    trackingModeResolved: input.site ? trackingModeFromSite(input.site) : null,
  })
  return {
    ...base,
    ok: false,
    accepted: false,
    reason: input.reason,
    rejection_code: rejection.rejection_code,
    rejection,
  }
}

export async function captureIntentPixelEvent(
  admin: SupabaseClient,
  payload: GrowthIntentPixelCollectPayload,
  options: GrowthIntentPixelCaptureOptions = {},
): Promise<GrowthIntentPixelCaptureResponse> {
  const base: GrowthIntentPixelCaptureResponse = {
    ok: false,
    qa_marker: GROWTH_INTENT_PIXEL_QA_MARKER,
    accepted: false,
    reason: "",
    visitor_key: null,
    session_key: null,
    session_id: null,
    consent_status: normalizeConsentStatus(payload.consent_status),
    tracking_mode: "rejected",
    privacy_note: GROWTH_INTENT_PIXEL_PRIVACY_NOTE,
  }

  const schemaReady = await isGrowthIntentPixelSchemaReady(admin)
  if (!schemaReady) {
    return buildRejectedCapture(base, {
      reason: GROWTH_INTENT_PIXEL_SCHEMA_SETUP_MESSAGE,
      payload,
    })
  }

  const site = await fetchIntentPixelSite(admin, payload.site_key)
  if (!site) {
    return buildRejectedCapture(base, {
      reason: "Unknown intent pixel site_key.",
      payload,
    })
  }

  const pageUrl = asString(payload.page_url)
  const domainAllowed = pageUrl ? isDomainAllowed(site, pageUrl) : null
  if (pageUrl && domainAllowed === false) {
    return buildRejectedCapture(base, {
      reason: "Page URL hostname not on site domain allowlist.",
      payload,
      site,
      domainAllowed: false,
    })
  }

  const consentStatus = normalizeConsentStatus(payload.consent_status)
  const consentCategories = resolveConsentCategories({
    consent_status: consentStatus,
    consent_categories: payload.consent_categories,
  })
  const gate = resolveTrackingMode(
    site,
    consentStatus,
    payload.event_type,
    payload.conversion_type,
    consentCategories,
  )

  if (!gate.accepted) {
    return buildRejectedCapture(base, {
      reason: gate.reason,
      payload: { ...payload, consent_status: consentStatus },
      site,
      domainAllowed,
    })
  }

  const session = await upsertVisitorSession(admin, site, payload, consentStatus, {
    consentCategories,
    allowMarketingAttribution: allowsMarketingAttribution(consentStatus, consentCategories),
    allowPersonalizationTracking: allowsPersonalizationTracking(consentStatus, consentCategories),
  })

  let piiAttached = false
  let piiReason = ""

  if (payload.event_type === "pageview") {
    const pageview = await recordPageview(admin, site, session, payload, {
      allowMarketingAttribution: allowsMarketingAttribution(consentStatus, consentCategories),
    })
    if (process.env.GROWTH_SIGNAL_INTELLIGENCE_ENABLED?.trim().toLowerCase() === "true") {
      const { bridgeIntentPageviewEvent } = await import(
        "@/lib/growth/signal-intelligence/external-signal-producers"
      )
      void bridgeIntentPageviewEvent(admin, {
        pageview_id: pageview.id,
        page_path: pageview.page_path,
        company_domain:
          typeof session.metadata?.identified_company_domain === "string"
            ? session.metadata.identified_company_domain
            : null,
        visit_count: session.pageview_count + 1,
        captured_at: pageview.captured_at,
      }).catch(() => undefined)
    }
  } else if (payload.event_type === "page_exit" || payload.event_type === "heartbeat") {
    const durationMs = payload.duration_ms ?? 0
    if (durationMs > 0) {
      await closeLastPageviewDuration(admin, session.id, durationMs)
      await admin
        .schema("growth")
        .from("intent_visitor_sessions")
        .update({
          total_time_on_site_ms: session.total_time_on_site_ms + durationMs,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", session.id)
    }
  } else if (payload.event_type === "conversion") {
    await recordConversion(admin, site, session, payload)

    const captureSource = resolvePiiCaptureSource(payload.conversion_type)
    const pii = sanitizeSubmittedIdentity(payload.submitted_identity, captureSource)
    piiReason = pii.reason

    if (pii.allowed && pii.identity && captureSource && captureSource !== "enrichment") {
      await attachIdentifiedContact(admin, site, session, captureSource, {
        email: pii.identity.email ?? null,
        phone: pii.identity.phone ?? null,
        full_name: pii.identity.full_name ?? null,
        linkedin_url: pii.identity.linkedin_url ?? null,
        company_name: pii.identity.company_name ?? null,
        submitted_fields: payload.conversion_metadata ?? {},
      })
      piiAttached = true
    }
  }

  let visitHistory: GrowthIntentPixelVisitHistory | undefined
  if (options.include_visit_history && session.visitor_key) {
    visitHistory = await fetchVisitHistory(admin, site.id, session.visitor_key)
  }

  return {
    ok: true,
    qa_marker: GROWTH_INTENT_PIXEL_QA_MARKER,
    accepted: true,
    reason: gate.reason,
    visitor_key: session.visitor_key,
    session_key: session.session_key,
    session_id: session.id,
    consent_status: session.consent_status,
    tracking_mode: gate.mode,
    privacy_note: GROWTH_INTENT_PIXEL_PRIVACY_NOTE,
    visit_history: visitHistory,
    pii_attached: piiAttached,
    pii_reason: piiReason || undefined,
  }
}
