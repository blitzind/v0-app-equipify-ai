/**
 * GS-SENDR-3C — Runtime visitor personalization certification.
 * Run: pnpm test:growth-sendr-visitor-personalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER,
} from "../lib/growth/sendr/growth-sendr-config"
import {
  applySendrRuntimePersonalizationToPayload,
  growthLeadRecordToSendrVariables,
  renderSendrPersonalizedText,
} from "../lib/growth/sendr/growth-sendr-personalization-runtime"
import { parseSendrVisitorRenderContext } from "../lib/growth/sendr/growth-sendr-visitor-render-context"
import { buildSendrPagePublicLink } from "../lib/growth/sendr/growth-sendr-slug-runtime"
import {
  createSendrVisitorAccessToken,
  verifySendrVisitorToken,
  verifySendrVisitorTokenResult,
} from "../lib/growth/sendr/growth-sendr-visitor-token"
import type { GrowthSendrPublicPagePayload } from "../lib/growth/sendr/growth-sendr-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function basePayload(): GrowthSendrPublicPagePayload {
  return {
    title: "Hello {{first_name}}",
    publishedVersion: 1,
    publishedAt: new Date().toISOString(),
    sections: [
      {
        type: "hero",
        sortOrder: 0,
        content: {
          headline: "Welcome {{first_name}} from {{company_name}}",
          body: "Your title: {{job_title}}",
        },
      },
      {
        type: "cta",
        sortOrder: 1,
        content: { label: "Book with {{first_name}}", href: "{{meeting_link}}" },
      },
      {
        type: "calendar",
        sortOrder: 2,
        content: { label: "Schedule" },
      },
    ],
    video: null,
    booking: {
      meetingLink: "https://cal.example/host-default",
      meetingType: null,
      durationMinutes: 30,
      timezone: "UTC",
    },
  }
}

function main(): void {
  console.log("\n=== GS-SENDR-3C Runtime Visitor Personalization Certification ===\n")

  assert.equal(
    GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER,
    "growth-sendr-visitor-personalization-gs-sendr-3c-v1",
  )

  const service = readSource("lib/growth/sendr/growth-sendr-visitor-personalization-service.ts")
  assert.match(service, /personalizeSendrPublicPagePayload/)
  assert.match(service, /resolveSendrVisitorLeadId/)
  assert.match(service, /parseSendrVisitorRenderContext|personalizeSendrPublicPagePayload/)
  assert.doesNotMatch(service, /setInterval|WebSocket|subscribe|poll/i)

  const pageRoute = readSource("app/videos/[slug]/page.tsx")
  assert.match(pageRoute, /searchParams/)
  assert.match(pageRoute, /parseSendrVisitorRenderContext/)

  const legacyRoute = readSource("app/sendr/[slug]/page.tsx")
  assert.match(legacyRoute, /redirect\(/)

  const publicApi = readSource("app/api/public/sendr/[slug]/route.ts")
  assert.match(publicApi, /parseSendrVisitorRenderContext/)

  const engagement = readSource("lib/growth/sendr/growth-sendr-public-engagement-service.ts")
  assert.match(engagement, /renderContext/)
  assert.match(engagement, /visitor_lead_id/)

  const client = readSource("components/sendr/sendr-public-page-client.tsx")
  assert.match(client, /getVisitorAttributionFromUrl/)
  assert.match(client, /leadId/)
  assert.match(client, /token/)
  assert.doesNotMatch(client, /setInterval/)

  const eventsRoute = readSource("app/api/public/sendr/events/route.ts")
  assert.match(eventsRoute, /leadId/)
  assert.match(eventsRoute, /token/)

  console.log("  ✓ Wiring: server render context + client attribution hints")

  const parsed = parseSendrVisitorRenderContext({
    leadId: "abc-123",
    token: "tok",
    other: "ignored",
  })
  assert.equal(parsed.leadId, "abc-123")
  assert.equal(parsed.token, "tok")
  assert.deepEqual(parseSendrVisitorRenderContext({}), { leadId: null, token: null })
  console.log("  ✓ parseSendrVisitorRenderContext")

  const leadId = "11111111-1111-4111-8111-111111111111"
  const pageId = "22222222-2222-4222-8222-222222222222"
  const token = createSendrVisitorAccessToken({ leadId, landingPageId: pageId })
  assert.ok(verifySendrVisitorToken(token, pageId))
  assert.equal(verifySendrVisitorToken(token, "wrong-page"), null)
  assert.equal(verifySendrVisitorToken("bad.token", pageId), null)

  const expired = createSendrVisitorAccessToken({
    leadId,
    landingPageId: pageId,
    expiresAt: new Date(Date.now() - 60_000),
  })
  assert.equal(verifySendrVisitorTokenResult(expired, pageId).ok, false)
  if (!verifySendrVisitorTokenResult(expired, pageId).ok) {
    assert.equal(verifySendrVisitorTokenResult(expired, pageId).reason, "expired_token")
  }
  console.log("  ✓ HMAC visitor token sign/verify + expiry")

  const variables = growthLeadRecordToSendrVariables({
    contactName: "Jane Doe",
    companyName: "Acme Corp",
    city: "Austin",
    state: "TX",
    metadata: {
      job_title: "VP Ops",
      meeting_link: "https://cal.example/jane",
      cta_label: "Talk to Jane",
      cta_href: "https://cal.example/jane-cta",
    },
  })
  assert.equal(variables.first_name, "Jane")
  assert.equal(variables.company_name, "Acme Corp")
  assert.equal(variables.meeting_link, "https://cal.example/jane")
  console.log("  ✓ Lead → variable map (first name, company, title, CTA, meeting link)")

  const context = { variables, fallbacks: {}, customVariables: {} }
  const { payload, missingVariables } = applySendrRuntimePersonalizationToPayload(basePayload(), context)
  assert.equal(payload.title, "Hello Jane")
  assert.match(String(payload.sections[0]?.content.headline), /Jane/)
  assert.match(String(payload.sections[0]?.content.headline), /Acme Corp/)
  assert.equal(payload.sections[1]?.content.label, "Talk to Jane")
  assert.equal(payload.sections[1]?.content.href, "https://cal.example/jane-cta")
  assert.equal(payload.booking?.meetingLink, "https://cal.example/jane")
  assert.ok(missingVariables.includes("owner_name"))
  console.log("  ✓ Runtime payload personalization + CTA/meeting overrides + missing var fallbacks")

  const anonymousPayload = applySendrRuntimePersonalizationToPayload(basePayload(), {
    variables: {},
    fallbacks: { first_name: "Friend" },
  }).payload
  assert.equal(
    renderSendrPersonalizedText("Hi {{first_name}}", {
      variables: {},
      fallbacks: { first_name: "Friend" },
    }),
    "Hi Friend",
  )
  assert.match(String(anonymousPayload.sections[0]?.content.headline), /Friend/)
  console.log("  ✓ Deterministic fallback when variables missing")

  assert.equal(
    buildSendrPagePublicLink("demo-page", "https://app.equipify.ai", { leadId }),
    `https://app.equipify.ai/videos/demo-page?leadId=${leadId}`,
  )
  assert.equal(
    buildSendrPagePublicLink("demo-page", "https://app.equipify.ai", { token }),
    `https://app.equipify.ai/videos/demo-page?token=${encodeURIComponent(token)}`,
  )
  console.log("  ✓ Public link builder supports leadId/token query params")

  const publicPageService = readSource("lib/growth/sendr/growth-sendr-public-page-service.ts")
  assert.match(publicPageService, /personalizeSendrPublicPagePayload/)
  assert.match(publicPageService, /renderContext/)
  console.log("  ✓ Anonymous default path preserved via optional renderContext")

  console.log("\nGS-SENDR-3C runtime visitor personalization certification passed.\n")
}

main()
